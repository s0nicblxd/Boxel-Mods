ModAPI.register({
    id: 'freecam',
    name: 'Freecam Mod',
    version: '1.01',
    description: 'Detached camera for filming & screenshots.',

    load() {
        const api = ModAPI;

        const PAN_SPEED = 4;
        const ZOOM_SPEED = 4;
        const ORBIT_STEP = Math.PI / 8;
        const PITCH_STEP = Math.PI / 12;
        const PITCH_LIMIT = 85 * Math.PI / 180;
        const MIN_ZOOM = 20;
        const DEFAULT_DISTANCE = 180;
        const BG_CAMERA_DISTANCE = 500;
        const CAM_FAR_FREECAM = 100000;

        const TOP_LEFT_UI_W = 330;
        const TOP_RIGHT_UI_W = 80;
        const TOP_GAP = 20;

        const CAM_KEYS = new Set([
            'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyP',
            'Digit1', 'Digit2', 'Digit3', 'KeyR', 'KeyF'
        ]);
        const keys = Object.create(null);

        let active = false;
        let screenshotRequested = false;
        let cameraTarget = { x: 0, y: 0, z: 0 };
        let orbitAngle = 0;
        let pitchAngle = 0;
        let orbitDistance = DEFAULT_DISTANCE;
        let originalFar = null;

        const cam = app.camera;
        const composer = app.graphics.composer;
        const renderer = app.graphics.renderer;

        let bgSaved = null;
        const saveBg = () => {
            const bg = app.background;
            if (!bg || bgSaved) return;
            bgSaved = {
                position: { x: bg.position.x, y: bg.position.y, z: bg.position.z },
                quaternion: { x: bg.quaternion.x, y: bg.quaternion.y, z: bg.quaternion.z, w: bg.quaternion.w },
                scale: { x: bg.scale.x, y: bg.scale.y, z: bg.scale.z }
            };
            bg.traverse(o => { o.frustumCulled = false; });
        };
        const restoreBg = () => {
            const bg = app.background;
            if (!bg || !bgSaved) return;
            bg.position.set(bgSaved.position.x, bgSaved.position.y, bgSaved.position.z);
            bg.quaternion.set(bgSaved.quaternion.x, bgSaved.quaternion.y, bgSaved.quaternion.z, bgSaved.quaternion.w);
            bg.scale.set(bgSaved.scale.x, bgSaved.scale.y, bgSaved.scale.z);
            bg.updateMatrixWorld(true);
            bgSaved = null;
        };

        const saveCam = () => {
            if (originalFar === null) originalFar = cam.far;
            cam.far = CAM_FAR_FREECAM;
            cam.updateProjectionMatrix();
        };
        const restoreCam = () => {
            if (originalFar !== null) {
                cam.far = originalFar;
                originalFar = null;
                cam.updateProjectionMatrix();
            }
        };
        const resetCamToGame = () => {
            const p = app.player ? app.player.position : { x: 0, y: 0, z: 0 };
            cam.position.set(p.x, p.y, p.z + 180);
            cam.up.set(0, 1, 0);
            cam.lookAt(p.x, p.y, p.z);
            cam.updateMatrixWorld(true);
        };

        const takeScreenshot = () => {
            try {
                const dataURL = renderer.domElement.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = 'boxel-3d-' + Date.now() + '.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (_) {}
        };

        let uiHidden = false;
        const uiHiddenElements = new Set();

        const setGameUIHidden = (state) => {
            const root = document.getElementById('app');
            const canvas = renderer.domElement;
            if (!root || !canvas) return;

            if (!state) {
                uiHiddenElements.forEach(el => {
                    try { el.style.display = el._freecamPrevDisplay || ''; } catch (_) {}
                    try { delete el._freecamPrevDisplay; } catch (_) {}
                });
                uiHiddenElements.clear();
                window._ModAPI_suppressBtn = false;
                return;
            }

            const chain = new Set();
            let n = canvas;
            while (n) { chain.add(n); n = n.parentNode; }

            const walk = (el) => {
                if (!el) return;
                if (el === panel) return;
                if (chain.has(el)) {
                    for (const c of el.children) walk(c);
                    return;
                }
                if (el.tagName === 'CANVAS') return;
                el._freecamPrevDisplay = el.style.display || '';
                el.style.display = 'none';
                uiHiddenElements.add(el);
            };

            for (const c of root.children) walk(c);

            window._ModAPI_suppressBtn = true;
        };

        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed; top: 1.5em; left: 50%; transform: translateX(-50%);
            background-color: #eb2b6d; border-radius: 0.75em;
            padding: 0.4em 0.8em;
            display: none; flex-direction: column;
            align-items: center; justify-content: center;
            box-shadow: 0 0.25em 0 #00000040;
            box-sizing: border-box; pointer-events: none;
            z-index: 9999;
            font-family: Comfortaa-Bold, Comfortaa, sans-serif;
            color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,0.25);
            white-space: nowrap;
            font-size: clamp(14px, 3vh, 22px);
            line-height: 1.15; user-select: none;
        `;

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex; align-items:baseline; justify-content:center; gap:0.35em;';
        const titleMain = document.createElement('span');
        titleMain.textContent = 'Freecam Mod';
        titleMain.style.fontSize = '0.95em';
        const titleVer = document.createElement('span');
        titleVer.textContent = '(1.0)';
        titleVer.style.fontSize = '0.5em';
        titleVer.style.opacity = '0.85';
        titleRow.appendChild(titleMain);
        titleRow.appendChild(titleVer);

        const rowXY = document.createElement('div');
        rowXY.style.cssText = 'display:flex; justify-content:center; gap:0.7em; font-size:0.6em; opacity:0.95; margin-top:0.15em; letter-spacing:0.05em;';
        const labelX = document.createElement('span');
        const labelY = document.createElement('span');
        rowXY.appendChild(labelX);
        rowXY.appendChild(labelY);

        const rowZAP = document.createElement('div');
        rowZAP.style.cssText = 'display:flex; justify-content:center; gap:0.55em; font-size:0.6em; opacity:0.95; letter-spacing:0.05em;';
        const labelZ = document.createElement('span');
        const labelA = document.createElement('span');
        const labelP = document.createElement('span');
        rowZAP.appendChild(labelZ);
        rowZAP.appendChild(labelA);
        rowZAP.appendChild(labelP);

        panel.appendChild(titleRow);
        panel.appendChild(rowXY);
        panel.appendChild(rowZAP);
        document.body.appendChild(panel);
        api.addCleanup(() => panel.remove());

        const repositionPanel = () => {
            if (!active) return;
            if (panel.style.display === 'none') return;

            panel.style.top = '1.5em';
            const vw = window.innerWidth;
            const pw = panel.getBoundingClientRect().width;
            const panelLeft = vw / 2 - pw / 2;
            const panelRight = vw / 2 + pw / 2;

            if (panelLeft < TOP_LEFT_UI_W + TOP_GAP || panelRight > vw - TOP_RIGHT_UI_W - TOP_GAP) {
                panel.style.top = '8em';
            }
        };

        const updatePanel = () => {
            labelX.textContent = 'X ' + cameraTarget.x.toFixed(1);
            labelY.textContent = 'Y ' + cameraTarget.y.toFixed(1);
            labelZ.textContent = 'Z ' + orbitDistance.toFixed(1);
            const yawDeg = ((orbitAngle * 180 / Math.PI) % 360 + 360) % 360;
            labelA.textContent = '◐ ' + yawDeg.toFixed(0) + '°';
            const pitchDeg = pitchAngle * 180 / Math.PI;
            const sign = pitchDeg >= 0 ? '+' : '';
            labelP.textContent = '⌃ ' + sign + pitchDeg.toFixed(0) + '°';
        };

        const refreshPanelVisibility = () => {
            if (active && !uiHidden) panel.style.display = 'flex';
            else panel.style.display = 'none';
        };

        const toggle = () => {
            if (!active && !app.play) return;

            active = !active;
            if (active) {
                const p = app.player.position;
                cameraTarget.x = p.x;
                cameraTarget.y = p.y;
                cameraTarget.z = p.z;
                orbitAngle = 0;
                pitchAngle = 0;
                orbitDistance = DEFAULT_DISTANCE;
                saveBg();
                saveCam();
                updatePanel();
                refreshPanelVisibility();
                requestAnimationFrame(repositionPanel);
            } else {
                restoreBg();
                restoreCam();
                resetCamToGame();
                refreshPanelVisibility();
                if (uiHidden) { setGameUIHidden(false); uiHidden = false; }
                for (const k in keys) keys[k] = false;
            }
        };

        const toggleUI = () => {
            if (!app.play) return;
            uiHidden = !uiHidden;
            setGameUIHidden(uiHidden);
            refreshPanelVisibility();
            if (active && !uiHidden) requestAnimationFrame(repositionPanel);
        };

        const keyHandler = (e) => {
            if (e.code === 'KeyV' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.stopImmediatePropagation();
                e.preventDefault();
                if (e.type === 'keydown') toggle();
                return;
            }
            if (e.code === 'KeyH' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.stopImmediatePropagation();
                e.preventDefault();
                if (e.type === 'keydown') toggleUI();
                return;
            }
            if (!active) return;
            if (CAM_KEYS.has(e.code)) {
                e.stopImmediatePropagation();
                e.preventDefault();
                if (e.code === 'KeyP' && e.type === 'keydown') { screenshotRequested = true; return; }
                keys[e.code] = (e.type === 'keydown');
            }
        };
        window.addEventListener('keydown', keyHandler, true);
        window.addEventListener('keyup', keyHandler, true);
        api.addCleanup(() => {
            window.removeEventListener('keydown', keyHandler, true);
            window.removeEventListener('keyup', keyHandler, true);
        });

        api.onUpdate(() => {
            if (active && !app.play) toggle();
        });

        const onResize = () => { if (active) requestAnimationFrame(repositionPanel); };
        window.addEventListener('resize', onResize);
        api.addCleanup(() => window.removeEventListener('resize', onResize));

        let last1 = false, last2 = false, last3 = false;
        let lastR = false, lastF = false;

        api.patch(composer, 'render', (next) => {
            if (!active) return next();

            if (keys.Digit1 && !last1) orbitAngle -= ORBIT_STEP;
            if (keys.Digit2 && !last2) orbitAngle += ORBIT_STEP;
            if (keys.Digit3 && !last3) {
                const p = app.player.position;
                orbitAngle = 0;
                pitchAngle = 0;
                orbitDistance = DEFAULT_DISTANCE;
                cameraTarget.x = p.x;
                cameraTarget.y = p.y;
                cameraTarget.z = p.z;
            }
            last1 = !!keys.Digit1;
            last2 = !!keys.Digit2;
            last3 = !!keys.Digit3;

            if (keys.KeyR && !lastR) pitchAngle = Math.min(PITCH_LIMIT, pitchAngle + PITCH_STEP);
            if (keys.KeyF && !lastF) pitchAngle = Math.max(-PITCH_LIMIT, pitchAngle - PITCH_STEP);
            lastR = !!keys.KeyR;
            lastF = !!keys.KeyF;

            if (keys.KeyW) cameraTarget.y += PAN_SPEED;
            if (keys.KeyS) cameraTarget.y -= PAN_SPEED;
            if (keys.KeyA) cameraTarget.x -= PAN_SPEED;
            if (keys.KeyD) cameraTarget.x += PAN_SPEED;
            if (keys.KeyQ) orbitDistance += ZOOM_SPEED;
            if (keys.KeyE) orbitDistance = Math.max(MIN_ZOOM, orbitDistance - ZOOM_SPEED);

            const cosP = Math.cos(pitchAngle);
            const sinP = Math.sin(pitchAngle);
            const sinT = Math.sin(orbitAngle);
            const cosT = Math.cos(orbitAngle);

            const cx = cameraTarget.x + sinT * cosP * orbitDistance;
            const cy = cameraTarget.y + sinP * orbitDistance;
            const cz = cameraTarget.z + cosT * cosP * orbitDistance;

            cam.position.set(cx, cy, cz);
            cam.up.set(0, 1, 0);
            cam.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
            cam.updateMatrixWorld(true);

            const bg = app.background;
            if (bg) {
                let dx = cameraTarget.x - cam.position.x;
                let dy = cameraTarget.y - cam.position.y;
                let dz = cameraTarget.z - cam.position.z;
                const len = Math.hypot(dx, dy, dz) || 1;
                dx /= len; dy /= len; dz /= len;

                const bgDist = len + BG_CAMERA_DISTANCE;
                const s = bgDist * (1280 / 180);
                bg.scale.set(s, s, s);
                bg.position.set(
                    cam.position.x + dx * bgDist,
                    cam.position.y + dy * bgDist,
                    cam.position.z + dz * bgDist
                );
                bg.quaternion.copy(cam.quaternion);
                bg.updateMatrixWorld(true);
            }

            updatePanel();
            next();

            if (screenshotRequested) {
                screenshotRequested = false;
                takeScreenshot();
            }
        });

        api.addCleanup(() => {
            restoreBg();
            restoreCam();
            resetCamToGame();
            if (uiHidden) setGameUIHidden(false);
            window._ModAPI_suppressBtn = false;
        });
    }
});
