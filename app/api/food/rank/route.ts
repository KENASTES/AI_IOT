import { NextResponse } from "next/server";

/**
 * The Raspberry Pi deployment proxies this path through Vite to server/food-api.mjs.
 * That Node service can reach MongoDB on the private Docker network. This route
 * is retained as a clear fallback for deployments that do not configure the proxy.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Food API service is not connected. Start the food-api Compose service." },
    { status: 503 },
  );
}
