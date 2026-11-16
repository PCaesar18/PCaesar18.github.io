/*
 * Shared rules for when a catalog slot can be sold.
 * The browser and the Vercel backend both load this file.
 * A slot is not for sale until every required field is filled in.
 * No Stripe keys belong in this file.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ShopProducts = api;
    }
})(typeof window !== "undefined" ? window : null, function () {
    var TWO_DECIMAL_CURRENCIES = {
        eur: true,
        usd: true,
        gbp: true,
        cad: true,
        aud: true,
        nzd: true,
        chf: true,
        sek: true,
        nok: true,
        dkk: true,
        pln: true,
        czk: true,
        ron: true
    };

    function clean(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value).trim();
    }

    function toCents(amount) {
        var text = clean(amount);
        if (!/^\d+\.\d{2}$/.test(text)) {
            return null;
        }
        var parts = text.split(".");
        return (Number(parts[0]) * 100) + Number(parts[1]);
    }

    function sellableProblems(product) {
        var item = product || {};
        var problems = [];
        var id = clean(item.id);
        var name = clean(item.name);
        var currency = clean(item.currency).toLowerCase();
        var amount = clean(item.amount);
        var shipping = clean(item.shippingAmount);
        var variant = clean(item.printfulVariantId);
        var fileUrl = clean(item.printfulFileUrl);
        var fileType = clean(item.printfulFileType);
        var taxCode = clean(item.taxCode);
        var amountCents = toCents(amount);
        var shippingCents = toCents(shipping);

        if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) {
            problems.push("id");
        }
        if (!name || name.length > 120) {
            problems.push("name");
        }
        if (!clean(item.price)) {
            problems.push("price");
        }
        if (!TWO_DECIMAL_CURRENCIES[currency]) {
            problems.push("currency");
        }
        if (amountCents === null || amountCents < 1) {
            problems.push("amount");
        }
        if (shippingCents === null) {
            problems.push("shippingAmount");
        }
        if (!/^[1-9]\d*$/.test(variant)) {
            problems.push("printfulVariantId");
        }
        if (!/^https:\/\/\S+$/i.test(fileUrl) || fileUrl.length > 500) {
            problems.push("printfulFileUrl");
        }
        if (!/^[a-z0-9_-]{1,32}$/i.test(fileType)) {
            problems.push("printfulFileType");
        }
        if (taxCode && !/^txcd_\d{8}$/.test(taxCode)) {
            problems.push("taxCode");
        }
        return problems;
    }

    function isSellable(product) {
        return sellableProblems(product).length === 0;
    }

    return {
        clean: clean,
        toCents: toCents,
        sellableProblems: sellableProblems,
        isSellable: isSellable
    };
});
