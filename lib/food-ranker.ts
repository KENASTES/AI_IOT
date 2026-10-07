export type FoodRankCandidate = {
  id: string;
  name: string;
  cuisine?: string;
  restaurant?: string;
  ingredients?: string[];
  tags?: string[];
  flavor?: string;
  description?: string;
};

export type FoodRankResult = { id: string; score: number };
export type FoodRankResponse = { provider: "huggingface" | "local" | "local-fallback"; fallbackReason?: string; scores: FoodRankResult[] };

/**
 * Rank an already-filtered candidate list against the user's natural-language
 * request and context. Budget, wait, allergy, distance, and avoid-food filters
 * must be applied before calling this function.
 */
export async function rankFilteredFoods(query: string, candidates: FoodRankCandidate[]): Promise<FoodRankResponse> {
  if (!query.trim()) throw new Error("A food preference query is required");
  if (candidates.length === 0) return { provider: "local", scores: [] };
  const response = await fetch("/api/food/rank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      candidates: candidates.map((menu) => ({
        id: menu.id,
        text: [menu.name, menu.cuisine, menu.restaurant, menu.description, menu.flavor,
          ...(menu.ingredients ?? []), ...(menu.tags ?? [])].filter(Boolean).join("; "),
      })),
    }),
  });
  if (!response.ok) throw new Error("Food ranking request failed");
  const result = await response.json() as Partial<FoodRankResponse>;
  if (!Array.isArray(result.scores) || !["huggingface", "local", "local-fallback"].includes(result.provider ?? "")) {
    throw new Error("Food ranking response is invalid");
  }
  return { provider: result.provider as FoodRankResponse["provider"], fallbackReason: result.fallbackReason, scores: result.scores };
}
