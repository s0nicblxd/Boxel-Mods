# Boxel Mods!

A small collection of mods for [Boxel 3D](https://www.dopplercreative.com/games/boxel-3d/play/). Now with a full mod menu!

## Requirements

1. Open Boxel 3D and press **F12** (or CTRL + Shift + J) to open your browser's DevTools.
2. Go to the **Console** tab.
3. Paste the loader below and press Enter. That's it! The mod menu loads itself.
4. Enter a level and click the puzzle-piece button (below the settings btn) to open the menu.

*NOTE: Since this all runs in the console, you'll need to redo step 3 every time you reload the page.*

## Loader

```js
(function () {
    const BASE = 'https://raw.githubusercontent.com/s0nicblxd/Boxel-Mods/main/loader';

    window.ModAPI_loadScript = function (url) {
        const busted = url + (url.indexOf('?') === -1 ? '?t=' : '&t=') + Date.now();
        return fetch(busted)
            .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status + ' for ' + url)))
            .then(text => {
                const blob = new Blob([text], { type: 'text/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                return new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = blobUrl;
                    s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
                    s.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Load failed: ' + url)); };
                    document.head.appendChild(s);
                });
            });
    };

    window.ModAPI_loadScript(BASE + '/core.js')
        .then(() => window.ModAPI.boot(BASE + '/manifest.js'))
        .catch(e => console.error('[BoxelMods]', e.message));
})();
```

## Using the menu

Once you're in a level, a new button appears right below the settings gear IN-GAME (for now). Click it to open the mod menu.

- **Click any mod** to turn it on or off instantly. No reload needed.
- **Simple Search bar** at the top to filter by name.
- Mods you had enabled stay enabled next time you paste the loader, yay :D.

## Mods

### [30 Second Timer!](30SecMod.js)
Adds a 30-second countdown timer to the screen! If you haven't finished the level by the time it hits zero, you're killed and sent back to the beginning of the level...

### [Checkpoints!](CheckpointMod.js)
Adds a manual checkpoint system on top of the game's built-in one:
- **Z:** save a checkpoint at your current position (mode and jump mode are saved too, so you come back exactly as you left, apart from your momentum/rotation).
- **X:** clear your checkpoint.
- A green octahedron spawns at your checkpoint so you can see where you'll respawn!

### [Gravity Roller!](GravityRoller.js)
Rolls a random gravity multiplier (between 0.1x and 2x) every time you attempt a level! It could be lightwork or be hellish to finish, it's up to RNG...

### [Jump Charge!](JumpCharge.js)
Replaces the normal instant jump with a hold-to-charge system:
- Tap for a small jump, hold up to **2 seconds** for a much bigger one.
- Works with keyboard (Space / W / Arrow Up), mouse click, and on-screen touch controls (omg mobile support ikr).
- A charge meter appears above your screen while holding, showing how close you are to max height.

### [Ground Pound!](GroundPound.js)
Lets you groundpound very quickly into the ground, having after-images and some subtle sfx, and even a little bounce at the end!

### [Portal Mod!](PortalMod.js)
Adds a fully working portal gun to the game:
- **Click / Tap:** place a portal and alternates to blue, then orange, then blue, orange...
- **R:** clear both portals.
- Walk into either portal and you'll pop out the other one with your momentum fully preserved!
- Both portals scale in smoothly when placed, and there's no cooldown, so you can bounce between them as fast as you can move!!!

### [Freecam!](FreecamMod.js)
Detaches the camera from the player so you can freely explore, rotate, and screenshot any level from any angle. Background and boundaries stay fixed so you never see the void.

- **V:** toggle freecam on / off
- **WASD:** pan the camera
- **Q / E:** zoom out / in
- **1 / 2:** orbit around the player (yaw)
- **R / F:** tilt the camera up / down (pitch)
- **3:** reset camera to the player's default position
- **P:** take a screenshot (saves as `boxel-3d-<timestamp>.png`)
- **U:** hide / show all UI (including this mod's panel)

The mod's info panel shows the camera's current X / Y / Z position, yaw angle, and pitch angle :D

# Enjoy your time with these mods!!!
