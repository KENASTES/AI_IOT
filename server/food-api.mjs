import { createServer } from "node:http";
import { MongoClient, ObjectId } from "mongodb";
import { scoreCandidates } from "./food-ranking.mjs";
import { explainRecommendations } from "./food-explainer.mjs";
import { generateCookRecipes, recipeTestHelpers } from "./food-recipes.mjs";

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
let recommendationFeedbackIndexPromise;
let budgetTransactionIndexPromise;

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

async function deleteMemory(clientId, memoryId) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  if (typeof memoryId !== "string" || !/^[a-f0-9]{24}$/iu.test(memoryId)) throw new Error("Invalid memoryId");
  return (await getDatabase()).collection("food_memories").deleteOne({
    _id: new ObjectId(memoryId),
    clientId,
  });
}

async function saveMemory(clientId, menuId) {
  if (!validClientId(clientId) || typeof menuId !== "string") throw new Error("A valid clientId and menuId are required");
  const [storeId, indexText] = menuId.split(":");
  if (!ObjectId.isValid(storeId) || !/^\d{1,4}$/u.test(indexText || "")) throw new Error("Invalid menuId");
  const store = await (await getStoreCollection()).findOne({ _id: new ObjectId(storeId), Is_Active: { $ne: false } }, {
    projection: { Store_Name: 1, Location: 1, Menu: 1 },
  });
  const menu = store?.Menu?.[Number(indexText)];
  if (!menu || typeof menu.Menu_Name !== "string" || !Number.isFinite(menu.Price_THB) || menu.Price_THB < 0 || menu.Blacklist === true) {
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

async function getBudgetTransactionCollection() {
  const collection = (await getDatabase()).collection("food_budget_transactions");
  if (!budgetTransactionIndexPromise) {
    budgetTransactionIndexPromise = collection.createIndex(
      { clientId: 1, transactionId: 1 },
      { unique: true, name: "unique_food_budget_transaction" },
    ).catch((error) => {
      budgetTransactionIndexPromise = undefined;
      throw error;
    });
  }
  await budgetTransactionIndexPromise;
  return collection;
}

async function saveBudgetTransaction(clientId, menuId, transactionId) {
  if (!validClientId(clientId) || typeof menuId !== "string") throw new Error("A valid clientId and menuId are required");
  if (typeof transactionId !== "string" || !/^[a-f0-9-]{36}$/iu.test(transactionId)) throw new Error("Invalid transactionId");
  const collection = await getBudgetTransactionCollection();
  const existing = await collection.findOne({ clientId, transactionId });
  if (existing) return existing;
  const [storeId, indexText] = menuId.split(":");
  if (!ObjectId.isValid(storeId) || !/^\d{1,4}$/u.test(indexText || "")) throw new Error("Invalid menuId");
  const store = await (await getStoreCollection()).findOne({ _id: new ObjectId(storeId), Is_Active: { $ne: false } }, {
    projection: { Store_Name: 1, Menu: 1 },
  });
  const menu = store?.Menu?.[Number(indexText)];
  if (!menu || typeof menu.Menu_Name !== "string" || !Number.isFinite(menu.Price_THB) || menu.Price_THB < 0 || menu.Blacklist === true) {
    throw new Error("Menu not found or unavailable");
  }
  const transaction = {
    clientId,
    transactionId,
    menuId,
    menuName: menu.Menu_Name,
    storeName: store.Store_Name || "ร้านอาหาร",
    amount: menu.Price_THB,
    createdAt: new Date(),
  };
  try {
    const result = await collection.insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return collection.findOne({ clientId, transactionId });
  }
}

function bangkokDateBoundaries(now = new Date()) {
  const offset = 7 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  return {
    monthStart: new Date(Date.UTC(year, month, 1) - offset),
    todayStart: new Date(Date.UTC(year, month, day) - offset),
    tomorrowStart: new Date(Date.UTC(year, month, day + 1) - offset),
    daysRemaining: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() - day + 1,
  };
}

async function getBudgetSummary(clientId) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  const { monthStart, todayStart, tomorrowStart, daysRemaining } = bangkokDateBoundaries();
  const collection = await getBudgetTransactionCollection();
  const [totals, transactions] = await Promise.all([
    collection.aggregate([
      { $match: { clientId, createdAt: { $gte: monthStart, $lt: tomorrowStart } } },
      { $group: {
        _id: null,
        totalSpentMonth: { $sum: "$amount" },
        totalSpentToday: { $sum: { $cond: [{ $gte: ["$createdAt", todayStart] }, "$amount", 0] } },
      } },
    ]).toArray(),
    collection.find({ clientId, createdAt: { $gte: monthStart, $lt: tomorrowStart } })
      .sort({ createdAt: -1 }).limit(10).toArray(),
  ]);
  return { totalSpentMonth: totals[0]?.totalSpentMonth || 0, totalSpentToday: totals[0]?.totalSpentToday || 0, daysRemaining, transactions };
}

async function getRecommendationFeedbackCollection() {
  const collection = (await getDatabase()).collection("food_recommendation_feedback");
  if (!recommendationFeedbackIndexPromise) {
    recommendationFeedbackIndexPromise = collection.createIndex(
      { clientId: 1, batchId: 1, menuId: 1 },
      { unique: true, name: "unique_recommendation_vote" },
    ).catch((error) => {
      recommendationFeedbackIndexPromise = undefined;
      throw error;
    });
  }
  await recommendationFeedbackIndexPromise;
  return collection;
}

async function saveRecommendationFeedback(payload) {
  const { clientId, batchId, batchLimit, batchSize, menuId, accepted, provider, score, menuName } = payload || {};
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  if (typeof batchId !== "string" || !/^[a-f0-9-]{36}$/iu.test(batchId)) throw new Error("Invalid recommendation batch");
  if (batchLimit !== 3) throw new Error("Invalid recommendation batch limit");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > batchLimit) throw new Error("Invalid recommendation batch size");
  const [storeId, indexText] = typeof menuId === "string" ? menuId.split(":") : [];
  if (!ObjectId.isValid(storeId) || !/^\d{1,4}$/u.test(indexText || "")) throw new Error("Invalid menuId");
  if (typeof accepted !== "boolean") throw new Error("Feedback must be positive or negative");
  if (provider !== "gemini" && provider !== "database") throw new Error("Invalid recommendation provider");
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error("Invalid match score");
  if (typeof menuName !== "string" || !menuName.trim() || menuName.length > 120) throw new Error("Invalid menu name");

  const now = new Date();
  await (await getRecommendationFeedbackCollection()).updateOne(
    { clientId, batchId, menuId },
    {
      $set: { accepted, provider, score, batchLimit, batchSize, menuName: menuName.trim(), updatedAt: now },
      $setOnInsert: { clientId, batchId, menuId, createdAt: now },
    },
    { upsert: true },
  );
}

