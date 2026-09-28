ModAPI.register({
    id: 'gravity-roller',
    name: 'Gravity Roller',
    version: '1.0',
    description: 'Randomize gravity on every respawn.',

    load() {
        const api = ModAPI;
        const normalGravity = 0.001;

        const rollGravity = () => {
            const multiplier = Math.round((0.1 + Math.random() * 1.9) * 10) / 10;
            app.engine.world.gravity.scale = normalGravity * multiplier;
        };

        api.patch(app.player, 'respawn', (next, ...args) => {
            rollGravity();
            return next(...args);
        });

        api.patch(app.player, 'cancelRestart', (next, ...args) => {
            rollGravity();
            return next(...args);
        });

        api.onEvent('levelStart', rollGravity);
    }
});
