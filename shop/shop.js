/*
 * Draws the five shop slots from catalog.js.
 * A slot with empty fields stays not for sale.
 * When a slot is complete and SHOP_API_BASE points at the Vercel backend,
 * Order asks that backend to open Stripe Checkout. This file never holds a Stripe key.
 */
(function () {
    "use strict";

    var SLOT_COUNT = 5;

    function text(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value).trim();
    }

    function isSafeImage(src) {
        if (!src || src.indexOf("\\") !== -1 || /\s/.test(src)) {
            return false;
        }
        if (/^https:\/\//i.test(src)) {
            return true;
        }
        return /^(?:\.\/|\.\.\/)?[A-Za-z0-9._~/-]+$/.test(src) && src.indexOf("//") === -1;
    }

    function apiBase() {
        var base = text(window.SHOP_API_BASE).replace(/\/$/, "");
        if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(base)) {
            return base;
        }
        if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
            return base;
        }
        return "";
    }

    function el(tag, className) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        return node;
    }

    function addText(parent, tag, className, value) {
        var node = el(tag, className);
        node.appendChild(document.createTextNode(value));
        parent.appendChild(node);
        return node;
    }

    function note(message) {
        var node = document.getElementById("shop-checkout-note");
        if (!node) {
            return;
        }
        node.hidden = false;
        node.textContent = message;
    }

    function emptyMark() {
        var icon = el("i", "mdi mdi-palette text-custom");
        icon.setAttribute("aria-hidden", "true");
        return icon;
    }

    function figureFor(product) {
        var figure = el("div", "shop-figure");
        var src = text(product.image);
        if (!isSafeImage(src)) {
            figure.appendChild(emptyMark());
            return figure;
        }
        var img = document.createElement("img");
        img.src = src;
        img.alt = text(product.name);
        img.addEventListener("error", function () {
            img.remove();
            if (!figure.querySelector(".mdi")) {
                figure.appendChild(emptyMark());
            }
        });
        figure.appendChild(img);
        return figure;
    }

    function startCheckout(productId, button) {
        var base = apiBase();
        if (!base) {
            note("Checkout is not connected.");
            return;
        }
        button.disabled = true;
        var payload = { productId: productId, quantity: 1 };
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            payload.idempotencyKey = window.crypto.randomUUID();
        }
        fetch(base + "/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data || {} };
            });
        }).then(function (result) {
            var url = result.data.checkoutUrl || "";
            if (!result.ok || !/^https:\/\/checkout\.stripe\.com\//.test(url)) {
                button.disabled = false;
                note(result.data.error || "Checkout did not open.");
                return;
            }
            window.location.href = url;
        }).catch(function () {
            button.disabled = false;
            note("Checkout did not open.");
        });
    }

    function renderSlot(product, index) {
        var name = text(product.name);
        var description = text(product.description);
        var price = text(product.price);
        var listed = name.length > 0;
        var sellable = listed && window.ShopProducts && window.ShopProducts.isSellable(product);
        var connected = sellable && apiBase();

        var col = el("div", "col-md-6 col-lg-4 mt-4 d-flex");
        var card = el("article", "services-boxes rounded shop-card");
        card.appendChild(figureFor(listed ? product : {}));

        var body = el("div", "p-4 shop-body text-center");
        if (!listed) {
            addText(body, "p", "shop-kicker text-custom mb-2", "Spot " + (index + 1));
        }
        addText(body, "h3", "h5 mb-0", listed ? name : "Still being made");
        body.appendChild(el("div", "services-title-border"));
        addText(
            body,
            "p",
            "text-muted mt-3 mb-0",
            listed ? (description || "Details to come.") : "This spot stays empty until there is a real piece."
        );
        if (listed && price) {
            addText(body, "p", "mt-3 mb-0 font-weight-bold", price);
        }
        if (connected) {
            var button = el("button", "btn btn-custom btn-round mt-4");
            button.type = "button";
            button.textContent = "Order";
            button.addEventListener("click", function () {
                startCheckout(product.id, button);
            });
            body.appendChild(button);
        } else if (sellable) {
            addText(body, "p", "shop-status mb-0", "Checkout is not connected");
        } else {
            addText(body, "p", "shop-status mb-0", "Not for sale");
        }

        card.appendChild(body);
        col.appendChild(card);
        return col;
    }

    function render() {
        var grid = document.getElementById("shop-grid");
        if (!grid) {
            return;
        }
        var source = window.SHOP_CATALOG;
        var catalog = Array.isArray(source) ? source.slice(0, SLOT_COUNT) : [];
        while (catalog.length < SLOT_COUNT) {
            catalog.push({});
        }
        grid.textContent = "";
        catalog.forEach(function (product, index) {
            grid.appendChild(renderSlot(product || {}, index));
        });
    }

    function checkoutReturn() {
        var params = new URLSearchParams(window.location.search);
        var state = params.get("checkout");
        if (state === "success") {
            note("If Stripe accepted the payment, the piece will be printed. This page cannot see whether it went through.");
        } else if (state === "cancel") {
            note("No payment was taken.");
        }
    }

    function stickyNav() {
        var nav = document.querySelector(".sticky");
        if (!nav) {
            return;
        }
        function onScroll() {
            if (window.scrollY >= 50) {
                nav.classList.add("stickyadd");
            } else {
                nav.classList.remove("stickyadd");
            }
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    function backToTop() {
        var link = document.querySelector(".back_top");
        if (!link) {
            return;
        }
        window.addEventListener("scroll", function () {
            link.style.display = window.scrollY > 100 ? "block" : "none";
        }, { passive: true });
        link.addEventListener("click", function (event) {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        render();
        checkoutReturn();
        stickyNav();
        backToTop();
    });
})();
