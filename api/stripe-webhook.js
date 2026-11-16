import { handleWebhook } from "./lib/shop.js";

export function GET() {
    return new Response(JSON.stringify({ error: "Stripe webhooks must POST to this URL." }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
}

export async function POST(request) {
    return handleWebhook({
        request: request,
        env: process.env,
        fetchImpl: fetch
    });
}
