import test from "node:test";
import assert from "node:assert/strict";
import { generateCookRecipes, recipeTestHelpers } from "./food-recipes.mjs";

const request = {
  ingredients: ["ไข่", "ข้าว", "ไก่"],
  time: "15 นาที",
  allergies: "ถั่วลิสง",
  dislikes: "ผักชี",
  conditions: "ไม่มี",
};

function modelResponse(recipes) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ recipes }) }] } }] }), { status: 200 });
}

const recipes = [
  { name: "ข้าวผัดไก่ไข่", summary: "เมนูจานเดียวทำง่าย", minutes: 12, usedIngredientIndexes: [0, 1, 2], pantryIngredients: ["น้ำมัน", "เกลือ"], steps: ["หั่นไก่เป็นชิ้นเล็ก", "ผัดไก่ให้สุก", "ใส่ข้าวและไข่ ผัดจนร้อนทั่ว"] },
  { name: "ไข่ข้นไก่ราดข้าว", summary: "ไข่นุ่มกินคู่ข้าว", minutes: 10, usedIngredientIndexes: [0, 1, 2], pantryIngredients: ["น้ำมัน"], steps: ["ปรุงไข่ในชาม", "ผัดไก่จนสุก", "ทำไข่ข้นแล้วเสิร์ฟบนข้าว"] },
];

test("generates two validated recipes using only submitted ingredient indexes", async () => {
  const result = await generateCookRecipes(request, {
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.deepEqual(body.generationConfig.responseSchema.properties.recipes.minItems, 2);
      const indexSchema = body.generationConfig.responseSchema.properties.recipes.items.properties.usedIngredientIndexes.items;
      assert.deepEqual(indexSchema, { type: "integer", minimum: 0, maximum: 2 });
      return modelResponse(recipes);
    },
  });
  assert.equal(result.provider, "gemini");
  assert.equal(result.recipes.length, 2);
  assert.deepEqual(result.recipes[0].ingredients, ["ไข่", "ข้าว", "ไก่"]);
  assert.equal(result.recipes[0].steps.length, 3);
});

test("rejects invalid time, missing ingredients, and model ingredients outside user selection", async () => {
  assert.throws(() => recipeTestHelpers.validateRequest({ ...request, time: "5 นาที" }), /เลือกเวลา/u);
  assert.throws(() => recipeTestHelpers.validateRequest({ ...request, ingredients: [] }), /วัตถุดิบ/u);
  const invalid = structuredClone(recipes);
  invalid[0].usedIngredientIndexes = [99];
  assert.throws(() => recipeTestHelpers.parseRecipes({ recipes: invalid }, recipeTestHelpers.validateRequest(request)), /AI สร้างสูตร/u);
});

test("blocks an ingredient that directly matches a declared allergy", () => {
  assert.throws(() => recipeTestHelpers.validateRequest({ ...request, ingredients: ["ไข่", "ข้าว"], allergies: "แพ้ไข่" }), /วัตถุดิบ.*แพ้/u);
});

test("requires a server API key", async () => {
  await assert.rejects(() => generateCookRecipes(request, { apiKey: "" }), /GEMINI_API_KEY/u);
});

test("preserves Gemini's safe error response for server-side diagnosis", async () => {
  await assert.rejects(() => generateCookRecipes(request, {
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "Invalid model schema" } }), { status: 400 }),
  }), /HTTP 400: .*Invalid model schema/u);
});
