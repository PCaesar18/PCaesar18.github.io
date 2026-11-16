import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
    encodeForm,
    handleCheckout,
    handleWebhook,
    isStripeCheckoutUrl,
    printfulExternalId,
    verifyStripeSignature
} from "../api/lib/shop.js";

const require = createRequire(import.meta.url);
const catalog = require("../shop/catalog.js");
const { isSellable } = require("../shop/products.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fakeStripeKey = "sk_test_unit_only";
const fakeWebhookSecret = "whsec_unit_test_secret";
const fakePrintfulKey = "printful_unit_only";

function sellablePiece() {
    return {
        id: "slot-1",
        name: "Test piece",
        description: "Used only by the unit test.",
        price: "€24",
        currency: "eur",
        amount: "24.00",
        shippingAmount: "5.00",
        image: "",
        printfulVariantId: "4012",
        printfulFileUrl: "https://example.com/print.png",
        printfulFileType: "default",
        taxCode: ""
    };
}

function checkoutRequest(body, origin) {
    return new Request("https://api.example/api/checkout", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            origin: origin || "https://caesardekeijzer.com"
        },
        body: JSON.stringify(body)
    });
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status: status,
        headers: { "content-type": "application/json" }
    });
}

test("the five catalog slots are unfinished and not for sale", () => {
    assert.equal(catalog.length, 5);
    catalog.forEach((slot, index) => {
        assert.equal(slot.id, "slot-" + (index + 1));
        assert.equal(slot.name, "");
        assert.equal(slot.amount, "");
        assert.equal(slot.price, "");
        assert.equal(slot.printfulVariantId, "");
        assert.equal(isSellable(slot), false);
    });
});

