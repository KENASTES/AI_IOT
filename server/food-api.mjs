import { createServer } from "node:http";
import { MongoClient, ObjectId } from "mongodb";
import { scoreCandidates } from "./food-ranking.mjs";
import { explainRecommendations } from "./food-explainer.mjs";

const PORT = Number(process.env.FOOD_API_PORT || 3001);
const MAX_BODY_BYTES = 64 * 1024;

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

async function getDatabase() {
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
  return client.db(process.env.MONGODB_DATABASE || "forkast_ai_food");
}

function validClientId(value) {
  return typeof value === "string" && /^[a-f0-9-]{16,64}$/iu.test(value);
}

async function getStats(clientId) {
  const database = await getDatabase();
  const storeCollection = database.collection(process.env.MONGODB_COLLECTION || "Store_catalog");
  const stores = await storeCollection.find({ Is_Active: { $ne: false } }, { projection: { Menu: 1 } }).limit(500).toArray();
  const storeCount = stores.length;
  const menuCount = stores.reduce((count, store) => count + (Array.isArray(store.Menu)
    ? store.Menu.filter((menu) => typeof menu?.Menu_Name === "string" && typeof menu?.Price_THB === "number" && menu.Blacklist !== true).length
    : 0), 0);
  const memoryCount = validClientId(clientId)
    ? await database.collection("food_memories").countDocuments({ clientId })
    : 0;
  return { storeCount, menuCount, memoryCount };
}

async function listMemories(clientId) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  const database = await getDatabase();
  const collection = database.collection("food_memories");
  const [items, count] = await Promise.all([
    collection.find({ clientId }).sort({ savedAt: -1 }).limit(30).toArray(),
    collection.countDocuments({ clientId }),
  ]);
  return { items, count };
}

async function saveMemory(clientId, menuId) {
  if (!validClientId(clientId) || typeof menuId !== "string") throw new Error("A valid clientId and menuId are required");
  const [storeId, indexText] = menuId.split(":");
  if (!ObjectId.isValid(storeId) || !/^\d{1,4}$/u.test(indexText || "")) throw new Error("Invalid menuId");
  const store = await (await getStoreCollection()).findOne({ _id: new ObjectId(storeId), Is_Active: { $ne: false } }, {
    projection: { Store_Name: 1, Location: 1, Menu: 1 },
  });
  const menu = store?.Menu?.[Number(indexText)];
  if (!menu || typeof menu.Menu_Name !== "string" || typeof menu.Price_THB !== "number" || menu.Blacklist === true) {
    throw new Error("Menu not found or unavailable");
  }
  const record = {
    clientId,
    menuId,
    menuName: menu.Menu_Name,
    storeName: store.Store_Name || "ร้านอาหาร",
    location: store.Location || "",
    price: menu.Price_THB,
    image: typeof menu.Menu_Picture_Source === "string" && /^https:\/\//u.test(menu.Menu_Picture_Source)
      ? menu.Menu_Picture_Source
      : "/food-noodles.jpg",
    savedAt: new Date(),
  };
  const result = await (await getDatabase()).collection("food_memories").insertOne(record);
  return { ...record, _id: result.insertedId };
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
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/api/food/stats") {
    try {
      sendJson(response, 200, await getStats(url.searchParams.get("clientId")));
    } catch (error) {
      console.error("MongoDB stats lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load live food statistics" });
    }
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/food/memory") {
    try {
      const memory = await listMemories(url.searchParams.get("clientId"));
      sendJson(response, 200, memory);
    } catch (error) {
      console.error("MongoDB memory lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load food memory" });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/food/memory") {
    let payload;
    try {
      payload = await readJson(request);
      const item = await saveMemory(payload?.clientId, payload?.menuId);
      sendJson(response, 201, { item });
    } catch (error) {
      console.error("MongoDB memory save failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not save food memory" });
    }
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
    || payload.allergies.some((item) => typeof item !== "string" || item.length > 100)
    || !payload.preferences || typeof payload.preferences !== "object"
    || ["time", "hunger", "mood", "goal"].some((key) => typeof payload.preferences[key] !== "string" || payload.preferences[key].length > 100)
    || (payload.recentMenuIds !== undefined && (!Array.isArray(payload.recentMenuIds)
      || payload.recentMenuIds.length > 20
      || payload.recentMenuIds.some((id) => typeof id !== "string" || id.length > 200)))) {
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
    sendJson(response, 200, { recommendations: [], provider: "database", message: "ไม่มีเมนูที่ผ่านงบและเงื่อนไขการแพ้" });
    return;
  }

  const result = scoreCandidates(candidates, payload.preferences, payload.maxBudgetThb);
  const explained = await explainRecommendations(
    result.recommendations,
    payload.preferences,
    payload.maxBudgetThb,
    payload.recentMenuIds || [],
  );
  sendJson(response, 200, {
    ...result,
    recommendations: explained.recommendations,
    explanation: { provider: explained.provider, message: explained.message },
    provider: "database",
  });
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
