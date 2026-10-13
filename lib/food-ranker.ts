export type FoodRecommendation = {
  id: string;
  menuName: string;
  storeName: string;
  location: string;
  price: number;
  tags: string[];
  image: string;
  sourceUrl: string;
  text: string;
  score: number;
};

export type FoodRankConstraints = {
  maxBudgetThb: number;
  allergies: string[];
};

export type FoodRankResponse = {
  provider: "huggingface" | "local" | "local-fallback";
  recommendations: FoodRecommendation[];
  message?: string;
};

/** The server loads eligible menu candidates from MongoDB and ranks them. */
export async function rankFilteredFoods(
  query: string,
  constraints: FoodRankConstraints,
): Promise<FoodRankResponse> {
  if (!query.trim()) throw new Error("A food preference query is required");

  const response = await fetch("/api/food/rank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...constraints }),
  });
  const result = await response.json() as Partial<FoodRankResponse> & { error?: string };
  if (!response.ok) throw new Error(result.error || "Could not load food recommendations");
  if (!Array.isArray(result.recommendations)
    || !["huggingface", "local", "local-fallback"].includes(result.provider ?? "")) {
    throw new Error("Food recommendation response is invalid");
  }

  return {
    provider: result.provider as FoodRankResponse["provider"],
    recommendations: result.recommendations,
    message: result.message,
  };
}
