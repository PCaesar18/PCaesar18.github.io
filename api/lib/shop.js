/*
 * Shop API used only by the Vercel deployment.
 * GitHub Pages does not run this file and cannot receive Stripe webhooks.
 *
 * Required environment variables, set on Vercel, never committed:
 *   STRIPE_SECRET_KEY       creates the Checkout Session and reloads it from the webhook
 *   STRIPE_WEBHOOK_SECRET   verifies the Stripe webhook signature
 *   PRINTFUL_API_KEY        places the print order after Stripe marks the session paid
 *
 * Optional:
 *   SHOP_PUBLIC_URL         origin of the GitHub Pages site. Defaults to https://caesardekeijzer.com
 *   STRIPE_PUBLISHABLE_KEY  not read here. Checkout redirects to a session URL, so the page does not need it.
 *
 * The catalog in shop/catalog.js is the price list. Client-supplied prices are ignored.
 */

import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bundledCatalog = require("../../shop/catalog.js");
const products = require("../../shop/products.js");

const { clean, isSellable, toCents } = products;

const SHIP_COUNTRIES = [
    "NL", "BE", "DE", "FR", "LU", "AT", "IT", "ES", "PT", "IE",
    "DK", "SE", "FI", "NO", "IS", "CH", "LI", "PL", "CZ", "SK",
    "HU", "RO", "BG", "GR", "HR", "SI", "EE", "LV", "LT", "MT",
    "CY", "GB", "US", "CA", "AU", "NZ", "JP", "KR", "SG", "HK",
    "MX", "BR"
];

const ALLOWED_ORIGINS = new Set([
    "https://caesardekeijzer.com",
    "https://www.caesardekeijzer.com",
    "https://pcaesar18.github.io"
]);

const STRIPE_VERSION = "2024-06-20";
const MAX_QUANTITY = 5;
const BODY_LIMIT = 20000;

export function missingKey(env, name) {
    return !clean(env && env[name]);
}

export function printfulExternalId(sessionId) {
    return crypto.createHash("sha256").update(String(sessionId)).digest("hex").slice(0, 32);
}

export function isStripeCheckoutUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
    } catch (err) {
        return false;
    }
}

function allowedOrigin(origin) {
    if (!origin) {
        return false;
    }
    if (ALLOWED_ORIGINS.has(origin)) {
        return true;
    }
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export function corsHeaders(request) {
    const headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin"
    };
    const origin = request && request.headers ? request.headers.get("origin") : "";
    if (allowedOrigin(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
}

export function jsonResponse(status, body, request, extraHeaders) {
    return new Response(JSON.stringify(body), {
        status,
        headers: Object.assign({
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }, corsHeaders(request), extraHeaders || {})
    });
}

function publicSite(env) {
    const raw = clean(env && env.SHOP_PUBLIC_URL);
    if (!raw) {
        return "https://caesardekeijzer.com";
    }
    if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw)) {
        return null;
    }
    return raw.replace(/\/$/, "");
}

export function encodeForm(value) {
    const pairs = [];
    appendForm(value, "", pairs);
    return pairs.map(function (pair) {
        const encoded = encodeURIComponent(pair[1]).replace(/%7BCHECKOUT_SESSION_ID%7D/g, "{CHECKOUT_SESSION_ID}");
        return encodeURIComponent(pair[0]) + "=" + encoded;
    }).join("&");
}

function appendForm(value, prefix, pairs) {
    if (Array.isArray(value)) {
        value.forEach(function (item, index) {
            appendForm(item, prefix + "[" + index + "]", pairs);
        });
        return;
    }
    if (value && typeof value === "object") {
        Object.keys(value).forEach(function (key) {
            const next = prefix ? prefix + "[" + key + "]" : key;
            appendForm(value[key], next, pairs);
        });
        return;
    }
    if (value === undefined || value === null || prefix === "") {
        return;
    }
    pairs.push([prefix, value === true ? "true" : value === false ? "false" : String(value)]);
}

function findProduct(catalog, id) {
    const list = Array.isArray(catalog) ? catalog : [];
    for (let i = 0; i < list.length; i += 1) {
        if (clean(list[i] && list[i].id) === id) {
            return list[i];
        }
    }
    return null;
}

