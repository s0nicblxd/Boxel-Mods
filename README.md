# Boxel Mods!

A small collection of mods for [Boxel 3D](https://www.dopplercreative.com/games/boxel-3d/play/), built on top of [Charlieee1's Boxel 3D Modding API](https://github.com/Charlieee1/Boxel-3d-Mods/blob/main/Boxel%203d%20Modding%20API.user.js). More mods coming soon!

## Requirements

1. Open Boxel 3D and press **F12** (or CTRL + Shift + J) to open your browser's DevTools.
2. Go to the **Console** tab.
3. Paste in the [Boxel 3D Modding API](https://github.com/Charlieee1/Boxel-3d-Mods/blob/main/Boxel%203d%20Modding%20API.user.js) code **FIRST** and press Enter. This only needs to be done once per page load, and must be done **BEFORE** any mod below.
4. Paste in the code for whichever mod(s) you want to use and press Enter!

*NOTE: Since this all runs in the console, you'll need to redo steps 3 to 4 every time you reload the page.*

## Mods

### [30 Second Timer!](30SecMod.js)
Adds a 30-second countdown timer to the screen! If you haven't finished the level by the time it hits zero, you're killed and sent back to the begening of the level...

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

# Enjoy your time with these mods!!!
