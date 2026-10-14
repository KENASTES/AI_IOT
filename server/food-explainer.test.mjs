import assert from "node:assert/strict";
import test from "node:test";
import { explainRecommendations } from "./food-explainer.mjs";

const preferences = { time: "รีบมาก 10 นาที", hunger: "หิวจนตาลาย", mood: "เบาแต่ไม่จืด", goal: "โปรตีน" };
const recommendations = [
  { id: "menu-1", menuName: "ข้าวไก่", price: 45, tags: ["quick", "healthy", "protein"], matchReasons: [] },
  { id: "menu-2", menuName: "ข้าวผัด", price: 50, tags: ["comfort"], matchReasons: [] },
];

test("Gemini can select only reason codes supported by MongoDB facts", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, {
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.generationConfig.responseFormat.text.mimeType, "application/json");
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
  const result = await explainRecommendations(recommendations, preferences, 60, { apiKey: "" });

  assert.equal(result.provider, "database");
  assert.match(result.message, /AI ยังไม่พร้อม/u);
  assert.match(result.recommendations[0].matchReasons.join(" "), /฿45/);
  assert.match(result.recommendations[0].matchReasons.join(" "), /สุขภาพดี/);
  assert.doesNotMatch(result.recommendations[1].matchReasons.join(" "), /โปรตีน/);
});

test("malformed or unavailable Gemini response falls back instead of exposing raw text", async () => {
  const result = await explainRecommendations(recommendations, preferences, 60, {
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) }),
  });

  assert.equal(result.provider, "database");
  assert.doesNotMatch(JSON.stringify(result), /not json/u);
});
