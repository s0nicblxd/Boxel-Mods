ModAPI.register({
    id: 'thirty-sec',
    name: '30 Second Timer',
    version: '1.0',
    description: 'Beat each level in 30 seconds or die.',

    load() {
        const api = ModAPI;

        const bg = document.createElement('div');
        bg.style.cssText = `
            position:absolute; top:1.5em; left:50%; transform:translateX(-50%);
            background:#eb2b6d; border-radius:0.75em;
            padding:0.25em 0.5em 0.25em 0.25em;
            display:none; flex-direction:column; align-items:center; justify-content:center;
            box-shadow:0 0.25em 0 #00000040; box-sizing:border-box;
            pointer-events:none; z-index:9999;
            font-family:Comfortaa-Bold, Comfortaa, sans-serif;
            font-size:clamp(16px, 4vh, 32px); width:8.5em;
        `;

        const timerDisplay = document.createElement('div');
        timerDisplay.style.cssText = `
            display:flex; justify-content:center; align-items:center;
            width:100%; white-space:nowrap; color:#fff;
            pointer-events:none; user-select:none;
            text-shadow:0 2px 0 rgba(0,0,0,0.25);
        `;

        const label = document.createElement('div');
        label.textContent = 'Seconds Left';
        label.style.cssText = `
            color:#fff; font-size:0.85em; line-height:1;
            margin-top:0.15em; white-space:nowrap;
            text-shadow:0 1px 0 rgba(0,0,0,0.25);
            pointer-events:none; user-select:none;
        `;

        bg.appendChild(timerDisplay);
        bg.appendChild(label);
        document.body.appendChild(bg);
        api.addCleanup(() => bg.remove());

        let triggered = false;
        const hideUI = () => { bg.style.display = 'none'; };

        api.onEvent('pageMounted', hideUI);

        api.onUpdate(() => {
            const timer = Number(app.timer);

            if (!app.play || isNaN(timer)) {
                hideUI();
                triggered = false;
                return;
            }

            bg.style.display = 'flex';
            const remaining = Math.max(0, 30 - timer);

            if (remaining <= 0) {
                label.style.display = 'none';
                timerDisplay.textContent = "Time's Up!";
            } else {
                label.style.display = 'block';
                timerDisplay.textContent = '';
                const text = remaining.toFixed(2);
                for (let i = 0; i < text.length; i++) {
                    const span = document.createElement('span');
                    span.textContent = text[i];
                    span.style.cssText = 'display:inline-block; width:0.8em; text-align:center;';
                    timerDisplay.appendChild(span);
                }
            }

            if (timer >= 30 && !triggered) {
                triggered = true;
                app.player.removeCheckpoint();
                app.player.kill();
            }
            if (timer < 30) triggered = false;
        });
    }
});
