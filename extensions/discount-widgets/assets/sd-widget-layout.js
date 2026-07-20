/* SmartDiscounts — shared widget layout applier.
   Any element with data-sd-widget="<widgetType>" gets the layout saved under
   Customization for that widget (width/height/padding/border/font). Fields left
   blank in the admin are skipped, so a widget's default look is preserved.
   Runs once per page (guarded), regardless of how many blocks include it. */
(function () {
  if (window.__sdLayoutInit) return;
  window.__sdLayoutInit = true;

  var els = document.querySelectorAll('[data-sd-widget]');
  if (!els.length) return;

  var shop = (window.Shopify && window.Shopify.shop) || '';

  function px(v) {
    return (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) ? Number(v) + 'px' : null;
  }

  function applyLayout(el, L) {
    if (!L) return;
    if (px(L.width)) el.style.width = px(L.width);
    if (px(L.height)) el.style.height = px(L.height);
    if (px(L.paddingTop)) el.style.paddingTop = px(L.paddingTop);
    if (px(L.paddingBottom)) el.style.paddingBottom = px(L.paddingBottom);
    if (px(L.paddingLeft)) el.style.paddingLeft = px(L.paddingLeft);
    if (px(L.paddingRight)) el.style.paddingRight = px(L.paddingRight);
    if (px(L.borderRadius)) el.style.borderRadius = px(L.borderRadius);
    if (L.borderColor) {
      el.style.borderColor = L.borderColor;
      el.style.borderStyle = 'solid';
      if (!el.style.borderWidth) el.style.borderWidth = '1px';
    }
    if (L.fontColor) el.style.color = L.fontColor;
  }

  fetch('/apps/smartdiscounts?shop=' + encodeURIComponent(shop))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var cust = (data && data.customizations) || {};
      els.forEach(function (el) {
        var cfg = cust[el.getAttribute('data-sd-widget')];
        if (cfg && cfg.layout) applyLayout(el, cfg.layout);
      });
    })
    .catch(function () {});
})();
