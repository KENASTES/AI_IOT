"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookHeart, Check, ChefHat, Flame,
  Heart, MapPin, Menu, Navigation, Plus, RotateCcw, Save, Sparkles,
  UserRound, WalletCards, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type Screen = "home" | "eat" | "cook" | "memory";
type Profile = {
  name: string; age: string; height: string; weight: string;
  allergies: string; conditions: string; dislikes: string;
  monthlyBudget: number; dailyBudget: number;
};
type Scenario = {
  id: number; badge: string; name: string; shop: string; price: number;
  walk: string; wait: string; score: number; reason: string;
  image: string; color: string;
};

const emptyProfile: Profile = { name: "", age: "", height: "", weight: "", allergies: "", conditions: "", dislikes: "", monthlyBudget: 3200, dailyBudget: 95 };
const demoProfile: Profile = { name: "มินท์", age: "20", height: "162", weight: "52", allergies: "ถั่วลิสง", conditions: "ไม่มี", dislikes: "ไม่กินเผ็ดมาก", monthlyBudget: 3200, dailyBudget: 95 };

const scenarios: Scenario[] = [
  { id: 1, badge: "อิ่มคุ้ม", name: "ก๋วยเตี๋ยวคั่วไก่ไข่ออนเซ็น", shop: "ร้านป้าหนิง · โรงอาหารวิศวะ", price: 55, walk: "2 นาที", wait: "คิว 6 นาที", score: 94, reason: "พอดีกับงบวันนี้ อิ่มนาน และผ่านข้อจำกัดในโปรไฟล์แล้ว", image: "/food-noodles.jpg", color: "#d7ff52" },
  { id: 2, badge: "ฮีลใจ", name: "ราเมนหมูย่างไข่ต้ม", shop: "ครัวลุงหนวด · โซน B", price: 65, walk: "4 นาที", wait: "คิว 4 นาที", score: 89, reason: "เข้ากับมู้ดอยากกินร้อน ๆ และยังเหลืองบสำหรับเครื่องดื่ม", image: "/food-ramen.jpg", color: "#ffb62e" },
];

const quiz = [
  { title: "มื้อนี้มีงบเท่าไหร่?", kicker: "1 · BUDGET", options: ["ไม่เกิน ฿50", "฿50–70", "ได้หมดถ้าอร่อย"] },
  { title: "มีเวลากี่นาที?", kicker: "2 · TIME", options: ["รีบมาก 10 นาที", "สบาย ๆ 20 นาที", "ไม่รีบ"] },
  { title: "หิวระดับไหน?", kicker: "3 · HUNGER", options: ["กินเล่น", "กำลังดี", "หิวจนตาลาย"] },
  { title: "วันนี้อยากได้ฟีลไหน?", kicker: "4 · MOOD", options: ["ฮีลใจ", "ของแซ่บ", "เบาแต่ไม่จืด"] },
  { title: "มื้อนี้เอาอะไรเป็นหลัก?", kicker: "5 · GOAL", options: ["อิ่มคุ้ม", "โปรตีน", "เซอร์ไพรส์ฉัน"] },
];

const recipes = [
  { name: "ข้าวผัดไข่คลีนตู้เย็น", time: "15 นาที", fit: "ใช้วัตถุดิบที่เลือกครบ ทำกระทะเดียว และปรับรสตามโปรไฟล์", image: "/food-friends.jpg", ingredients: ["ข้าว", "ไข่", "ผักรวม", "ซีอิ๊ว"] },
  { name: "บะหมี่ไข่ออนเซ็นซุปหอม", time: "20 นาที", fit: "เหมาะกับวันอยากกินของร้อน ใช้อุปกรณ์น้อยและคุมงบได้", image: "/food-noodles.jpg", ingredients: ["เส้น", "ไข่", "ต้นหอม", "น้ำซุป"] },
];

const memoryItems = [
  { name: "ข้าวกะเพราไก่ไข่ดาว", date: "เมื่อวาน · 12:14", price: 50, image: "/food-friends.jpg" },
  { name: "ก๋วยเตี๋ยวคั่วไก่", date: "30 ก.ย. · 12:32", price: 55, image: "/food-noodles.jpg" },
  { name: "ราเมนหมูย่าง", date: "28 ก.ย. · 18:05", price: 65, image: "/food-ramen.jpg" },
];

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
}

