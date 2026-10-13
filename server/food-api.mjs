import { createServer } from "node:http";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.FOOD_API_PORT || 3001);
const MAX_BODY_BYTES = 64 * 1024;
const HF_MODEL = "BAAI/bge-reranker-v2-m3";
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

const allergyAliases = {
  seafood: ["seafood", "fish", "shellfish", "shrimp", "prawn", "crab", "squid", "oyster", "กุ้ง", "ปลา", "อาหารทะเล"],
  peanut: ["peanut", "ถั่วลิสง"],
  dairy: ["dairy", "milk", "นม"],
  egg: ["egg", "ไข่"],
  soy: ["soy", "tofu", "ถั่วเหลือง", "เต้าหู้"],
  gluten: ["gluten", "wheat", "แป้งสาลี"],
};

let mongoClient;
let mongoClientPromise;

async function getStoreCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!mongoClientPromise) {
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    mongoClientPromise = mongoClient.connect().catch((error) => {
      mongoClient = undefined;
      mongoClientPromise = undefined;
      throw error;
    });
  }
  const client = await mongoClientPromise;
  return client
    .db(process.env.MONGODB_DATABASE || "forkast_ai_food")
    .collection(process.env.MONGODB_COLLECTION || "Store_catalog");
}

function normalizeAllergies(values) {
  const inputs = Array.isArray(values) ? values : [];
  const groups = inputs.flatMap((value) => {
    if (typeof value !== "string") return [];
    const normalized = value.trim().toLocaleLowerCase("th");
    if (!normalized) return [];
    const group = Object.entries(allergyAliases).find(([, aliases]) =>
      aliases.some((alias) => normalized.includes(alias.toLocaleLowerCase("th"))),
    );
    return [group?.[0] || normalized];
  });
  return [...new Set(groups)];
}

function buildCandidates(stores, maxBudgetThb, allergies) {
  const allergySet = new Set(normalizeAllergies(allergies));
  const candidates = [];
  for (const store of stores) {
    if (store.Is_Active === false) continue;
    for (const [menuIndex, menu] of (Array.isArray(store.Menu) ? store.Menu : []).entries()) {
      const price = menu.Price_THB;
      if (typeof menu.Menu_Name !== "string" || !menu.Menu_Name.trim()
        || typeof price !== "number" || price > maxBudgetThb || menu.Blacklist === true) continue;
      const menuAllergens = normalizeAllergies(menu.Allergens);
      if (menuAllergens.some((allergen) => allergySet.has(allergen))) continue;

      const tags = Array.isArray(menu.Tags) ? menu.Tags.filter((tag) => typeof tag === "string") : [];
      const sourceImage = menu.Menu_Picture_Source;
      const image = typeof sourceImage === "string" && /^https:\/\//u.test(sourceImage)
        && !sourceImage.includes("example.com")
        ? sourceImage
        : tags.includes("healthy") ? "/food-friends.jpg" : tags.includes("comfort") ? "/food-ramen.jpg" : "/food-noodles.jpg";
      const storeName = typeof store.Store_Name === "string" ? store.Store_Name : "ร้านอาหาร";
      const location = typeof store.Location === "string" ? store.Location : "";
      candidates.push({
        id: `${store._id.toString()}:${menuIndex}`,
        menuName: menu.Menu_Name,
        storeName,
        location,
        price,
        tags,
        image,
        sourceUrl: typeof store.Source_Url === "string" ? store.Source_Url : "",
        text: `เมนู ${menu.Menu_Name} จากร้าน ${storeName} อยู่ที่ ${location} ราคา ${price} บาท หมวดหมู่ ${tags.join(", ")}`,
      });
    }
  }
  return candidates.slice(0, 200);
}

function localRank(query, candidates) {
  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const terms = normalizedQuery.split(/[\s,，;；/]+/u).filter((term) => term.length >= 2);
  return candidates.map(({ id, text }) => {
    const description = text.toLocaleLowerCase("th");
    const score = terms.reduce((total, term) => total + (description.includes(term) ? 1 : 0), 0)
      + (normalizedQuery.length >= 2 && description.includes(normalizedQuery) ? 2 : 0);
    return { id, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function scoreFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const score = scoreFrom(item);
      if (score !== null) return score;
    }
  }
  if (value && typeof value === "object" && "score" in value) {
    const score = Number(value.score);
    if (Number.isFinite(score)) return score;
  }
  return null;
}

async function rankWithHuggingFace(query, candidates) {
  const token = process.env.HF_TOKEN;
  if (!token) return null;
  const response = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: candidates.map(({ text }) => ({ text: query, text_pair: text })),
      parameters: { function_to_apply: "none" },
    }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const values = await response.json();
  const rows = Array.isArray(values) && values.length === candidates.length
    ? values
    : Array.isArray(values) && values.length === 1 && Array.isArray(values[0]) && values[0].length === candidates.length
      ? values[0]
      : null;
  if (!rows) return null;
  const scores = rows.map((value, index) => ({ id: candidates[index].id, score: scoreFrom(value) }));
  if (scores.some((item) => item.score === null)) return null;
  return scores.sort((a, b) => b.score - a.score);
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/food/rank") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
    return;
  }
  if (!payload || typeof payload.query !== "string" || !payload.query.trim() || payload.query.length > 5000
    || typeof payload.maxBudgetThb !== "number" || !Number.isFinite(payload.maxBudgetThb)
    || payload.maxBudgetThb < 0 || payload.maxBudgetThb > 10000
    || !Array.isArray(payload.allergies) || payload.allergies.length > 30
    || payload.allergies.some((item) => typeof item !== "string" || item.length > 100)) {
    sendJson(response, 400, { error: "Provide a query, valid maximum budget, and allergy list" });
    return;
  }

  let candidates;
  try {
    const collection = await getStoreCollection();
    const stores = await collection.find(
      { Is_Active: { $ne: false } },
      { projection: { Store_Name: 1, Location: 1, Source_Url: 1, Is_Active: 1, Menu: 1 } },
    ).limit(500).toArray();
    candidates = buildCandidates(stores, payload.maxBudgetThb, payload.allergies);
  } catch (error) {
    console.error("MongoDB menu lookup failed:", error);
    sendJson(response, 503, { error: "MongoDB menu lookup failed. Check MONGODB_URI, database, and collection settings." });
    return;
  }

  if (candidates.length === 0) {
    sendJson(response, 200, { recommendations: [], provider: "local", message: "ไม่มีเมนูที่ผ่านงบและเงื่อนไขการแพ้" });
    return;
  }

  let scores;
  let provider;
  try {
    scores = await rankWithHuggingFace(payload.query, candidates);
    provider = scores ? "huggingface" : process.env.HF_TOKEN ? "local-fallback" : "local";
  } catch {
    scores = null;
    provider = "local-fallback";
  }
  scores ??= localRank(payload.query, candidates);
  const scoreById = new Map(scores.map(({ id, score }) => [id, score]));
  const recommendations = candidates
    .map((candidate) => ({ ...candidate, score: scoreById.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  sendJson(response, 200, { recommendations, provider });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Forkast food API listening on port ${PORT}`);
});

async function shutdown() {
  server.close();
  if (mongoClient) await mongoClient.close().catch(() => {});
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