function checkoutParams(product, quantity, site) {
    const currency = clean(product.currency).toLowerCase();
    const unitCents = toCents(product.amount);
    const shippingCents = toCents(product.shippingAmount);
    const productData = { name: clean(product.name) };
    const description = clean(product.description);
    const taxCode = clean(product.taxCode);
    const image = clean(product.image);
    if (description) {
        productData.description = description.slice(0, 500);
    }
    if (taxCode) {
        productData.tax_code = taxCode;
    }
    if (/^https:\/\/\S+$/i.test(image)) {
        productData.images = [image];
    }

    return {
        mode: "payment",
        success_url: site + "/shop/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: site + "/shop/?checkout=cancel",
        client_reference_id: clean(product.id),
        billing_address_collection: "required",
        customer_creation: "always",
        phone_number_collection: { enabled: "true" },
        automatic_tax: { enabled: "true" },
        shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
        shipping_options: [{
            shipping_rate_data: {
                type: "fixed_amount",
                display_name: "Shipping",
                tax_behavior: "exclusive",
                tax_code: "txcd_92010001",
                fixed_amount: {
                    amount: String(shippingCents),
                    currency: currency
                }
            }
        }],
        line_items: [{
            quantity: String(quantity),
            price_data: {
                currency: currency,
                unit_amount: String(unitCents),
                tax_behavior: "exclusive",
                product_data: productData
            }
        }],
        payment_intent_data: {
            description: clean(product.name).slice(0, 200)
        },
        metadata: {
            source: "caesardekeijzer-shop",
            productId: clean(product.id),
            quantity: String(quantity),
            unitAmount: String(unitCents),
            shippingAmount: String(shippingCents),
            currency: currency,
            variantId: clean(product.printfulVariantId),
            fileUrl: clean(product.printfulFileUrl),
            fileType: clean(product.printfulFileType)
        }
    };
}

async function readJson(request) {
    const text = await request.text();
    if (text.length > BODY_LIMIT) {
        return { error: "The checkout request is too large." };
    }
    if (!text) {
        return { error: "The checkout request was empty." };
    }
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { error: "The checkout request must be a JSON object." };
        }
        return { value: parsed };
    } catch (err) {
        return { error: "The checkout request was not valid JSON." };
    }
}

async function stripeRequest(env, fetchImpl, path, method, params, idempotencyKey) {
    if (missingKey(env, "STRIPE_SECRET_KEY")) {
        return { missing: "STRIPE_SECRET_KEY" };
    }
    const headers = {
        Authorization: "Bearer " + clean(env.STRIPE_SECRET_KEY),
        "Stripe-Version": STRIPE_VERSION
    };
    const init = { method: method, headers: headers };
    if (method !== "GET") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        init.body = encodeForm(params || {});
    }
    if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
    }
    const response = await fetchImpl("https://api.stripe.com/v1" + path, init);
    const json = await response.json().catch(function () { return {}; });
    return { response: response, json: json };
}

function stripeErrorMessage(json) {
    const message = json && json.error && json.error.message;
    return clean(message) || "Stripe refused the request.";
}

export async function handleCheckoutOptions(request) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function handleCheckout({ request, env, fetchImpl, catalog }) {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigin(origin)) {
        return jsonResponse(403, { error: "This shop does not accept checkout from that site." }, request);
    }
    if (missingKey(env, "STRIPE_SECRET_KEY")) {
        console.error("checkout refused: missing STRIPE_SECRET_KEY");
        return jsonResponse(503, { error: "Payments are not configured. Missing STRIPE_SECRET_KEY." }, request);
    }

    const site = publicSite(env);
    if (!site) {
        return jsonResponse(500, { error: "SHOP_PUBLIC_URL must be an https origin." }, request);
    }

    const parsed = await readJson(request);
    if (parsed.error) {
        return jsonResponse(400, { error: parsed.error }, request);
    }
    const body = parsed.value;
    const productId = clean(body.productId);
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(productId)) {
        return jsonResponse(400, { error: "Unknown piece." }, request);
    }
    const quantity = Number(body.quantity === undefined ? 1 : body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        return jsonResponse(400, { error: "Quantity must be a whole number from 1 to " + MAX_QUANTITY + "." }, request);
    }
    let idempotencyKey = "";
    if (body.idempotencyKey) {
        idempotencyKey = clean(body.idempotencyKey);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
            return jsonResponse(400, { error: "idempotencyKey must be a UUID." }, request);
        }
    }

    const list = catalog || bundledCatalog;
    const product = findProduct(list, productId);
    if (!product || !isSellable(product)) {
        return jsonResponse(409, { error: "This piece is not for sale." }, request);
    }

    const created = await stripeRequest(
        env,
        fetchImpl,
        "/checkout/sessions",
        "POST",
        checkoutParams(product, quantity, site),
        idempotencyKey
    );
    if (created.missing) {
        console.error("checkout refused: missing STRIPE_SECRET_KEY");
        return jsonResponse(503, { error: "Payments are not configured. Missing STRIPE_SECRET_KEY." }, request);
    }
    if (!created.response.ok || !isStripeCheckoutUrl(created.json && created.json.url)) {
        console.error("stripe checkout failed", created.response.status, stripeErrorMessage(created.json));
        return jsonResponse(502, { error: "Stripe did not open checkout. " + stripeErrorMessage(created.json) }, request);
    }
    return jsonResponse(200, { checkoutUrl: created.json.url }, request);
}

