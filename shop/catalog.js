/*
 * Five empty slots for /shop. The pieces are not designed yet.
 * Leave every field blank until a piece is real. An empty slot is not for sale.
 *
 *   id                 stable id, already set on each slot
 *   name               piece name
 *   description        short line for the card and for Stripe
 *   price              label shown on the card, currency included (for example "€24")
 *   currency           what Stripe charges: eur, usd, gbp, ... (two-decimal currencies)
 *   amount             what Stripe charges, before tax, "24.00". This is not parsed from price.
 *   shippingAmount     postage added in Checkout, "4.50". Use "0.00" only for free postage.
 *   image              path relative to shop/index.html, or an https URL
 *   printfulVariantId  Printful catalog variant id
 *   printfulFileUrl    https URL Printful can download
 *   printfulFileType   Printful file type for that product, such as default or front
 *   taxCode            optional Stripe tax code (txcd_########). Blank uses the Tax settings default.
 *
 * Checkout runs on a separate Vercel backend, not on GitHub Pages.
 * The backend creates a Stripe Checkout Session with Stripe Tax.
 * After Stripe confirms payment via webhook, that backend places the Printful order.
 * Do not put STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY,
 * or PRINTFUL_API_KEY in this file. GitHub Pages cannot receive the webhook.
 *
 * Printful: the account exists, and there is nothing to fulfill yet.
 * This static file does not call Printful.
 */
(function (root, factory) {
    var products = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = products;
    }
    if (root) {
        root.SHOP_CATALOG = products;
    }
})(typeof window !== "undefined" ? window : null, function () {
    function slot(id) {
        return {
            id: id,
            name: "",
            description: "",
            price: "",
            currency: "",
            amount: "",
            shippingAmount: "",
            image: "",
            printfulVariantId: "",
            printfulFileUrl: "",
            printfulFileType: "",
            taxCode: ""
        };
    }

    return [
        slot("slot-1"),
        slot("slot-2"),
        slot("slot-3"),
        slot("slot-4"),
        slot("slot-5")
    ];
});
