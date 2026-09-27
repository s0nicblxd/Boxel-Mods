(() => {
    'use strict';

    const CFG = {
        width:          22.5,
        height:         37.5,
        depth:          10,
        rotX:           0,
        rotY:           90 * Math.PI / 180,
        rotZ:           0,
        ringSegments:   48,
        innerRatioX:    1.0,
        innerRatioY:    1.0,
        triggerRadius2: 30 * 30,
        exitNudge:      15,
        blueColor:      0x66ccff,
        orangeColor:    0xffa040,
        spawnDuration:  500,
        spawnEasing:    'back',
        spawnOvershoot: 1.70158,
        spawnMinScale:  0.001,
        geometryVersion: 7
    };

    let bluePortal   = null;
    let orangePortal = null;
    let nextIsBlue   = true;
    let armed        = true;

    const Vector3 = app.player.position.constructor;

    const findMesh = (root, predicate) => {
        let result = null;
        if (!root || !root.traverse) return null;
        root.traverse(o => {
            if (!result && predicate(o)) result = o;
        });
        return result;
    };

    const anyMesh = findMesh(app.graphics.scene, o =>
        o.isMesh && o.geometry?.attributes?.position);

    const Mesh           = anyMesh.constructor;
    const BufferGeometry = anyMesh.geometry.constructor;
    const Attribute      = anyMesh.geometry.attributes.position.constructor;
    const Camera         = app.camera.constructor;
    const BasicMaterial  = findMesh(app.graphics.scene, o =>
        o.isMesh && o.material?.type === 'MeshBasicMaterial').material.constructor;

    const buildRingGeometry = () => {
        const { width, height, depth, ringSegments, innerRatioX, innerRatioY } = CFG;
        const rOx = width  / 2;
        const rOy = height / 2;
        const rIx = rOx * innerRatioX;
        const rIy = rOy * innerRatioY;
        const zHalf = depth / 2;

        const positions = [];
        const normals   = [];

        const push = (p, n) => { positions.push(p); normals.push(n); };

        const radialNormal = (x, y) => {
            const len = Math.hypot(x / (rOx * rOx), y / (rOy * rOy)) || 1;
            return [x / (rOx * rOx) / len, y / (rOy * rOy) / len, 0];
        };

        for (let i = 0; i < ringSegments; i++) {
            const a0 = (i / ringSegments) * Math.PI * 2;
            const a1 = ((i + 1) / ringSegments) * Math.PI * 2;
            const c0 = Math.cos(a0), s0 = Math.sin(a0);
            const c1 = Math.cos(a1), s1 = Math.sin(a1);

            const Ox0 = c0 * rOx, Oy0 = s0 * rOy;
            const Ox1 = c1 * rOx, Oy1 = s1 * rOy;
            const Ix0 = c0 * rIx, Iy0 = s0 * rIy;
            const Ix1 = c1 * rIx, Iy1 = s1 * rIy;

            const nF = [0, 0, 1];
            push([Ox0, Oy0,  zHalf], nF); push([Ox1, Oy1,  zHalf], nF); push([Ix0, Iy0,  zHalf], nF);
            push([Ox1, Oy1,  zHalf], nF); push([Ix1, Iy1,  zHalf], nF); push([Ix0, Iy0,  zHalf], nF);

            const nB = [0, 0, -1];
            push([Ox1, Oy1, -zHalf], nB); push([Ox0, Oy0, -zHalf], nB); push([Ix0, Iy0, -zHalf], nB);
            push([Ox1, Oy1, -zHalf], nB); push([Ix1, Iy1, -zHalf], nB); push([Ix0, Iy0, -zHalf], nB);

            const nO0 = radialNormal(Ox0, Oy0);
            const nO1 = radialNormal(Ox1, Oy1);
            push([Ox0, Oy0, -zHalf], nO0); push([Ox1, Oy1, -zHalf], nO1); push([Ox0, Oy0,  zHalf], nO0);
            push([Ox1, Oy1, -zHalf], nO1); push([Ox1, Oy1,  zHalf], nO1); push([Ox0, Oy0,  zHalf], nO0);

            const nI0 = radialNormal(Ix0, Iy0).map(v => -v);
            const nI1 = radialNormal(Ix1, Iy1).map(v => -v);
            push([Ix0, Iy0,  zHalf], nI0); push([Ix1, Iy1,  zHalf], nI1); push([Ix0, Iy0, -zHalf], nI0);
            push([Ix1, Iy1,  zHalf], nI1); push([Ix1, Iy1, -zHalf], nI1); push([Ix0, Iy0, -zHalf], nI0);
        }

        const flatPos = new Float32Array(positions.length * 3);
        const flatNor = new Float32Array(normals.length * 3);
        for (let i = 0; i < positions.length; i++) {
            flatPos[i * 3]     = positions[i][0];
            flatPos[i * 3 + 1] = positions[i][1];
            flatPos[i * 3 + 2] = positions[i][2];
            flatNor[i * 3]     = normals[i][0];
            flatNor[i * 3 + 1] = normals[i][1];
            flatNor[i * 3 + 2] = normals[i][2];
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Attribute(flatPos, 3));
        geo.setAttribute('normal',   new Attribute(flatNor, 3));
        geo.setIndex(null);
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        return geo;
    };

    const makeMaterial = hex => {
        const m = new BasicMaterial();
        m.color.set(hex);
        m.transparent = false;
        m.opacity     = 1;
        m.side        = 2;
        m.depthTest   = true;
        m.depthWrite  = true;
        m.fog         = false;
        m.map         = null;
        m.needsUpdate = true;
        return m;
    };

    const findRenderMesh = obj => {
        if (!obj) return null;
        if (obj.isMesh && obj.geometry?.attributes?.position) return obj;
        if (obj.children) {
            for (const child of obj.children) {
                const hit = findRenderMesh(child);
                if (hit) return hit;
            }
        }
        return null;
    };

    const applyRotation = portal => {
        const e = portal.entity;
        e.rotation.set(CFG.rotX, CFG.rotY, CFG.rotZ);
        e.updateMatrix();
        e.updateMatrixWorld(true);
    };

    const ensurePortalStyle = portal => {
        if (!portal?.entity) return;
        const mesh = findRenderMesh(portal.entity);
        if (!mesh?.material?.color) return;

        const wantColor = portal.isBlue ? CFG.blueColor : CFG.orangeColor;
        const needsRebuild =
            mesh.material.color.getHex() !== wantColor ||
            mesh.userData._geometryVersion !== CFG.geometryVersion;

        if (needsRebuild) {
            mesh.geometry = buildRingGeometry();
            mesh.frustumCulled = false;
            mesh.material = makeMaterial(wantColor);
            mesh.userData._geometryVersion = CFG.geometryVersion;
        }

        applyRotation(portal);
        if (portal.entity.helper) portal.entity.helper.visible = false;
    };

    const ease = t => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        switch (CFG.spawnEasing) {
            case 'linear': return t;
            case 'cubic':  return 1 - Math.pow(1 - t, 3);
            case 'back': {
                const c1 = CFG.spawnOvershoot;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            }
            default: return 1 - Math.pow(1 - t, 3);
        }
    };

    const updateSpawn = portal => {
        if (!portal?.entity || portal.spawnDone) return;
        const t = (performance.now() - portal.spawnTime) / CFG.spawnDuration;

        if (t >= 1) {
            portal.entity.setScale({ x: 1, y: 1, z: 1 }, true);
            portal.spawnDone = true;
            return;
        }

        const s = Math.max(ease(t), CFG.spawnMinScale);
        portal.entity.setScale({ x: s, y: s, z: s }, true);
    };

    const makePortal = (pos, isBlue) => {
        const entity = app.level.entityFactory.createObject('default');
        entity.body.collisionFilter.mask = 0;
        app.level.addObject(entity);
        entity.setPosition({ x: pos.x, y: pos.y, z: 0 }, true);
        entity.setScale({ x: CFG.spawnMinScale, y: CFG.spawnMinScale, z: CFG.spawnMinScale }, true);
        entity.setStatic(true, false);
        if (entity.helper) entity.helper.visible = false;

        const portal = {
            x: pos.x, y: pos.y, isBlue,
            entity,
            spawnTime: performance.now(),
            spawnDone: false
        };

        applyRotation(portal);
        ensurePortalStyle(portal);
        return portal;
    };

    const destroyPortal = portal => {
        if (!portal?.entity) return;
        try { app.level.removeObject(portal.entity, true); } catch (_) {}
    };

    const clearPortals = () => {
        destroyPortal(bluePortal);
        destroyPortal(orangePortal);
        bluePortal = orangePortal = null;
        nextIsBlue = true;
        armed = true;
    };

    const screenToWorld = (cx, cy) => {
        const cam = app.camera;
        if (!cam) return null;

        const v = new Vector3(
            (cx / innerWidth)  * 2 - 1,
            -(cy / innerHeight) * 2 + 1,
            0.5
        ).unproject(cam);

        const { x: ox, y: oy, z: oz } = cam.position;
        const dx = v.x - ox, dy = v.y - oy, dz = v.z - oz;
        if (Math.abs(dz) < 1e-9) return null;

        const t = (0 - oz) / dz;
        return { x: ox + t * dx, y: oy + t * dy, z: 0 };
    };

    window.addEventListener('pointerdown', e => {
        if (e.target?.tagName !== 'CANVAS') return;
        if (!app.play) return;

        const pos = screenToWorld(e.clientX, e.clientY);
        if (!pos) return;

        if (nextIsBlue) {
            destroyPortal(bluePortal);
            bluePortal = makePortal(pos, true);
        } else {
            destroyPortal(orangePortal);
            orangePortal = makePortal(pos, false);
        }
        nextIsBlue = !nextIsBlue;

        try { app.assets.audio.play('pop1'); } catch (_) {}
    });

    window.addEventListener('keydown', e => {
        if (e.key === 'r' || e.key === 'R') clearPortals();
    });

    const teleportTo = target => {
        const body = app.player.body;
        const v = body.velocity;
        const saved = { x: v.x, y: v.y };
        const speed = Math.hypot(saved.x, saved.y) || 1;
        const nx = saved.x / speed;
        const ny = saved.y / speed;

        Matter.Body.setPosition(body, {
            x: target.x + nx * CFG.exitNudge,
            y: -target.y + ny * CFG.exitNudge
        });
        Matter.Body.setVelocity(body, saved);

        nextFrameUpdateFunction(() => {
            Matter.Body.setVelocity(app.player.body, saved);
        });

        try { app.assets.audio.play('teleport'); } catch (_) {}
    };

    const checkTeleport = () => {
        if (!bluePortal || !orangePortal) return;
        if (!bluePortal.spawnDone || !orangePortal.spawnDone) return;

        const p = app.player.position;
        const dBlue   = (p.x - bluePortal.x)   ** 2 + (p.y - bluePortal.y)   ** 2;
        const dOrange = (p.x - orangePortal.x) ** 2 + (p.y - orangePortal.y) ** 2;

        const inBlue   = dBlue   < CFG.triggerRadius2;
        const inOrange = dOrange < CFG.triggerRadius2;

        if (!inBlue && !inOrange) { armed = true; return; }
        if (!armed) return;

        if (inBlue)        { teleportTo(orangePortal); armed = false; }
        else if (inOrange) { teleportTo(bluePortal);   armed = false; }
    };

    addUpdateFunction(() => {
        ensurePortalStyle(bluePortal);
        ensurePortalStyle(orangePortal);
        updateSpawn(bluePortal);
        updateSpawn(orangePortal);
        checkTeleport();
    });

    window.addEventListener('pageMounted', clearPortals);

    addModToList('Portal Mod');
})();
