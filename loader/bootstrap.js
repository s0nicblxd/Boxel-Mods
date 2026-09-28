(function () {
    const BASE = 'https://raw.githubusercontent.com/s0nicblxd/Boxel-Mods/refs/heads/main/loader';
    const s = document.createElement('script');
    s.src = BASE + '/core.js';
    s.onload = function () { window.ModAPI.boot(BASE + '/manifest.js'); };
    s.onerror = function () { console.error('[BoxelMods] failed to load core.js'); };
    document.head.appendChild(s);
})();