export function verifyStripeSignature(rawBody, header, secret, nowMs) {
    if (!clean(secret) || !clean(header)) {
        return false;
    }
    const parts = String(header).split(",");
    let timestamp = "";
    const signatures = [];
    parts.forEach(function (part) {
        const eq = part.indexOf("=");
        if (eq === -1) {
            return;
        }
        const key = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        if (key === "t") {
            timestamp = value;
        } else if (key === "v1" && value) {
            signatures.push(value);
        }
    });
    if (!/^\d+$/.test(timestamp) || signatures.length === 0) {
        return false;
    }
    const age = Math.floor((nowMs || Date.now()) / 1000) - Number(timestamp);
    if (!Number.isFinite(age) || age > 300 || age < -300) {
        return false;
    }
    const expected = crypto.createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    return signatures.some(function (signature) {
        const actual = Buffer.from(signature, "utf8");
        return actual.length === expectedBuf.length && crypto.timingSafeEqual(actual, expectedBuf);
    });
}

function webhookJson(status, body) {
    return new Response(JSON.stringify(body), {
        status: status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

function addressFromSession(session) {
    const shipping = session.shipping_details || session.shipping || {};
    const address = shipping.address || {};
    const customer = session.customer_details || {};
    const state = clean(address.state);
    const recipient = {
        name: clean(shipping.name),
        address1: clean(address.line1),
        city: clean(address.city),
        country_code: clean(address.country).toUpperCase(),
        zip: clean(address.postal_code)
    };
    const line2 = clean(address.line2);
    if (line2) {
        recipient.address2 = line2;
    }
    if (/^[A-Za-z]{2}$/.test(state)) {
        recipient.state_code = state.toUpperCase();
    } else if (state) {
        recipient.state_name = state;
    }
    const email = clean(customer.email);
    if (email) {
        recipient.email = email;
    }
    const phone = clean(customer.phone);
    if (phone) {
        recipient.phone = phone;
    }
    if (!recipient.name || !recipient.address1 || !recipient.city || !/^[A-Z]{2}$/.test(recipient.country_code) || !recipient.zip || !recipient.email) {
        return null;
    }
    return recipient;
}

function snapshotFromSession(session) {
    const meta = session.metadata || {};
    const quantity = Number(meta.quantity);
    const unitAmount = Number(meta.unitAmount);
    const shippingAmount = Number(meta.shippingAmount);
    const currency = clean(meta.currency).toLowerCase();
    const variantId = clean(meta.variantId);
    const fileUrl = clean(meta.fileUrl);
    const fileType = clean(meta.fileType);
    if (clean(meta.source) !== "caesardekeijzer-shop") {
        return { error: "Checkout session is missing shop metadata." };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        return { error: "Checkout session has a quantity this shop will not print." };
    }
    if (!Number.isInteger(unitAmount) || unitAmount < 1 || !Number.isInteger(shippingAmount) || shippingAmount < 0) {
        return { error: "Checkout session is missing the amount that was charged." };
    }
    if (!/^[a-z]{3}$/.test(currency) || clean(session.currency).toLowerCase() !== currency) {
        return { error: "Checkout session currency does not match the piece." };
    }
    const expected = (unitAmount * quantity) + shippingAmount;
    if (Number(session.amount_subtotal) !== expected) {
        return { error: "Paid amount does not match the checkout that was created." };
    }
    if (!/^[1-9]\d*$/.test(variantId) || !/^https:\/\/\S+$/i.test(fileUrl) || !/^[a-z0-9_-]{1,32}$/i.test(fileType)) {
        return { error: "Checkout session is missing the print file for this piece." };
    }
    return {
        value: {
            quantity: quantity,
            variantId: Number(variantId),
            fileUrl: fileUrl,
            fileType: fileType
        }
    };
}

async function printfulRequest(env, fetchImpl, path, method, body) {
    if (missingKey(env, "PRINTFUL_API_KEY")) {
        return { missing: "PRINTFUL_API_KEY" };
    }
    const init = {
        method: method,
        headers: {
            Authorization: "Bearer " + clean(env.PRINTFUL_API_KEY),
            "Content-Type": "application/json"
        }
    };
    if (body) {
        init.body = JSON.stringify(body);
    }
    const response = await fetchImpl("https://api.printful.com" + path, init);
    const json = await response.json().catch(function () { return {}; });
    return { response: response, json: json };
}

export async function handleWebhook({ request, env, fetchImpl, nowMs }) {
    if (missingKey(env, "STRIPE_WEBHOOK_SECRET")) {
        console.error("webhook refused: missing STRIPE_WEBHOOK_SECRET");
        return webhookJson(503, { error: "Webhook is not configured. Missing STRIPE_WEBHOOK_SECRET." });
    }
    const raw = await request.text();
    if (raw.length > 200000) {
        return webhookJson(413, { error: "Webhook body is too large." });
    }
    const signature = request.headers.get("stripe-signature");
    if (!verifyStripeSignature(raw, signature, clean(env.STRIPE_WEBHOOK_SECRET), nowMs || Date.now())) {
        console.error("webhook refused: signature mismatch");
        return webhookJson(400, { error: "Stripe webhook signature did not match." });
    }

    let event;
    try {
        event = JSON.parse(raw);
    } catch (err) {
        return webhookJson(400, { error: "Webhook body was not valid JSON." });
    }
    const type = event && event.type;
    if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
        return webhookJson(200, { received: true, ignored: true });
    }
    const sessionId = event.data && event.data.object && event.data.object.id;
    if (!/^cs_[A-Za-z0-9_]+$/.test(clean(sessionId))) {
        return webhookJson(400, { error: "Webhook did not include a Checkout Session id." });
    }
    if (missingKey(env, "STRIPE_SECRET_KEY")) {
        console.error("webhook refused: missing STRIPE_SECRET_KEY");
        return webhookJson(503, { error: "Payments are not configured. Missing STRIPE_SECRET_KEY." });
    }

    const loaded = await stripeRequest(env, fetchImpl, "/checkout/sessions/" + sessionId, "GET");
    if (loaded.missing) {
        return webhookJson(503, { error: "Payments are not configured. Missing STRIPE_SECRET_KEY." });
    }
    if (!loaded.response.ok) {
        console.error("stripe session reload failed", loaded.response.status, stripeErrorMessage(loaded.json));
        return webhookJson(502, { error: "Could not reload the Checkout Session. " + stripeErrorMessage(loaded.json) });
    }
    const session = loaded.json;
    if (clean(session.payment_status) !== "paid") {
        return webhookJson(200, { received: true, fulfilled: false });
    }

    const snapshot = snapshotFromSession(session);
    if (snapshot.error) {
        console.error("webhook rejected session", sessionId, snapshot.error);
        return webhookJson(422, { error: snapshot.error });
    }
    const recipient = addressFromSession(session);
    if (!recipient) {
        console.error("webhook missing shipping address", sessionId);
        return webhookJson(422, { error: "Stripe session has no complete shipping address, so the print order was not placed." });
    }
    if (missingKey(env, "PRINTFUL_API_KEY")) {
        console.error("webhook refused: missing PRINTFUL_API_KEY");
        return webhookJson(503, { error: "Fulfilment is not configured. Missing PRINTFUL_API_KEY." });
    }

    const externalId = printfulExternalId(session.id || sessionId);
    const existing = await printfulRequest(env, fetchImpl, "/orders/@" + externalId, "GET");
    if (existing.missing) {
        return webhookJson(503, { error: "Fulfilment is not configured. Missing PRINTFUL_API_KEY." });
    }
    if (existing.response.ok && existing.json && existing.json.result) {
        return webhookJson(200, { received: true, fulfilled: true, duplicate: true });
    }
    if (existing.response.status !== 404) {
        console.error("printful lookup failed", existing.response.status);
        return webhookJson(502, { error: "Could not check whether this print order already exists." });
    }

    const order = {
        external_id: externalId,
        shipping: "STANDARD",
        recipient: recipient,
        items: [{
            variant_id: snapshot.value.variantId,
            quantity: snapshot.value.quantity,
            files: [{
                type: snapshot.value.fileType,
                url: snapshot.value.fileUrl
            }]
        }]
    };
    const created = await printfulRequest(env, fetchImpl, "/orders?confirm=true", "POST", order);
    if (created.missing) {
        return webhookJson(503, { error: "Fulfilment is not configured. Missing PRINTFUL_API_KEY." });
    }
    if (!created.response.ok) {
        const again = await printfulRequest(env, fetchImpl, "/orders/@" + externalId, "GET");
        if (again.response && again.response.ok && again.json && again.json.result) {
            return webhookJson(200, { received: true, fulfilled: true, duplicate: true });
        }
        const message = clean(created.json && created.json.error && created.json.error.message) || "Printful refused the order.";
        console.error("printful order failed", created.response.status, message);
        return webhookJson(502, { error: "Printful did not accept the order. " + message });
    }
    console.error("printful order placed", sessionId);
    return webhookJson(200, { received: true, fulfilled: true });
}

export { bundledCatalog, isSellable };
