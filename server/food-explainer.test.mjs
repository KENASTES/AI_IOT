import assert from "node:assert/strict";
import test from "node:test";
import { explainRecommendations } from "./food-explainer.mjs";

const preferences = { time: "รีบมาก 10 นาที", hunger: "หิวจนตาลาย", mood: "เบาแต่ไม่จืด", goal: "โปรตีน" };
const recommendations = [
  { id: "menu-1", menuName: "ข้าวไก่", storeName: "ร้านหนึ่ง", score: 90, price: 45, tags: ["quick", "healthy", "protein"], matchReasons: [] },
  { id: "menu-2", menuName: "ข้าวผัด", storeName: "ร้านสอง", score: 88, price: 50, tags: ["comfort"], matchReasons: [] },
];

test("Gemini can select only reason codes supported by MongoDB facts", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, [], {
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.generationConfig.responseFormat.text.mimeType, "application/json");
      assert.equal(request.generationConfig.responseFormat.text.schema.properties.items.type, "array");
      assert.equal(request.generationConfig.thinkingConfig.thinkingBudget, 0);
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [
          { id: "menu-1", reasonCodes: ["mood_match", "goal_match", "unsupported", "budget_fit"] },
          { id: "menu-2", reasonCodes: ["goal_match"] },
        ] }) }] } }] }),
      };
    },
  });

  assert.equal(result.provider, "gemini");
  assert.match(result.recommendations[0].matchReasons.join(" "), /อารมณ์/);
  assert.match(result.recommendations[0].matchReasons.join(" "), /เป้าหมาย/);
  assert.doesNotMatch(result.recommendations[0].matchReasons.join(" "), /unsupported|Gemini/);
  assert.match(result.recommendations[1].matchReasons.join(" "), /ราคา ฿50/);
});

test("missing API key falls back to safe, grounded reasons", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, [], { apiKey: "", random: () => 0 });

  assert.equal(result.provider, "database");
  assert.match(result.message, /คัดจากข้อมูลร้านและเมนู/u);
  assert.match(result.message, /กรองงบและอาหารที่แพ้ก่อน/u);
  assert.doesNotMatch(result.message, /AI ยังไม่พร้อม|สุ่มเมนู/u);
  const fallbackReasons = result.recommendations.flatMap((item) => item.matchReasons).join(" ");
  assert.match(fallbackReasons, /฿45/);
  assert.match(fallbackReasons, /สุขภาพดี/);
  const nonProteinMenu = result.recommendations.find((item) => item.id === "menu-2");
  assert.ok(nonProteinMenu);
  assert.doesNotMatch(nonProteinMenu.matchReasons.join(" "), /โปรตีน/);
});

test("malformed or unavailable Gemini response falls back instead of exposing raw text", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, [], {
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) }),
  });

  assert.equal(result.provider, "database");
  assert.doesNotMatch(JSON.stringify(result), /not json/u);
});

test("ignores Gemini thought parts and extracts JSON after a short preamble", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, [], {
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [
        { text: "Here is the reasoning, I should choose the quick healthy item.", thought: true },
        { text: `Here is the result:\n${JSON.stringify({ items: [{ id: "menu-1", reasonCodes: ["mood_match", "goal_match"] }, { id: "menu-2", reasonCodes: ["budget_fit"] }] })}` },
      ] } }] }),
    }),
  });

  assert.equal(result.provider, "gemini");
  assert.equal(result.recommendations[0].id, "menu-1");
});

test("reports Gemini finish metadata when no final text is returned", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, [], {
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ promptFeedback: { blockReason: "SAFETY" }, candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "internal reasoning", thought: true }] } }] }),
    }),
  });

  assert.equal(result.provider, "database");
});

test("recently displayed IDs are avoided and the fallback prefers different stores", async () => {
  const pool = [
    ...recommendations,
    { id: "menu-3", menuName: "ข้าวหมู", storeName: "ร้านสาม", score: 86, price: 48, tags: ["filling"], matchReasons: [] },
    { id: "menu-4", menuName: "ข้าวปลา", storeName: "ร้านสี่", score: 85, price: 50, tags: ["quick"], matchReasons: [] },
  ];
  const result = await explainRecommendations(pool, preferences, 60, ["menu-1", "menu-2"], { apiKey: "", random: () => 0 });

  assert.equal(result.recommendations.length, 2);
  assert.ok(result.recommendations.every((item) => item.id !== "menu-1" && item.id !== "menu-2"));
  assert.notEqual(result.recommendations[0].storeName, result.recommendations[1].storeName);
});
