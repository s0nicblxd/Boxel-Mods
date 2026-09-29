ModAPI.register({
    id: 'charlie-dash',
    name: "Charlieee1's Dash Mod",
    version: '1.0',
    description: 'Air dash in your facing direction. Original by Charlieee1.',

    load() {
        const api = ModAPI;

        const DASH_SPEED_OVERRIDE     = 6;
        const DASH_KEYS               = ['ShiftLeft', 'ShiftRight'];
        const ALLOW_IN_MODES          = ['jump', 'control'];
        const GROUND_DASH_COOLDOWN_MS = 1500;

        const TRAIL_INTERVAL_MS       = 20;
        const TRAIL_LIFETIME_MS       = 250;
        const MAX_TRAILS              = 5;
        const TRAIL_COLOR             = 0xffff00;
        const TRAIL_OPACITY           = 0.6;

        let lastGroundDashAt = 0;
        let airDashUsed = false;
        let lastTrailTime = 0;
        let dashActive = false;
        let dashStartTime = 0;
        let trails = [];

        const getPlayerScene = () => app.player.parent && app.player.parent.parent;

        const spawnTrail = () => {
            const scene = getPlayerScene();
            if (!scene) return;
            if (trails.length >= MAX_TRAILS) return;

            const ghost = app.player.clone(true);
            ghost.position.copy(app.player.position);
            ghost.rotation.copy(app.player.rotation);
            ghost.scale.copy(app.player.scale);
            ghost.position.z = 0.5;

            const meshes = [];
            ghost.traverse((child) => {
                if (child.isLight) child.visible = false;
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.transparent = true;
                    child.material.depthWrite = false;
                    child.material.color.set(TRAIL_COLOR);
                    meshes.push(child);
                }
            });

            scene.add(ghost);
            trails.push({ obj: ghost, meshes, scene, spawnTime: performance.now() });
        };

        const removeTrail = (entry) => {
            if (entry.scene) entry.scene.remove(entry.obj);
        };

        const clearTrails = () => {
            trails.forEach(removeTrail);
            trails = [];
        };

        const canDashNow = () => {
            if (app.player.jumpReady) {
                return performance.now() - lastGroundDashAt >= GROUND_DASH_COOLDOWN_MS;
            }
            return !airDashUsed;
        };

        const markDashUsed = () => {
            if (app.player.jumpReady) lastGroundDashAt = performance.now();
            else airDashUsed = true;
        };

        const performDash = () => {
            const velocity = app.player.body.velocity;
            const gravity = app.engine.world.gravity;
            const dir = { x: gravity.y, y: -gravity.x };

            let dashDir;
            if (app.player.controls.left) dashDir = -1;
            else if (app.player.controls.right) dashDir = 1;
            else {
                const v = velocity.x * dir.x + velocity.y * dir.y;
                if (v > 0) dashDir = 1;
                else if (v < 0) dashDir = -1;
                else return false;
            }

            const speed = DASH_SPEED_OVERRIDE !== null
                ? DASH_SPEED_OVERRIDE
                : app.player.controls.speed;

            Matter.Body.setVelocity(app.player.body, {
                x: dashDir * speed * dir.x,
                y: dashDir * speed * dir.y
            });

            try { app.assets.audio.play('pop2'); } catch (_) {}
            dashActive = true;
            dashStartTime = performance.now();
            lastTrailTime = 0;
            return true;
        };

        DASH_KEYS.forEach(code => {
            api.onKey(code, () => {
                if (ALLOW_IN_MODES.indexOf(app.player.mode) === -1) return;
                if (!canDashNow()) return;
                if (performDash()) markDashUsed();
            });
        });

        api.onUpdate(() => {
            if (app.player.jumpReady) airDashUsed = false;

            const now = performance.now();

            if (dashActive) {
                if (now - dashStartTime >= TRAIL_LIFETIME_MS) {
                    dashActive = false;
                } else if (now - lastTrailTime >= TRAIL_INTERVAL_MS) {
                    lastTrailTime = now;
                    spawnTrail();
                }
            }

            for (let i = trails.length - 1; i >= 0; i--) {
                const entry = trails[i];
                const age = now - entry.spawnTime;
                const fraction = Math.min(age / TRAIL_LIFETIME_MS, 1);
                entry.meshes.forEach((mesh) => {
                    mesh.material.opacity = TRAIL_OPACITY * (1 - fraction);
                });

                if (age >= TRAIL_LIFETIME_MS) {
                    removeTrail(entry);
                    trails.splice(i, 1);
                }
            }
        });

        api.onEvent('pageMounted', clearTrails);
        api.addCleanup(clearTrails);
    }
});
