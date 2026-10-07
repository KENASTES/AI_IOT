import { NextResponse } from "next/server";

type Candidate = { id: string; text: string };
type RankRequest = { query: string; candidates: Candidate[] };

const model = "BAAI/bge-reranker-v2-m3";
const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;

function localRank(query: string, candidates: Candidate[]) {
  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const terms = normalizedQuery.split(/[\s,，;；/]+/u).filter((term) => term.length >= 2);
  return candidates.map(({ id, text }) => {
    const description = text.toLocaleLowerCase("th");
    const score = terms.reduce((total, term) => total + (description.includes(term) ? 1 : 0), 0)
      + (normalizedQuery.length >= 2 && description.includes(normalizedQuery) ? 2 : 0);
    return { id, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function scoreFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const score = scoreFrom(item);
      if (score !== null) return score;
    }
    return null;
  }
  if (value && typeof value === "object" && "score" in value) {
    const score = Number(value.score);
    return Number.isFinite(score) ? score : null;
  }
  return null;
}

function validPayload(value: unknown): value is RankRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<RankRequest>;
  return typeof body.query === "string" && body.query.trim().length > 0 && body.query.length <= 5000
    && Array.isArray(body.candidates) && body.candidates.length >= 1 && body.candidates.length <= 30
    && body.candidates.every((item) => item && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 200
      && typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 10000);
}

/** Rank only the candidates supplied by the caller. Eligibility filters belong upstream. */
export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 }); }
  if (!validPayload(payload)) return NextResponse.json({ error: "Provide a query and 1–30 candidates with id and menu text" }, { status: 400 });

  const token = process.env.HF_TOKEN;
  if (!token) return NextResponse.json({ provider: "local", model: "local-keyword-ranker", scores: localRank(payload.query, payload.candidates) });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: payload.candidates.map(({ text }) => ({ text: payload.query, text_pair: text })), parameters: { function_to_apply: "none" } }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({
        provider: "local-fallback", model: "local-keyword-ranker", fallbackReason: `http_${response.status}`,
        scores: localRank(payload.query, payload.candidates),
      });
    }
    const values: unknown = await response.json();
    const rows = Array.isArray(values) && values.length === payload.candidates.length
      ? values
      : Array.isArray(values) && values.length === 1 && Array.isArray(values[0]) && values[0].length === payload.candidates.length
        ? values[0] : null;
    if (!rows) {
      return NextResponse.json({ provider: "local-fallback", model: "local-keyword-ranker", fallbackReason: "invalid_count", scores: localRank(payload.query, payload.candidates) });
    }
    const scores = rows.map((value, index) => ({ id: payload.candidates[index].id, score: scoreFrom(value) }));
    if (scores.some((item) => item.score === null)) {
      return NextResponse.json({ provider: "local-fallback", model: "local-keyword-ranker", fallbackReason: "invalid_score", scores: localRank(payload.query, payload.candidates) });
    }
    const rankedScores = scores as Array<{ id: string; score: number }>;
    return NextResponse.json({ provider: "huggingface", model, scores: rankedScores.sort((a, b) => b.score - a.score) });
  } catch (error) {
    const fallbackReason = error instanceof Error && error.message === "invalid_response" ? "invalid_response" : "network_or_timeout";
    return NextResponse.json({ provider: "local-fallback", model: "local-keyword-ranker", fallbackReason, scores: localRank(payload.query, payload.candidates) });
  }
}
