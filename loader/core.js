(function () {
    'use strict';

    if (window.ModAPI && window.ModAPI._booted) return;

    const CORE_VERSION = '1.0.1';

    const registry = new Map();
    const patchStacks = new Map();
    const pendingRegistrations = new Map();

    let currentMod = null;
    let manifest = null;
    let menu = null;
    let booted = false;

    const ENABLED_KEY = 'boxel-mods:enabled';
    const log = (...a) => console.log('%c[ModAPI]', 'color:#eb2b6d;font-weight:bold', ...a);

    function fetchScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load: ' + url));
            document.head.appendChild(s);
        });
    }

    function register(def) {
        if (!def || !def.id) { log('register() needs an id'); return; }

        const existing = registry.get(def.id);
        if (existing && existing.def && existing.loaded) {
            log('Mod', def.id, 'already loaded, ignoring re-register');
            return;
        }

        const entry = existing || { def: null, handles: [], loaded: false };
        entry.def = def;
        entry.handles = [];
        entry.loaded = false;
        registry.set(def.id, entry);

        const resolver = pendingRegistrations.get(def.id);
        if (resolver) {
            pendingRegistrations.delete(def.id);
            resolver(entry);
        }
    }

    function callLoad(entry) {
        if (entry.loaded) return;
        currentMod = entry;
        try { entry.def.load(); } catch (e) { log('load() error in', entry.def.id, e); }
        currentMod = null;
        entry.loaded = true;
    }

    function callUnload(entry) {
        if (!entry.loaded) return;
        currentMod = entry;
        try { if (entry.def.unload) entry.def.unload(); } catch (e) { log('unload() error in', entry.def.id, e); }
        for (let i = entry.handles.length - 1; i >= 0; i--) {
            try { entry.handles[i](); } catch (e) { log('cleanup error:', e); }
        }
        entry.handles = [];
        entry.loaded = false;
        currentMod = null;
    }

    function addCleanup(fn) {
        if (!currentMod) return fn;
        currentMod.handles.push(fn);
        return fn;
    }

    const onUpdate = (fn) => {
        if (!app.engine.events.afterUpdate) app.engine.events.afterUpdate = [];
        app.engine.events.afterUpdate.push(fn);
        return addCleanup(() => {
            const i = app.engine.events.afterUpdate.indexOf(fn);
            if (i >= 0) app.engine.events.afterUpdate.splice(i, 1);
        });
    };

    const onEvent = (name, fn, options) => {
        window.addEventListener(name, fn, options);
        return addCleanup(() => window.removeEventListener(name, fn, options));
    };

    const onKey = (code, fn, opts = {}) => {
        const capture = opts.capture !== undefined ? opts.capture : true;
        const handler = (e) => {
            if (e.code !== code) return;
            if (opts.ctrl  !== undefined && e.ctrlKey  !== opts.ctrl)  return;
            if (opts.shift !== undefined && e.shiftKey !== opts.shift) return;
            if (opts.alt   !== undefined && e.altKey   !== opts.alt)   return;
            if (opts.meta  !== undefined && e.metaKey  !== opts.meta)  return;
            if (opts.preventDefault !== false) e.preventDefault();
            fn(e);
        };
        window.addEventListener('keydown', handler, capture);
        return addCleanup(() => window.removeEventListener('keydown', handler, capture));
    };

    const onKeyUp = (code, fn, opts = {}) => {
        const capture = opts.capture !== undefined ? opts.capture : true;
        const handler = (e) => {
            if (e.code !== code) return;
            if (opts.preventDefault !== false) e.preventDefault();
            fn(e);
        };
        window.addEventListener('keyup', handler, capture);
        return addCleanup(() => window.removeEventListener('keyup', handler, capture));
    };

    const patch = (target, key, wrapper) => {
        if (!patchStacks.has(target)) patchStacks.set(target, new Map());
        const stacks = patchStacks.get(target);

        let stack = stacks.get(key);
        if (!stack) {
            stack = { original: target[key], wrappers: [] };
            stacks.set(key, stack);

            target[key] = function (...args) {
                let idx = stack.wrappers.length - 1;
                const next = () => {
                    if (idx < 0) return stack.original.apply(this, args);
                    return stack.wrappers[idx--].call(this, next, ...args);
                };
                return next();
            };
        }

        stack.wrappers.push(wrapper);

        return addCleanup(() => {
            const i = stack.wrappers.indexOf(wrapper);
            if (i >= 0) stack.wrappers.splice(i, 1);
            if (stack.wrappers.length === 0) {
                target[key] = stack.original;
                stacks.delete(key);
            }
        });
    };

    const storageFor = (modId) => {
        const p = 'boxel-mods:' + modId + ':';
        return {
            get(key, defVal) {
                try {
                    const v = localStorage.getItem(p + key);
                    return v === null ? defVal : JSON.parse(v);
                } catch (_) { return defVal; }
            },
            set(key, val) {
                try { localStorage.setItem(p + key, JSON.stringify(val)); } catch (_) {}
            },
            remove(key) {
                try { localStorage.removeItem(p + key); } catch (_) {}
            }
        };
    };

    const MSYM_FONT = "'Material Symbols Rounded'";
    const MSYM_SETTINGS = "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24";

    const MENU_CSS = `
        .modapi-btn {
            position: fixed; top: 20px; right: 100px;
            width: 56px; height: 56px; border-radius: 14px;
            background: #eb2b6d; color: #fff;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 0 #00000040;
            cursor: pointer; transition: transform 0.15s;
            z-index: 9998;
        }
        .modapi-btn:hover { transform: translateY(-2px); }
        .modapi-btn .msym {
            font-family: ${MSYM_FONT};
            font-size: 32px;
            line-height: 0;
            font-variation-settings: ${MSYM_SETTINGS};
        }
        .modapi-drawer {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: 380px; max-width: 90vw;
            background: #1e2740;
            box-shadow: -8px 0 32px #00000060;
            transform: translateX(100%);
            transition: transform 0.25s ease-out;
            display: flex; flex-direction: column;
            z-index: 99999;
            font-family: Comfortaa-Bold, Comfortaa, sans-serif;
            color: #fff;
        }
        .modapi-drawer.open { transform: translateX(0); }
        .modapi-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 20px 22px; border-bottom: 2px solid #2b3a55;
        }
        .modapi-title { display: flex; align-items: center; gap: 10px; font-weight: 700; }
        .modapi-title .icon {
            width: 36px; height: 36px; border-radius: 10px;
            background: #eb2b6d; color: #fff;
            display: flex; align-items: center; justify-content: center;
        }
        .modapi-title .icon .msym {
            font-family: ${MSYM_FONT};
            font-size: 26px;
            line-height: 0;
            font-variation-settings: ${MSYM_SETTINGS};
        }
        .modapi-title .name { font-size: 20px; }
        .modapi-title .ver  { font-size: 11px; opacity: 0.55; }
        .modapi-close {
            width: 36px; height: 36px; border-radius: 10px;
            background: #2b3a55; color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s;
        }
        .modapi-close:hover { background: #eb2b6d; }
        .modapi-close .msym {
            font-family: ${MSYM_FONT};
            font-size: 22px;
            line-height: 0;
            font-variation-settings: ${MSYM_SETTINGS};
        }
        .modapi-search {
            padding: 12px 16px; display: flex; align-items: center; gap: 10px;
            background: #1a2138; margin: 14px 22px 0; border-radius: 10px;
        }
        .modapi-search .msym {
            font-family: ${MSYM_FONT};
            color: #7e8aa5; font-size: 22px;
            line-height: 0;
            font-variation-settings: ${MSYM_SETTINGS};
        }
        .modapi-search input {
            flex: 1; background: transparent; color: #fff;
            border: none; outline: none;
            font-family: Comfortaa-Bold, Comfortaa, sans-serif; font-size: 13px;
        }
        .modapi-search input::placeholder { color: #7e8aa5; }
        .modapi-list {
            flex: 1; overflow-y: auto; padding: 14px;
        }
        .modapi-list::-webkit-scrollbar { width: 8px; }
        .modapi-list::-webkit-scrollbar-thumb { background: #2b3a55; border-radius: 4px; }
        .modapi-card {
            display: flex; align-items: center; gap: 12px;
            padding: 14px; background: #253059;
            border-radius: 12px; margin-bottom: 10px;
            cursor: pointer; transition: background 0.15s;
        }
        .modapi-card:hover { background: #2b3a66; }
        .modapi-card.on   { background: #2b3a66; }
        .modapi-card-body { flex: 1; min-width: 0; }
        .modapi-card-name { color: #b8c2d6; font-weight: 700; font-size: 14px; }
        .modapi-card.on .modapi-card-name { color: #fff; }
        .modapi-card-ver  { color: #7e8aa5; font-size: 10px; margin-left: 4px; }
        .modapi-card-desc { color: #7e8aa5; font-size: 11px; margin-top: 3px; line-height: 1.4; }
        .modapi-switch {
            flex: 0 0 auto; width: 46px; height: 26px;
            border-radius: 13px; background: #1a2138;
            position: relative; transition: background 0.2s;
        }
        .modapi-switch::after {
            content: ''; position: absolute;
            top: 3px; left: 3px; width: 20px; height: 20px;
            border-radius: 50%; background: #7e8aa5;
            transition: transform 0.2s, background 0.2s;
        }
        .modapi-card.on .modapi-switch { background: #eb2b6d; }
        .modapi-card.on .modapi-switch::after { transform: translateX(20px); background: #fff; }
        .modapi-footer {
            padding: 12px 22px 16px; border-top: 2px solid #2b3a55;
            color: #7e8aa5; font-size: 11px; text-align: center;
        }
    `;

    function buildMenu() {
        const style = document.createElement('style');
        style.textContent = MENU_CSS;
        document.head.appendChild(style);

        const btn = document.createElement('div');
        btn.className = 'modapi-btn';
        btn.innerHTML = '<span class="msym">extension</span>';
        btn.style.display = 'none';
        document.body.appendChild(btn);

        const drawer = document.createElement('div');
        drawer.className = 'modapi-drawer';
        drawer.innerHTML = `
            <div class="modapi-header">
                <div class="modapi-title">
                    <div class="icon"><span class="msym">extension</span></div>
                    <span class="name">Mod Menu</span>
                    <span class="ver">v1.0</span>
                </div>
                <div class="modapi-close"><span class="msym">close</span></div>
            </div>
            <div class="modapi-search">
                <span class="msym">search</span>
                <input type="text" placeholder="Search mods..." />
            </div>
            <div class="modapi-list"></div>
            <div class="modapi-footer">Tap a mod to toggle it on / off</div>
        `;
        document.body.appendChild(drawer);

        const listEl = drawer.querySelector('.modapi-list');
        const searchEl = drawer.querySelector('input');

        const open  = () => drawer.classList.add('open');
        const close = () => drawer.classList.remove('open');
        btn.addEventListener('click', open);
        drawer.querySelector('.modapi-close').addEventListener('click', close);

        let filter = '';
        searchEl.addEventListener('input', () => {
            filter = searchEl.value.toLowerCase();
            render();
        });

        function render() {
            listEl.innerHTML = '';
            if (!manifest) return;

            for (const m of manifest.mods) {
                if (filter && !(m.name.toLowerCase().includes(filter) ||
                                (m.description || '').toLowerCase().includes(filter))) continue;

                const entry = registry.get(m.id);
                const loaded = entry && entry.loaded;

                const card = document.createElement('div');
                card.className = 'modapi-card' + (loaded ? ' on' : '');
                card.innerHTML = `
                    <div class="modapi-card-body">
                        <div>
                            <span class="modapi-card-name"></span>
                            <span class="modapi-card-ver"></span>
                        </div>
                        <div class="modapi-card-desc"></div>
                    </div>
                    <div class="modapi-switch"></div>
                `;
                card.querySelector('.modapi-card-name').textContent = m.name;
                card.querySelector('.modapi-card-ver').textContent = m.version || '';
                card.querySelector('.modapi-card-desc').textContent = m.description || '';

                card.addEventListener('click', async () => {
                    if (loaded) disableMod(m.id);
                    else await enableMod(m.id);
                    render();
                });
                listEl.appendChild(card);
            }
        }

        onUpdate(() => {
            btn.style.display = app.play ? 'flex' : 'none';
            if (!app.play && drawer.classList.contains('open')) {
                drawer.classList.remove('open');
            }
        });

        menu = { btn, drawer, render, open, close };
        render();
    }

    async function registerMod(modDef) {
        const existing = registry.get(modDef.id);
        if (existing && existing.def) return existing;

        const waitRegister = new Promise(resolve => {
            pendingRegistrations.set(modDef.id, resolve);
            setTimeout(() => {
                if (pendingRegistrations.has(modDef.id)) {
                    pendingRegistrations.delete(modDef.id);
                    resolve(null);
                }
            }, 5000);
        });

        try {
            await fetchScript(modDef.url);
        } catch (e) {
            log('Failed to fetch', modDef.id, '-', e.message);
            return null;
        }

        return await waitRegister;
    }

    async function enableMod(id) {
        const modDef = manifest.mods.find(m => m.id === id);
        if (!modDef) return;

        let entry = registry.get(id);
        if (!entry || !entry.def) {
            entry = await registerMod(modDef);
        }
        if (!entry) { log('Failed to enable', id); return; }
        if (entry.loaded) return;

        callLoad(entry);
        saveEnabled();
        if (menu) menu.render();
    }

    function disableMod(id) {
        const entry = registry.get(id);
        if (!entry) return;
        callUnload(entry);
        saveEnabled();
        if (menu) menu.render();
    }

    function saveEnabled() {
        const ids = [];
        registry.forEach((entry, id) => { if (entry.loaded) ids.push(id); });
        try { localStorage.setItem(ENABLED_KEY, JSON.stringify(ids)); } catch (_) {}
    }

    async function boot(manifestLocation) {
        if (booted) { log('Already booted'); return; }
        booted = true;
        window.ModAPI._booted = true;

        log('Core v' + CORE_VERSION + ' booting...');

        await fetchScript(manifestLocation);
        manifest = window.BOXEL_MOD_MANIFEST;
        if (!manifest || !manifest.mods) { log('Invalid manifest'); return; }

        for (const m of manifest.mods) {
            if (!registry.has(m.id)) {
                registry.set(m.id, { def: null, handles: [], loaded: false });
            }
        }

        buildMenu();

        let enabledIds = [];
        try { enabledIds = JSON.parse(localStorage.getItem(ENABLED_KEY) || '[]'); } catch (_) {}

        for (const id of enabledIds) {
            await enableMod(id);
        }
        if (menu) menu.render();

        log('Core v' + CORE_VERSION + ' ready —', enabledIds.length, 'mod(s) enabled');
    }

    window.ModAPI = {
        _booted: false,
        _version: CORE_VERSION,
        boot,
        register,

        onUpdate,
        onEvent,
        onKey,
        onKeyUp,
        patch,
        addCleanup,
        storage: storageFor,
        log,

        get player()     { return app.player; },
        get level()      { return app.level; },
        get engine()     { return app.engine; },
        get world()      { return app.engine.world; },
        get background() { return app.background; },
        get graphics()   { return app.graphics; },
        get scene()      { return app.graphics.scene; },
        get camera()     { return app.camera; },
        get composer()   { return app.graphics.composer; },
        get renderer()   { return app.graphics.renderer; },
        get canvas()     { return app.graphics.renderer.domElement; },
        get isPlaying()  { return app.play; },

        enable: enableMod,
        disable: disableMod
    };
})();
