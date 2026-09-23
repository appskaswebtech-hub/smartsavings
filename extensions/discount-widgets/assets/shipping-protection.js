/**
 * SmartDiscounts - Shipping Protection (product and cart pages)
 * Drives blocks/shipping-protection.liquid. Kept out of the block because
 * inline scripts count toward the extension's 100 KB Liquid limit.
 *
 * Config is the app's shop metafield ($app:smartsavings/shipping_protection),
 * embedded by the block's Liquid — no app-proxy request, so it works however
 * the proxy is routed. It holds every active campaign, each covering different
 * products; one card is shown per campaign that applies here.
 *   Product page (block has data-product-id): the campaign covering this
 *     product. Ticking adds its fee product right away, no reload.
 *   Cart page: a card per campaign with protected items in the cart; toggling reloads.
 * Only fee products are ever added or removed — never the shopper's items.
 */
(function() {
  'use strict';

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function init(box) {
    if (box.dataset.sdInit) return;
    box.dataset.sdInit = '1';
    var list = box.querySelector('.sd-protect-list');
    var tpl = box.querySelector('.sd-protect-tpl');
    if (!list || !tpl) return;
    var pageProductId = box.dataset.productId || '';
    var onProductPage = pageProductId !== '';

    function money(cents) {
      try {
        return new Intl.NumberFormat(box.dataset.locale || undefined, {
          style: 'currency',
          currency: box.dataset.currency || 'USD'
        }).format(cents / 100);
      } catch (e) {
        return (cents / 100).toFixed(2);
      }
    }

    function isLive(c) {
      var now = Date.now();
      if (c.startsAt && Date.parse(c.startsAt) > now) return false;
      if (c.endsAt && Date.parse(c.endsAt) <= now) return false;
      return true;
    }

    function getCart() {
      return fetch(root + 'cart.js', { headers: { 'Accept': 'application/json' } }).then(function(r) { return r.json(); });
    }

    function postCart(path, body) {
      return fetch(root + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      }).then(function(r) {
        if (r.ok) return r.json();
        // Shopify explains the refusal, e.g. "Cannot find variant" for a product
        // that isn't on the Online Store — keep it for the console / theme editor.
        return r.json().catch(function() { return {}; }).then(function(body) {
          throw new Error(body.description || body.message || ('Cart update failed (HTTP ' + r.status + ')'));
        });
      });
    }

    function removeLines(lines) {
      return lines.reduce(function(chain, line) {
        return chain.then(function() { return postCart('cart/change.js', { id: line.key, quantity: 0 }); });
      }, Promise.resolve());
    }

    function setText(card, selector, text) {
      var el = card.querySelector(selector);
      el.textContent = text || '';
      // 'block', not '' — clearing it would drop the Liquid's inline display:block
      // and run the title, subtitle and description together on one line.
      el.style.display = text ? 'block' : 'none';
    }

    // Shoppers see nothing; merchants in the theme editor see why, so a placed
    // block that stays empty is never a mystery.
    function hide(reason) {
      list.textContent = '';
      if (!(window.Shopify && window.Shopify.designMode)) {
        if (window.console) window.console.info('[SmartSavings] Shipping protection hidden: ' + reason);
        box.style.display = 'none';
        return;
      }
      var note = document.createElement('div');
      note.style.cssText = 'border:1px dashed #8a8a8a;border-radius:8px;padding:10px 12px;font-size:13px;color:#616161;';
      note.textContent = 'Shipping protection is hidden (only you see this in the theme editor): ' + reason;
      list.appendChild(note);
      box.style.display = 'block';
    }

    // "gid://shopify/Product/123" -> "123", to match /cart.js and /cart/add.js ids.
    function numericId(id) {
      var match = String(id || '').match(/(\d+)$/);
      return match ? match[1] : '';
    }

    // The app's shop metafield, embedded by the block's Liquid. The app only
    // writes campaigns that are active and ready, so an empty list means "off".
    function readCampaigns() {
      var el = box.querySelector('[data-sd-protect-config]');
      if (!el) return [];
      var parsed;
      try {
        parsed = JSON.parse(el.textContent || 'null');
      } catch (e) {
        return [];
      }
      // Older stores published a single campaign object.
      var raw = parsed && Array.isArray(parsed.campaigns) ? parsed.campaigns : parsed ? [parsed] : [];
      return raw.filter(function(c) { return c && c.feeProductId && c.feeVariantId; });
    }

    var all = readCampaigns();
    if (all.length === 0) {
      hide('there\'s no active Shipping protection campaign ready for this store — create or save one in the app.');
      return;
    }
    var campaigns = all.filter(isLive);
    if (campaigns.length === 0) {
      hide('every Shipping protection campaign is scheduled for later or has ended.');
      return;
    }

    // Any campaign's fee line is a charge, not merchandise to protect.
    var feeIds = {};
    campaigns.forEach(function(c) { feeIds[numericId(c.feeProductId)] = true; });

    function protectsProduct(c, productId) {
      var id = String(productId);
      if (feeIds[id]) return false;
      if (c.appliesTo === 'all') return true;
      return (c.productIds || []).map(numericId).indexOf(id) !== -1;
    }
    function protectedLinesOf(c, items) {
      return items.filter(function(line) { return protectsProduct(c, line.product_id); });
    }
    function feeLinesOf(c, items) {
      var id = numericId(c.feeProductId);
      return items.filter(function(line) { return String(line.product_id) === id; });
    }
    function applies(c, items) {
      return onProductPage ? protectsProduct(c, pageProductId) : protectedLinesOf(c, items).length > 0;
    }

    function feeCents(c, items, feeLines) {
      // Once added, the line's real (Cart Transform) price — except on a product
      // page, where the shopper may not have added this product yet.
      if (feeLines.length > 0 && !onProductPage) {
        return feeLines.reduce(function(sum, line) { return sum + line.final_line_price; }, 0);
      }
      // A fixed fee is in the shop currency; convert it like the Cart Transform does.
      var rate = Number(window.Shopify && window.Shopify.currency && window.Shopify.currency.rate) || 1;
      if (c.pricingType === 'fixed_amount') return Math.round(c.fixedAmount * 100 * rate);
      var valueCents = protectedLinesOf(c, items).reduce(function(sum, line) { return sum + line.original_line_price; }, 0);
      var pageProductInCart = items.some(function(line) { return String(line.product_id) === pageProductId; });
      if (onProductPage && !pageProductInCart) valueCents += parseInt(box.dataset.productPrice, 10) || 0;
      return Math.round(valueCents * c.percentage / 100);
    }

    function buildCard(c, items) {
      var card = tpl.content.firstElementChild.cloneNode(true);
      var check = card.querySelector('.sd-protect-check');
      var feeLines = feeLinesOf(c, items);
      var added = feeLines.length > 0;

      setText(card, '.sd-protect-heading', c.heading);
      setText(card, '.sd-protect-title', c.title);
      setText(card, '.sd-protect-subtitle', (c.subtitle || '').replace(/\{price\}/g, money(feeCents(c, items, feeLines))));
      setText(card, '.sd-protect-desc', c.description);
      if (c.imageUrl) {
        var img = card.querySelector('.sd-protect-img');
        img.src = c.imageUrl;
        img.style.display = '';
      }
      check.checked = added;
      check.setAttribute('aria-label', c.title || 'Shipping protection');

      check.addEventListener('change', function() {
        check.disabled = true;
        var update = check.checked
          ? postCart('cart/add.js', { items: [{ id: Number(numericId(c.feeVariantId)), quantity: 1 }] })
          : getCart().then(function(cart) { return removeLines(feeLinesOf(c, cart.items || [])); });
        update
          .then(function() {
            if (!onProductPage) return window.location.reload();
            check.disabled = false;
            startWatching();
          })
          .catch(function(error) {
            check.checked = !check.checked;
            check.disabled = false;
            var detail = (error && error.message) || '';
            if (window.console) window.console.warn('[SmartSavings] Shipping protection cart update failed: ' + detail);
            // Merchants previewing in the theme editor get Shopify's reason; shoppers a plain message.
            alert(window.Shopify && window.Shopify.designMode && detail
              ? 'Could not update shipping protection: ' + detail
              : 'Could not update shipping protection. Please try again.');
          });
      });
      return card;
    }

    // What the cards depend on — re-render only when this changes, so a poll
    // doesn't rebuild the DOM under the shopper on every tick.
    function signature(items) {
      return campaigns
        .map(function(c) {
          if (!applies(c, items)) return '';
          return numericId(c.feeProductId) + ':' + feeLinesOf(c, items).map(function(l) {
            return l.key + '@' + l.final_line_price;
          }).join(',') + ':' + feeCents(c, items, feeLinesOf(c, items));
        })
        .join('|');
    }

    var lastSignature = null;
    function render(items) {
      var shown = campaigns.filter(function(c) { return applies(c, items); });
      if (shown.length === 0) {
        lastSignature = null;
        hide(onProductPage
          ? 'this product isn\'t protected by any active campaign.'
          : 'there are no protected products in the cart.');
        return;
      }
      lastSignature = signature(items);
      list.textContent = '';
      shown.forEach(function(c) { list.appendChild(buildCard(c, items)); });
      box.style.display = 'block';
    }

    // Keep the cards in step with the cart. Themes remove items over AJAX
    // without reloading, so while a fee line is in the cart, re-read it.
    var watchTimer = null;
    function stopWatching() {
      if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    }
    function checkCart() {
      if (list.querySelector('.sd-protect-check:disabled')) return; // a change of ours is in flight
      getCart().then(function(cart) {
        var items = cart.items || [];
        var orphaned = [];
        campaigns.forEach(function(c) {
          var feeLines = feeLinesOf(c, items);
          // Nothing left for this campaign to protect — drop its fee. Only on the
          // cart page: on a product page the shopper may tick before adding this
          // product (and checkout prices an orphaned fee line at 0 regardless).
          if (feeLines.length > 0 && !onProductPage && protectedLinesOf(c, items).length === 0) {
            orphaned = orphaned.concat(feeLines);
          }
        });
        if (orphaned.length > 0) {
          stopWatching();
          removeLines(orphaned).then(function() { window.location.reload(); });
          return;
        }
        if (signature(items) !== lastSignature) render(items);
        if (!campaigns.some(function(c) { return feeLinesOf(c, items).length > 0; })) stopWatching();
      }).catch(function() {});
    }
    function startWatching() {
      if (!watchTimer) watchTimer = setInterval(checkCart, 2000);
    }
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && watchTimer) checkCart();
    });

    getCart().then(function(cart) {
      var items = cart.items || [];
      render(items);
      if (campaigns.some(function(c) { return feeLinesOf(c, items).length > 0; })) startWatching();
    }).catch(function() {
      hide('the cart couldn\'t be loaded.');
    });
  }

  function initAll(scope) {
    var boxes = (scope || document).querySelectorAll('[data-sd-protect]');
    for (var i = 0; i < boxes.length; i++) init(boxes[i]);
  }

  initAll();
  // Theme editor re-renders a section without re-running deferred scripts.
  document.addEventListener('shopify:section:load', function(e) { initAll(e.target); });
})();
