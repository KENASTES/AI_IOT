import assert from "node:assert/strict";
import test from "node:test";
import { scoreCandidates } from "./food-ranking.mjs";

const candidates = [
  { id: "quick-spicy", price: 50, tags: ["quick", "spicy"] },
  { id: "comfort", price: 40, tags: ["comfort"] },
];

test("scores menu tags and budget preferences instead of returning a 50% baseline", () => {
  const result = scoreCandidates(candidates, {
    time: "รีบมาก 10 นาที",
    mood: "ของแซ่บ",
  }, 100);

  assert.equal(result.recommendations[0].id, "quick-spicy");
  assert.equal(result.recommendations[0].score, 95);
  assert.equal(result.recommendations[1].score, 28);
  assert.match(result.recommendations[0].matchReasons.join(" "), /spicy/u);
  assert.deepEqual(result.recommendations[0].scoreBreakdown.map(({ label, score }) => [label, score]), [
    ["งบ", 85], ["เวลา", 100], ["อารมณ์", 100],
  ]);
  assert.match(result.message, /คะแนน Match คำนวณจาก งบ \d+% \+ เวลา \d+% \+ อารมณ์ \d+%/u);
});

test("marks a preference unsupported when MongoDB candidates have no matching tag", () => {
  const result = scoreCandidates(
    [{ id: "plain", price: 50, tags: ["comfort"] }],
    { mood: "ของแซ่บ" },
    50,
  );

  assert.equal(result.recommendations[0].score, 70);
  assert.deepEqual(result.unsupportedCriteria, ["อารมณ์ (spicy)"]);
  assert.match(result.message, /ยังไม่รวมเกณฑ์/u);
});

test("scores are deterministic for the same preferences and database data", () => {
  const preferences = { mood: "ฮีลใจ", goal: "เซอร์ไพรส์ฉัน" };
  const first = scoreCandidates(candidates, preferences, 100);
  const second = scoreCandidates(candidates, preferences, 100);

  assert.deepEqual(first.recommendations, second.recommendations);
  assert.deepEqual(first.unsupportedCriteria, ["ความหลากหลาย (ยังไม่มีประวัติเมนูที่ผู้ใช้เคยเลือก)"]);
});

test("treats the existing hearty tag as the filling preference", () => {
  const result = scoreCandidates([
    { id: "hearty", price: 40, tags: ["hearty"] },
    { id: "other", price: 40, tags: ["quick", "snack"] },
  ], { hunger: "หิวจนตาลาย" }, 60);

  assert.equal(result.recommendations[0].id, "hearty");
  assert.equal(result.unsupportedCriteria.includes("ระดับความอิ่ม (filling)"), false);
});

test("does not score unknown fullness tags as zero", () => {
  const result = scoreCandidates([
    { id: "unknown-fullness", price: 50, tags: ["comfort"] },
    { id: "known-fullness", price: 50, tags: ["filling"] },
  ], { hunger: "หิวจนตาลาย" }, 50);

  assert.deepEqual(result.recommendations.map((item) => item.score), [70, 70]);
  assert.ok(result.recommendations.every((item) => item.scoreBreakdown.every(({ label }) => label !== "ความอิ่ม")));
  assert.deepEqual(result.unsupportedCriteria, ["ความอิ่ม (ข้อมูลร้านยังระบุไม่ครบทุกเมนู)"]);
});
