# Food menu reranker

`app/api/food/rank/route.ts` provides AI_IOT with a ranking endpoint for an
already-filtered set of menu candidates. The caller supplies the search phrase
and context (for example, “spicy Thai, filling, I have little time”) together
with menu descriptions. The endpoint compares that text with each candidate
using `BAAI/bge-reranker-v2-m3` through Hugging Face when `HF_TOKEN` is set;
otherwise it returns a local keyword ranking. Provider failures also fall back
locally.

Use `rankFilteredFoods` from `lib/food-ranker.ts` in the UI. Apply budget,
wait-time, allergy, distance, dietary, and foods-to-avoid rules before passing
candidates to it. The route does not filter, add, or remove menus; it only
returns their IDs in ranked order with scores. At most 30 candidates can be
ranked per request.

Set `HF_TOKEN` in the server environment to enable hosted reranking. Keep the
token server-side; it is never sent to the browser. Without the token, the app
remains usable with local ranking.
