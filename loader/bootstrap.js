(function () {
    const BASE = 'https://cdn.jsdelivr.net/gh/s0nicblxd/Boxel-Mods@main/loader';
    const s = document.createElement('script');
    s.src = BASE + '/core.js';
    s.onload = function () { window.ModAPI.boot(BASE + '/manifest.js'); };
    s.onerror = function () { console.error('[BoxelMods] failed to load core.js'); };
    document.head.appendChild(s);
})();
