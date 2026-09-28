(function () {
    const BASE = 'https://cdn.jsdelivr.net/gh/s0nicblxd/Boxel-Mods@main/loader';
    const v = '?v=' + Date.now();
    const s = document.createElement('script');
    s.src = BASE + '/core.js' + v;
    s.onload = function () { window.ModAPI.boot(BASE + '/manifest.js' + v); };
    s.onerror = function () { console.error('[BoxelMods] failed to load core.js'); };
    document.head.appendChild(s);
})();
