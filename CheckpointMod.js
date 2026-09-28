ModAPI.register({
    id: 'checkpoint',
    name: 'Checkpoint Mod',
    version: '1.0',
    description: 'Save custom checkpoints with Z, clear with X.',

    load() {
        const api = ModAPI;

        let checkpointState = null;
        let checkpointPos = null;
        let marker = null;
        let markerTime = 0;
        let visualGeneration = 0;
        let manualRestart = false;

        const CRYSTAL_SIZE = 8;
        const EXPECTED_COLOR = 0x22ff77;

        const findRenderMesh = (obj) => {
            if (!obj) return null;
            if (obj.isMesh && obj.geometry && obj.geometry.attributes.position) return obj;
            if (obj.children) {
                for (let i = 0; i < obj.children.length; i++) {
                    const result = findRenderMesh(obj.children[i]);
                    if (result) return result;
                }
            }
            return null;
        };

        const styleCrystalMesh = (mesh) => {
            const BufferGeometryClass = mesh.geometry.constructor;
            const AttributeClass = mesh.geometry.attributes.position.constructor;

            const r = 1;
            const px = [r, 0, 0];
            const nx = [-r, 0, 0];
            const py = [0, r, 0];
            const ny = [0, -r, 0];
            const pz = [0, 0, r];
            const nz = [0, 0, -r];

            const tris = [];
            const pushTri = (a, b, c) => tris.push(a, b, c);

            pushTri(py, px, pz); pushTri(py, pz, nx); pushTri(py, nx, nz); pushTri(py, nz, px);
            pushTri(ny, pz, px); pushTri(ny, nx, pz); pushTri(ny, nz, nx); pushTri(ny, px, nz);

            const flat = new Float32Array(tris.length * 3);
            for (let i = 0; i < tris.length; i++) {
                flat[i * 3] = tris[i][0];
                flat[i * 3 + 1] = tris[i][1];
                flat[i * 3 + 2] = tris[i][2];
            }

            const geometry = new BufferGeometryClass();
            geometry.setAttribute("position", new AttributeClass(flat, 3));
            geometry.setIndex(null);
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();

            mesh.geometry = geometry;
            mesh.frustumCulled = false;
            mesh.material.map = null;
            mesh.material.color.set(EXPECTED_COLOR);
            mesh.material.transparent = true;
            mesh.material.opacity = 0.85;
            mesh.material.side = 2;
            mesh.material.depthTest = true;
            mesh.material.depthWrite = true;
        };

        const setupCrystal = (gen) => {
            if (gen !== visualGeneration) return;
            if (!marker) return;

            const mesh = findRenderMesh(marker);
            if (!mesh) { setTimeout(() => setupCrystal(gen), 16); return; }

            styleCrystalMesh(mesh);
            if (marker.helper) marker.helper.visible = false;
        };

        const ensureCrystalStyle = () => {
            if (!marker) return;
            const mesh = findRenderMesh(marker);
            if (!mesh || !mesh.material || !mesh.material.color) return;
            if (mesh.material.color.getHex() !== EXPECTED_COLOR) styleCrystalMesh(mesh);
            if (marker.helper && marker.helper.visible) marker.helper.visible = false;
        };

        const removeVisual = () => {
            visualGeneration++;
            if (marker) {
                try { app.level.removeObject(marker, true); } catch (_) {}
                marker = null;
            }
            markerTime = 0;
        };

        const spawnVisualAt = (pos) => {
            if (!pos) return;
            removeVisual();
            visualGeneration++;
            const gen = visualGeneration;

            marker = app.level.entityFactory.createObject("default");
            marker.body.collisionFilter.mask = 0;
            app.level.addObject(marker);
            marker.setPosition({ x: pos.x, y: pos.y, z: pos.z }, true);
            marker.setScale({ x: CRYSTAL_SIZE, y: CRYSTAL_SIZE, z: CRYSTAL_SIZE }, true);
            marker.setStatic(true, false);
            marker.updateMatrix();
            marker.updateMatrixWorld(true);

            setTimeout(() => setupCrystal(gen), 16);
        };

        const saveCheckpoint = () => {
            checkpointPos = {
                x: app.player.position.x,
                y: app.player.position.y,
                z: app.player.position.z
            };
            app.player.saveCheckpoint(checkpointPos);
            checkpointState = { mode: app.player.mode, jumpMode: app.player.jumpMode };
            try { app.assets.audio.play("jump"); } catch (_) {}
            spawnVisualAt(checkpointPos);
        };

        const restoreCheckpointState = () => {
            if (!checkpointState) return;
            setTimeout(() => {
                app.player.setMode(checkpointState.mode, false);
                app.player.setJumpMode(checkpointState.jumpMode, false);
            }, 0);
        };

        const removeCheckpoint = () => {
            app.player.removeCheckpoint();
            checkpointState = null;
            checkpointPos = null;
            try { app.assets.audio.play("kill"); } catch (_) {}
            removeVisual();
        };

        api.onEvent('playerRespawn', () => {
            if (!checkpointState) return;
            try { app.assets.audio.play("teleport"); } catch (_) {}
            restoreCheckpointState();
        });

        api.onEvent('playerRestart', () => {
            if (manualRestart) { manualRestart = false; return; }
            if (!checkpointPos) return;
            spawnVisualAt(checkpointPos);
        });

        api.onEvent('pageMounted', () => {
            checkpointState = null;
            checkpointPos = null;
            manualRestart = false;
            removeVisual();
        });

        api.onKey('KeyZ', saveCheckpoint);
        api.onKey('KeyX', removeCheckpoint);
        api.onKey('KeyR', () => { manualRestart = true; removeCheckpoint(); });

        api.onUpdate((delta) => {
            ensureCrystalStyle();
            if (!marker) return;
            markerTime += delta;
            const pulse = 1 + Math.sin(markerTime * 0.004) * 0.06;
            marker.rotation.y += delta * 0.0015;
            marker.scale.set(CRYSTAL_SIZE * pulse, CRYSTAL_SIZE * pulse, CRYSTAL_SIZE * pulse);
        });

        api.addCleanup(removeVisual);
    }
});