async function getRecommendationFeedbackStats() {
  const grouped = await (await getRecommendationFeedbackCollection()).aggregate([
    { $group: {
      _id: { clientId: "$clientId", batchId: "$batchId", provider: "$provider" },
      votes: { $sum: 1 },
      acceptedVotes: { $sum: { $cond: ["$accepted", 1, 0] } },
      batchLimit: { $max: { $ifNull: ["$batchLimit", { $ifNull: ["$batchSize", 2] }] } },
      expectedVotes: { $max: { $ifNull: ["$batchSize", 2] } },
    } },
    { $match: { batchLimit: 3, $expr: { $or: [
      { $gt: ["$acceptedVotes", 0] },
      { $gte: ["$votes", "$expectedVotes"] },
    ] } } },
    { $group: {
      _id: "$_id.provider",
      rounds: { $sum: 1 },
      successfulRounds: { $sum: { $cond: [{ $gt: ["$acceptedVotes", 0] }, 1, 0] } },
    } },
  ]).toArray();
  const byProvider = Object.fromEntries(grouped.map(({ _id, rounds, successfulRounds }) => [
    _id,
    { rounds, successfulRounds, acceptanceRate: rounds ? Math.round((successfulRounds / rounds) * 100) : null },
  ]));
  const gemini = byProvider.gemini || { rounds: 0, successfulRounds: 0, acceptanceRate: null };
  const database = byProvider.database || { rounds: 0, successfulRounds: 0, acceptanceRate: null };
  const total = gemini.rounds + database.rounds;
  const accepted = gemini.successfulRounds + database.successfulRounds;
  return {
    rounds: total,
    successfulRounds: accepted,
    acceptanceRate: total ? Math.round((accepted / total) * 100) : null,
    gemini,
    database,
  };
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new Error("ข้อมูลโปรไฟล์ไม่ถูกต้อง");
  const textFields = ["name", "age", "height", "weight", "allergies", "conditions", "dislikes"];
  const cleaned = {};
  for (const field of textFields) {
    const value = profile[field] ?? "";
    const maxLength = field === "name" ? 80 : 300;
    if (typeof value !== "string" || value.length > maxLength) throw new Error(`ข้อมูล ${field} ไม่ถูกต้อง`);
    cleaned[field] = value.trim();
  }
  if (!cleaned.name) throw new Error("กรุณาระบุชื่อโปรไฟล์");
  for (const field of ["monthlyBudget", "dailyBudget"]) {
    const value = profile[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000) {
      throw new Error(`ข้อมูลงบประมาณ ${field} ไม่ถูกต้อง`);
    }
    cleaned[field] = value;
  }
  return cleaned;
}

function sanitizeCookHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) throw new Error("ข้อมูลประวัติการทำอาหารไม่ถูกต้อง");
  const savedRecipes = Array.isArray(history.savedRecipes) ? history.savedRecipes.slice(0, 20) : [];
  const recipes = savedRecipes.map((recipe) => {
    const cleanText = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
    const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients.slice(0, 15).map((value) => cleanText(value, 60)).filter(Boolean) : [];
    const pantryIngredients = Array.isArray(recipe?.pantryIngredients) ? recipe.pantryIngredients.slice(0, 15).map((value) => cleanText(value, 40)).filter(Boolean) : [];
    const steps = Array.isArray(recipe?.steps) ? recipe.steps.slice(0, 8).map((value) => cleanText(value, 300)).filter(Boolean) : [];
    const minutes = Number(recipe?.minutes);
    const name = cleanText(recipe?.name, 100);
    if (!name || ingredients.length === 0 || steps.length < 3 || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      throw new Error("สูตรที่บันทึกมีข้อมูลไม่ครบ");
    }
    return { name, summary: cleanText(recipe.summary, 300), minutes, ingredients, pantryIngredients, steps };
  });
  const recipeRatings = {};
  if (history.recipeRatings && typeof history.recipeRatings === "object" && !Array.isArray(history.recipeRatings)) {
    for (const [name, rating] of Object.entries(history.recipeRatings).slice(0, 50)) {
      if (typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        recipeRatings[name.slice(0, 100)] = rating;
      }
    }
  }
  const recentRecipeNames = Array.isArray(history.recentRecipeNames)
    ? [...new Set(history.recentRecipeNames.filter((name) => typeof name === "string").map((name) => name.trim().slice(0, 100)).filter(Boolean))].slice(0, 20)
    : [];
  return { savedRecipes: recipes, recipeRatings, recentRecipeNames };
}

async function getUserProfile(clientId) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  const record = await (await getDatabase()).collection("food_profiles").findOne(
    { clientId },
    { projection: { _id: 0, profile: 1, cookHistory: 1 } },
  );
  return { profile: record?.profile || null, cookHistory: record?.cookHistory || null };
}

async function saveUserProfile(clientId, profile) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  const now = new Date();
  await (await getDatabase()).collection("food_profiles").updateOne(
    { clientId },
    { $set: { profile: sanitizeProfile(profile), updatedAt: now }, $setOnInsert: { clientId, createdAt: now } },
    { upsert: true },
  );
}

