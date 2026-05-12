/**
 * SmartDiscounts - Shared Widget Scripts
 * Countdown timer logic
 */
(function() {
  'use strict';
  if (window.__sdInit) return;
  window.__sdInit = true;

  // Countdown timers
  document.querySelectorAll('.sd-countdown-banner').forEach(function(banner) {
    var endStr = banner.getAttribute('data-end-date');
    if (!endStr) return;
    var endDate = new Date(endStr).getTime();

    function tick() {
      var diff = endDate - Date.now();
      if (diff <= 0) diff = 0;
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var el;
      el = banner.querySelector('[data-unit="days"]'); if (el) el.textContent = String(d).padStart(2,'0');
      el = banner.querySelector('[data-unit="hours"]'); if (el) el.textContent = String(h).padStart(2,'0');
      el = banner.querySelector('[data-unit="minutes"]'); if (el) el.textContent = String(m).padStart(2,'0');
      el = banner.querySelector('[data-unit="seconds"]'); if (el) el.textContent = String(s).padStart(2,'0');
      if (diff > 0) requestAnimationFrame(function() { setTimeout(tick, 1000); });
    }
    tick();
  });
})();
