/**
 * SmartDiscounts - Shipping Progress Bar
 * Drives blocks/shipping-progress-bar.liquid (selection rules are documented
 * there). Kept out of the block because inline scripts count toward the
 * extension's 100 KB Liquid limit.
 */
(function() {
  function init(container) {
    if (container.dataset.sdInit) return;
    container.dataset.sdInit = '1';
    var B = container.id.replace('sd-shipping-', '');
    var msgEl = document.getElementById('sd-shipping-msg-' + B);
    var fillEl = document.getElementById('sd-shipping-fill-' + B);
    if (!container || !msgEl || !fillEl) return;

    var shop = container.dataset.shop || '';
    var currentProductId = container.dataset.currentProductId || '';
    var specificCampaigns = []; // free shipping for specific products
    var allProductsCampaigns = []; // free shipping for all products

    var initialMsg = container.dataset.initial || 'Add {amount} to unlock free shipping';
    var progressMsg = container.dataset.progress || "You're {amount} away from free shipping!";
    var successMsg = container.dataset.success || "You've unlocked free shipping!";

    function fmt(amount) {
      return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Combine all specific campaigns' productIds into one set for fast lookup.
    // (If a merchant has multiple specific campaigns, any matching product counts
    // as a "specific item" for the cart-contents check.)
    function buildSpecificProductSet() {
      var set = new Set();
      for (var i = 0; i < specificCampaigns.length; i++) {
        var ids = specificCampaigns[i].productIds || [];
        for (var j = 0; j < ids.length; j++) set.add(String(ids[j]));
      }
      return set;
    }

    // Returns the lowest threshold among the specific campaigns whose
    // productIds match at least one item in the cart. Null if none match.
    function bestSpecificThreshold(cart) {
      var items = (cart && cart.items) || [];
      var itemIds = items.map(function(it) { return String(it.product_id); });
      var bestThr = null;
      for (var i = 0; i < specificCampaigns.length; i++) {
        var c = specificCampaigns[i];
        var pids = c.productIds || [];
        var matches = false;
        for (var j = 0; j < pids.length; j++) {
          if (itemIds.indexOf(String(pids[j])) !== -1) { matches = true; break; }
        }
        if (matches) {
          var thr = parseFloat(c.minimumAmount);
          if (!isNaN(thr) && thr > 0) {
            if (bestThr === null || thr < bestThr) bestThr = thr;
          }
        }
      }
      return bestThr;
    }

    // Sum of cart items whose product_id is in the specific allow set, in cents.
    function sumSpecificCents(cart, allowedSet) {
      var items = (cart && cart.items) || [];
      var total = 0;
      for (var i = 0; i < items.length; i++) {
        if (allowedSet.has(String(items[i].product_id))) {
          total += items[i].final_line_price || 0;
        }
      }
      return total;
    }

    // Get the lowest threshold from active all-products campaigns. Null if none.
    function bestAllProductsThreshold() {
      var bestThr = null;
      for (var i = 0; i < allProductsCampaigns.length; i++) {
        var thr = parseFloat(allProductsCampaigns[i].minimumAmount);
        if (!isNaN(thr) && thr > 0) {
          if (bestThr === null || thr < bestThr) bestThr = thr;
        }
      }
      return bestThr;
    }

    // Decide which threshold to show + what counts toward it.
    // Returns { thresholdDollars, applicableCents } or null.
    function pickThreshold(cart) {
      var items = (cart && cart.items) || [];
      var allowedSet = buildSpecificProductSet();

      // If there are no specific campaigns AND no all-products campaigns,
      // we shouldn't even be here — but guard anyway.
      if (specificCampaigns.length === 0 && allProductsCampaigns.length === 0) {
        return null;
      }

      // Determine cart composition
      var hasSpecific = false;
      var hasNonSpecific = false;
      for (var i = 0; i < items.length; i++) {
        var pid = String(items[i].product_id);
        if (allowedSet.has(pid)) hasSpecific = true;
        else hasNonSpecific = true;
        if (hasSpecific && hasNonSpecific) break;
      }

      // Empty cart — pick a sensible default based on what's available + page context
      if (items.length === 0) {
        // If on a product page where the current product is specific-eligible,
        // start the customer on the specific threshold for friendlier UX.
        var onSpecificProductPage =
          currentProductId && allowedSet.has(String(currentProductId));
        if (onSpecificProductPage) {
          var specThr = bestSpecificThreshold({ items: [{ product_id: currentProductId }] });
          if (specThr !== null) {
            return { thresholdDollars: specThr, applicableCents: 0 };
          }
        }
        // Otherwise fall back to all-products
        var allThr = bestAllProductsThreshold();
        if (allThr !== null) return { thresholdDollars: allThr, applicableCents: 0 };
        // No all-products → fall back to lowest specific threshold (anything is better than nothing)
        var lowestSpec = null;
        for (var k = 0; k < specificCampaigns.length; k++) {
          var t = parseFloat(specificCampaigns[k].minimumAmount);
          if (!isNaN(t) && t > 0 && (lowestSpec === null || t < lowestSpec)) lowestSpec = t;
        }
        if (lowestSpec !== null) return { thresholdDollars: lowestSpec, applicableCents: 0 };
        return null;
      }

      // CASE A: Pure specific cart — use specific threshold, count only specific items
      if (hasSpecific && !hasNonSpecific) {
        var thr = bestSpecificThreshold(cart);
        if (thr === null) {
          // Specific items in cart but no matching specific campaign threshold?
          // Fall back to all-products.
          var fallback = bestAllProductsThreshold();
          if (fallback === null) return null;
          return { thresholdDollars: fallback, applicableCents: cart.total_price || 0 };
        }
        var specCents = sumSpecificCents(cart, allowedSet);
        return { thresholdDollars: thr, applicableCents: specCents };
      }

      // CASE B & C: Any non-specific item in cart — use max(specific, all-products)
      // The progress counts the WHOLE cart (because all-products would fire on it).
      var specT = bestSpecificThreshold(cart); // may be null if no specific matches
      var allT = bestAllProductsThreshold();   // may be null if no all-products campaign

      // If neither exists, no bar
      if (specT === null && allT === null) return null;

      // "Higher wins" — even if specific can't actually fire here, per the user's rule
      var higher;
      if (specT === null) higher = allT;
      else if (allT === null) higher = specT;
      else higher = Math.max(specT, allT);

      return { thresholdDollars: higher, applicableCents: cart.total_price || 0 };
    }

    function update() {
      fetch('/cart.js', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(cart) {
          if (!cart) return;

          var winner = pickThreshold(cart);
          if (!winner || isNaN(winner.thresholdDollars) || winner.thresholdDollars <= 0) {
            container.style.display = 'none';
            return;
          }

          var threshold = winner.thresholdDollars;
          var applicableCents = winner.applicableCents;
          var applicable = applicableCents / 100;
          var thresholdCents = threshold * 100;
          var remaining = Math.max(0, threshold - applicable);
          var progress = Math.min(100, (applicable / threshold) * 100);

          container.style.display = 'block';
          fillEl.style.width = progress + '%';

          if (cart.item_count === 0) {
            msgEl.innerHTML = initialMsg
              .replace('{amount}', fmt(threshold))
              .replace('{threshold}', threshold) + ' 🚚';
          } else if (applicableCents >= thresholdCents) {
            msgEl.innerHTML = '🎉 ' + successMsg;
          } else {
            msgEl.innerHTML = progressMsg
              .replace('{amount}', fmt(remaining))
              .replace('{threshold}', threshold) + ' 🚚';
          }
        })
        .catch(function() {});
    }

    function startPollingAndObserve() {
      update();
      setInterval(update, 2000);

      var cartForm = document.querySelector('form[action="/cart"], cart-items, .cart-items');
      if (cartForm) {
        var obs = new MutationObserver(function() {
          setTimeout(update, 500);
        });
        obs.observe(cartForm, { childList: true, subtree: true, attributes: true });
      }
    }

    // Load active free-shipping campaigns from proxy, split into specific vs all-products.
    fetch('/apps/smartdiscounts?shop=' + encodeURIComponent(shop))
      .then(function(r) {
        if (!r.ok) throw new Error('proxy error');
        return r.json();
      })
      .then(function(data) {
        var campaigns = (data && data.campaigns) || [];
        for (var i = 0; i < campaigns.length; i++) {
          var c = campaigns[i];
          if (!c) continue;
          if (c.type !== 'shipping_discount') continue;
          if (c.discountType !== 'free_shipping') continue;
          if (c.status !== 'active') continue;
          if (!(parseFloat(c.minimumAmount) > 0)) continue;

          if (c.appliesTo === 'specific_products' && c.productIds && c.productIds.length > 0) {
            specificCampaigns.push(c);
          } else if (c.appliesTo === 'all' || !c.appliesTo) {
            allProductsCampaigns.push(c);
          }
        }

        if (specificCampaigns.length === 0 && allProductsCampaigns.length === 0) return;
        startPollingAndObserve();
      })
      .catch(function() { /* proxy unreachable → stay hidden */ });
  }

  function initAll(scope) {
    var bars = (scope || document).querySelectorAll('[data-sd-widget="shipping_bar"]');
    for (var i = 0; i < bars.length; i++) init(bars[i]);
  }

  initAll();
  // Theme editor re-renders a section without re-running deferred scripts.
  document.addEventListener('shopify:section:load', function(e) { initAll(e.target); });
})();
