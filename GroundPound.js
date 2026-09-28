ModAPI.register({
    id: 'ground-pound',
    name: 'Ground Pound',
    version: '1.0',
    description: 'Slam down midair for a bounce and afterimages.',

    load() {
        const api = ModAPI;

        let isGroundPounding = false;
        let hasLeftGround = false;
        let fallVelocity = 0;
        const GROUND_POUND_SPEED = 10;
        const BOUNCE_FORCE = 0.00025;

        const AFTERIMAGE_INTERVAL_MS = 25;
        const AFTERIMAGE_LIFETIME_MS = 300;
        const MAX_AFTERIMAGES = 6;

        let afterimagePool = [];
        let lastAfterimageTime = 0;

        const getPlayerScene = () => app.player.parent && app.player.parent.parent;

        const createAfterimage = () => {
            const scene = getPlayerScene();
            if (!scene) return;
            if (afterimagePool.length >= MAX_AFTERIMAGES) return;

            const ghost = app.player.clone(true);
            ghost.position.copy(app.player.position);
            ghost.rotation.copy(app.player.rotation);
            ghost.scale.copy(app.player.scale);

            const meshes = [];
            ghost.traverse((child) => {
                if (child.isLight) child.visible = false;
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                    child.material.depthWrite = false;
                    child.material.color.set(0x66ccff);
                    meshes.push(child);
                }
            });

            scene.add(ghost);
            afterimagePool.push({ obj: ghost, meshes, spawnTime: performance.now() });
        };

        const startGroundPound = () => {
            isGroundPounding = true;
            hasLeftGround = false;
            fallVelocity = 0;
            lastAfterimageTime = performance.now();
            Matter.Body.setVelocity(app.player.body, {
                x: app.player.body.velocity.x,
                y: GROUND_POUND_SPEED
            });
            try { app.assets.audio.play("resize"); } catch (_) {}
        };

        api.onKey('KeyS', () => {
            if (!isGroundPounding && !app.player.jumpReady) startGroundPound();
        });

        api.onKey('ArrowDown', () => {
            if (!isGroundPounding && !app.player.jumpReady) startGroundPound();
        });

        api.onUpdate(() => {
            if (isGroundPounding) {
                if (!hasLeftGround) {
                    if (!app.player.jumpReady) hasLeftGround = true;
                    fallVelocity = app.player.body.velocity.y;
                } else {
                    if (app.player.jumpReady) {
                        isGroundPounding = false;
                        Matter.Body.applyForce(app.player.body, app.player.body.position, {
                            x: 0,
                            y: -fallVelocity * BOUNCE_FORCE
                        });
                        try { app.assets.audio.play(Math.random() < 0.5 ? "impact1" : "impact2"); } catch (_) {}
                    } else {
                        fallVelocity = app.player.body.velocity.y;
                    }
                }

                const now = performance.now();
                if (now - lastAfterimageTime >= AFTERIMAGE_INTERVAL_MS) {
                    lastAfterimageTime = now;
                    createAfterimage();
                }
            }

            for (let i = afterimagePool.length - 1; i >= 0; i--) {
                const entry = afterimagePool[i];
                const age = performance.now() - entry.spawnTime;
                const fraction = Math.min(age / AFTERIMAGE_LIFETIME_MS, 1);
                const opacity = 0.55 * (1 - fraction);

                entry.meshes.forEach((mesh) => { mesh.material.opacity = opacity; });

                if (age >= AFTERIMAGE_LIFETIME_MS) {
                    const scene = getPlayerScene();
                    if (scene) scene.remove(entry.obj);
                    afterimagePool.splice(i, 1);
                }
            }
        });

        api.onEvent('pageMounted', () => {
            const scene = getPlayerScene();
            afterimagePool.forEach((entry) => { if (scene) scene.remove(entry.obj); });
            afterimagePool = [];
            isGroundPounding = false;
            hasLeftGround = false;
        });

        api.addCleanup(() => {
            const scene = getPlayerScene();
            afterimagePool.forEach((entry) => { if (scene) scene.remove(entry.obj); });
            afterimagePool = [];
        });
    }
});
