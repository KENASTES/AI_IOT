"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookHeart, Check, ChefHat, Flame,
  Heart, MapPin, Menu, Navigation, Plus, RotateCcw, Save, Sparkles, Star, Trash2,
  UserRound, WalletCards, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { rankFilteredFoods } from "@/lib/food-ranker";

type Screen = "home" | "eat" | "cook" | "memory";
type Profile = {
  name: string; age: string; height: string; weight: string;
  allergies: string; conditions: string; dislikes: string;
  monthlyBudget: number; dailyBudget: number;
};
type Scenario = {
  id: string; badge: string; name: string; shop: string; price: number;
  location: string; score: number; reason: string; image: string;
  tags: string[]; color: string; sourceUrl: string;
  scoreBreakdown: { label: string; weight: number; score: number }[];
  recommendationBatchId?: string;
  recommendationBatchSize?: number;
  recommendationProvider?: "gemini" | "database";
};
type AiFeedbackRoundStats = { rounds: number; successfulRounds: number; acceptanceRate: number | null };
type AiFeedbackStats = AiFeedbackRoundStats & { gemini: AiFeedbackRoundStats; database: AiFeedbackRoundStats };
type LiveStats = { storeCount: number; menuCount: number; memoryCount: number };
type MemoryItem = { _id: string; menuName: string; storeName: string; price: number; image: string; savedAt: string };

const emptyProfile: Profile = { name: "", age: "", height: "", weight: "", allergies: "", conditions: "", dislikes: "", monthlyBudget: 3200, dailyBudget: 95 };
const demoProfile: Profile = { ...emptyProfile, name: "มินท์", age: "20", height: "162", weight: "52", allergies: "ถั่วลิสง", conditions: "ไม่มี", dislikes: "ไม่กินเผ็ดมาก" };
const quiz = [
  { title: "มื้อนี้มีงบเท่าไหร่?", kicker: "1 · BUDGET", options: ["ไม่เกิน ฿50", "฿50–70", "ได้หมดถ้าอร่อย"] },
  { title: "มีเวลากี่นาที?", kicker: "2 · TIME", options: ["รีบมาก 10 นาที", "สบาย ๆ 20 นาที", "ไม่รีบ"] },
  { title: "หิวระดับไหน?", kicker: "3 · HUNGER", options: ["กินเล่น", "กำลังดี", "หิวจนตาลาย"] },
  { title: "วันนี้อยากได้ฟีลไหน?", kicker: "4 · MOOD", options: ["ฮีลใจ", "ของแซ่บ", "เบาแต่ไม่จืด"] },
  { title: "มื้อนี้เอาอะไรเป็นหลัก?", kicker: "5 · GOAL", options: ["อิ่มคุ้ม", "โปรตีน", "เซอร์ไพรส์ฉัน"] },
];

function budgetFromAnswer(answer: string, fallback: number): number {
  const range = answer.match(/฿\s*(\d+)\s*[–-]\s*฿?\s*(\d+)/u);
  if (range) return Number(range[2]);
  const single = answer.match(/฿\s*(\d+)/u);
  return single ? Number(single[1]) : fallback;
}
async function loadLiveStats(clientId: string): Promise<LiveStats> {
  const response = await fetch(`/api/food/stats?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load live statistics");
  return response.json() as Promise<LiveStats>;
}

async function saveFoodMemory(clientId: string, menuId: string): Promise<void> {
  const response = await fetch("/api/food/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, menuId }),
  });
  if (!response.ok) throw new Error("บันทึก Food Memory ไม่สำเร็จ");
}

async function deleteFoodMemory(clientId: string, memoryId: string): Promise<void> {
  const response = await fetch("/api/food/memory", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, memoryId }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || "ลบ Food Memory ไม่สำเร็จ");
  }
}

async function fetchAiFeedbackStats(): Promise<AiFeedbackStats> {
  const response = await fetch("/api/food/recommendation-feedback", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load AI feedback stats");
  return response.json() as Promise<AiFeedbackStats>;
}

async function saveAiRecommendationFeedback(clientId: string, scenario: Scenario, accepted: boolean): Promise<void> {
  if (!scenario.recommendationBatchId || !scenario.recommendationProvider) return;
  const response = await fetch("/api/food/recommendation-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      batchId: scenario.recommendationBatchId,
      batchLimit: 3,
      batchSize: scenario.recommendationBatchSize,
      menuId: scenario.id,
      accepted,
      provider: scenario.recommendationProvider,
      score: scenario.score,
      menuName: scenario.name,
    }),
  });
  if (!response.ok) throw new Error("บันทึกผลตอบรับไม่สำเร็จ");
}

async function fetchUserProfile(clientId: string): Promise<Profile | null> {
  const response = await fetch(`/api/food/profile?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("โหลดโปรไฟล์จากฐานข้อมูลไม่สำเร็จ");
  const result = await response.json() as { profile: Profile | null };
  return result.profile;
}

async function storeUserProfile(clientId: string, profile: Profile): Promise<void> {
  const response = await fetch("/api/food/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, profile }),
  });
  if (!response.ok) throw new Error("บันทึกโปรไฟล์ลงฐานข้อมูลไม่สำเร็จ");
}