test("checkout fails clearly when STRIPE_SECRET_KEY is missing", async () => {
    let called = false;
    const response = await handleCheckout({
        request: checkoutRequest({ productId: "slot-1" }),
        env: {},
        fetchImpl: async () => {
            called = true;
            throw new Error("network should not be used");
        },
        catalog: [sellablePiece()]
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.match(body.error, /Missing STRIPE_SECRET_KEY/);
    assert.equal(called, false);
});

test("placeholder catalog pieces are rejected and Stripe is not called", async () => {
    let called = false;
    const response = await handleCheckout({
        request: checkoutRequest({ productId: "slot-1", amount: "1.00", price: "€1" }),
        env: { STRIPE_SECRET_KEY: fakeStripeKey },
        fetchImpl: async () => {
            called = true;
            throw new Error("network should not be used");
        },
        catalog: catalog
    });
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(body.error, "This piece is not for sale.");
    assert.equal(called, false);
});

test("a complete piece opens Stripe Checkout with Tax and ignores the client price", async () => {
    const calls = [];
    const response = await handleCheckout({
        request: checkoutRequest({
            productId: "slot-1",
            quantity: 1,
            amount: "1.00",
            currency: "usd",
            printfulVariantId: "1"
        }),
        env: {
            STRIPE_SECRET_KEY: fakeStripeKey,
            SHOP_PUBLIC_URL: "https://caesardekeijzer.com"
        },
        fetchImpl: async (url, options) => {
            calls.push({ url: url, options: options });
            return jsonResponse(200, {
                id: "cs_test_session",
                url: "https://checkout.stripe.com/c/pay/cs_test_session"
            });
        },
        catalog: [sellablePiece()]
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_session");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(calls[0].options.headers.Authorization.startsWith("Bearer "), true);
    assert.equal(calls[0].options.headers.Authorization.endsWith(fakeStripeKey), true);
    const form = calls[0].options.body;
    assert.match(form, /automatic_tax(?:%5B|\[)enabled(?:%5D|\])=true/);
    assert.match(form, /tax_behavior(?:%5D|\])=exclusive/);
    assert.match(form, /unit_amount(?:%5D|\])=2400/);
    assert.doesNotMatch(form, /unit_amount(?:%5D|\])=100(?:&|$)/);
    assert.match(form, /\{CHECKOUT_SESSION_ID\}/);
    assert.equal(form.includes(fakeStripeKey), false);
    assert.equal(JSON.stringify(body).includes(fakeStripeKey), false);
});

test("webhook fails clearly when STRIPE_WEBHOOK_SECRET is missing", async () => {
    let called = false;
    const response = await handleWebhook({
        request: new Request("https://api.example/api/stripe-webhook", {
            method: "POST",
            body: "{}"
        }),
        env: { STRIPE_SECRET_KEY: fakeStripeKey },
        fetchImpl: async () => {
            called = true;
            throw new Error("network should not be used");
        }
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.match(body.error, /Missing STRIPE_WEBHOOK_SECRET/);
    assert.equal(called, false);
});

test("webhook rejects a bad signature before calling Stripe or Printful", async () => {
    let called = false;
    const response = await handleWebhook({
        request: new Request("https://api.example/api/stripe-webhook", {
            method: "POST",
            headers: { "stripe-signature": "t=1,v1=deadbeef" },
            body: "{\"id\":\"evt_test\"}"
        }),
        env: { STRIPE_WEBHOOK_SECRET: fakeWebhookSecret, STRIPE_SECRET_KEY: fakeStripeKey },
        fetchImpl: async () => {
            called = true;
            throw new Error("network should not be used");
        },
        nowMs: 1000
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
});

test("a paid Checkout Session places one confirmed Printful order", async () => {
    const now = 1_700_000_000_000;
    const session = {
        id: "cs_test_paid",
        payment_status: "paid",
        currency: "eur",
        amount_subtotal: 2900,
        metadata: {
            source: "caesardekeijzer-shop",
            productId: "slot-1",
            quantity: "1",
            unitAmount: "2400",
            shippingAmount: "500",
            currency: "eur",
            variantId: "4012",
            fileUrl: "https://example.com/print.png",
            fileType: "default"
        },
        customer_details: { email: "reader@example.com", phone: "+31600000000" },
        shipping_details: {
            name: "Caesar",
            address: {
                line1: "Damrak 1",
                city: "Amsterdam",
                postal_code: "1012LG",
                country: "NL"
            }
        }
    };
    const event = {
        type: "checkout.session.completed",
        data: { object: { id: session.id } }
    };
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(now / 1000);
    const signature = crypto.createHmac("sha256", fakeWebhookSecret).update(timestamp + "." + raw).digest("hex");
    const calls = [];
    const response = await handleWebhook({
        request: new Request("https://api.example/api/stripe-webhook", {
            method: "POST",
            headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
            body: raw
        }),
        env: {
            STRIPE_WEBHOOK_SECRET: fakeWebhookSecret,
            STRIPE_SECRET_KEY: fakeStripeKey,
            PRINTFUL_API_KEY: fakePrintfulKey
        },
        fetchImpl: async (url, options) => {
            calls.push({ url: url, method: options.method, body: options.body || "" });
            if (url.indexOf("api.stripe.com") !== -1) {
                return jsonResponse(200, session);
            }
            if (options.method === "GET") {
                return jsonResponse(404, { code: 404 });
            }
            return jsonResponse(200, { code: 200, result: { id: 99 } });
        },
        nowMs: now
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.fulfilled, true);
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /\/checkout\/sessions\/cs_test_paid$/);
    assert.match(calls[1].url, /\/orders\/@[0-9a-f]{32}$/);
    assert.match(calls[2].url, /\/orders\?confirm=true$/);
    const order = JSON.parse(calls[2].body);
    assert.equal(order.items[0].variant_id, 4012);
    assert.equal(order.items[0].quantity, 1);
    assert.equal(order.items[0].files[0].url, "https://example.com/print.png");
    assert.equal(order.recipient.country_code, "NL");
    assert.equal(calls[2].body.includes(fakeStripeKey), false);
    assert.equal(calls[2].body.includes(fakePrintfulKey), false);
});

test("an unpaid session does not place a Printful order", async () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_open" } }
    });
    const timestamp = Math.floor(now / 1000);
    const signature = crypto.createHmac("sha256", fakeWebhookSecret).update(timestamp + "." + raw).digest("hex");
    const calls = [];
    const response = await handleWebhook({
        request: new Request("https://api.example/api/stripe-webhook", {
            method: "POST",
            headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
            body: raw
        }),
        env: {
            STRIPE_WEBHOOK_SECRET: fakeWebhookSecret,
            STRIPE_SECRET_KEY: fakeStripeKey,
            PRINTFUL_API_KEY: fakePrintfulKey
        },
        fetchImpl: async (url) => {
            calls.push(url);
            return jsonResponse(200, { id: "cs_test_open", payment_status: "unpaid", metadata: {} });
        },
        nowMs: now
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.fulfilled, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].includes("printful.com"), false);
});

test("a paid session without PRINTFUL_API_KEY fails clearly and does not pretend success", async () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({
        type: "checkout.session.async_payment_succeeded",
        data: { object: { id: "cs_test_paid" } }
    });
    const timestamp = Math.floor(now / 1000);
    const signature = crypto.createHmac("sha256", fakeWebhookSecret).update(timestamp + "." + raw).digest("hex");
    const response = await handleWebhook({
        request: new Request("https://api.example/api/stripe-webhook", {
            method: "POST",
            headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
            body: raw
        }),
        env: {
            STRIPE_WEBHOOK_SECRET: fakeWebhookSecret,
            STRIPE_SECRET_KEY: fakeStripeKey
        },
        fetchImpl: async () => jsonResponse(200, {
            id: "cs_test_paid",
            payment_status: "paid",
            currency: "eur",
            amount_subtotal: 2900,
            metadata: {
                source: "caesardekeijzer-shop",
                quantity: "1",
                unitAmount: "2400",
                shippingAmount: "500",
                currency: "eur",
                variantId: "4012",
                fileUrl: "https://example.com/print.png",
                fileType: "default"
            },
            customer_details: { email: "reader@example.com" },
            shipping_details: {
                name: "Caesar",
                address: { line1: "Damrak 1", city: "Amsterdam", postal_code: "1012LG", country: "NL" }
            }
        }),
        nowMs: now
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.match(body.error, /Missing PRINTFUL_API_KEY/);
    assert.equal(body.fulfilled, undefined);
});

test("signature helper accepts a fresh signature and rejects a stale one", () => {
    const secret = fakeWebhookSecret;
    const payload = "{\"ok\":true}";
    const now = 1_700_000_000_000;
    const timestamp = Math.floor(now / 1000);
    const hex = crypto.createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
    assert.equal(verifyStripeSignature(payload, "t=" + timestamp + ",v1=" + hex, secret, now), true);
    assert.equal(verifyStripeSignature(payload, "t=" + (timestamp - 1000) + ",v1=" + hex, secret, now), false);
    assert.equal(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test"), true);
    assert.equal(isStripeCheckoutUrl("https://example.com/checkout"), false);
    assert.equal(printfulExternalId("cs_test_paid").length, 32);
});

test("encodeForm keeps the Stripe session placeholder intact", () => {
    const form = encodeForm({
        success_url: "https://caesardekeijzer.com/shop/?checkout=success&session_id={CHECKOUT_SESSION_ID}"
    });
    assert.match(form, /\{CHECKOUT_SESSION_ID\}/);
    assert.equal(form.includes("%7BCHECKOUT_SESSION_ID%7D"), false);
});

test("pages keep a single Plausible snippet and the repo has no committed keys", () => {
    const htmlFiles = [
        "index.html",
        "shop/index.html",
        "blog/Downtown Lane.html",
        "blog/WupsE.html",
        "blog/beautiful-words.html",
        "blog/mandarin.html",
        "blog/self-checkout.html",
        "blog/super_lawyer.html",
        "blog/usyd_openLLMs.html"
    ];
    const marker = "https://plausible.io/js/pa-XOM3JaBEqIdmqBWaRLGjU.js";
    htmlFiles.forEach((relative) => {
        const text = fs.readFileSync(path.join(root, relative), "utf8");
        const count = text.split(marker).length - 1;
        assert.equal(count, 1, relative);
        assert.equal(text.includes("plausible.init()"), true, relative);
        const head = text.slice(0, text.indexOf("</head>"));
        assert.equal(head.includes(marker), true, relative);
    });

    const banned = [/sk_live_/, /sk_test_/, /pk_live_/, /pk_test_/, /whsec_[A-Za-z0-9]/];
    const files = [];
    function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.name === "node_modules" || entry.name === "test" || entry.name === ".git") {
                return;
            }
            if (entry.isDirectory()) {
                walk(full);
                return;
            }
            if (/\.(html|js|mjs|json|css|md|example)$/.test(entry.name) || entry.name === ".env.example") {
                files.push(full);
            }
        });
    }
    walk(root);
    files.forEach((file) => {
        const text = fs.readFileSync(file, "utf8");
        banned.forEach((pattern) => {
            assert.equal(pattern.test(text), false, path.relative(root, file) + " matched " + pattern);
        });
    });
    const shopHtml = fs.readFileSync(path.join(root, "shop/index.html"), "utf8");
    assert.equal(/mollie/i.test(shopHtml), false);
    assert.equal(shopHtml.includes('href="shop/'), false);
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8").includes('href="shop/"'), true);
});
