ModAPI.register({
    id: 'ground-pound',
    name: 'Ground Pound',
    version: '1.01',
    description: 'Slam down midair for a bounce and afterimages.',

    load() {
        const api = ModAPI;

        let isGroundPounding = false;
        let hasLeftGround = false;
        let fallVelocity = 0;
        const GROUND_POUND_SPEED = 10;
        const BOUNCE_FORCE = 0.00025;

        const TRAIL_INTERVAL_MS   = 20;
        const TRAIL_LIFETIME_MS   = 250;
        const MAX_TRAILS          = 5;
        const TRAIL_COLOR         = 0xffff00;
        const TRAIL_OPACITY       = 0.6;

        let trails = [];
        let lastTrailTime = 0;

        const getPlayerScene = () => app.player.parent && app.player.parent.parent;

        const isTrulyGrounded = () => {
            const body = app.player.body;
            const bounds = body.bounds;
            if (!bounds) return false;
            const feetY = bounds.max.y;
            const cx = body.position.x;
            const pMinX = cx - 4, pMaxX = cx + 4;
            const pMinY = feetY + 1, pMaxY = feetY + 8;
            const bodies = app.engine.world.bodies;
            for (let i = 0; i < bodies.length; i++) {
                const b = bodies[i];
                if (!b || b === body) continue;
                if (b.isSensor) continue;
                if (b.collisionFilter && b.collisionFilter.mask === 0) continue;
                const bb = b.bounds;
                if (!bb) continue;
                if (bb.max.x < pMinX) continue;
                if (bb.min.x > pMaxX) continue;
                if (bb.max.y < pMinY) continue;
                if (bb.min.y > pMaxY) continue;
                return true;
            }
            return false;
        };

        const createTrail = () => {
            const scene = getPlayerScene();
            if (!scene) return;
            if (trails.length >= MAX_TRAILS) return;

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

        const startGroundPound = () => {
            isGroundPounding = true;
            hasLeftGround = false;
            fallVelocity = 0;
            lastTrailTime = performance.now();
            Matter.Body.setVelocity(app.player.body, {
                x: app.player.body.velocity.x,
                y: GROUND_POUND_SPEED
            });
            try { app.assets.audio.play("resize"); } catch (_) {}
        };

        api.onKey('KeyS', () => {
            if (!isGroundPounding && !isTrulyGrounded()) startGroundPound();
        });

        api.onKey('ArrowDown', () => {
            if (!isGroundPounding && !isTrulyGrounded()) startGroundPound();
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
                if (now - lastTrailTime >= TRAIL_INTERVAL_MS) {
                    lastTrailTime = now;
                    createTrail();
                }
            }

            for (let i = trails.length - 1; i >= 0; i--) {
                const entry = trails[i];
                const age = performance.now() - entry.spawnTime;
                const fraction = Math.min(age / TRAIL_LIFETIME_MS, 1);
                const opacity = TRAIL_OPACITY * (1 - fraction);

                entry.meshes.forEach((mesh) => { mesh.material.opacity = opacity; });

                if (age >= TRAIL_LIFETIME_MS) {
                    removeTrail(entry);
                    trails.splice(i, 1);
                }
            }
        });

        api.onEvent('pageMounted', () => {
            clearTrails();
            isGroundPounding = false;
            hasLeftGround = false;
        });

        api.addCleanup(clearTrails);
    }
});
