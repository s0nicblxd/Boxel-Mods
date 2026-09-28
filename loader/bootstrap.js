(function () {
    const BASE = 'https://raw.githubusercontent.com/s0nicblxd/Boxel-Mods/main/loader';

    window.ModAPI_loadScript = function (url) {
        const busted = url + (url.indexOf('?') === -1 ? '?t=' : '&t=') + Date.now();
        return fetch(busted)
            .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status + ' for ' + url)))
            .then(text => {
                const blob = new Blob([text], { type: 'text/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                return new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = blobUrl;
                    s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
                    s.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Load failed: ' + url)); };
                    document.head.appendChild(s);
                });
            });
    };

    window.ModAPI_loadScript(BASE + '/core.js')
        .then(() => window.ModAPI.boot(BASE + '/manifest.js'))
        .catch(e => console.error('[BoxelMods]', e.message));
})();