async function saveCookHistory(clientId, history) {
  if (!validClientId(clientId)) throw new Error("A valid clientId is required");
  const now = new Date();
  await (await getDatabase()).collection("food_profiles").updateOne(
    { clientId },
    { $set: { cookHistory: sanitizeCookHistory(history), updatedAt: now }, $setOnInsert: { clientId, createdAt: now } },
    { upsert: true },
  );
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
  if (request.method === "GET" && url.pathname === "/api/food/profile") {
    try {
      sendJson(response, 200, await getUserProfile(url.searchParams.get("clientId")));
    } catch (error) {
      console.error("MongoDB profile lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load user profile" });
    }
    return;
  }
  if (request.method === "PUT" && url.pathname === "/api/food/profile") {
    let payload;
    try { payload = await readJson(request); } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      await saveUserProfile(payload?.clientId, payload?.profile);
      sendJson(response, 200, { saved: true });
    } catch (error) {
      console.error("MongoDB profile save failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not save user profile" });
    }
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/food/budget") {
    try {
      sendJson(response, 200, await getBudgetSummary(url.searchParams.get("clientId")));
    } catch (error) {
      console.error("MongoDB budget lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load food budget" });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/food/budget") {
    let payload;
    try { payload = await readJson(request); } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      const transaction = await saveBudgetTransaction(payload?.clientId, payload?.menuId, payload?.transactionId);
      sendJson(response, 201, { transaction });
    } catch (error) {
      console.error("MongoDB budget transaction save failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not record food expense" });
    }
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/food/cook-history") {
    try {
      const { cookHistory } = await getUserProfile(url.searchParams.get("clientId"));
      sendJson(response, 200, { cookHistory });
    } catch (error) {
      console.error("MongoDB cooking history lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load cooking history" });
    }
    return;
  }
  if (request.method === "PUT" && url.pathname === "/api/food/cook-history") {
    let payload;
    try { payload = await readJson(request); } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      await saveCookHistory(payload?.clientId, payload?.cookHistory);
      sendJson(response, 200, { saved: true });
    } catch (error) {
      console.error("MongoDB cooking history save failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not save cooking history" });
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
  if (request.method === "DELETE" && url.pathname === "/api/food/memory") {
    let payload;
    try { payload = await readJson(request); } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      const result = await deleteMemory(payload?.clientId, payload?.memoryId);
      if (!result.deletedCount) {
        sendJson(response, 404, { error: "ไม่พบรายการ Food Memory นี้ในบัญชีของคุณ" });
        return;
      }
      sendJson(response, 200, { deleted: true });
    } catch (error) {
      console.error("MongoDB memory delete failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not delete food memory" });
    }
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/food/recommendation-feedback") {
    try {
      sendJson(response, 200, await getRecommendationFeedbackStats());
    } catch (error) {
      console.error("MongoDB recommendation feedback lookup failed:", error.message);
      sendJson(response, 503, { error: "Could not load recommendation feedback statistics" });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/food/recommendation-feedback") {
    let payload;
    try { payload = await readJson(request); } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      await saveRecommendationFeedback(payload);
      sendJson(response, 200, { saved: true });
    } catch (error) {
      console.error("MongoDB recommendation feedback save failed:", error.message);
      sendJson(response, 400, { error: error.message || "Could not save recommendation feedback" });
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
  if (request.method === "POST" && url.pathname === "/api/food/recipes") {
    let payload;
    try {
      payload = await readJson(request);
    } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB" });
      return;
    }
    try {
      recipeTestHelpers.validateRequest(payload);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    try {
      sendJson(response, 200, await generateCookRecipes(payload));
    } catch (error) {
      console.error("AI recipe generation failed:", error.message);
      const missingKey = !process.env.GEMINI_API_KEY;
      sendJson(response, missingKey ? 503 : 502, {
        error: missingKey
          ? "AI ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในบริการ food-api"
          : "AI สร้างสูตรไม่สำเร็จ กรุณาตรวจ Gemini API แล้วลองใหม่",
      });
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
      || payload.recentMenuIds.length > 500
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
    message: explained.recommendations.length
      ? result.message
      : "คุณดูเมนูที่ผ่านเงื่อนไขครบแล้ว เริ่มรอบใหม่หรือเปลี่ยนคำตอบเพื่อค้นหาอีกครั้ง",
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