function Logo({ onClick }: { onClick?: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-2.5 text-left" aria-label="ไปหน้า Home">
    <span className="grid size-10 rotate-[-8deg] place-items-center rounded-[14px] bg-[#ff5b4d] text-white shadow-[0_8px_24px_rgba(255,91,77,.32)]"><Flame className="size-6 fill-current" /></span>
    <span className="leading-none"><b className="block font-black tracking-[-.04em]">Food Match</b><span className="mt-1 block text-[10px] font-black tracking-[.16em] text-[#ff5b4d]">AI กินไรดี</span></span>
  </button>;
}

function Header({ screen, onNavigate, onProfile }: { screen: Screen; onNavigate: (s: Screen) => void; onProfile: () => void }) {
  const [open, setOpen] = useState(false);
  const links: { id: Screen; label: string }[] = [
    { id: "home", label: "Home" }, { id: "eat", label: "กินไรดี" },
    { id: "cook", label: "ทำเมนูไรกินดี" }, { id: "memory", label: "Food Memory" },
  ];
  return <header className="sticky top-0 z-40 border-b border-black/[.06] bg-[#f6f4ee]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-10">
      <Logo onClick={() => onNavigate("home")} />
      <nav className="hidden items-center gap-1 rounded-full border border-black/[.06] bg-white/70 p-1.5 shadow-sm md:flex">
        {links.map((link) => <button key={link.id} onClick={() => onNavigate(link.id)} className={`rounded-full px-5 py-2.5 text-sm font-black transition ${screen === link.id ? "bg-[#17151c] text-white" : "text-black/55 hover:bg-black/[.04] hover:text-black"}`}>{link.label}</button>)}
      </nav>
      <div className="flex items-center gap-2">
        <button onClick={onProfile} className="grid size-11 place-items-center rounded-full bg-[#ff5b4d] text-white shadow-[0_10px_24px_rgba(255,91,77,.24)]" aria-label="เปิด Dashboard ส่วนตัว"><UserRound className="size-5" /></button>
        <button onClick={() => setOpen((v) => !v)} className="grid size-11 place-items-center rounded-full bg-white md:hidden" aria-label="เปิดเมนู"><Menu className="size-5" /></button>
      </div>
    </div>
    {open && <nav className="grid gap-1 border-t border-black/[.06] bg-[#f6f4ee] p-3 md:hidden">{links.map((link) => <button key={link.id} onClick={() => { onNavigate(link.id); setOpen(false); }} className={`rounded-2xl px-4 py-3 text-left text-sm font-black ${screen === link.id ? "bg-[#17151c] text-white" : "bg-white"}`}>{link.label}</button>)}</nav>}
  </header>;
}

function ProfileDrawer({ open, value, onClose, onSave }: { open: boolean; value: Profile; onClose: () => void; onSave: (p: Profile) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  if (!open) return null;
  const update = (key: keyof Profile, next: string | number) => setDraft((p) => ({ ...p, [key]: next }));
  return <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onMouseDown={onClose}>
    <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-[#f6f4ee] p-5 shadow-2xl md:p-8" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between"><div><span className="text-xs font-black tracking-[.18em] text-[#ff5b4d]">MY FOOD PROFILE</span><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Dashboard ส่วนตัว</h2><p className="mt-2 text-sm font-semibold text-black/50">กรอกครั้งเดียว ระบบจะจำไว้ใช้กับทุกการ Match</p></div><button onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white"><X /></button></div>
      <div className="mt-7 grid gap-4 rounded-[28px] bg-white p-5 shadow-sm sm:grid-cols-2">
        <Field label="ชื่อ" value={draft.name} onChange={(v) => update("name", v)} placeholder="เช่น มินท์" wide />
        <Field label="อายุ" value={draft.age} onChange={(v) => update("age", v)} placeholder="20" type="number" />
        <Field label="ส่วนสูง (ซม.)" value={draft.height} onChange={(v) => update("height", v)} placeholder="162" type="number" />
        <Field label="น้ำหนัก (กก.)" value={draft.weight} onChange={(v) => update("weight", v)} placeholder="52" type="number" />
        <Field label="อาหารที่แพ้" value={draft.allergies} onChange={(v) => update("allergies", v)} placeholder="เช่น ถั่วลิสง, กุ้ง" wide />
        <Field label="โรคประจำตัว" value={draft.conditions} onChange={(v) => update("conditions", v)} placeholder="เช่น เบาหวาน หรือ ไม่มี" wide />
        <Field label="สิ่งที่ไม่กิน" value={draft.dislikes} onChange={(v) => update("dislikes", v)} placeholder="เช่น ไม่กินผักชี" wide />
        <div className="sm:col-span-2"><div className="mb-3 flex justify-between text-sm font-black"><span>งบอาหารต่อเดือน</span><b className="text-[#ff5b4d]">฿{draft.monthlyBudget.toLocaleString()}</b></div><Slider value={[draft.monthlyBudget]} min={1000} max={8000} step={100} onValueChange={([v]) => update("monthlyBudget", v)} /></div>
        <div className="sm:col-span-2"><div className="mb-3 flex justify-between text-sm font-black"><span>งบต่อวัน</span><b className="text-[#ff5b4d]">฿{draft.dailyBudget}</b></div><Slider value={[draft.dailyBudget]} min={40} max={300} step={5} onValueChange={([v]) => update("dailyBudget", v)} /></div>
      </div>
      <div className="mt-5 rounded-2xl bg-[#d7ff52] p-4 text-sm font-bold"><BadgeCheck className="mr-2 inline size-5" />ข้อมูลนี้ใช้เพื่อช่วยคัดตัวเลือก ไม่ใช่คำแนะนำทางการแพทย์</div>
      <Button disabled={!draft.name.trim()} onClick={() => onSave(draft)} className="mt-5 h-14 w-full rounded-2xl bg-[#17151c] text-base font-black text-white hover:bg-black"><Save className="mr-2 size-5" />บันทึกโปรไฟล์</Button>
      <button onClick={() => setDraft(demoProfile)} className="mt-4 text-sm font-bold text-black/45 underline underline-offset-4">เติมข้อมูลเดโมให้ฉัน</button>
    </aside>
  </div>;
/*
function Onboarding({ onDone, clientId }: { onDone: (profile: Profile) => void; clientId: string }) {
  const [profile, setProfile] = useState<Profile>({ name: "", allergies: "", dislikes: "", monthlyBudget: 3000, dailyBudget: 100 });
  const [stats, setStats] = useState<LiveStats | null>(null);
  useEffect(() => { if (clientId) loadLiveStats(clientId).then(setStats).catch(() => setStats(null)); }, [clientId]);
  const update = (key: keyof Profile, value: string | number) => setProfile((p) => ({ ...p, [key]: value }));
  return <main className="min-h-dvh overflow-hidden bg-[#f6f4ee] text-[#17151c]">
    <div className="pointer-events-none fixed -right-20 -top-20 size-[420px] rounded-full bg-[#ff5b4d]/15 blur-3xl" /><div className="pointer-events-none fixed -bottom-24 -left-16 size-[380px] rounded-full bg-[#d7ff52]/25 blur-3xl" />
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-10"><Logo /><span className="rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm font-bold backdrop-blur">KMITL · DEMO</span></header>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-10 pt-4 md:grid-cols-[1.05fr_.95fr] md:px-10 md:pt-10">
      <div className="relative z-10 max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-[#17151c] px-4 py-2 text-sm font-bold text-white"><Sparkles className="size-4 text-[#d7ff52]" /> บอกเราอีกนิด แล้วมื้อนี้จะง่ายขึ้น</span>
        <h1 className="mt-6 text-[clamp(3rem,7vw,6.5rem)] font-black leading-[.87] tracking-[-.07em]">มื้อนี้<br />ให้เรา <span className="text-[#ff5b4d]">Match</span></h1>
        <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-black/60">Food Match ใช้งบ ข้อจำกัด และ Food Memory เพื่อคัดมื้อที่ใช่ ไม่ต้องเลื่อนหาร้านเป็นสิบ ๆ ร้าน</p>
        <div className="mt-8 grid gap-5 rounded-[30px] border border-black/10 bg-white/85 p-5 shadow-[0_30px_80px_rgba(35,24,16,.10)] backdrop-blur md:grid-cols-2 md:p-7">
          <label className="md:col-span-2"><span className="mb-2 block text-sm font-black">ชื่อที่อยากให้เราเรียก</span><Input value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="เช่น มินท์" className="h-13 rounded-2xl border-black/10 bg-[#f6f4ee] px-4 text-base font-semibold" /></label>
          <label><span className="mb-2 block text-sm font-black">อาหารที่แพ้</span><Input value={profile.allergies} onChange={(e) => update("allergies", e.target.value)} placeholder="เช่น ถั่วลิสง, กุ้ง" className="h-13 rounded-2xl border-black/10 bg-[#f6f4ee] px-4 text-base" /></label>
          <label><span className="mb-2 block text-sm font-black">สิ่งที่ไม่กิน</span><Input value={profile.dislikes} onChange={(e) => update("dislikes", e.target.value)} placeholder="เช่น ไม่เผ็ด, ไม่ผักชี" className="h-13 rounded-2xl border-black/10 bg-[#f6f4ee] px-4 text-base" /></label>
          <div><div className="mb-3 flex items-end justify-between"><span className="text-sm font-black">งบอาหารต่อเดือน</span><b className="text-[#ff5b4d]">฿{profile.monthlyBudget.toLocaleString()}</b></div><Slider value={[profile.monthlyBudget]} min={1000} max={8000} step={100} onValueChange={([v]) => update("monthlyBudget", v)} className="py-2" /></div>
          <div><div className="mb-3 flex items-end justify-between"><span className="text-sm font-black">งบต่อวัน</span><b className="text-[#ff5b4d]">฿{profile.dailyBudget}</b></div><Slider value={[profile.dailyBudget]} min={40} max={300} step={5} onValueChange={([v]) => update("dailyBudget", v)} className="py-2" /></div>
          <Button disabled={!profile.name.trim()} onClick={() => onDone(profile)} className="h-14 rounded-2xl bg-[#ff5b4d] text-base font-black text-white shadow-[0_14px_30px_rgba(255,91,77,.28)] hover:bg-[#ee493c] md:col-span-2">เริ่ม Match มื้อแรก <Heart className="ml-1 size-5 fill-current" /></Button>
          <button type="button" onClick={() => setProfile(demoProfile)} className="text-left text-sm font-bold text-black/45 underline decoration-dotted underline-offset-4 md:col-span-2">เติมข้อมูลเดโมให้ฉัน</button>
        </div>
      </div>
      <div className="relative hidden min-h-[700px] md:block"><div className="absolute left-12 top-4 h-[620px] w-[390px] rotate-[7deg] overflow-hidden rounded-[46px] bg-[#17151c] p-3 shadow-[0_55px_100px_rgba(24,18,15,.25)]"><img src="/food-hero.jpg" alt="คนกำลังรับประทานเบอร์เกอร์" className="h-full w-full rounded-[36px] object-cover" /><div className="absolute inset-x-3 bottom-3 rounded-b-[36px] bg-gradient-to-t from-black via-black/70 to-transparent px-7 pb-8 pt-32 text-white"><span className="rounded-full bg-[#d7ff52] px-3 py-1 text-xs font-black text-black">เมนูจากฐานข้อมูล</span><div className="mt-3 text-3xl font-black">อิ่มคุ้ม ถูกใจงบ</div><p className="mt-1 text-white/70">{stats ? `มี ${stats.menuCount} เมนูจาก ${stats.storeCount} ร้าน` : "กำลังโหลดข้อมูลเมนู…"}</p></div></div><div className="absolute bottom-10 right-0 w-[260px] -rotate-[8deg] rounded-[28px] bg-[#d7ff52] p-6 shadow-xl"><div className="text-xs font-black tracking-[.18em]">FOOD MEMORY</div><div className="mt-3 text-5xl font-black tracking-[-.07em]">{stats?.memoryCount ?? "—"}</div><p className="mt-1 font-bold">มื้อที่บันทึกในอุปกรณ์นี้</p></div></div>
    </section>
  </main>;
}

function Quiz({ onDone, onBack }: { onDone: (answers: string[]) => void; onBack: () => void }) {
  const [step, setStep] = useState(0); const [selected, setSelected] = useState<string[]>([]); const [remaining, setRemaining] = useState(5);
  const choose = useCallback((choice: string) => { const answers = [...selected, choice]; setSelected(answers); if (step === quiz.length - 1) onDone(answers); else setStep((s) => s + 1); }, [onDone, selected, step]);
  useEffect(() => { const timer = window.setInterval(() => setRemaining((v) => Math.max(0, v - 1)), 1000); return () => window.clearInterval(timer); }, []);
  return <main className="grid min-h-dvh place-items-center overflow-hidden bg-[#17151c] px-5 py-8 text-white"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,91,77,.28),transparent_38%)]" /><div className="relative w-full max-w-2xl">
    <div className="mb-8 flex items-center justify-between"><button onClick={onBack} aria-label="ย้อนกลับ" className="grid size-12 place-items-center rounded-full border border-white/15 bg-white/5"><ArrowLeft /></button><Logo dark /><div className="grid size-12 place-items-center rounded-full bg-[#d7ff52] text-lg font-black text-black">{remaining}</div></div>
    <div className="mb-9 flex gap-2">{quiz.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full transition-colors ${i <= step ? "bg-[#ff5b4d]" : "bg-white/12"}`} />)}</div>
    <div className="rounded-[36px] border border-white/10 bg-white/[.06] p-6 shadow-2xl backdrop-blur md:p-10"><div className="text-sm font-black tracking-[.18em] text-[#d7ff52]">{quiz[step].kicker}</div><h1 className="mt-3 text-4xl font-black leading-tight tracking-[-.04em] md:text-6xl">{quiz[step].title}</h1><div className="mt-9 grid gap-3">{quiz[step].options.map((option, i) => <button key={option} onClick={() => choose(option)} className="group flex min-h-16 items-center justify-between rounded-2xl border border-white/10 bg-white/[.05] px-5 text-left text-lg font-black transition hover:-translate-y-0.5 hover:border-[#ff5b4d] hover:bg-[#ff5b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7ff52]"><span>{option}</span><span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm group-hover:bg-black/15">{i + 1}</span></button>)}</div><div className="mt-8 flex items-center justify-between text-sm font-bold text-white/45"><span>เลือกไปแล้ว {selected.length} ข้อ</span><span>เร็วแค่ 5 วินาที</span></div></div>
  </div></main>;
*/
}

function Field({ label, value, onChange, placeholder, wide, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean; type?: string }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-black">{label}</span><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-12 rounded-2xl border-black/10 bg-[#f6f4ee] px-4" /></label>;
}

function HomePage({ go, profile, clientId }: { go: (s: Screen) => void; profile: Profile; clientId: string }) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  useEffect(() => { if (clientId) loadLiveStats(clientId).then(setStats).catch(() => setStats(null)); }, [clientId]);
  return <>
    <section className="relative overflow-hidden px-5 pb-16 pt-8 md:px-10 md:pb-24 md:pt-12"><div className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-[#ff5b4d]/15 blur-3xl" /><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.04fr_.96fr] lg:items-center">
      <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full bg-[#17151c] px-4 py-2 text-sm font-black text-white"><Sparkles className="size-4 text-[#d7ff52]" /> AI ผู้ช่วยเรื่องมื้ออาหารของคุณ</span><h1 className="mt-6 max-w-3xl text-[clamp(3.5rem,7vw,7.2rem)] font-black leading-[.84] tracking-[-.075em]">วันนี้<br /><span className="text-[#ff5b4d]">กินอะไรดี?</span></h1><p className="mt-7 max-w-xl text-lg font-semibold leading-8 text-black/55">Food Match ช่วยทั้งวันที่อยากออกไปกิน และวันที่อยากเปิดตู้เย็นทำเอง โดยใช้เวลา งบ วัตถุดิบ และข้อมูลส่วนตัวที่บันทึกไว้</p><div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => go("eat")} className="h-14 rounded-full bg-[#ff5b4d] px-7 text-base font-black text-white hover:bg-[#ec493d]">เริ่มหาเมนูใกล้ฉัน <ArrowRight className="ml-2 size-5" /></Button><Button onClick={() => go("cook")} variant="outline" className="h-14 rounded-full border-black/15 bg-white px-7 text-base font-black">เปิดตู้เย็นทำเอง <ChefHat className="ml-2 size-5" /></Button></div>{profile.name && <p className="mt-5 text-sm font-bold text-black/45">สวัสดี {profile.name} · โปรไฟล์พร้อมสำหรับการวิเคราะห์แล้ว</p>}</div>
      <div className="relative min-h-[570px]"><div className="absolute right-0 top-0 h-[520px] w-[84%] overflow-hidden rounded-[48px] bg-[#17151c] shadow-[0_45px_90px_rgba(24,18,15,.22)]"><img src="/food-hero.jpg" alt="คนกำลังกินอาหาร" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7 text-white"><span className="rounded-full bg-[#d7ff52] px-3 py-1 text-xs font-black text-black">94% MATCH</span><p className="mt-3 text-3xl font-black">มื้อที่ใช่ ไม่ต้องคิดนาน</p></div></div><div className="absolute bottom-0 left-0 w-[270px] -rotate-3 rounded-[30px] bg-[#d7ff52] p-6 shadow-2xl"><ChefHat className="size-8" /><b className="mt-4 block text-2xl leading-tight">มีไข่กับข้าว?<br />ได้ 2 เมนูพอดี</b><span className="mt-3 block text-sm font-bold text-black/55">Cook Match · 15 นาที</span></div></div>
    </div></section>
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 pb-10 md:grid-cols-3 md:px-10"><div className="rounded-2xl bg-white p-4"><b className="block text-2xl">{stats ? stats.menuCount : "—"}</b><span className="text-sm font-semibold text-black/45">เมนูทั้งหมด</span></div><div className="rounded-2xl bg-white p-4"><b className="block text-2xl">{stats ? stats.storeCount : "—"}</b><span className="text-sm font-semibold text-black/45">ร้านที่เปิดใช้งาน</span></div><div className="col-span-2 rounded-2xl bg-white p-4 md:col-span-1"><b className="block text-2xl">{stats ? stats.memoryCount : "—"}</b><span className="text-sm font-semibold text-black/45">Food Memory ของคุณ</span></div></div>
    <section className="bg-[#17151c] px-5 py-16 text-white md:px-10 md:py-24"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-sm font-black tracking-[.18em] text-[#d7ff52]">2 MODES · 1 PROFILE</span><h2 className="mt-3 text-4xl font-black tracking-[-.05em] md:text-6xl">เลือกตามชีวิตจริงของคุณ</h2></div><p className="max-w-md font-semibold leading-7 text-white/55">โปรไฟล์เดียวช่วยคัดข้อจำกัด งบ และความชอบให้ทั้งสองโหมด</p></div><div className="mt-10 grid gap-5 md:grid-cols-2"><ModeCard icon={Navigation} number="01" title="กินไรดี" text="ตอบคำถาม 5 วินาที แล้วปัดเลือก Food Scenario 2 ใบจากร้านใกล้คุณ" image="/food-ramen.jpg" color="#ff5b4d" onClick={() => go("eat")} /><ModeCard icon={ChefHat} number="02" title="ทำเมนูไรกินดี" text="เลือกวัตถุดิบ เวลา และอุปกรณ์ แล้วให้ AI จับคู่เป็นเมนูที่ทำได้จริง" image="/food-noodles.jpg" color="#d7ff52" onClick={() => go("cook")} /></div></div></section>
    <section className="px-5 py-16 md:px-10 md:py-24"><div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[.8fr_1.2fr]"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">WHY FOOD MATCH</span><h2 className="mt-3 text-4xl font-black leading-tight tracking-[-.05em] md:text-6xl">ไม่สุ่มมั่ว<br />แต่สุ่มแบบมีเหตุผล</h2></div><div className="grid gap-4 sm:grid-cols-2"><Feature icon={BadgeCheck} title="ปลอดภัยก่อน" text="คัดอาหารที่แพ้และข้อจำกัดจาก Dashboard" /><Feature icon={WalletCards} title="เข้าใจงบ" text="จัดอันดับเมนูให้เหมาะกับงบที่เหลือ" /><Feature icon={MapPin} title="ใกล้จริง" text="เดโมร้านในโรงอาหารวิศวะ ลาดกระบัง" /><Feature icon={BookHeart} title="จำสิ่งที่ชอบ" text="Food Memory ทำให้ผลลัพธ์แม่นขึ้นทุกมื้อ" /></div></div></section>
  </>;
}

function ModeCard({ icon: Icon, number, title, text, image, color, onClick }: { icon: typeof ChefHat; number: string; title: string; text: string; image: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className="group overflow-hidden rounded-[34px] bg-white text-left text-[#17151c] transition hover:-translate-y-1"><div className="relative h-64 overflow-hidden"><img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-5 top-5 rounded-full px-4 py-2 text-sm font-black" style={{ backgroundColor: color }}>{number}</span></div><div className="p-6 md:p-8"><div className="flex items-center justify-between"><Icon className="size-8" /><ArrowRight className="transition group-hover:translate-x-1" /></div><h3 className="mt-5 text-3xl font-black">{title}</h3><p className="mt-2 max-w-lg font-semibold leading-7 text-black/50">{text}</p></div></button>;
}

function Feature({ icon: Icon, title, text }: { icon: typeof BadgeCheck; title: string; text: string }) {
  return <div className="rounded-[26px] bg-white p-6 shadow-[0_16px_45px_rgba(30,24,20,.07)]"><span className="grid size-12 place-items-center rounded-2xl bg-[#d7ff52]"><Icon /></span><b className="mt-5 block text-xl">{title}</b><p className="mt-2 text-sm font-semibold leading-6 text-black/50">{text}</p></div>;
}

/* function LegacyEatPage({ profile, needProfile, addMeal }: { profile: Profile; needProfile: () => void; addMeal: (s: Scenario) => void }) {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro"); const [step, setStep] = useState(0); const start = () => profile.name ? setPhase("quiz") : needProfile();
  if (phase === "quiz") return <section className="mx-auto min-h-[calc(100dvh-76px)] max-w-3xl px-5 py-10"><button onClick={() => setPhase("intro")} className="flex items-center gap-2 text-sm font-black text-black/45"><ArrowLeft className="size-4" />กลับ</button><div className="mt-8 flex gap-2">{quiz.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-[#ff5b4d]" : "bg-black/10"}`} />)}</div><div className="mt-7 rounded-[38px] bg-[#17151c] p-7 text-white shadow-2xl md:p-11"><span className="text-sm font-black tracking-[.18em] text-[#d7ff52]">{quiz[step].kicker}</span><h1 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-6xl">{quiz[step].title}</h1><div className="mt-9 grid gap-3">{quiz[step].options.map((option, i) => <button key={option} onClick={() => step === quiz.length - 1 ? setPhase("result") : setStep((v) => v + 1)} className="flex min-h-16 items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] px-5 text-left text-lg font-black transition hover:bg-[#ff5b4d]"><span>{option}</span><span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm">{i + 1}</span></button>)}</div></div></section>;
  if (phase === "result") return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[.7fr_1.3fr] lg:px-10"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">2 FOOD SCENARIOS</span><h1 className="mt-3 text-5xl font-black leading-[.92] tracking-[-.06em] md:text-7xl">เลือกด้วย<br />ความรู้สึก.<br /><span className="text-[#ff5b4d]">มั่นใจด้วย AI.</span></h1><div className="mt-7 rounded-[26px] bg-white p-5 shadow-sm"><b>ใช้โปรไฟล์ของ {profile.name}</b><p className="mt-2 text-sm font-semibold leading-6 text-black/50">ระบบคัดข้อแพ้ สิ่งที่ไม่กิน งบ ฿{profile.dailyBudget} และระยะเดินให้แล้ว จึงไม่ต้องกรอกซ้ำในหน้านี้</p></div><button onClick={() => { setStep(0); setPhase("quiz"); }} className="mt-5 flex items-center gap-2 text-sm font-black text-black/45"><RotateCcw className="size-4" />ตอบใหม่อีกครั้ง</button></div><SwipeDeck onPicked={addMeal} /></section>;
  return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#ff5b4d]/10 px-4 py-2 text-sm font-black text-[#ff5b4d]"><Zap className="size-4 fill-current" /> SWIPE 5 วินาที</span><h1 className="mt-6 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-8xl">ออกไปกิน<br /><span className="text-[#ff5b4d]">อะไรดี?</span></h1><p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-black/55">ตอบแค่เรื่องมื้อนี้: งบ เวลา ความหิว และมู้ด ส่วนข้อมูลสุขภาพและอาหารที่ไม่กิน เราดึงจาก Dashboard ให้อัตโนมัติ</p><Button onClick={start} className="mt-8 h-14 rounded-full bg-[#17151c] px-8 text-base font-black text-white hover:bg-black">เริ่มหา Food Match <ArrowRight className="ml-2" /></Button></div><div className="relative min-h-[560px]"><div className="absolute right-6 top-0 h-[500px] w-[76%] rotate-3 overflow-hidden rounded-[42px] bg-[#17151c] p-3 shadow-2xl"><img src="/food-ramen.jpg" alt="ราเมน" className="h-full w-full rounded-[32px] object-cover" /></div><div className="absolute bottom-0 left-0 w-[260px] -rotate-6 rounded-[28px] bg-[#d7ff52] p-6 shadow-xl"><b className="text-5xl tracking-[-.06em]">94%</b><span className="mt-1 block font-black">เหมาะกับมื้อนี้</span><p className="mt-3 text-sm font-bold text-black/50">฿65 · เดิน 4 นาที</p></div></div></section>;
} */

/* function LegacySwipeDeck({ onPicked }: { onPicked: (s: Scenario) => void }) {
  const [index, setIndex] = useState(0); const [dragX, setDragX] = useState(0); const [dragging, setDragging] = useState(false); const startX = useRef(0); const card = scenarios[index % scenarios.length]; const next = scenarios[(index + 1) % scenarios.length];
  const choose = (liked: boolean) => { if (liked) onPicked(card); setIndex((v) => v + 1); setDragX(0); };
  return <div className="relative mx-auto w-full max-w-[440px]"><div className="absolute inset-x-5 top-5 h-[610px] rotate-3 overflow-hidden rounded-[38px] bg-white opacity-60"><img src={next.image} alt="" className="h-full w-full object-cover opacity-35" /></div><article onPointerDown={(e) => { startX.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => dragging && setDragX(e.clientX - startX.current)} onPointerUp={() => { setDragging(false); if (Math.abs(dragX) > 100) choose(dragX > 0); else setDragX(0); }} className="relative h-[610px] touch-none overflow-hidden rounded-[38px] bg-[#17151c] shadow-[0_36px_80px_rgba(22,18,17,.22)]" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, transition: dragging ? "none" : "transform .3s" }}><img src={card.image} alt={card.name} className="h-full w-full select-none object-cover" draggable={false} /><div className="absolute inset-0 bg-gradient-to-t from-[#17151c] via-black/15 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7 text-white"><div className="flex justify-between"><span className="rounded-full px-3 py-1 text-sm font-black text-black" style={{ backgroundColor: card.color }}>{card.score}% MATCH</span><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{card.badge}</span></div><h2 className="mt-4 text-3xl font-black leading-tight">{card.name}</h2><p className="mt-2 flex items-center gap-1.5 font-bold text-white/75"><MapPin className="size-4" />{card.shop}</p><p className="mt-4 text-sm font-semibold leading-6 text-white/65">{card.reason}</p><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-5 text-center"><Stat value={`฿${card.price}`} label="ราคา" /><Stat value={card.walk} label="ระยะเดิน" /><Stat value={card.wait} label="เวลารอ" /></div></div></article><div className="relative mt-7 flex justify-center gap-5"><button onClick={() => choose(false)} className="grid size-16 place-items-center rounded-full bg-white text-[#ff5b4d] shadow-xl"><X className="size-8" /></button><button onClick={() => choose(true)} className="grid size-16 place-items-center rounded-full bg-[#d7ff52] shadow-xl"><Heart className="size-8 fill-current" /></button></div><p className="mt-4 text-center text-sm font-bold text-black/40">ลากซ้ายเพื่อผ่าน · ลากขวาเพื่อ Match</p></div>;
}

function Stat({ value, label }: { value: string }) { return <div><b className="block">{value}</b></div>; } */

/* function LegacyCookPage({ profile, needProfile }: { profile: Profile; needProfile: () => void }) {
  const options = ["ไข่", "ข้าว", "ไก่", "หมู", "เส้น", "ผัก", "เต้าหู้", "ชีส"]; const [selected, setSelected] = useState<string[]>(["ไข่", "ข้าว"]); const [custom, setCustom] = useState(""); const [time, setTime] = useState("15 นาที"); const [result, setResult] = useState(false);
  const toggle = (item: string) => setSelected((v) => v.includes(item) ? v.filter((x) => x !== item) : [...v, item]); const generate = () => { if (!profile.name) return needProfile(); if (custom.trim()) setSelected((v) => [...new Set([...v, custom.trim()])]); setResult(true); };
  return <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14"><div className="grid gap-9 lg:grid-cols-[.8fr_1.2fr]"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#d7ff52] px-4 py-2 text-sm font-black"><ChefHat className="size-4" /> COOK MATCH</span><h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-7xl">มีอะไรอยู่<br />ในครัวบ้าง?</h1><p className="mt-5 max-w-lg font-semibold leading-7 text-black/55">เลือกวัตถุดิบและเวลาที่มี ระบบจะเสนอ 2 เมนูที่ทำได้จริง พร้อมเหตุผลและขั้นตอนย่อ</p><div className="mt-8 overflow-hidden rounded-[32px]"><img src="/food-noodles.jpg" alt="อาหารทำเอง" className="h-72 w-full object-cover" /></div></div><div className="rounded-[34px] bg-white p-6 shadow-[0_25px_70px_rgba(30,24,20,.09)] md:p-9"><label className="text-sm font-black">1. เลือกวัตถุดิบที่มี</label><div className="mt-4 flex flex-wrap gap-2">{options.map((item) => <button key={item} onClick={() => toggle(item)} className={`rounded-full border px-4 py-2 text-sm font-black transition ${selected.includes(item) ? "border-[#17151c] bg-[#17151c] text-white" : "border-black/10 bg-[#f6f4ee]"}`}>{selected.includes(item) ? <Check className="mr-1 inline size-4" /> : <Plus className="mr-1 inline size-4" />}{item}</button>)}</div><div className="mt-4 flex gap-2"><Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="เพิ่มวัตถุดิบ เช่น มะเขือเทศ" className="h-12 rounded-2xl border-black/10 bg-[#f6f4ee]" /><button onClick={() => { if (custom.trim()) { setSelected((v) => [...new Set([...v, custom.trim()])]); setCustom(""); } }} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#d7ff52]"><Plus /></button></div><label className="mt-7 block text-sm font-black">2. มีเวลาทำเท่าไหร่</label><div className="mt-3 grid grid-cols-3 gap-2">{["15 นาที", "30 นาที", "ไม่รีบ"].map((item) => <button key={item} onClick={() => setTime(item)} className={`rounded-2xl px-3 py-3 text-sm font-black ${time === item ? "bg-[#ff5b4d] text-white" : "bg-[#f6f4ee]"}`}>{item}</button>)}</div><div className="mt-6 rounded-2xl bg-[#f6f4ee] p-4 text-sm font-semibold leading-6 text-black/55"><Sparkles className="mr-2 inline size-5 text-[#ff5b4d]" />จะคัดข้อแพ้และสิ่งที่ไม่กินจาก Dashboard ของ {profile.name || "คุณ"} ให้อัตโนมัติ</div><Button onClick={generate} disabled={!selected.length} className="mt-5 h-14 w-full rounded-2xl bg-[#17151c] text-base font-black text-white hover:bg-black">คิดเมนูจากของที่มี <Sparkles className="ml-2 size-5" /></Button></div></div>{result && <div className="mt-12"><div className="flex items-end justify-between gap-4"><div><span className="text-sm font-black tracking-[.16em] text-[#ff5b4d]">2 RECIPE SCENARIOS</span><h2 className="mt-2 text-4xl font-black tracking-[-.05em] md:text-6xl">วันนี้ทำเมนูนี้ได้เลย</h2></div><button onClick={() => setResult(false)} className="hidden items-center gap-2 text-sm font-black text-black/45 md:flex"><RotateCcw className="size-4" />เลือกใหม่</button></div><div className="mt-7 grid gap-5 md:grid-cols-2">{recipes.map((recipe, i) => <article key={recipe.name} className="overflow-hidden rounded-[32px] bg-[#17151c] text-white"><div className="relative h-64"><img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" /><span className="absolute left-5 top-5 rounded-full px-4 py-2 text-sm font-black text-black" style={{ background: i ? "#ffb62e" : "#d7ff52" }}>{i ? "88" : "95"}% MATCH</span></div><div className="p-6"><h3 className="text-2xl font-black">{recipe.name}</h3><div className="mt-3 flex gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{recipe.time}</span><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">ทำง่าย</span></div><p className="mt-4 text-sm font-semibold leading-6 text-white/60">{recipe.fit}</p><div className="mt-5 flex flex-wrap gap-2">{recipe.ingredients.map((x) => <span key={x} className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold">{x}</span>)}</div><button className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 font-black text-[#17151c]">ดูวิธีทำแบบย่อ <ArrowRight /></button></div></article>)}</div></div>}</section>;
} */

/* function LegacyMemoryPage({ profile }: { profile: Profile }) {
  const spent = 1340; const left = Math.max(profile.monthlyBudget - spent, 0); const pct = Math.min(100, Math.round((spent / profile.monthlyBudget) * 100));
  return <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">FOOD MEMORY</span><h1 className="mt-2 text-5xl font-black tracking-[-.06em] md:text-7xl">ยิ่งกิน ยิ่งรู้ใจ</h1></div><div className="rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white">เรียนรู้แล้ว 12 มื้อ</div></div><div className="mt-8 grid gap-5 md:grid-cols-3">{memoryItems.map((item, i) => <article key={item.name} className="group overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_50px_rgba(30,24,20,.08)]"><div className="relative h-52 overflow-hidden rounded-[20px]"><img src={item.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-black">{i === 0 ? "ล่าสุด" : "ชอบ"}</span></div><div className="p-3"><h2 className="text-xl font-black">{item.name}</h2><p className="mt-1 text-sm font-semibold text-black/45">{item.date}</p><div className="mt-4 flex justify-between"><b>฿{item.price}</b><Heart className="size-5 fill-[#ff5b4d] text-[#ff5b4d]" /></div></div></article>)}</div><div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-[32px] bg-[#d7ff52] p-7 md:p-10"><div className="flex justify-between"><b>SMART BUDGET · เดือนนี้</b><WalletCards /></div><span className="mt-8 block text-sm font-black">คงเหลือ</span><div className="mt-1 text-6xl font-black tracking-[-.07em] md:text-8xl">฿{left.toLocaleString()}</div><div className="mt-8 h-4 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#17151c]" style={{ width: `${pct}%` }} /></div><div className="mt-3 flex justify-between text-sm font-black"><span>ใช้แล้ว ฿{spent.toLocaleString()}</span><span>{pct}% ของงบ</span></div></div><div className="rounded-[32px] bg-[#ff5b4d] p-7 text-white md:p-9"><Sparkles className="size-8" /><h2 className="mt-6 text-3xl font-black">AI Insight ของ {profile.name || "คุณ"}</h2><p className="mt-3 font-semibold leading-7 text-white/75">มักเลือกอาหารเส้นช่วงกลางวัน และชอบเมนูที่รอไม่เกิน 8 นาที ระบบจะดันตัวเลือกแบบนี้ขึ้นก่อน</p><div className="mt-8 rounded-2xl bg-white/15 p-4"><span className="text-sm font-bold text-white/65">งบแนะนำวันนี้</span><b className="mt-1 block text-3xl">฿{profile.dailyBudget}</b></div></div></div></section>;
} */

type CookRecipe = {
  name: string;
  summary: string;
  minutes: number;
  ingredients: string[];
  pantryIngredients: string[];
  steps: string[];
};

type CookHistory = {
  savedRecipes: CookRecipe[];
  recipeRatings: Record<string, number>;
  recentRecipeNames: string[];
};

async function fetchCookHistory(clientId: string): Promise<CookHistory | null> {
  const response = await fetch(`/api/food/cook-history?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("โหลดประวัติทำอาหารไม่สำเร็จ");
  const result = await response.json() as { cookHistory: CookHistory | null };
  return result.cookHistory;
}

async function storeCookHistory(clientId: string, cookHistory: CookHistory): Promise<void> {
  const response = await fetch("/api/food/cook-history", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, cookHistory }),
  });
  if (!response.ok) throw new Error("บันทึกประวัติทำอาหารลงฐานข้อมูลไม่สำเร็จ");
}

type PendingRecipeResult = { original: string[]; normalized: string[]; recipes: CookRecipe[] };

function CookPage({ profile, needProfile, clientId }: { profile: Profile; needProfile: () => void; clientId: string }) {
  const options = ["ไข่", "ข้าว", "ไก่", "หมู", "เส้น", "ผัก", "เต้าหู้", "ชีส"];
  const [selected, setSelected] = useState<string[]>(["ไข่", "ข้าว"]);
  const [custom, setCustom] = useState("");
  const [time, setTime] = useState("15 นาที");
  const [recipes, setRecipes] = useState<CookRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRecipe, setActiveRecipe] = useState<CookRecipe | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<CookRecipe | null>(null);
  const [cookingStep, setCookingStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [completedRecipe, setCompletedRecipe] = useState("");
  const [pendingResult, setPendingResult] = useState<PendingRecipeResult | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<CookRecipe[]>([]);
  const [recipeRatings, setRecipeRatings] = useState<Record<string, number>>({});
  const [recentRecipeNames, setRecentRecipeNames] = useState<string[]>([]);
  const recipeMemoryKey = `food-match-cook-recipes:${clientId || "anonymous"}`;
  const recipeRatingKey = `food-match-cook-ratings:${clientId || "anonymous"}`;
  const recentRecipeKey = `food-match-cook-recent:${clientId || "anonymous"}`;

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    let localHistory: CookHistory = { savedRecipes: [], recipeRatings: {}, recentRecipeNames: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(recipeMemoryKey) || "[]");
      if (Array.isArray(saved)) localHistory.savedRecipes = saved.filter((recipe): recipe is CookRecipe => recipe && typeof recipe.name === "string" && Array.isArray(recipe.ingredients) && Array.isArray(recipe.steps)).slice(0, 20);
      const ratings = JSON.parse(localStorage.getItem(recipeRatingKey) || "{}");
      if (ratings && typeof ratings === "object" && !Array.isArray(ratings)) localHistory.recipeRatings = ratings as Record<string, number>;
      const recent = JSON.parse(localStorage.getItem(recentRecipeKey) || "[]");
      if (Array.isArray(recent)) localHistory.recentRecipeNames = recent.filter((name): name is string => typeof name === "string").slice(0, 20);
    } catch { /* Ignore invalid browser storage and keep recipe generation available. */ }
    setSavedRecipes(localHistory.savedRecipes);
    setRecipeRatings(localHistory.recipeRatings);
    setRecentRecipeNames(localHistory.recentRecipeNames);
    fetchCookHistory(clientId).then(async (stored) => {
      if (!active) return;
      if (!stored) {
        if (localHistory.savedRecipes.length || Object.keys(localHistory.recipeRatings).length || localHistory.recentRecipeNames.length) {
          try { await storeCookHistory(clientId, localHistory); } catch { /* Keep the browser copy if MongoDB is unavailable. */ }
        }
        return;
      }
      setSavedRecipes(stored.savedRecipes);
      setRecipeRatings(stored.recipeRatings);
      setRecentRecipeNames(stored.recentRecipeNames);
      try {
        localStorage.setItem(recipeMemoryKey, JSON.stringify(stored.savedRecipes));
        localStorage.setItem(recipeRatingKey, JSON.stringify(stored.recipeRatings));
        localStorage.setItem(recentRecipeKey, JSON.stringify(stored.recentRecipeNames));
      } catch { /* MongoDB remains the source of truth. */ }
    }).catch(() => { /* Use the local cache if API/DB is temporarily unavailable. */ });
    return () => { active = false; };
  }, [clientId, recipeMemoryKey, recipeRatingKey, recentRecipeKey]);
  const toggle = (item: string) => setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      setTimerSeconds((seconds) => Math.max(0, seconds - 1));
      if (timerSeconds === 1) setTimerRunning(false);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [timerRunning, timerSeconds]);

  const startCooking = (recipe: CookRecipe) => {
    setActiveRecipe(null);
    setCookingRecipe(recipe);
    setCookingStep(0);
    setTimerSeconds(recipe.minutes * 60);
    setTimerRunning(false);
    setCompletedRecipe("");
  };
  const closeCooking = () => { setTimerRunning(false); setCookingRecipe(null); };
  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;
  const formatIngredient = (value: string) => {
    const formatted = value.normalize("NFC").replace(/\s+/gu, " ").trim();
    return options.find((item) => item.toLocaleLowerCase() === formatted.toLocaleLowerCase()) ?? formatted;
  };
  const uniqueIngredients = (items: string[]) => [...new Map(items.map(formatIngredient).filter(Boolean).map((item) => [item.toLocaleLowerCase(), item])).values()];
  const addCustomIngredient = () => {
    const ingredient = formatIngredient(custom);
    if (!ingredient) return;
    const alreadySelected = selected.some((item) => item.toLocaleLowerCase() === ingredient.toLocaleLowerCase());
    if (!alreadySelected && selected.length >= 15) { setError("เพิ่มวัตถุดิบได้สูงสุด 15 อย่าง"); return; }
    setSelected(uniqueIngredients([...selected, ingredient]));
    setCustom("");
    setError("");
  };

  const generate = async () => {
    if (!profile.name) { needProfile(); return; }
    const ingredients = uniqueIngredients([...selected, custom]);
    if (!ingredients.length) { setError("เลือกหรือเพิ่มวัตถุดิบอย่างน้อย 1 อย่างก่อน"); return; }
    if (ingredients.length > 15) { setError("เลือกวัตถุดิบได้สูงสุด 15 อย่าง"); return; }
    setSelected(ingredients);
    setCustom("");
    setLoading(true);
    setError("");
    setRecipes([]);
    setPendingResult(null);
    try {
      const response = await fetch("/api/food/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, time, allergies: profile.allergies, dislikes: profile.dislikes, conditions: profile.conditions, previousRecipes: recentRecipeNames, recipeRatings }),
      });
      // The Vite proxy can return an empty/non-JSON 502 when food-api is offline.
      // Read text first so that case becomes an actionable message instead of a
      // JSON parsing exception exposed directly in the UI.
      const responseText = await response.text();
      let result: { recipes?: CookRecipe[]; normalizedIngredients?: string[]; error?: string } = {};
      try {
        if (responseText.trim()) result = JSON.parse(responseText) as typeof result;
      } catch {
        if (!response.ok) {
          throw new Error(`เชื่อมต่อ food-api ไม่ได้ (HTTP ${response.status}) กรุณาเปิดบริการ food-api แล้วลองอีกครั้ง`);
        }
        throw new Error("เซิร์ฟเวอร์ส่งคำตอบกลับมาไม่สมบูรณ์ กรุณาลองใหม่");
      }
      if (!response.ok || !Array.isArray(result.recipes) || result.recipes.length !== 2) {
        throw new Error(result.error || (response.status >= 500
          ? `บริการ AI ตอบกลับผิดพลาด (HTTP ${response.status}) กรุณาตรวจสอบ food-api แล้วลองใหม่`
          : "AI สร้างเมนูไม่สำเร็จ กรุณาลองใหม่"));
      }
      const normalized = Array.isArray(result.normalizedIngredients) && result.normalizedIngredients.length === ingredients.length
        ? result.normalizedIngredients.map(formatIngredient)
        : ingredients;
      const hasCorrections = normalized.some((item, index) => item !== ingredients[index]);
      if (hasCorrections) setPendingResult({ original: ingredients, normalized, recipes: result.recipes });
      else {
        setSelected(normalized);
        setRecipes(result.recipes);
        rememberRecipes(result.recipes);
      }
    } catch (cause) {
      setError(cause instanceof TypeError
        ? "เชื่อมต่อ food-api ไม่ได้ กรุณาเปิดบริการ food-api แล้วลองอีกครั้ง"
        : cause instanceof Error ? cause.message : "เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองใหม่");
    } finally { setLoading(false); }
  };

  const rememberRecipes = (nextRecipes: CookRecipe[]) => {
    const names = [...new Set([...nextRecipes.map((recipe) => recipe.name), ...recentRecipeNames])].slice(0, 20);
    setRecentRecipeNames(names);
    try { localStorage.setItem(recentRecipeKey, JSON.stringify(names)); } catch { /* Recent menu diversity is optional when storage is unavailable. */ }
    void storeCookHistory(clientId, { savedRecipes, recipeRatings, recentRecipeNames: names }).catch(() => setError("เก็บประวัติไว้ในอุปกรณ์แล้ว แต่เชื่อมต่อฐานข้อมูลไม่สำเร็จ"));
  };
  const confirmCorrections = () => {
    if (!pendingResult) return;
    setSelected(uniqueIngredients(pendingResult.normalized));
    setRecipes(pendingResult.recipes);
    rememberRecipes(pendingResult.recipes);
    setPendingResult(null);
  };
  const toggleSavedRecipe = (recipe: CookRecipe) => {
    const exists = savedRecipes.some((item) => item.name.toLocaleLowerCase() === recipe.name.toLocaleLowerCase());
    const next = exists ? savedRecipes.filter((item) => item.name.toLocaleLowerCase() !== recipe.name.toLocaleLowerCase()) : [recipe, ...savedRecipes];
    setSavedRecipes(next);
    try { localStorage.setItem(recipeMemoryKey, JSON.stringify(next)); } catch { setError("บันทึกสูตรในอุปกรณ์นี้ไม่สำเร็จ"); }
    void storeCookHistory(clientId, { savedRecipes: next, recipeRatings, recentRecipeNames }).catch(() => setError("เก็บสูตรไว้ในอุปกรณ์แล้ว แต่เชื่อมต่อฐานข้อมูลไม่สำเร็จ"));
  };
  const rateRecipe = (recipe: CookRecipe, rating: number) => {
    const next = { ...recipeRatings, [recipe.name]: rating };
    setRecipeRatings(next);
    try { localStorage.setItem(recipeRatingKey, JSON.stringify(next)); } catch { setError("บันทึกคะแนนสูตรในอุปกรณ์นี้ไม่สำเร็จ"); }
    void storeCookHistory(clientId, { savedRecipes, recipeRatings: next, recentRecipeNames }).catch(() => setError("เก็บคะแนนไว้ในอุปกรณ์แล้ว แต่เชื่อมต่อฐานข้อมูลไม่สำเร็จ"));
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
      <div className="grid gap-9 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#d7ff52] px-4 py-2 text-sm font-black"><ChefHat className="size-4" /> COOK MATCH</span>
          <h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-7xl">มีอะไรอยู่<br />ในครัวบ้าง?</h1>
          <p className="mt-5 max-w-lg font-semibold leading-7 text-black/55">เลือกวัตถุดิบและเวลา แล้วให้ AI คิด 2 เมนูพร้อมขั้นตอนทำจริง</p>
          <div className="mt-8 overflow-hidden rounded-[32px]"><img src="/food-noodles.jpg" alt="อาหารทำเอง" className="h-72 w-full object-cover" /></div>
        </div>
        <div className="rounded-[34px] bg-white p-6 shadow-[0_25px_70px_rgba(30,24,20,.09)] md:p-9">
          <label className="text-sm font-black">1. เลือกวัตถุดิบที่มี</label>
          <div className="mt-4 flex flex-wrap gap-2">
            {options.map((item) => <button type="button" key={item} onClick={() => toggle(item)} className={`rounded-full border px-4 py-2 text-sm font-black transition ${selected.includes(item) ? "border-[#17151c] bg-[#17151c] text-white" : "border-black/10 bg-[#f6f4ee]"}`}>{selected.includes(item) ? <Check className="mr-1 inline size-4" /> : <Plus className="mr-1 inline size-4" />}{item}</button>)}
            {selected.filter((item) => !options.includes(item)).map((item) => <button type="button" key={`custom-${item}`} onClick={() => toggle(item)} aria-label={`นำ ${item} ออก`} className="rounded-full border border-[#17151c] bg-[#17151c] px-4 py-2 text-sm font-black text-white transition hover:bg-black"><Check className="mr-1 inline size-4" />{item}<X className="ml-2 inline size-3.5" /></button>)}
          </div>
          <p className="mt-2 text-xs font-semibold text-black/45">รายการที่เพิ่มเองจะแสดงตรงนี้ และ AI จะช่วยปรับคำสะกดก่อนคิดเมนู</p>
          <div className="mt-4 flex gap-2">
            <Input value={custom} maxLength={60} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomIngredient(); } }} placeholder="เพิ่มวัตถุดิบ เช่น มะเขือเทศ" className="h-12 rounded-2xl border-black/10 bg-[#f6f4ee]" />
            <button type="button" onClick={addCustomIngredient} disabled={!custom.trim()} aria-label="เพิ่มวัตถุดิบ" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#d7ff52] disabled:cursor-not-allowed disabled:opacity-50"><Plus /></button>
          </div>
          <label className="mt-7 block text-sm font-black">2. มีเวลาทำเท่าไหร่</label>
          <div className="mt-3 grid grid-cols-3 gap-2">{["15 นาที", "30 นาที", "ไม่รีบ"].map((item) => <button type="button" key={item} onClick={() => setTime(item)} className={`rounded-2xl px-3 py-3 text-sm font-black ${time === item ? "bg-[#ff5b4d] text-white" : "bg-[#f6f4ee]"}`}>{item}</button>)}</div>
          <div className="mt-6 rounded-2xl bg-[#f6f4ee] p-4 text-sm font-semibold leading-6 text-black/55"><Sparkles className="mr-2 inline size-5 text-[#ff5b4d]" />AI จะคำนึงถึงอาหารที่แพ้และสิ่งที่ไม่กินของ {profile.name || "คุณ"}</div>
          <Button onClick={() => void generate()} disabled={loading || (!selected.length && !custom.trim())} className="mt-5 h-14 w-full rounded-2xl bg-[#17151c] text-base font-black text-white hover:bg-black">{loading ? "AI กำลังคิดเมนู…" : "คิดเมนูจากของที่มี"}<Sparkles className="ml-2 size-5" /></Button>
          {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        </div>
      </div>
    {completedRecipe && <p role="status" className="mt-8 rounded-2xl bg-[#d7ff52] p-4 text-sm font-black">ทำ {completedRecipe} เสร็จแล้ว อร่อยเลยครับ!</p>}
      {pendingResult && <div role="status" className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50 p-5"><h2 className="font-black">AI แนะนำให้ตรวจคำวัตถุดิบก่อน</h2><div className="mt-3 flex flex-wrap gap-2">{pendingResult.original.map((value, index) => value !== pendingResult.normalized[index] && <span key={`${value}-${index}`} className="rounded-full bg-white px-3 py-2 text-sm font-bold">{value} <ArrowRight className="mx-1 inline size-4" /> {pendingResult.normalized[index]}</span>)}</div><p className="mt-3 text-sm font-semibold text-black/60">ยืนยันเมื่อชื่อใหม่ตรงกับวัตถุดิบจริงของคุณ หากไม่ตรงให้ปิดข้อความนี้แล้วแก้รายการเองก่อนคิดเมนู</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={confirmCorrections} className="rounded-xl bg-[#17151c] font-black text-white">ยืนยันคำที่แก้และดูเมนู</Button><Button type="button" variant="outline" onClick={() => setPendingResult(null)} className="rounded-xl font-black">แก้รายการเอง</Button></div></div>}
      {recipes.length > 0 && <div className="mt-12"><div className="flex items-end justify-between gap-4"><div><span className="text-sm font-black tracking-[.16em] text-[#ff5b4d]">AI RECIPE IDEAS</span><h2 className="mt-2 text-4xl font-black tracking-[-.05em] md:text-6xl">วันนี้ทำเมนูนี้ได้เลย</h2></div><button onClick={() => { setRecipes([]); setPendingResult(null); }} className="hidden items-center gap-2 text-sm font-black text-black/45 md:flex"><RotateCcw className="size-4" />เลือกใหม่</button></div><div className="mt-7 grid gap-5 md:grid-cols-2">{recipes.map((recipe, index) => { const isSaved = savedRecipes.some((item) => item.name.toLocaleLowerCase() === recipe.name.toLocaleLowerCase()); const rating = recipeRatings[recipe.name] || 0; return <article key={`${recipe.name}-${index}`} className="overflow-hidden rounded-[32px] bg-[#17151c] text-white"><div className="relative h-64"><img src={index === 0 ? "/food-friends.jpg" : "/food-noodles.jpg"} alt="" className="h-full w-full object-cover" /><span className="absolute left-5 top-5 rounded-full bg-[#d7ff52] px-4 py-2 text-sm font-black text-black">AI · {recipe.minutes} นาที</span></div><div className="p-6"><div className="flex items-start justify-between gap-3"><h3 className="text-2xl font-black">{recipe.name}</h3><button type="button" onClick={() => toggleSavedRecipe(recipe)} aria-label={isSaved ? "ยกเลิกบันทึกสูตร" : "บันทึกสูตร"} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10"><Heart className={`size-5 ${isSaved ? "fill-[#ff5b4d] text-[#ff5b4d]" : ""}`} /></button></div><span className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-bold">ทำได้ใน {recipe.minutes} นาที</span><p className="mt-4 text-sm font-semibold leading-6 text-white/70">{recipe.summary}</p><div className="mt-5"><p className="text-xs font-black uppercase tracking-wider text-[#d7ff52]">ของที่คุณเลือก · {recipe.ingredients.length}</p><div className="mt-2 flex flex-wrap gap-2">{recipe.ingredients.map((ingredient) => <span key={ingredient} className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold">{ingredient}</span>)}</div>{recipe.pantryIngredients.length > 0 && <><p className="mt-4 text-xs font-black uppercase tracking-wider text-white/55">เครื่องปรุงพื้นฐานที่ต้องเพิ่ม</p><div className="mt-2 flex flex-wrap gap-2">{recipe.pantryIngredients.map((ingredient) => <span key={ingredient} className="rounded-full border border-dashed border-white/30 px-3 py-1 text-xs font-bold text-white/70">{ingredient}</span>)}</div></>}</div><div className="mt-5 flex items-center gap-1" aria-label={`ให้คะแนน ${rating} จาก 5`}><span className="mr-2 text-xs font-bold text-white/55">ถูกใจแค่ไหน?</span>{[1,2,3,4,5].map((value) => <button type="button" key={value} onClick={() => rateRecipe(recipe, value)} aria-label={`ให้ ${value} ดาว`} className="p-1"><Star className={`size-5 ${value <= rating ? "fill-[#d7ff52] text-[#d7ff52]" : "text-white/45"}`} /></button>)}</div><button type="button" onClick={() => setActiveRecipe(recipe)} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 font-black text-[#17151c]">ดูวิธีทำแบบย่อ <ArrowRight /></button></div></article>; })}</div></div>}
      {savedRecipes.length > 0 && <div className="mt-12 rounded-[30px] bg-white p-6 md:p-8"><div className="flex items-center gap-3"><BookHeart className="size-6 text-[#ff5b4d]" /><h2 className="text-2xl font-black">สูตรที่บันทึกไว้</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{savedRecipes.map((recipe) => <div key={recipe.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f4ee] p-4"><button type="button" onClick={() => setActiveRecipe(recipe)} className="text-left"><b>{recipe.name}</b><span className="mt-1 block text-xs font-semibold text-black/50">{recipe.minutes} นาที{recipeRatings[recipe.name] ? ` · ${recipeRatings[recipe.name]}/5 ดาว` : ""}</span></button><button type="button" onClick={() => toggleSavedRecipe(recipe)} aria-label={`ลบ ${recipe.name} จากสูตรที่บันทึก`} className="rounded-full p-2 text-[#ff5b4d]"><X className="size-4" /></button></div>)}</div></div>}
    {activeRecipe && (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveRecipe(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="recipe-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-[#f6f4ee] p-6 shadow-2xl md:p-8">
          <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-black tracking-[.16em] text-[#ff5b4d]">AI-สร้างสูตร · {activeRecipe.minutes} นาที</span><h2 id="recipe-title" className="mt-2 text-3xl font-black">{activeRecipe.name}</h2><p className="mt-2 font-semibold text-black/55">{activeRecipe.summary}</p></div><button type="button" onClick={() => setActiveRecipe(null)} aria-label="ปิดวิธีทำ" className="grid size-10 shrink-0 place-items-center rounded-full bg-white"><X /></button></div>
          <div className="mt-6 rounded-2xl bg-white p-5"><h3 className="font-black">ของที่คุณเลือก · {activeRecipe.ingredients.length} อย่าง</h3><p className="mt-2 text-sm font-semibold leading-6 text-black/65">{activeRecipe.ingredients.join(" · ")}</p>{activeRecipe.pantryIngredients.length > 0 && <><h3 className="mt-5 font-black">เครื่องปรุงพื้นฐานที่ต้องเพิ่ม</h3><p className="mt-2 text-sm font-semibold leading-6 text-black/65">{activeRecipe.pantryIngredients.join(" · ")}</p></>}<h3 className="mt-5 font-black">ขั้นตอน</h3><ol className="mt-3 space-y-3">{activeRecipe.steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3 text-sm font-semibold leading-6"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#d7ff52] font-black">{index + 1}</span><span>{step}</span></li>)}</ol></div>
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">สูตรสร้างโดย AI ควรตรวจสอบวัตถุดิบกับอาการแพ้ของคุณอีกครั้ง และปรุงเนื้อสัตว์/ไข่ให้สุกทั่วถึงก่อนรับประทาน</p>
          <Button type="button" onClick={() => startCooking(activeRecipe)} className="mt-4 h-12 w-full rounded-2xl bg-[#17151c] font-black text-white hover:bg-black"><ChefHat className="mr-2 size-5" />เริ่มโหมดทำอาหาร</Button>
        </section>
      </div>
    )}
    {cookingRecipe && (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-[#17151c]/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCooking(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="cook-mode-title" className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-[#f6f4ee] shadow-2xl">
          <header className="flex items-start justify-between gap-4 bg-white p-6 md:p-8"><div><span className="text-xs font-black tracking-[.18em] text-[#ff5b4d]">COOK MODE · {cookingRecipe.minutes} นาที</span><h2 id="cook-mode-title" className="mt-2 text-2xl font-black md:text-3xl">{cookingRecipe.name}</h2></div><button type="button" onClick={closeCooking} aria-label="ปิดโหมดทำอาหาร" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f6f4ee]"><X /></button></header>
          <div className="px-6 pt-6 md:px-8"><div className="flex items-center justify-between text-sm font-black"><span>ขั้นตอน {cookingStep + 1} จาก {cookingRecipe.steps.length}</span><span>{Math.round(((cookingStep + 1) / cookingRecipe.steps.length) * 100)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#d7ff52] transition-all duration-300" style={{ width: `${((cookingStep + 1) / cookingRecipe.steps.length) * 100}%` }} /></div></div>
          <div className="p-6 md:p-8"><div aria-live="polite" className="min-h-52 rounded-[28px] bg-[#17151c] p-6 text-white md:p-8"><span className="text-sm font-black tracking-[.16em] text-[#d7ff52]">ขั้นตอนที่ {cookingStep + 1}</span><p className="mt-5 text-2xl font-black leading-relaxed md:text-3xl">{cookingRecipe.steps[cookingStep]}</p></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5"><div><span className="text-xs font-black tracking-[.12em] text-black/45">เวลาที่แนะนำ · นับถอยหลัง</span><div className="mt-1 font-mono text-4xl font-black tabular-nums">{timerLabel}</div>{timerSeconds === 0 && <p className="mt-1 text-xs font-bold text-[#ff5b4d]">ครบเวลาที่แนะนำแล้ว เช็กความสุกก่อนเสิร์ฟนะครับ</p>}</div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setTimerRunning((running) => !running)} disabled={timerSeconds === 0} className="rounded-xl bg-[#ff5b4d] font-black text-white hover:bg-[#e94d40]">{timerRunning ? "พักเวลา" : "เริ่มจับเวลา"}</Button><Button type="button" variant="outline" onClick={() => { setTimerRunning(false); setTimerSeconds((seconds) => seconds + 60); }} className="rounded-xl font-black">+1 นาที</Button><Button type="button" variant="outline" onClick={() => { setTimerRunning(false); setTimerSeconds(cookingRecipe.minutes * 60); }} aria-label="เริ่มจับเวลาใหม่" className="rounded-xl"><RotateCcw className="size-4" /></Button></div></div>
            <div className="mt-5 flex gap-3"><Button type="button" variant="outline" disabled={cookingStep === 0} onClick={() => setCookingStep((step) => Math.max(0, step - 1))} className="h-12 flex-1 rounded-2xl font-black">ย้อนกลับ</Button>{cookingStep < cookingRecipe.steps.length - 1 ? <Button type="button" onClick={() => setCookingStep((step) => Math.min(cookingRecipe.steps.length - 1, step + 1))} className="h-12 flex-1 rounded-2xl bg-[#17151c] font-black text-white hover:bg-black">เสร็จแล้ว · ขั้นต่อไป <ArrowRight className="ml-2 size-4" /></Button> : <Button type="button" onClick={() => { setCompletedRecipe(cookingRecipe.name); closeCooking(); }} className="h-12 flex-1 rounded-2xl bg-[#d7ff52] font-black text-[#17151c] hover:bg-[#c6ef45]"><Check className="mr-2 size-4" />ทำเสร็จแล้ว</Button>}</div>
          </div>
        </section>
      </div>
    )}
    </section>
  );
}

function EatPage({ profile, needProfile, clientId, addMeal }: { profile: Profile; needProfile: () => void; clientId: string; addMeal: (s: Scenario) => void }) {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [items, setItems] = useState<Scenario[]>([]);
  const [status, setStatus] = useState("ตอบคำถามสั้น ๆ เพื่อค้นเมนูจากฐานข้อมูล");
  const [loading, setLoading] = useState(false);
  const [aiFeedbackStats, setAiFeedbackStats] = useState<AiFeedbackStats | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const recentMenuIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (phase !== "result") return;
    let active = true;
    fetchAiFeedbackStats().then((stats) => { if (active) setAiFeedbackStats(stats); }).catch(() => { if (active) setAiFeedbackStats(null); });
    return () => { active = false; };
  }, [phase]);

  const recordFeedback = async (scenario: Scenario, accepted: boolean) => {
    try {
      await saveAiRecommendationFeedback(clientId, scenario, accepted);
      setAiFeedbackStats(await fetchAiFeedbackStats());
      setFeedbackError("");
    } catch {
      setFeedbackError("ผลตอบรับยังบันทึกไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง");
    }
  };

  const requestRecommendations = async (nextAnswers: string[]) => {
    setPhase("result");
    setLoading(true);
    setStatus("กำลังจับคู่เมนูให้คุณ…");
    try {
      const recentIds = [...recentMenuIdsRef.current];
      const [budgetAnswer, time, hunger, mood, goal] = nextAnswers;
      const query = [...nextAnswers, profile.dislikes ? `ไม่กิน: ${profile.dislikes}` : "", profile.conditions ? `ข้อจำกัดสุขภาพ: ${profile.conditions}` : ""].filter(Boolean).join("; ");
      const result = await rankFilteredFoods(query, {
        maxBudgetThb: budgetFromAnswer(budgetAnswer, profile.dailyBudget),
        allergies: [profile.allergies, profile.dislikes].flatMap((value) => value.split(/[,，]/u)).map((value) => value.trim()).filter(Boolean),
      }, { time, hunger, mood, goal }, recentIds);
      const batchId = crypto.randomUUID();
      const recommendationProvider = result.explanation?.provider || "database";
      const recommendations = result.recommendations.map((item) => ({
        id: item.id, badge: item.tags[0] || "แนะนำ", name: item.menuName, shop: item.storeName,
        price: item.price, location: item.location, score: item.score,
        reason: [
          item.matchReasons.join(" · ") || item.text,
        ].filter(Boolean).join(" · "), image: item.image || "/food-noodles.jpg",
        tags: item.tags, color: item.tags.includes("spicy") ? "#ffb62e" : "#d7ff52", sourceUrl: item.sourceUrl,
        scoreBreakdown: item.scoreBreakdown || [],
        recommendationBatchId: batchId,
        recommendationBatchSize: result.recommendations.length,
        recommendationProvider,
      }));
      setItems(recommendations);
      recentMenuIdsRef.current = [...recommendations.map((item) => item.id), ...recentIds.filter((id) => !recommendations.some((item) => item.id === id))].slice(0, 500);
      setStatus([result.explanation?.message, result.message].filter(Boolean).join(" · ") || `จัดอันดับ ${recommendations.length} เมนูจากฐานข้อมูล`);
    } catch (error) {
      setItems([]);
      setStatus(error instanceof Error ? error.message : "ค้นเมนูจากฐานข้อมูลไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  const start = () => { recentMenuIdsRef.current = []; setPhase(profile.name ? "quiz" : "intro"); if (!profile.name) needProfile(); };
  const choose = (option: string) => {
    const next = [...answers.slice(0, step), option];
    setAnswers(next);
    if (step === quiz.length - 1) void requestRecommendations(next);
    else setStep((value) => value + 1);
  };
  if (phase === "quiz") return <section className="mx-auto min-h-[calc(100dvh-76px)] max-w-3xl px-5 py-10"><button onClick={() => setPhase("intro")} className="flex items-center gap-2 text-sm font-black text-black/45"><ArrowLeft className="size-4" />กลับ</button><div className="mt-8 flex gap-2">{quiz.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-[#ff5b4d]" : "bg-black/10"}`} />)}</div><div className="mt-7 rounded-[38px] bg-[#17151c] p-7 text-white shadow-2xl md:p-11"><span className="text-sm font-black tracking-[.18em] text-[#d7ff52]">{quiz[step].kicker}</span><h1 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-6xl">{quiz[step].title}</h1><div className="mt-9 grid gap-3">{quiz[step].options.map((option, i) => <button key={option} onClick={() => choose(option)} className="flex min-h-16 items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] px-5 text-left text-lg font-black transition hover:bg-[#ff5b4d]"><span>{option}</span><span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm">{i + 1}</span></button>)}</div></div></section>;
  if (phase === "result") return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[.7fr_1.3fr] lg:px-10"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">FOOD SCENARIOS</span><h1 className="mt-3 text-5xl font-black leading-[.92] tracking-[-.06em] md:text-7xl">เลือกด้วย<br />ความรู้สึก.<br /><span className="text-[#ff5b4d]">มั่นใจด้วย AI.</span></h1><div className="mt-7 rounded-[26px] bg-white p-5 shadow-sm"><b>เกณฑ์ที่ใช้จัดอันดับ</b><p className="mt-2 text-sm font-semibold leading-6 text-black/50">{status}</p><div className="mt-4 rounded-2xl bg-[#f6f4ee] p-4"><div className="flex items-baseline justify-between gap-3"><b className="text-sm">อัตรารอบที่พบเมนูที่ยอมรับ</b><b className="text-xl">{aiFeedbackStats?.acceptanceRate == null ? "—" : `${aiFeedbackStats.acceptanceRate}%`}</b></div><p className="mt-1 text-xs font-semibold leading-5 text-black/50">{aiFeedbackStats ? `สำเร็จ ${aiFeedbackStats.successfulRounds} จาก ${aiFeedbackStats.rounds} จากที่ผู้ใช้ถูกใจ` : "กำลังโหลดผลตอบรับจากฐานข้อมูล…"}</p><p className="mt-2 text-[11px] font-semibold leading-4 text-black/40">นับ 1 รอบต่อชุดแนะนำสูงสุด 3 เมนู: ยืนยันเลือกอย่างน้อย 1 เมนู = สำเร็จ, ปัดทิ้งครบทั้งชุด = ไม่สำเร็จ; รอบที่ยังให้ความเห็นไม่ครบจะไม่นับ ตัวชี้วัดนี้สะท้อนการยอมรับของผู้ใช้ ไม่ใช่ความแม่นยำเชิงวิทยาศาสตร์ของ AI</p>{feedbackError && <p className="mt-2 text-xs font-bold text-[#d43d32]">{feedbackError}</p>}</div></div><button onClick={() => { recentMenuIdsRef.current = []; setStep(0); setAnswers([]); setItems([]); setPhase("quiz"); }} className="mt-5 flex items-center gap-2 text-sm font-black text-black/45"><RotateCcw className="size-4" />ตอบใหม่อีกครั้ง</button></div><SwipeDeck items={items} loading={loading} onPicked={addMeal} onFeedback={(scenario, accepted) => { void recordFeedback(scenario, accepted); }} onNextBatch={() => { setItems([]); void requestRecommendations(answers); }} /></section>;
  return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#ff5b4d]/10 px-4 py-2 text-sm font-black text-[#ff5b4d]"><Zap className="size-4 fill-current" /> SWIPE 5 วินาที</span><h1 className="mt-6 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-8xl">ออกไปกิน<br /><span className="text-[#ff5b4d]">อะไรดี?</span></h1><p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-black/55">ตอบแค่เรื่องมื้อนี้: งบ เวลา ความหิว และมู้ด ส่วนข้อมูลสุขภาพและอาหารที่ไม่กิน เราดึงจากโปรไฟล์ให้อัตโนมัติ</p><Button onClick={start} className="mt-8 h-14 rounded-full bg-[#17151c] px-8 text-base font-black text-white hover:bg-black">เริ่มหา Food Match <ArrowRight className="ml-2" /></Button></div><div className="relative min-h-[560px]"><div className="absolute right-6 top-0 h-[500px] w-[76%] rotate-3 overflow-hidden rounded-[42px] bg-[#17151c] p-3 shadow-2xl"><img src="/food-ramen.jpg" alt="อาหารแนะนำ" className="h-full w-full rounded-[32px] object-cover" /></div><div className="absolute bottom-0 left-0 w-[260px] -rotate-6 rounded-[28px] bg-[#d7ff52] p-6 shadow-xl"><b className="text-4xl tracking-[-.06em]">ข้อมูลร้านและเมนู</b><span className="mt-1 block font-black">เมนูจากร้านจริง</span><p className="mt-3 text-sm font-bold text-black/50">AI จัดอันดับตามคำตอบและโปรไฟล์</p></div></div></section>;
}

function SwipeDeck({ items, loading, onPicked, onFeedback, onNextBatch }: { items: Scenario[]; loading: boolean; onPicked: (s: Scenario) => void; onFeedback: (s: Scenario, accepted: boolean) => void; onNextBatch: () => void }) {
  const [index, setIndex] = useState(0);
  const [match, setMatch] = useState<Scenario | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  useEffect(() => { setIndex(0); setMatch(null); }, [items]);
  if (loading) return <div className="mx-auto w-full max-w-[440px] rounded-[32px] bg-white p-8 text-center shadow-lg"><Sparkles className="mx-auto size-10 animate-pulse text-[#ff5b4d]"/><h2 className="mt-4 text-xl font-black">กำลังหาเมนูที่เหมาะกับคุณ…</h2></div>;
  if (!items.length) return <div className="mx-auto w-full max-w-[440px] rounded-[32px] bg-white p-8 text-center shadow-lg"><Sparkles className="mx-auto size-10 text-[#ff5b4d]"/><h2 className="mt-4 text-2xl font-black">ไม่มีเมนูใหม่ในรอบนี้</h2><p className="mt-2 font-semibold text-black/55">ตรวจเหตุผลด้านซ้าย หรือเปลี่ยนคำตอบเพื่อค้นหาเมนูอื่น โดยระบบจะไม่วนกลับมาแสดงเมนูเดิม</p><button onClick={onNextBatch} className="mt-5 rounded-full bg-[#17151c] px-5 py-3 font-black text-white">ค้นหาอีกครั้ง</button></div>;
  if (index >= items.length) return <div className="mx-auto w-full max-w-[440px] rounded-[32px] bg-white p-8 text-center shadow-lg"><Sparkles className="mx-auto size-10 text-[#ff5b4d]"/><h2 className="mt-4 text-2xl font-black">ดูครบ {items.length} เมนูในชุดนี้แล้ว</h2><p className="mt-2 font-semibold text-black/55">ขอชุดถัดไปได้เลย เราจะเลี่ยงเมนูที่แสดงไปแล้ว</p><button onClick={onNextBatch} className="mt-5 rounded-full bg-[#17151c] px-5 py-3 font-black text-white">ดูเมนูชุดถัดไป</button></div>;
  const card = items[index];
  const nextCard = items[index + 1];
  const dismiss = (liked: boolean) => { setDragX(0); if (liked) setMatch(card); else { onFeedback(card, false); setIndex((value) => value + 1); } };
  return <div className="relative mx-auto w-full max-w-[440px]">
    {nextCard && <div aria-hidden="true" className="absolute inset-x-3 top-3 h-[620px] rotate-2 overflow-hidden rounded-[38px] bg-[#17151c] shadow-[0_30px_70px_rgba(22,18,17,.16)]"><img src={nextCard.image} alt="" draggable={false} className="h-full w-full object-cover opacity-70"/><div className="absolute inset-0 bg-gradient-to-t from-[#17151c]/80 via-transparent to-black/20"/><span className="absolute left-6 top-6 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#17151c]">ถัดไป · {nextCard.name}</span></div>}
    <article
      onPointerDown={(event) => { if (event.pointerType === "mouse" && event.button !== 0) return; startX.current = event.clientX; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (dragging) setDragX(event.clientX - startX.current); }}
      onPointerUp={(event) => { if (!dragging) return; const distance = event.clientX - startX.current; setDragging(false); setDragX(0); if (Math.abs(distance) > 90) dismiss(distance > 0); }}
      onPointerCancel={() => { setDragging(false); setDragX(0); }}
      className={`relative z-10 h-[620px] touch-none select-none overflow-hidden rounded-[38px] bg-[#17151c] shadow-[0_40px_90px_rgba(22,18,17,.22)] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, transition: dragging ? "none" : "transform .25s ease-out" }}
    >
      <img src={card.image} alt={card.name} draggable={false} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17151c] via-black/20 to-black/5"/>
      {dragX < -24 && <span className="pointer-events-none absolute left-6 top-7 rotate-[-10deg] rounded-xl border-4 border-[#ff5b4d] bg-[#17151c]/60 px-4 py-2 text-2xl font-black text-[#ff5b4d]">ทิ้ง</span>}
      {dragX > 24 && <span className="pointer-events-none absolute right-6 top-7 rotate-[10deg] rounded-xl border-4 border-[#d7ff52] bg-[#17151c]/60 px-4 py-2 text-2xl font-black text-[#d7ff52]">ชอบ</span>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 text-white md:p-7"><div className="flex items-center justify-between"><span className="rounded-full bg-[#d7ff52] px-3 py-1.5 text-sm font-black text-black">{card.score}% MATCH</span><span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold">{card.badge}</span></div><h2 className="mt-4 text-3xl font-black">{card.name}</h2><p className="mt-2 flex items-center gap-1.5 font-bold text-white/80"><MapPin className="size-4"/>{card.shop} · {card.location}</p><div className="mt-4 flex flex-wrap gap-2">{card.tags.map((tag) => <span key={tag} className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm font-bold">{tag}</span>)}</div><p className="mt-4 text-sm font-semibold leading-6 text-white/70">{card.reason}</p><div className="mt-5 flex items-center justify-between border-t border-white/15 pt-5"><div><b className="block text-xl">฿{card.price}</b><span className="text-xs text-white/55">ราคาจากฐานข้อมูล</span></div>{card.sourceUrl && <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="pointer-events-auto text-sm font-bold underline">ดูแหล่งข้อมูลร้าน</a>}</div></div>
    </article>
    <p className="mt-4 text-center text-sm font-black text-black/50">← ปัดซ้าย: ทิ้ง <span className="mx-2 text-black/20">·</span> ปัดขวา: ชอบ →</p>
    <div className="mt-3 flex items-center justify-center gap-4"><button onClick={() => setIndex((value) => Math.max(0, value - 1))} aria-label="ย้อนเมนู" className="grid size-12 place-items-center rounded-full bg-white text-[#ffb62e] shadow-lg"><RotateCcw/></button><button onClick={() => dismiss(false)} aria-label="ทิ้งเมนูนี้" className="grid size-16 place-items-center rounded-full bg-white text-[#ff5b4d] shadow-xl"><X className="size-8"/></button><button onClick={() => dismiss(true)} aria-label="ชอบเมนูนี้" className="grid size-16 place-items-center rounded-full bg-[#d7ff52] shadow-xl"><Heart className="size-8 fill-current"/></button><button onClick={onNextBatch} aria-label="เมนูชุดใหม่" className="grid size-12 place-items-center rounded-full bg-[#17151c] text-[#d7ff52] shadow-lg"><Zap className="fill-current"/></button></div>
    {match && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-5"><div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center"><h3 className="text-2xl font-black">ชอบ {match.name}?</h3><p className="mt-2 text-sm font-semibold text-black/55">บันทึกลง Food Memory ของคุณ</p><div className="mt-5 flex gap-3"><button onClick={() => setMatch(null)} className="flex-1 rounded-xl bg-black/5 py-3 font-black">ยกเลิก</button><button onClick={() => { onFeedback(match, true); onPicked(match); setMatch(null); }} className="flex-1 rounded-xl bg-[#d7ff52] py-3 font-black">เลือกมื้อนี้</button></div></div></div>}
  </div>;
}

function MemoryPage({ profile, clientId }: { profile: Profile; clientId: string }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/food/memory?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("โหลด Food Memory ไม่สำเร็จ"); return response.json() as Promise<{ items: MemoryItem[]; count: number }>; })
      .then((result) => { setItems(result.items); setCount(result.count); })
      .catch(() => { setItems([]); setCount(0); })
      .finally(() => setLoading(false));
  }, [clientId]);
  return <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">FOOD MEMORY</span><h1 className="mt-2 text-5xl font-black tracking-[-.06em] md:text-7xl">ยิ่งกิน ยิ่งรู้ใจ</h1><p className="mt-2 font-semibold text-black/45">{count} มื้อที่บันทึกไว้ · {profile.name || "โปรไฟล์ของคุณ"}</p></div><div className="rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white">FOOD MEMORY</div></div>{loading ? <p className="mt-8 rounded-3xl bg-white p-8 text-center font-semibold text-black/50">กำลังโหลดข้อมูลจากฐานข้อมูล…</p> : items.length ? <div className="mt-8 grid gap-5 md:grid-cols-3">{items.map((item) => <article key={item._id} className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_50px_rgba(30,24,20,.08)]"><div className="h-52 overflow-hidden rounded-[20px]"><img src={item.image || "/food-noodles.jpg"} alt={item.menuName} className="h-full w-full object-cover"/></div><div className="p-3"><h2 className="text-xl font-black">{item.menuName}</h2><p className="mt-1 text-sm font-semibold text-black/45">{item.storeName} · {new Date(item.savedAt).toLocaleString("th-TH")}</p><b className="mt-4 block">฿{item.price}</b></div></article>)}</div> : <p className="mt-8 rounded-3xl bg-white p-8 text-center font-semibold text-black/50">ยังไม่มีมื้อที่บันทึก เลือกเมนูที่ชอบจากหน้า Match เพื่อเพิ่มลง Food Memory</p>}</section>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home"); const [profile, setProfile] = useState<Profile>(emptyProfile); const [profileOpen, setProfileOpen] = useState(false); const [toast, setToast] = useState(""); const [clientId, setClientId] = useState("");
  useEffect(() => {
    let active = true;
    let id = localStorage.getItem("food-match-client-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("food-match-client-id", id); }
    setClientId(id);
    let localProfile: Profile | null = null;
    try {
      const saved = localStorage.getItem("food-match-profile-v2") || localStorage.getItem("food-match-profile");
      if (saved) { localProfile = { ...emptyProfile, ...JSON.parse(saved) }; setProfile(localProfile); }
    } catch { /* Continue with the database profile or the blank defaults. */ }
    fetchUserProfile(id).then(async (storedProfile) => {
      if (!active) return;
      if (storedProfile) {
        const restored = { ...emptyProfile, ...storedProfile };
        setProfile(restored);
        try { localStorage.setItem("food-match-profile-v2", JSON.stringify(restored)); } catch { /* MongoDB remains the source of truth. */ }
      } else if (localProfile) {
        try { await storeUserProfile(id, localProfile); } catch { /* Keep the local profile if the API is unavailable. */ }
      }
    }).catch(() => { /* Continue using browser-stored profile data while MongoDB is unavailable. */ });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(id); }, [toast]);
  const greeting = useMemo(() => profile.name ? `โปรไฟล์ของ ${profile.name}` : "สร้างโปรไฟล์ส่วนตัว", [profile.name]);
  const navigate = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveProfile = (next: Profile) => {
    setProfile(next);
    try { localStorage.setItem("food-match-profile-v2", JSON.stringify(next)); } catch { /* MongoDB save remains available. */ }
    setProfileOpen(false);
    void storeUserProfile(clientId, next)
      .then(() => setToast("บันทึกความชอบลงฐานข้อมูลแล้ว"))
      .catch(() => setToast("บันทึกไว้ในอุปกรณ์แล้ว แต่เชื่อมต่อฐานข้อมูลไม่สำเร็จ"));
  };
  const addMeal = (meal: Scenario) => { void saveFoodMemory(clientId, meal.id).then(() => setToast(`บันทึก ${meal.name} ลง Food Memory แล้ว`)).catch(() => setToast(`เลือก ${meal.name} แล้ว แต่บันทึก Food Memory ไม่สำเร็จ`)); navigate("memory"); };
  return <main className="min-h-dvh bg-[#f6f4ee] text-[#17151c]"><Header screen={screen} onNavigate={navigate} onProfile={() => setProfileOpen(true)} />{screen === "home" && <HomePage go={navigate} profile={profile} clientId={clientId} />}{screen === "eat" && <EatPage profile={profile} needProfile={() => setProfileOpen(true)} clientId={clientId} addMeal={addMeal} />}{screen === "cook" && <CookPage profile={profile} needProfile={() => setProfileOpen(true)} clientId={clientId} />}{screen === "memory" && <MemoryPage profile={profile} clientId={clientId} />}<footer className="border-t border-black/[.06] px-5 py-8 md:px-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><Logo onClick={() => navigate("home")} /><p className="text-sm font-semibold text-black/40">Demo · โรงอาหารคณะวิศวกรรมศาสตร์ ลาดกระบัง</p><button onClick={() => setProfileOpen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-black">{greeting}</button></div></footer><ProfileDrawer open={profileOpen} value={profile} onClose={() => setProfileOpen(false)} onSave={saveProfile} />{toast && <div className="fixed left-1/2 top-24 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white shadow-xl"><Check className="size-5 text-[#d7ff52]" />{toast}</div>}</main>;
}
/*
function SwipeDeck({ items, onPicked, onNextBatch }: { items: Scenario[]; onPicked: (s: Scenario) => void; onNextBatch: () => void }) {
  const [index, setIndex] = useState(0); const [dragX, setDragX] = useState(0); const [dragging, setDragging] = useState(false); const startX = useRef(0); const [match, setMatch] = useState<Scenario | null>(null);
  useEffect(() => { setIndex(0); }, [items]);
  if (items.length === 0) return <div className="mx-auto w-full max-w-[440px] rounded-[32px] bg-white p-8 text-center shadow-lg"><Sparkles className="mx-auto size-10 text-[#ff5b4d]"/><h2 className="mt-4 text-2xl font-black">ยังไม่มีเมนูที่ตรงเงื่อนไข</h2><p className="mt-2 font-semibold text-black/55">{"เช็กการเชื่อมต่อบริการเมนู หรือปรับงบและคำตอบแล้วลองใหม่"}</p></div>;
  const card = items[index % items.length]; const nextCard = items[(index + 1) % items.length];
  const dismiss = (liked: boolean) => { if (liked) setMatch(card); else setIndex((i) => i + 1); setDragX(0); };
  return <div className="relative mx-auto w-full max-w-[440px]"><div className="absolute inset-x-5 top-5 h-[620px] rotate-3 overflow-hidden rounded-[38px] bg-white/60 opacity-60"><img src={nextCard.image} alt="" className="h-full w-full object-cover opacity-35" /></div><article onPointerDown={(e) => { startX.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => dragging && setDragX(e.clientX - startX.current)} onPointerUp={() => { setDragging(false); if (Math.abs(dragX) > 105) dismiss(dragX > 0); else setDragX(0); }} className={`relative h-[620px] touch-none overflow-hidden rounded-[38px] bg-[#17151c] shadow-[0_40px_90px_rgba(22,18,17,.22)] ${dragging ? "cursor-grabbing" : "cursor-grab"}`} style={{ transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`, transition: dragging ? "none" : "transform .35s cubic-bezier(.2,.9,.2,1)" }}><img src={card.image} alt={card.name} className="h-full w-full select-none object-cover" draggable={false} /><div className="absolute inset-0 bg-gradient-to-t from-[#17151c] via-black/20 to-black/5" /><div className={`absolute left-6 top-7 rotate-[-8deg] rounded-xl border-4 px-4 py-2 text-2xl font-black uppercase ${dragX > 0 ? "opacity-100" : "opacity-0"}`} style={{ color: "#d7ff52", borderColor: "#d7ff52" }}>MATCH</div><div className={`absolute right-6 top-7 rotate-[8deg] rounded-xl border-4 border-white px-4 py-2 text-2xl font-black text-white ${dragX < 0 ? "opacity-100" : "opacity-0"}`}>PASS</div><div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7"><div className="flex items-center justify-between"><span className="rounded-full px-3 py-1.5 text-sm font-black text-black" style={{ backgroundColor: card.color }}>{card.score}% MATCH</span><span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">{card.badge}</span></div><h2 className="mt-4 text-3xl font-black leading-[1.05] tracking-[-.04em]">{card.name}</h2><p className="mt-2 flex items-center gap-1.5 font-bold text-white/80"><MapPin className="size-4" />{card.shop} · {card.location}</p><div className="mt-4 flex flex-wrap gap-2">{card.tags.map((tag) => <span key={tag} className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm font-bold backdrop-blur">{tag}</span>)}</div><p className="mt-4 text-sm font-semibold leading-6 text-white/65">{card.reason}</p><div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/15 pt-5 text-center"><div><b className="block text-xl">฿{card.price}</b><span className="text-xs text-white/55">ราคาจากฐานข้อมูล</span></div><div className="flex items-center justify-center">{card.sourceUrl ? <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-bold underline">ดูแหล่งข้อมูลร้าน</a> : <span className="text-sm font-semibold text-white/55">{card.location}</span>}</div></div></div></article><div className="relative mt-7 flex items-center justify-center gap-4"><button onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="ย้อนการปัด" className="grid size-12 place-items-center rounded-full bg-white text-[#ffb62e] shadow-lg"><RotateCcw /></button><button onClick={() => dismiss(false)} aria-label="ไม่เลือก" className="grid size-16 place-items-center rounded-full bg-white text-[#ff5b4d] shadow-xl transition hover:scale-105"><X className="size-8" /></button><button onClick={() => dismiss(true)} aria-label="เลือกเมนูนี้" className="grid size-16 place-items-center rounded-full bg-[#d7ff52] text-[#17151c] shadow-xl transition hover:scale-105"><Heart className="size-8 fill-current" /></button><button onClick={onNextBatch} aria-label="ขอเมนูชุดใหม่" title="ขอเมนูชุดใหม่" className="grid size-12 place-items-center rounded-full bg-[#17151c] text-[#d7ff52] shadow-lg"><Zap className="fill-current" /></button></div><p className="mt-5 text-center text-sm font-bold text-black/40">ลากการ์ด หรือกดสายฟ้าเพื่อขอเมนูชุดใหม่จากร้านอื่น</p>{match && <MatchModal scenario={match} onClose={() => { setMatch(null); setIndex((i) => i + 1); }} onConfirm={() => { onPicked(match); setMatch(null); }} />}</div>;
}

function Memory({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/food/memory?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("โหลด Food Memory ไม่สำเร็จ"); return response.json() as Promise<{items: MemoryItem[]; count: number}>; })
      .then((result) => { setItems(result.items); setCount(result.count); })
      .catch(() => { setItems([]); setCount(0); })
      .finally(() => setLoading(false));
  }, [clientId]);
  const removeItem = async (item: MemoryItem) => {
    if (!window.confirm(`ลบ “${item.menuName}” ออกจาก Food Memory ใช่ไหม?`)) return;
    setDeletingId(item._id);
    setError("");
    try {
      await deleteFoodMemory(clientId, item._id);
      setItems((current) => current.filter((saved) => saved._id !== item._id));
      setCount((current) => Math.max(0, current - 1));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ลบ Food Memory ไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setDeletingId(null);
    }
  };
  return <section className="mx-auto w-full max-w-5xl px-5 pb-32 pt-8 md:px-10"><div className="flex items-end justify-between gap-4"><div><div className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">FOOD MEMORY</div><h1 className="mt-2 text-4xl font-black tracking-[-.05em] md:text-6xl">ยิ่งกิน ยิ่งรู้ใจ</h1><p className="mt-2 font-semibold text-black/45">บันทึกแล้ว {count} มื้อ · แสดงล่าสุดไม่เกิน 30 รายการ</p></div><BookHeart className="size-12 text-[#ff5b4d]" /></div>
    {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0ef] p-4 text-sm font-bold text-[#d43d32]">{error}</p>}
    {loading ? <p className="mt-8 rounded-3xl bg-white p-8 text-center font-semibold text-black/50">กำลังโหลดประวัติมื้ออาหาร…</p> : items.length ? <div className="mt-8 grid gap-4 md:grid-cols-3">{items.map((item, i) => <article key={item._id} className="group overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_50px_rgba(30,24,20,.08)]"><div className="relative h-52 overflow-hidden rounded-[20px]"><img src={item.image || "/food-noodles.jpg"} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-black">{i === 0 ? "ล่าสุด" : "บันทึกแล้ว"}</span></div><div className="p-3"><h2 className="text-xl font-black">{item.menuName}</h2><p className="mt-1 text-sm font-semibold text-black/45">{item.storeName} · {new Date(item.savedAt).toLocaleString("th-TH")}</p><div className="mt-4 flex items-center justify-between"><b>฿{item.price}</b><button type="button" onClick={() => void removeItem(item)} disabled={deletingId === item._id} aria-label={`ลบ ${item.menuName} จาก Food Memory`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-[#d43d32] transition hover:bg-[#fff0ef] disabled:cursor-wait disabled:opacity-50"><Trash2 className="size-4" />{deletingId === item._id ? "กำลังลบ…" : "ลบ"}</button></div></div></article>)}</div> : <p className="mt-8 rounded-3xl bg-white p-8 text-center font-semibold text-black/50">ยังไม่มีมื้อที่บันทึก เลือกเมนูที่ชอบจากหน้า Match แล้วกด “เลือกมื้อนี้” เพื่อเพิ่มลง Food Memory</p>}
    <div className="mt-6 rounded-[28px] bg-[#17151c] p-6 text-white"><div className="flex items-center gap-2 text-[#d7ff52]"><Sparkles className="size-5"/><b>FOOD MEMORY</b></div><p className="mt-2 max-w-2xl text-lg font-bold">รายการนี้บันทึกจากเมนูที่คุณเลือกในอุปกรณ์และโปรไฟล์เบราว์เซอร์นี้</p></div></section>;
}

function Budget({ profile }: { profile: Profile }) { const spent = 1340; const left = Math.max(profile.monthlyBudget - spent, 0); const pct = Math.min(100, Math.round((spent / profile.monthlyBudget) * 100)); return <section className="mx-auto w-full max-w-5xl px-5 pb-32 pt-8 md:px-10"><div className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">SMART BUDGET</div><h1 className="mt-2 text-4xl font-black tracking-[-.05em] md:text-6xl">เงินเหลือ ก็กินอร่อยได้</h1><div className="mt-8 grid gap-5 md:grid-cols-[1.2fr_.8fr]"><div className="rounded-[32px] bg-[#d7ff52] p-7 md:p-10"><div className="flex items-center justify-between"><span className="font-black">งบอาหารเดือนตุลาคม</span><WalletCards /></div><div className="mt-8 text-sm font-bold">คงเหลือ</div><div className="mt-1 text-6xl font-black tracking-[-.07em] md:text-8xl">฿{left.toLocaleString()}</div><div className="mt-8 h-4 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#17151c]" style={{ width: `${pct}%` }} /></div><div className="mt-3 flex justify-between text-sm font-black"><span>ใช้แล้ว ฿{spent.toLocaleString()}</span><span>{pct}% ของงบ</span></div></div><div className="rounded-[32px] bg-[#ff5b4d] p-7 text-white md:p-9"><Sparkles className="size-8"/><h2 className="mt-6 text-3xl font-black leading-tight">วันนี้ใช้ได้อีก<br/>฿{profile.dailyBudget}</h2><p className="mt-3 font-semibold text-white/75">เพื่อให้งบอยู่ถึงสิ้นเดือน เราจะจัดอันดับเมนูไม่เกิน ฿{profile.dailyBudget} ให้ก่อน</p><div className="mt-8 rounded-2xl bg-white/15 p-4"><div className="text-sm font-bold text-white/65">มื้อล่าสุด</div><div className="mt-1 flex items-center justify-between font-black"><span>กะเพราไก่ไข่ดาว</span><span>−฿50</span></div></div></div></div><div className="mt-5 grid gap-4 md:grid-cols-3">{[{icon: Clock3,title:"เหลือ 29 วัน",text:"เฉลี่ยได้วันละ ฿64"},{icon: Beef,title:"9 มื้อเดือนนี้",text:"เฉลี่ยมื้อละ ฿52"},{icon: BadgeCheck,title:"อยู่ในแผน",text:"ประหยัดกว่าเป้า ฿110"}].map(({icon:Icon,title,text})=><div key={title} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-2xl bg-[#f6f4ee]"><Icon/></span><div><b className="block">{title}</b><span className="text-sm font-semibold text-black/45">{text}</span></div></div>)}</div></section>; }

function AppShell({ profile, onReset, clientId }: { profile: Profile; onReset: () => void; clientId: string }) {
  const [screen, setScreen] = useState<"quiz" | "discover" | "memory" | "budget">("quiz"); const [toast, setToast] = useState("");
  const [rankQuery, setRankQuery] = useState(""); const [rankedScenarios, setRankedScenarios] = useState<Scenario[]>([]); const [rankStatus, setRankStatus] = useState("รอคำตอบเพื่อจัดอันดับ");
  const [rankingRun, setRankingRun] = useState(0);
  const [rankConstraints, setRankConstraints] = useState({ maxBudgetThb: profile.dailyBudget, allergies: profile.allergies.split(/[,，]/u).map((item) => item.trim()).filter(Boolean) });
  const [rankPreferences, setRankPreferences] = useState<FoodRankPreferences>({ time: "", hunger: "", mood: "", goal: "" });
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 3000); return () => window.clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (screen !== "discover" || !rankQuery) return;
    let active = true;
    let recentMenuIds: string[] = [];
    try {
      const savedIds: unknown = JSON.parse(window.localStorage.getItem("forkast-food-recent-menu-ids") || "[]");
      if (Array.isArray(savedIds)) recentMenuIds = savedIds.filter((id): id is string => typeof id === "string").slice(0, 10);
    } catch { }
    rankFilteredFoods(rankQuery, rankConstraints, rankPreferences, recentMenuIds)
      .then(({ provider, recommendations, message, explanation }) => {
        if (!active) return;
        const nextRecentIds = [...recommendations.map((item) => item.id), ...recentMenuIds.filter((id) => !recommendations.some((item) => item.id === id))].slice(0, 10);
        try { window.localStorage.setItem("forkast-food-recent-menu-ids", JSON.stringify(nextRecentIds)); } catch { }
        setRankedScenarios(recommendations.map((item) => ({
          id: item.id,
          badge: item.tags[0] || "แนะนำ",
          name: item.menuName,
          shop: item.storeName,
          price: item.price,
          location: item.location,
          score: item.score,
          reason: item.matchReasons.join(" · "),
          image: item.image,
          tags: item.tags,
          color: item.tags.includes("spicy") ? "#ffb62e" : "#d7ff52",
          sourceUrl: item.sourceUrl,
          scoreBreakdown: item.scoreBreakdown || [],
        })));
        setRankStatus(explanation?.message || message || `เทียบคำตอบกับงบและข้อมูลเมนูทั้งหมด (${provider})`);
      })
      .catch((error: unknown) => { if (active) { setRankedScenarios([]); setRankStatus(error instanceof Error ? error.message : "ค้นเมนูจากฐานข้อมูลไม่สำเร็จ"); } });
    return () => { active = false; };
  }, [rankQuery, rankConstraints, rankPreferences, screen, rankingRun]);
  useEffect(() => { const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void } }).modelContext; if (!context?.registerTool) return; const lifecycle = new AbortController(); try { context.registerTool({ name: "start_food_match", title: "เริ่ม Food Match", description: "เปิดหน้าค้นหา Food Scenario ที่เหมาะกับผู้ใช้", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async () => { setScreen("quiz"); return { status: "started" }; } }, { signal: lifecycle.signal }); context.registerTool({ name: "select_food_scenario", title: "เลือกมื้ออาหาร", description: "เลือก Food Scenario จากรหัสเมนูที่แสดง", inputSchema: { type: "object", properties: { scenarioId: { type: "string" } }, required: ["scenarioId"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => { const id = String((input as {scenarioId?: string})?.scenarioId); const s = rankedScenarios.find((x) => x.id === id); if (!s) throw new Error("ไม่พบรหัสเมนูนี้ในผลลัพธ์ปัจจุบัน"); setToast(`เลือก ${s.name} แล้ว`); setScreen("memory"); return { status: "selected", name: s.name, price: s.price }; } }, { signal: lifecycle.signal }); } catch {} return () => lifecycle.abort(); }, [rankedScenarios]);
  if (screen === "quiz") return <Quiz onDone={(answers) => { setRankStatus("กำลังค้นเมนูที่ผ่านงบและ allergy จากฐานข้อมูล…"); setRankQuery(answers.join("; ")); setRankPreferences({ time: answers[1] ?? "", hunger: answers[2] ?? "", mood: answers[3] ?? "", goal: answers[4] ?? "" }); setRankConstraints({ maxBudgetThb: budgetFromAnswer(answers[0], profile.dailyBudget), allergies: profile.allergies.split(/[,，]/u).map((item) => item.trim()).filter(Boolean) }); setScreen("discover"); }} onBack={onReset} />;
  return <main className="min-h-dvh bg-[#f6f4ee] text-[#17151c]"><header className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f4ee]/90 backdrop-blur-xl"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-10"><Logo/><div className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm sm:flex"><Navigation className="size-4 text-[#ff5b4d]"/>โรงอาหารวิศวะ ลาดกระบัง</div><button onClick={onReset} className="grid size-11 place-items-center rounded-full bg-white shadow-sm" aria-label="แก้ไขโปรไฟล์"><UserRound className="size-5"/></button></div></header>
    {screen === "discover" && <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-32 pt-8 lg:grid-cols-[.72fr_1.28fr] lg:px-10 lg:pt-12"><div className="lg:sticky lg:top-32 lg:self-start"><div className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">UP TO 3 FOOD SCENARIOS</div><h1 className="mt-2 text-5xl font-black leading-[.93] tracking-[-.06em] md:text-7xl">เลือกด้วย<br/>ความรู้สึก.<br/><span className="text-[#ff5b4d]">มั่นใจด้วย AI.</span></h1><div className="mt-7 rounded-[26px] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#d7ff52]"><Sparkles className="size-5"/></span><div><b className="block">ทำไมถึงได้เมนูชุดนี้?</b><span className="text-sm font-semibold text-black/45">จับคู่จากงบ คำตอบ และข้อมูลเมนู</span></div></div><p className="mt-4 text-sm font-semibold leading-6 text-black/55">{rankStatus}</p></div><button onClick={() => setScreen("quiz")} className="mt-5 flex items-center gap-2 text-sm font-black text-black/45"><RotateCcw className="size-4"/>เปลี่ยนคำตอบ 5 วินาที</button></div><SwipeDeck items={rankedScenarios} onNextBatch={() => { setRankedScenarios([]); setRankStatus("กำลังค้นเมนูชุดใหม่จากฐานข้อมูล…"); setRankingRun((run) => run + 1); }} onPicked={(s) => { setScreen("budget"); void saveFoodMemory(clientId, s.id).then(() => setToast(`เลือก ${s.name} · บันทึก Food Memory แล้ว`)).catch(() => setToast(`เลือก ${s.name} แล้ว แต่บันทึก Food Memory ไม่สำเร็จ`)); }} /></section>}
    {screen === "memory" && <Memory clientId={clientId} />}{screen === "budget" && <Budget profile={profile}/>}<nav className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(92%,430px)] items-center justify-around rounded-[24px] border border-white/60 bg-[#17151c]/95 px-3 py-2 text-white shadow-[0_18px_50px_rgba(0,0,0,.25)] backdrop-blur">{[{id:"discover",icon:Flame,label:"Match"},{id:"memory",icon:History,label:"Memory"},{id:"budget",icon:WalletCards,label:"งบของฉัน"}].map(({id,icon:Icon,label})=><button key={id} onClick={()=>setScreen(id as "discover"|"memory"|"budget")} className={`flex min-w-24 flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-black transition ${screen===id?"bg-[#ff5b4d]":"text-white/55 hover:text-white"}`}><Icon className={`size-5 ${screen===id&&id==="discover"?"fill-current":""}`}/>{label}</button>)}</nav>{toast && <div className="fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white shadow-xl"><Check className="size-5 text-[#d7ff52]"/>{toast}</div>}</main>;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientId, setClientId] = useState("");
  useEffect(() => {
    let id = localStorage.getItem("food-match-client-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("food-match-client-id", id); }
    setClientId(id);
    const savedProfile = localStorage.getItem("food-match-profile");
    if (savedProfile) { try { setProfile(JSON.parse(savedProfile) as Profile); } catch { localStorage.removeItem("food-match-profile"); } }
  }, []);
  const complete = (value: Profile) => { setProfile(value); localStorage.setItem("food-match-profile", JSON.stringify(value)); };
  const reset = () => { setProfile(null); localStorage.removeItem("food-match-profile"); };
  return profile ? <AppShell profile={profile} onReset={reset} clientId={clientId} /> : <Onboarding onDone={complete} clientId={clientId} />;
*/
