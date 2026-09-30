ModAPI.register({
    id: 'size-shifter',
    name: 'Size Shifter',
    version: '1.0',
    description: 'Grow and shrink with = and -. Reset with 0.',

    load() {
        const api = ModAPI;

        const STEP           = 0.25;
        const MIN_SCALE      = 0.25;
        const MAX_SCALE      = 4;
        const TWEEN_DURATION = 200;
        const SOUND          = 'wood';
        const LABEL_GAP_PX   = 16;

        let currentMult = 1;
        let animState = null;

        const getBaseScale = () => {
            if (app.player && app.player.scaleOrigin) {
                return {
                    x: app.player.scaleOrigin.x,
                    y: app.player.scaleOrigin.y,
                    z: app.player.scaleOrigin.z
                };
            }
            return {
                x: app.player.scale.x,
                y: app.player.scale.y,
                z: app.player.scale.z
            };
        };

        const applyScale = (mult) => {
            if (!app.player || !app.player.parent) return;
            const b = getBaseScale();
            app.player.setScale({
                x: b.x * mult,
                y: b.y * mult,
                z: b.z * mult
            }, false);
        };

        const clamp = (v) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, v));

        const startTween = (targetMult) => {
            targetMult = clamp(targetMult);
            targetMult = Math.round(targetMult * 100) / 100;
            if (Math.abs(targetMult - currentMult) < 0.001) return;

            animState = {
                startMult: currentMult,
                targetMult,
                startTime: performance.now()
            };
            currentMult = targetMult;

            try { app.assets.audio.play(SOUND); } catch (_) {}
            updateLabel();
        };

        const label = document.createElement('div');
        label.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-50%);
            background: #eb2b6d;
            color: #fff;
            padding: 4px 10px;
            border-radius: 8px;
            font-family: Comfortaa-Bold, Comfortaa, sans-serif;
            font-size: 12px;
            font-weight: 700;
            box-shadow: 0 3px 0 #00000040;
            pointer-events: none;
            z-index: 9997;
            display: none;
            text-shadow: 0 1px 0 rgba(0,0,0,0.25);
        `;
        document.body.appendChild(label);
        api.addCleanup(() => label.remove());

        const updateLabel = () => {
            label.textContent = '×' + currentMult.toFixed(2);
        };

        const anchorLabel = () => {
            const btn = document.querySelector('.modapi-btn');
            if (!btn) return;
            const br = btn.getBoundingClientRect();
            label.style.top = Math.round(br.bottom + LABEL_GAP_PX) + 'px';
            label.style.left = Math.round(br.left + br.width / 2) + 'px';
        };

        const hideUI = () => {
            label.style.display = 'none';
        };

        const resetToNormal = () => {
            currentMult = 1;
            animState = null;
            if (app.player && app.player.parent) applyScale(1);
            updateLabel();
        };

        api.onEvent('pageMounted', () => {
            hideUI();
            currentMult = 1;
            animState = null;
        });

        api.onKey('Minus', () => {
            if (!app.play) return;
            startTween(currentMult - STEP);
        });

        api.onKey('Equal', () => {
            if (!app.play) return;
            startTween(currentMult + STEP);
        });

        api.onKey('Digit0', () => {
            if (!app.play) return;
            startTween(1);
        });

        api.onUpdate(() => {
            if (!app.play) {
                hideUI();
                if (currentMult !== 1 || animState) {
                    currentMult = 1;
                    animState = null;
                    updateLabel();
                }
                return;
            }

            const suppressed = !!window._ModAPI_suppressBtn;
            if (suppressed) {
                label.style.display = 'none';
            } else {
                label.style.display = 'block';
                anchorLabel();
            }

            if (!animState) {
                const b = getBaseScale();
                if (b.x > 0 && app.player && app.player.scale) {
                    const actualMult = app.player.scale.x / b.x;
                    if (Math.abs(actualMult - currentMult) > 0.05) {
                        currentMult = Math.round(actualMult * 100) / 100;
                        updateLabel();
                    }
                }
            }

            if (!animState) return;

            const t = (performance.now() - animState.startTime) / TWEEN_DURATION;

            if (t >= 1) {
                applyScale(animState.targetMult);
                animState = null;
                return;
            }

            const eased = t < 0.5
                ? 2 * t * t
                : 1 - Math.pow(-2 * t + 2, 2) / 2;

            const s = animState.startMult + (animState.targetMult - animState.startMult) * eased;
            applyScale(s);
        });

        api.onEvent('playerRespawn', () => {
            if (app.player && app.player.checkpoint) {
                if (currentMult !== 1) setTimeout(() => applyScale(currentMult), 0);
            } else {
                resetToNormal();
            }
        });

        api.onEvent('playerRestart', () => {
            if (app.player && app.player.checkpoint) {
                if (currentMult !== 1) setTimeout(() => applyScale(currentMult), 0);
            } else {
                resetToNormal();
            }
        });

        updateLabel();
    }
});