function Field({ label, value, onChange, placeholder, wide, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean; type?: string }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-black">{label}</span><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-12 rounded-2xl border-black/10 bg-[#f6f4ee] px-4" /></label>;
}

function HomePage({ go, profile }: { go: (s: Screen) => void; profile: Profile }) {
  return <>
    <section className="relative overflow-hidden px-5 pb-16 pt-8 md:px-10 md:pb-24 md:pt-12"><div className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-[#ff5b4d]/15 blur-3xl" /><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.04fr_.96fr] lg:items-center">
      <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full bg-[#17151c] px-4 py-2 text-sm font-black text-white"><Sparkles className="size-4 text-[#d7ff52]" /> AI ผู้ช่วยเรื่องมื้ออาหารของคุณ</span><h1 className="mt-6 max-w-3xl text-[clamp(3.5rem,7vw,7.2rem)] font-black leading-[.84] tracking-[-.075em]">วันนี้<br /><span className="text-[#ff5b4d]">กินอะไรดี?</span></h1><p className="mt-7 max-w-xl text-lg font-semibold leading-8 text-black/55">Food Match ช่วยทั้งวันที่อยากออกไปกิน และวันที่อยากเปิดตู้เย็นทำเอง โดยใช้เวลา งบ วัตถุดิบ และข้อมูลส่วนตัวที่บันทึกไว้</p><div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => go("eat")} className="h-14 rounded-full bg-[#ff5b4d] px-7 text-base font-black text-white hover:bg-[#ec493d]">เริ่มหาเมนูใกล้ฉัน <ArrowRight className="ml-2 size-5" /></Button><Button onClick={() => go("cook")} variant="outline" className="h-14 rounded-full border-black/15 bg-white px-7 text-base font-black">เปิดตู้เย็นทำเอง <ChefHat className="ml-2 size-5" /></Button></div>{profile.name && <p className="mt-5 text-sm font-bold text-black/45">สวัสดี {profile.name} · โปรไฟล์พร้อมสำหรับการวิเคราะห์แล้ว</p>}</div>
      <div className="relative min-h-[570px]"><div className="absolute right-0 top-0 h-[520px] w-[84%] overflow-hidden rounded-[48px] bg-[#17151c] shadow-[0_45px_90px_rgba(24,18,15,.22)]"><img src="/food-hero.jpg" alt="คนกำลังกินอาหาร" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7 text-white"><span className="rounded-full bg-[#d7ff52] px-3 py-1 text-xs font-black text-black">94% MATCH</span><p className="mt-3 text-3xl font-black">มื้อที่ใช่ ไม่ต้องคิดนาน</p></div></div><div className="absolute bottom-0 left-0 w-[270px] -rotate-3 rounded-[30px] bg-[#d7ff52] p-6 shadow-2xl"><ChefHat className="size-8" /><b className="mt-4 block text-2xl leading-tight">มีไข่กับข้าว?<br />ได้ 2 เมนูพอดี</b><span className="mt-3 block text-sm font-bold text-black/55">Cook Match · 15 นาที</span></div></div>
    </div></section>
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

function EatPage({ profile, needProfile, addMeal }: { profile: Profile; needProfile: () => void; addMeal: (s: Scenario) => void }) {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro"); const [step, setStep] = useState(0); const start = () => profile.name ? setPhase("quiz") : needProfile();
  if (phase === "quiz") return <section className="mx-auto min-h-[calc(100dvh-76px)] max-w-3xl px-5 py-10"><button onClick={() => setPhase("intro")} className="flex items-center gap-2 text-sm font-black text-black/45"><ArrowLeft className="size-4" />กลับ</button><div className="mt-8 flex gap-2">{quiz.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-[#ff5b4d]" : "bg-black/10"}`} />)}</div><div className="mt-7 rounded-[38px] bg-[#17151c] p-7 text-white shadow-2xl md:p-11"><span className="text-sm font-black tracking-[.18em] text-[#d7ff52]">{quiz[step].kicker}</span><h1 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-6xl">{quiz[step].title}</h1><div className="mt-9 grid gap-3">{quiz[step].options.map((option, i) => <button key={option} onClick={() => step === quiz.length - 1 ? setPhase("result") : setStep((v) => v + 1)} className="flex min-h-16 items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] px-5 text-left text-lg font-black transition hover:bg-[#ff5b4d]"><span>{option}</span><span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm">{i + 1}</span></button>)}</div></div></section>;
  if (phase === "result") return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[.7fr_1.3fr] lg:px-10"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">2 FOOD SCENARIOS</span><h1 className="mt-3 text-5xl font-black leading-[.92] tracking-[-.06em] md:text-7xl">เลือกด้วย<br />ความรู้สึก.<br /><span className="text-[#ff5b4d]">มั่นใจด้วย AI.</span></h1><div className="mt-7 rounded-[26px] bg-white p-5 shadow-sm"><b>ใช้โปรไฟล์ของ {profile.name}</b><p className="mt-2 text-sm font-semibold leading-6 text-black/50">ระบบคัดข้อแพ้ สิ่งที่ไม่กิน งบ ฿{profile.dailyBudget} และระยะเดินให้แล้ว จึงไม่ต้องกรอกซ้ำในหน้านี้</p></div><button onClick={() => { setStep(0); setPhase("quiz"); }} className="mt-5 flex items-center gap-2 text-sm font-black text-black/45"><RotateCcw className="size-4" />ตอบใหม่อีกครั้ง</button></div><SwipeDeck onPicked={addMeal} /></section>;
  return <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:py-20"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#ff5b4d]/10 px-4 py-2 text-sm font-black text-[#ff5b4d]"><Zap className="size-4 fill-current" /> SWIPE 5 วินาที</span><h1 className="mt-6 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-8xl">ออกไปกิน<br /><span className="text-[#ff5b4d]">อะไรดี?</span></h1><p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-black/55">ตอบแค่เรื่องมื้อนี้: งบ เวลา ความหิว และมู้ด ส่วนข้อมูลสุขภาพและอาหารที่ไม่กิน เราดึงจาก Dashboard ให้อัตโนมัติ</p><Button onClick={start} className="mt-8 h-14 rounded-full bg-[#17151c] px-8 text-base font-black text-white hover:bg-black">เริ่มหา Food Match <ArrowRight className="ml-2" /></Button></div><div className="relative min-h-[560px]"><div className="absolute right-6 top-0 h-[500px] w-[76%] rotate-3 overflow-hidden rounded-[42px] bg-[#17151c] p-3 shadow-2xl"><img src="/food-ramen.jpg" alt="ราเมน" className="h-full w-full rounded-[32px] object-cover" /></div><div className="absolute bottom-0 left-0 w-[260px] -rotate-6 rounded-[28px] bg-[#d7ff52] p-6 shadow-xl"><b className="text-5xl tracking-[-.06em]">94%</b><span className="mt-1 block font-black">เหมาะกับมื้อนี้</span><p className="mt-3 text-sm font-bold text-black/50">฿65 · เดิน 4 นาที</p></div></div></section>;
}

function SwipeDeck({ onPicked }: { onPicked: (s: Scenario) => void }) {
  const [index, setIndex] = useState(0); const [dragX, setDragX] = useState(0); const [dragging, setDragging] = useState(false); const startX = useRef(0); const card = scenarios[index % scenarios.length]; const next = scenarios[(index + 1) % scenarios.length];
  const choose = (liked: boolean) => { if (liked) onPicked(card); setIndex((v) => v + 1); setDragX(0); };
  return <div className="relative mx-auto w-full max-w-[440px]"><div className="absolute inset-x-5 top-5 h-[610px] rotate-3 overflow-hidden rounded-[38px] bg-white opacity-60"><img src={next.image} alt="" className="h-full w-full object-cover opacity-35" /></div><article onPointerDown={(e) => { startX.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => dragging && setDragX(e.clientX - startX.current)} onPointerUp={() => { setDragging(false); if (Math.abs(dragX) > 100) choose(dragX > 0); else setDragX(0); }} className="relative h-[610px] touch-none overflow-hidden rounded-[38px] bg-[#17151c] shadow-[0_36px_80px_rgba(22,18,17,.22)]" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, transition: dragging ? "none" : "transform .3s" }}><img src={card.image} alt={card.name} className="h-full w-full select-none object-cover" draggable={false} /><div className="absolute inset-0 bg-gradient-to-t from-[#17151c] via-black/15 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7 text-white"><div className="flex justify-between"><span className="rounded-full px-3 py-1 text-sm font-black text-black" style={{ backgroundColor: card.color }}>{card.score}% MATCH</span><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{card.badge}</span></div><h2 className="mt-4 text-3xl font-black leading-tight">{card.name}</h2><p className="mt-2 flex items-center gap-1.5 font-bold text-white/75"><MapPin className="size-4" />{card.shop}</p><p className="mt-4 text-sm font-semibold leading-6 text-white/65">{card.reason}</p><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-5 text-center"><Stat value={`฿${card.price}`} label="ราคา" /><Stat value={card.walk} label="ระยะเดิน" /><Stat value={card.wait} label="เวลารอ" /></div></div></article><div className="relative mt-7 flex justify-center gap-5"><button onClick={() => choose(false)} className="grid size-16 place-items-center rounded-full bg-white text-[#ff5b4d] shadow-xl"><X className="size-8" /></button><button onClick={() => choose(true)} className="grid size-16 place-items-center rounded-full bg-[#d7ff52] shadow-xl"><Heart className="size-8 fill-current" /></button></div><p className="mt-4 text-center text-sm font-bold text-black/40">ลากซ้ายเพื่อผ่าน · ลากขวาเพื่อ Match</p></div>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div><b className="block">{value}</b><span className="text-xs text-white/50">{label}</span></div>; }

function CookPage({ profile, needProfile }: { profile: Profile; needProfile: () => void }) {
  const options = ["ไข่", "ข้าว", "ไก่", "หมู", "เส้น", "ผัก", "เต้าหู้", "ชีส"]; const [selected, setSelected] = useState<string[]>(["ไข่", "ข้าว"]); const [custom, setCustom] = useState(""); const [time, setTime] = useState("15 นาที"); const [result, setResult] = useState(false);
  const toggle = (item: string) => setSelected((v) => v.includes(item) ? v.filter((x) => x !== item) : [...v, item]); const generate = () => { if (!profile.name) return needProfile(); if (custom.trim()) setSelected((v) => [...new Set([...v, custom.trim()])]); setResult(true); };
  return <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14"><div className="grid gap-9 lg:grid-cols-[.8fr_1.2fr]"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#d7ff52] px-4 py-2 text-sm font-black"><ChefHat className="size-4" /> COOK MATCH</span><h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] md:text-7xl">มีอะไรอยู่<br />ในครัวบ้าง?</h1><p className="mt-5 max-w-lg font-semibold leading-7 text-black/55">เลือกวัตถุดิบและเวลาที่มี ระบบจะเสนอ 2 เมนูที่ทำได้จริง พร้อมเหตุผลและขั้นตอนย่อ</p><div className="mt-8 overflow-hidden rounded-[32px]"><img src="/food-noodles.jpg" alt="อาหารทำเอง" className="h-72 w-full object-cover" /></div></div><div className="rounded-[34px] bg-white p-6 shadow-[0_25px_70px_rgba(30,24,20,.09)] md:p-9"><label className="text-sm font-black">1. เลือกวัตถุดิบที่มี</label><div className="mt-4 flex flex-wrap gap-2">{options.map((item) => <button key={item} onClick={() => toggle(item)} className={`rounded-full border px-4 py-2 text-sm font-black transition ${selected.includes(item) ? "border-[#17151c] bg-[#17151c] text-white" : "border-black/10 bg-[#f6f4ee]"}`}>{selected.includes(item) ? <Check className="mr-1 inline size-4" /> : <Plus className="mr-1 inline size-4" />}{item}</button>)}</div><div className="mt-4 flex gap-2"><Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="เพิ่มวัตถุดิบ เช่น มะเขือเทศ" className="h-12 rounded-2xl border-black/10 bg-[#f6f4ee]" /><button onClick={() => { if (custom.trim()) { setSelected((v) => [...new Set([...v, custom.trim()])]); setCustom(""); } }} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#d7ff52]"><Plus /></button></div><label className="mt-7 block text-sm font-black">2. มีเวลาทำเท่าไหร่</label><div className="mt-3 grid grid-cols-3 gap-2">{["15 นาที", "30 นาที", "ไม่รีบ"].map((item) => <button key={item} onClick={() => setTime(item)} className={`rounded-2xl px-3 py-3 text-sm font-black ${time === item ? "bg-[#ff5b4d] text-white" : "bg-[#f6f4ee]"}`}>{item}</button>)}</div><div className="mt-6 rounded-2xl bg-[#f6f4ee] p-4 text-sm font-semibold leading-6 text-black/55"><Sparkles className="mr-2 inline size-5 text-[#ff5b4d]" />จะคัดข้อแพ้และสิ่งที่ไม่กินจาก Dashboard ของ {profile.name || "คุณ"} ให้อัตโนมัติ</div><Button onClick={generate} disabled={!selected.length} className="mt-5 h-14 w-full rounded-2xl bg-[#17151c] text-base font-black text-white hover:bg-black">คิดเมนูจากของที่มี <Sparkles className="ml-2 size-5" /></Button></div></div>{result && <div className="mt-12"><div className="flex items-end justify-between gap-4"><div><span className="text-sm font-black tracking-[.16em] text-[#ff5b4d]">2 RECIPE SCENARIOS</span><h2 className="mt-2 text-4xl font-black tracking-[-.05em] md:text-6xl">วันนี้ทำเมนูนี้ได้เลย</h2></div><button onClick={() => setResult(false)} className="hidden items-center gap-2 text-sm font-black text-black/45 md:flex"><RotateCcw className="size-4" />เลือกใหม่</button></div><div className="mt-7 grid gap-5 md:grid-cols-2">{recipes.map((recipe, i) => <article key={recipe.name} className="overflow-hidden rounded-[32px] bg-[#17151c] text-white"><div className="relative h-64"><img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" /><span className="absolute left-5 top-5 rounded-full px-4 py-2 text-sm font-black text-black" style={{ background: i ? "#ffb62e" : "#d7ff52" }}>{i ? "88" : "95"}% MATCH</span></div><div className="p-6"><h3 className="text-2xl font-black">{recipe.name}</h3><div className="mt-3 flex gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{recipe.time}</span><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">ทำง่าย</span></div><p className="mt-4 text-sm font-semibold leading-6 text-white/60">{recipe.fit}</p><div className="mt-5 flex flex-wrap gap-2">{recipe.ingredients.map((x) => <span key={x} className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold">{x}</span>)}</div><button className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 font-black text-[#17151c]">ดูวิธีทำแบบย่อ <ArrowRight /></button></div></article>)}</div></div>}</section>;
}

function MemoryPage({ profile }: { profile: Profile }) {
  const spent = 1340; const left = Math.max(profile.monthlyBudget - spent, 0); const pct = Math.min(100, Math.round((spent / profile.monthlyBudget) * 100));
  return <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-sm font-black tracking-[.18em] text-[#ff5b4d]">FOOD MEMORY</span><h1 className="mt-2 text-5xl font-black tracking-[-.06em] md:text-7xl">ยิ่งกิน ยิ่งรู้ใจ</h1></div><div className="rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white">เรียนรู้แล้ว 12 มื้อ</div></div><div className="mt-8 grid gap-5 md:grid-cols-3">{memoryItems.map((item, i) => <article key={item.name} className="group overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_50px_rgba(30,24,20,.08)]"><div className="relative h-52 overflow-hidden rounded-[20px]"><img src={item.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-black">{i === 0 ? "ล่าสุด" : "ชอบ"}</span></div><div className="p-3"><h2 className="text-xl font-black">{item.name}</h2><p className="mt-1 text-sm font-semibold text-black/45">{item.date}</p><div className="mt-4 flex justify-between"><b>฿{item.price}</b><Heart className="size-5 fill-[#ff5b4d] text-[#ff5b4d]" /></div></div></article>)}</div><div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-[32px] bg-[#d7ff52] p-7 md:p-10"><div className="flex justify-between"><b>SMART BUDGET · เดือนนี้</b><WalletCards /></div><span className="mt-8 block text-sm font-black">คงเหลือ</span><div className="mt-1 text-6xl font-black tracking-[-.07em] md:text-8xl">฿{left.toLocaleString()}</div><div className="mt-8 h-4 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#17151c]" style={{ width: `${pct}%` }} /></div><div className="mt-3 flex justify-between text-sm font-black"><span>ใช้แล้ว ฿{spent.toLocaleString()}</span><span>{pct}% ของงบ</span></div></div><div className="rounded-[32px] bg-[#ff5b4d] p-7 text-white md:p-9"><Sparkles className="size-8" /><h2 className="mt-6 text-3xl font-black">AI Insight ของ {profile.name || "คุณ"}</h2><p className="mt-3 font-semibold leading-7 text-white/75">มักเลือกอาหารเส้นช่วงกลางวัน และชอบเมนูที่รอไม่เกิน 8 นาที ระบบจะดันตัวเลือกแบบนี้ขึ้นก่อน</p><div className="mt-8 rounded-2xl bg-white/15 p-4"><span className="text-sm font-bold text-white/65">งบแนะนำวันนี้</span><b className="mt-1 block text-3xl">฿{profile.dailyBudget}</b></div></div></div></section>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home"); const [profile, setProfile] = useState<Profile>(emptyProfile); const [profileOpen, setProfileOpen] = useState(false); const [toast, setToast] = useState("");
  useEffect(() => { try { const saved = localStorage.getItem("food-match-profile-v2") || localStorage.getItem("food-match-profile"); if (saved) setProfile({ ...emptyProfile, ...JSON.parse(saved) }); } catch {} }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(id); }, [toast]);
  const greeting = useMemo(() => profile.name ? `โปรไฟล์ของ ${profile.name}` : "สร้างโปรไฟล์ส่วนตัว", [profile.name]);
  const navigate = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveProfile = (next: Profile) => { setProfile(next); localStorage.setItem("food-match-profile-v2", JSON.stringify(next)); setProfileOpen(false); setToast("บันทึกโปรไฟล์แล้ว · ระบบจะจำไว้ครั้งต่อไป"); };
  const addMeal = (meal: Scenario) => { setToast(`บันทึก ${meal.name} และหักงบ ฿${meal.price} แล้ว`); navigate("memory"); };
  return <main className="min-h-dvh bg-[#f6f4ee] text-[#17151c]"><Header screen={screen} onNavigate={navigate} onProfile={() => setProfileOpen(true)} />{screen === "home" && <HomePage go={navigate} profile={profile} />}{screen === "eat" && <EatPage profile={profile} needProfile={() => setProfileOpen(true)} addMeal={addMeal} />}{screen === "cook" && <CookPage profile={profile} needProfile={() => setProfileOpen(true)} />}{screen === "memory" && <MemoryPage profile={profile} />}<footer className="border-t border-black/[.06] px-5 py-8 md:px-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><Logo onClick={() => navigate("home")} /><p className="text-sm font-semibold text-black/40">Demo · โรงอาหารคณะวิศวกรรมศาสตร์ ลาดกระบัง</p><button onClick={() => setProfileOpen(true)} className="rounded-full bg-white px-4 py-2 text-sm font-black">{greeting}</button></div></footer><ProfileDrawer open={profileOpen} value={profile} onClose={() => setProfileOpen(false)} onSave={saveProfile} />{toast && <div className="fixed left-1/2 top-24 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#17151c] px-5 py-3 text-sm font-black text-white shadow-xl"><Check className="size-5 text-[#d7ff52]" />{toast}</div>}</main>;
}
