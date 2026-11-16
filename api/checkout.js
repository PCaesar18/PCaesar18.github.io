import { handleCheckout, handleCheckoutOptions } from "./lib/shop.js";

export function OPTIONS(request) {
    return handleCheckoutOptions(request);
}

export function GET() {
    return new Response(JSON.stringify({ error: "Send a POST request to start checkout." }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
}

export async function POST(request) {
    return handleCheckout({
        request: request,
        env: process.env,
        fetchImpl: fetch
    });
}
