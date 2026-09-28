ModAPI.register({
    id: 'jump-charge',
    name: 'Jump Charge',
    version: '1.0',
    description: 'Hold to charge a bigger jump.',

    load() {
        const api = ModAPI;

        const MIN_VEL = -4;
        const MAX_VEL = -11;
        const MAX_CHARGE_MS = 2000;
        const BAR_WIDTH = 220;
        const BAR_HEIGHT = 28;
        const POINTER_SIZE = 14;

        let isCharging = false;
        let chargeStartTime = 0;
        let forceReleaseTimeout = null;
        let usedJumpSinceGrounded = false;
        let wasGrounded = true;

        const container = document.createElement("div");
        container.style.cssText = `
            position:absolute; top:1.5em; left:50%; transform:translateX(-50%);
            display:none; flex-direction:column; align-items:center;
            pointer-events:none; z-index:9999;
        `;

        const bar = document.createElement("div");
        bar.style.cssText = `
            width:${BAR_WIDTH}px; height:${BAR_HEIGHT}px;
            display:flex; flex-direction:row;
            border:3px solid #000; border-radius:3px; overflow:hidden;
            box-shadow:0 0.2em 0 #00000040; box-sizing:content-box;
        `;

        [{ color: "#8CE81C", weight: 40 },
         { color: "#FFEB00", weight: 28 },
         { color: "#FF8C00", weight: 20 },
         { color: "#E8232B", weight: 12 }].forEach((z) => {
            const zone = document.createElement("div");
            zone.style.flex = z.weight;
            zone.style.background = z.color;
            bar.appendChild(zone);
        });

        const pointerWrap = document.createElement("div");
        pointerWrap.style.cssText = `position:relative; width:${BAR_WIDTH}px; height:0px;`;

        const pointerOutline = document.createElement("div");
        pointerOutline.style.cssText = `
            position:absolute; top:-2px; left:0px;
            width:0; height:0;
            border-left:${(POINTER_SIZE + 6) / 2}px solid transparent;
            border-right:${(POINTER_SIZE + 6) / 2}px solid transparent;
            border-bottom:${POINTER_SIZE + 6}px solid #000000;
            transform:translateX(-50%); z-index:1;
        `;

        const pointer = document.createElement("div");
        pointer.style.cssText = `
            position:absolute; top:0px; left:0px;
            width:0; height:0;
            border-left:${POINTER_SIZE / 2}px solid transparent;
            border-right:${POINTER_SIZE / 2}px solid transparent;
            border-bottom:${POINTER_SIZE}px solid #ffffff;
            transform:translateX(-50%); z-index:2;
        `;

        pointerWrap.appendChild(pointerOutline);
        pointerWrap.appendChild(pointer);
        container.appendChild(bar);
        container.appendChild(pointerWrap);
        document.body.appendChild(container);
        api.addCleanup(() => container.remove());

        const showUI = () => { container.style.display = "flex"; };
        const hideUI = () => { container.style.display = "none"; };

        const updateBarFill = (fraction) => {
            const x = fraction * BAR_WIDTH;
            pointer.style.left = x + "px";
            pointerOutline.style.left = x + "px";
        };

        api.onEvent('pageMounted', hideUI);

        const releaseJump = () => {
            if (!isCharging) return;
            isCharging = false;
            hideUI();

            if (forceReleaseTimeout) {
                clearTimeout(forceReleaseTimeout);
                forceReleaseTimeout = null;
            }

            const heldMs = performance.now() - chargeStartTime;
            const fraction = Math.min(heldMs, MAX_CHARGE_MS) / MAX_CHARGE_MS;
            const vel = MIN_VEL + (MAX_VEL - MIN_VEL) * fraction;

            if (isFinite(vel)) {
                Matter.Body.setVelocity(app.player.body, {
                    x: app.player.body.velocity.x,
                    y: vel
                });
                app.player.jumpReady = false;
                usedJumpSinceGrounded = true;
                wasGrounded = false;
                try { app.assets.audio.play("pop1"); } catch (_) {}
            }
        };

        api.patch(app.player, 'jump', (next) => {
            if (app.player.mode === 'grapple') return next();
            if (isCharging) return;
            if (!app.player.jumpReady || usedJumpSinceGrounded) return;

            isCharging = true;
            chargeStartTime = performance.now();
            try { app.assets.audio.play("wood"); } catch (_) {}

            if (app.play) { updateBarFill(0); showUI(); }

            forceReleaseTimeout = setTimeout(() => {
                forceReleaseTimeout = null;
                releaseJump();
            }, MAX_CHARGE_MS);
        });

        const isJumpKey = (e) => ['Space', 'ArrowUp', 'KeyW'].indexOf(e.code) !== -1;

        api.onEvent('keyup', (e) => { if (isJumpKey(e)) releaseJump(); }, true);
        api.onEvent('pointerup', (e) => {
            if (e.pointerType === 'mouse' && e.target && e.target.tagName === 'CANVAS') releaseJump();
        }, true);

        api.onEvent('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
        }, true);

        api.onUpdate(() => {
            if (app.player.mode === 'grapple') {
                if (isCharging) {
                    isCharging = false;
                    if (forceReleaseTimeout) {
                        clearTimeout(forceReleaseTimeout);
                        forceReleaseTimeout = null;
                    }
                    hideUI();
                }
                return;
            }

            const grounded = app.player.jumpReady;
            if (grounded && !wasGrounded) usedJumpSinceGrounded = false;
            wasGrounded = grounded;

            if (!app.play) {
                if (isCharging) releaseJump();
                hideUI();
                return;
            }

            if (isCharging) {
                const heldMs = performance.now() - chargeStartTime;
                const fraction = Math.min(heldMs, MAX_CHARGE_MS) / MAX_CHARGE_MS;
                updateBarFill(fraction);
            }
        });

        api.addCleanup(() => {
            if (forceReleaseTimeout) clearTimeout(forceReleaseTimeout);
        });
    }
});
