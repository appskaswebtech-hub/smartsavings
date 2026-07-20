/* SmartDiscounts — email-capture discount popup.
   Reads context from #sd-email-popup-root data-* attributes; style + page
   targeting come from /apps/smartdiscounts. */
(function () {
  var root = document.getElementById('sd-email-popup-root');
  if (!root) return;

  var shop = root.dataset.shop || '';
  var template = (root.dataset.template || '').split('.')[0]; // "product.alt" -> "product"
  var accent = root.dataset.accent || '#1a1a1a';
  var radius = parseInt(root.dataset.radius || '14', 10);
  var delaySec = parseFloat(root.dataset.delay || '2');

  function pageMatches(pages) {
    if (!pages || !pages.length) return false;
    if (pages.indexOf('all') !== -1) return true;
    return pages.indexOf(template) !== -1;
  }

  // How long to wait before re-showing after a dismissal (default 24h)
  function frequencyMs(c) {
    var v = parseInt(c.popupFrequencyValue, 10);
    if (isNaN(v) || v < 0) return 24 * 60 * 60 * 1000;
    return v * (c.popupFrequencyUnit === 'minutes' ? 60000 : 3600000);
  }

  // #RRGGBB + 0-100 opacity -> rgba()
  function rgba(hex, op) {
    var h = (hex || '#000000').replace('#', '');
    var r = parseInt(h.slice(0, 2), 16) || 0;
    var g = parseInt(h.slice(2, 4), 16) || 0;
    var b = parseInt(h.slice(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + ((op == null ? 55 : op) / 100) + ')';
  }

  fetch('/apps/smartdiscounts?shop=' + encodeURIComponent(shop))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var campaigns = (data && data.campaigns) || [];

      // Appearance customization (Customization -> Discount pop-up); global kill-switch
      var style = (data && data.popupStyle) || {};
      if (style.enabled === false) return;

      var campaign = null;
      for (var i = 0; i < campaigns.length; i++) {
        var c = campaigns[i];
        if (c.type === 'advanced_discount_code' && c.status === 'active' && c.popupEnabled && pageMatches(c.popupPages)) {
          campaign = c;
          break;
        }
      }
      if (!campaign) return;

      var storageKey = 'sd_ep_done_' + campaign.id;
      var closedKey = 'sd_ep_closed_' + campaign.id;
      try {
        if (localStorage.getItem(storageKey)) return; // already submitted
        var closedAt = parseInt(localStorage.getItem(closedKey) || '0', 10);
        if (closedAt && Date.now() - closedAt < frequencyMs(campaign)) return; // re-show window
      } catch (e) {}

      setTimeout(function () { renderPopup(campaign, storageKey, closedKey, style); }, delaySec * 1000);
    })
    .catch(function () {});

  function renderPopup(campaign, storageKey, closedKey, style) {
    style = style || {};
    var heading = campaign.popupHeading || 'Get your discount code';
    var desc = campaign.popupDescription || "Enter your email and we'll send your code to your inbox.";
    var btnText = campaign.popupButtonText || 'Email me the code';

    // DB style wins, then theme-embed block settings, then hard default
    var s = {
      overlay: style.overlayColor ? rgba(style.overlayColor, style.overlayOpacity) : 'rgba(0,0,0,.55)',
      modalBg: style.modalBg || '#ffffff',
      heading: style.headingColor || '#1a1a1a',
      text: style.textColor || '#555555',
      btnBg: style.buttonBg || accent,
      btnText: style.buttonTextColor || '#ffffff',
      inputBorder: style.inputBorderColor || '#dddddd',
      radius: (style.borderRadius != null ? style.borderRadius : radius)
    };

    var overlay = document.createElement('div');
    overlay.id = 'sd-ep-overlay';
    overlay.style.background = s.overlay;
    overlay.innerHTML =
      '<div id="sd-ep-modal" style="border-radius:' + s.radius + 'px;background:' + s.modalBg + ';">' +
        '<button id="sd-ep-close" aria-label="Close">&times;</button>' +
        '<h2 id="sd-ep-heading" style="color:' + s.heading + ';"></h2>' +
        '<p id="sd-ep-desc" style="color:' + s.text + ';"></p>' +
        '<input id="sd-ep-email" type="email" placeholder="you@email.com" autocomplete="email" style="border-color:' + s.inputBorder + ';" />' +
        '<button id="sd-ep-submit" style="background:' + s.btnBg + ';color:' + s.btnText + ';border-radius:' + Math.max(6, s.radius - 6) + 'px;"></button>' +
        '<div id="sd-ep-msg"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Size & spacing from Customization → Discount pop-up (applies to the modal card)
    var L = style.layout;
    if (L) {
      var modal = overlay.querySelector('#sd-ep-modal');
      var pxv = function (v) { return (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) ? Number(v) + 'px' : null; };
      if (modal) {
        if (pxv(L.width)) modal.style.maxWidth = pxv(L.width);
        if (pxv(L.height)) modal.style.height = pxv(L.height);
        if (pxv(L.paddingTop)) modal.style.paddingTop = pxv(L.paddingTop);
        if (pxv(L.paddingBottom)) modal.style.paddingBottom = pxv(L.paddingBottom);
        if (pxv(L.paddingLeft)) modal.style.paddingLeft = pxv(L.paddingLeft);
        if (pxv(L.paddingRight)) modal.style.paddingRight = pxv(L.paddingRight);
        if (L.fontColor) modal.style.color = L.fontColor;
      }
    }

    // textContent avoids injecting merchant-configured text as HTML
    overlay.querySelector('#sd-ep-heading').textContent = heading;
    overlay.querySelector('#sd-ep-desc').textContent = desc;
    var submitBtn = overlay.querySelector('#sd-ep-submit');
    submitBtn.textContent = btnText;

    var emailInput = overlay.querySelector('#sd-ep-email');
    var msg = overlay.querySelector('#sd-ep-msg');
    var closeBtn = overlay.querySelector('#sd-ep-close');

    requestAnimationFrame(function () { overlay.classList.add('sd-ep-show'); });

    function close() {
      try { localStorage.setItem(closedKey, String(Date.now())); } catch (e) {}
      overlay.classList.remove('sd-ep-show');
      setTimeout(function () { overlay.remove(); }, 200);
    }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    function showMsg(text, ok) {
      msg.textContent = text;
      msg.className = ok ? 'sd-ep-ok' : 'sd-ep-err';
      msg.style.display = 'block';
    }

    function submit() {
      var email = (emailInput.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMsg('Please enter a valid email address.', false);
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      msg.style.display = 'none';

      fetch('/apps/smartdiscounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, campaignId: campaign.id })
      })
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
        .then(function (res) {
          if (res.ok && res.body && res.body.success) {
            try { localStorage.setItem(storageKey, '1'); } catch (e) {}
            showMsg(res.body.message || 'Check your inbox for your discount code!', true);
            emailInput.style.display = 'none';
            submitBtn.style.display = 'none';
            setTimeout(close, 3000);
          } else {
            showMsg((res.body && res.body.error) || 'Something went wrong. Please try again.', false);
            submitBtn.disabled = false;
            submitBtn.textContent = btnText;
          }
        })
        .catch(function () {
          showMsg('Something went wrong. Please try again.', false);
          submitBtn.disabled = false;
          submitBtn.textContent = btnText;
        });
    }

    submitBtn.addEventListener('click', submit);
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }
})();
