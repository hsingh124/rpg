# RPG Game Builder

Build 2D top-down RPG games using the `rpg-engine.js` library. You provide a data config via `RPG.create({...})`. The engine handles all rendering, input, combat, UI, and game logic.

## Output Format

A single HTML file. The ONLY JavaScript you write is the `RPG.create({...})` call. Do NOT rewrite any engine code.

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GAME TITLE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{image-rendering:pixelated;border:2px solid #333}</style>
</head><body><canvas id="game"></canvas>
<script src="rpg-engine.js"></script>
<script>
RPG.create({
  // ... your config ...
});
</script></body></html>
```

---

## API Reference: RPG.create(config)

### Top-level Properties

```js
{
  title: 'Game Title',           // browser tab title
  colors: { ... },               // override default palette (see Colors section)
  solidTiles: [1,2,4,6,...],     // tile type integers that block movement
  treeTiles: [4, 17],            // tile types redrawn ON TOP of entities (depth sort)
  player: { name:'Hero', x:9, y:9, hp:20, mp:10, atk:2 },
  combat: { dash:true, gun:false },  // enable/disable combat mechanics
  startMap: 'village',           // map ID the game begins on
  winCondition: { ... },         // how the game ends (see Win Condition)
  items: { ... },                // item definitions (see Items)
  enemyTypes: { ... },           // enemy type definitions (see Enemies)
  maps: { ... },                 // map definitions (see Maps)
  doorPortals: { ... },          // inter-map door teleporters (see Door Portals)
  drawTile: fn,                  // OPTIONAL: override built-in tile rendering
  drawEnemy: fn,                 // OPTIONAL: override built-in enemy rendering
}
```

### Colors

All optional. Override any to re-theme the entire game. Tiles and UI reference these by name.

```js
colors: {
  // terrain
  grass:'#4a7a3b', grass2:'#3d6b31', path:'#c4a55a', water:'#3b6d9e',
  wall:'#7a6652', roof:'#8b3a3a', door:'#5a3a1a', tree:'#2d5a1e', trunk:'#6b4226',
  sand:'#d4b96a', sand2:'#c8a85a', lava:'#cc4400',
  snow:'#e8e8f0', snow2:'#d8d8e8', ice:'#a0c8e8', pine:'#1a5028',
  caveFloor:'#3a3530', caveFloor2:'#342f2a', caveWall:'#2a2520',
  dungeonFloor:'#4a4540', dungeonFloor2:'#3e3a35', dungeonWall:'#3a3545',
  darkGrass:'#2a5a22', darkGrass2:'#224a1a',
  cobble:'#8a8078', carpet:'#8b3050', carpetBorder:'#c4a55a',
  wood:'#6b4226', fence:'#b89a6a', bridge:'#8b6914',
  // UI
  player:'#e8c170', shadow:'rgba(0,0,0,0.2)', uiBorder:'#e8c170',
  hpFill:'#e74c3c', hpBg:'#555', mpFill:'#3498db', xpFill:'#f1c40f', white:'#fff',
}
```

### Items

```js
items: {
  herb:  { name:'Herb',  color:'#5cb85c', icon:'herb',  desc:'Heals 5 HP.', heal:5 },
  sword: { name:'Sword', color:'#a08050', icon:'sword', desc:'+3 ATK', weapon:true, atk:3 },
  gun:   { name:'Gun',   color:'#55ddff', icon:'gun',   desc:'Press F to fire!' },
  key:   { name:'Key',   color:'#f1c40f', icon:'key',   desc:'Opens something.' },
}
```

- `heal: N` — consumable, restores N HP
- `weapon: true, atk: N` — equippable, adds N attack
- `gun` item ID — special: sets `player.hasGun = true`
- **Icon options:** `herb`, `shroom`, `fossil`, `gem`, `crystal`, `potion`, `scroll`, `feather`, `coin`, `sword`, `staff`, `gun`, `key`, `seal`, `bone`

### Enemy Types

```js
enemyTypes: {
  slime: { name:'Slime', color:'#5cb85c', hp:8, atk:2, xp:10, speed:0.8, drops:['herb'] },
}
```

- `speed` — movement frequency (higher = faster, 0.5–1.5 typical range)
- `drops` — array of item IDs. Random drop on death. Can be empty `[]`

### Maps

Every map: **exactly 15 rows, exactly 20 columns**.

```js
maps: {
  village: {
    name: 'Display Name',
    tiles: [ /* 15 arrays of 20 integers each */ ],
    npcs: [ /* NPC objects */ ],
    exits: {
      north: { map:'forest', spawnX:9, spawnY:13 },   // where player appears in target map
    },
    exitTiles: {
      north: [8, 9],  // which edge positions are walkable exits
    },
    items: [{ x:3, y:9, item:'herb' }],
    enemies: [{ x:5, y:5, type:'slime' }],
  },
}
```

**Exit rules:**
- `north/south` exitTiles = column indices. Edge row tiles at those columns must NOT be solid.
- `east/west` exitTiles = row indices. Edge column tiles at those rows must NOT be solid.
- All exits MUST be bidirectional. A→B means B must have an exit back to A.
- `spawnX/spawnY` must land on a walkable tile in the target map.

**NPC types:**

```js
// Dialogue-only NPC
{ x:4, y:5, name:'Elder', color:'#7eb8da', dir:0,
  dialogue:["Line 1.", "Line 2."] }

// Trader NPC
{ x:8, y:7, name:'Smith', color:'#da7e7e', dir:0, trader:true,
  trades:[{ give:'herb', giveQty:3, receive:'sword', receiveQty:1 }],
  dialogue:["Want to trade?"] }

// Quest-giver NPC (gives item + sets a flag)
{ x:6, y:6, name:'Sage', color:'#7eda8e', dir:0,
  questGive: { flag:'has_key', item:'key' },
  dialogue:["Take this key.", "The door is to the north."] }
```

- `dir`: 0=down, 1=left, 2=right, 3=up
- Quest property MUST be `questGive` — not `quest` or anything else
- NPCs are solid — they block movement. Never place them on the only path to an exit or door.

### Door Portals

Teleport the player when they walk onto a tile of type 5 (door).

```js
doorPortals: {
  camp: [  // source map ID
    { x:9, y:6, map:'cave', spawnX:9, spawnY:12,
      locked:true, unlockFlag:'has_key', lockedMsg:"It's locked." },
  ],
  cave: [  // return portal
    { x:9, y:13, map:'camp', spawnX:9, spawnY:7, locked:false },
  ],
}
```

- The tile at `(x, y)` in the source map's grid MUST be `5` (door tile)
- `unlockFlag` matches a `questGive.flag` from an NPC
- Door portals must be bidirectional — every portal into a map needs a portal back out
- `spawnX/spawnY` must land on a walkable tile

### Win Condition

```js
winCondition: {
  item: 'moonstone',    // triggers when player picks up this item
  title: 'VICTORY!',
  message: 'You saved the world!',
}
// OR use a flag trigger:
winCondition: {
  flag: 'boss_defeated',  // triggers when this flag is set via questGive
  title: 'VICTORY!',
  message: 'The evil is vanquished!',
}
```

---

## Built-in Tile Types

All have animated pixel art. Just use the integer in your tiles grid.

| # | Tile | Solid | Notes |
|---|------|-------|-------|
| 0 | Grass | no | Checkerboard pattern + grass tufts |
| 1 | Stone wall | **yes** | Brick pattern with shadow |
| 2 | Water | **yes** | Animated shimmer effect |
| 3 | Dirt path | no | Subtle dirt specks |
| 4 | Tree | **yes** | Canopy depth-sorted over entities |
| 5 | Door | no | Door on path background — for portals |
| 6 | Roof | **yes** | Horizontal shingle lines |
| 7 | Sand | no | Desert checkerboard |
| 8 | Dungeon floor | no | Dark stone checkerboard |
| 9 | Lava | **yes** | Animated orange glow |
| 10 | Cave floor | no | Dark brown checkerboard |
| 11 | Cave wall | **yes** | Dark rock with shadow |
| 12 | Stalagmite | **yes** | Spike on cave floor |
| 13 | Dungeon wall | **yes** | Purple-gray stone |
| 14 | Bones | no | Skull + crossbones on dungeon floor |
| 15 | Snow | no | White/blue checkerboard |
| 16 | Ice | no | Animated shine streaks |
| 17 | Pine tree | **yes** | Triangle canopy, depth-sorted |
| 18 | Flowers | no | Colored dots on grass |
| 19 | Bridge | no | Wooden planks over water |
| 20 | Dark grass | no | Swamp/deep forest floor |
| 21 | Cobblestone | no | Stone blocks with grout |
| 22 | Carpet | no | Red with gold border |
| 23 | Bookshelf | **yes** | Colored books on wood |
| 24 | Fence | **yes** | Horizontal rails with posts |

Custom types 25+ require a `drawTile` callback.

## Built-in Enemy Types

All have unique animated pixel art. Reference by string name in `enemies[].type`.

| Type | Description |
|------|-------------|
| `slime` | Bouncing green blob with shine |
| `frog` | Hopping body, big googly eyes |
| `snake` | Wavy body, tongue, yellow eye |
| `skeleton` | Skull + ribs + limbs, subtle bob |
| `ghost` / `wraith` | Translucent floating shape, wavy hem |
| `bat` | Flapping wings, red eyes |
| `spider` | 8 legs, multiple red eyes |
| `wolf` | Running body, tail wag, orange eye |
| `goblin` | Green humanoid, pointy ears, yellow eyes |
| `rat` | Scurrying body, pink ears + tail |

Custom enemy types not in this list require a `drawEnemy` callback.

## What the Engine Handles (you don't write any of this)

- 640×480 canvas, 32px tiles, 20×15 grid
- All tile rendering (25 types) and enemy rendering (10 types) with animation
- Player/NPC character sprites with walk animation
- Item icons (15 types) with floating/glow on ground
- Input: WASD/arrows move, Shift run, E/X dash-slash, F shoot, Space interact, I inventory, Esc close
- Tile-to-tile movement with lerp, collision detection
- Screen transitions (fade to black) at map edges
- Door portals (auto-enter on tile 5, locked/unlocked via flags)
- NPC interaction: dialogue, trading, quest items (NPCs checked before portals)
- Dash-slash melee combat with afterimages and slash arcs
- Gun projectiles with trails
- Enemy AI (chase within 5 tiles, wander otherwise)
- Particles, damage floats, death drops
- Inventory UI, trade UI, dialogue boxes
- HUD (HP/MP/XP bars, area name, equipped weapon, controls)
- Level up system (HP+5, ATK+1, full heal)
- Death/respawn at start map
- Victory screen with fade, stars, title, message, and stats

---

## Mandatory Validation Checklist

Run through every one of these before outputting your game. Violations cause broken/unplayable games.

1. **Grid dimensions** — Every map has exactly 15 rows of exactly 20 integers each
2. **Exit walkability** — Every `exitTiles` position points to a non-solid tile on the edge row/column
3. **Bidirectional exits** — Every exit A→B has a matching exit B→A
4. **Map reachability** — Every map is reachable from `startMap` via exits or door portals
5. **Door tile = 5** — Every `doorPortals` entry at `(x, y)` has tile `5` in that map's tiles grid
6. **Portal return** — Every door portal into a map has a door portal back out
7. **Spawn on walkable** — Every `spawnX/spawnY` in exits and portals lands on a non-solid tile
8. **Paths connect to exits** — Walkable tiles form connected paths from the interior to exit edges. No isolated center loops with walls blocking the exit
9. **NPC placement** — NPCs are NOT on the only walkable path to an exit or door. Leave at least 2 tiles of clearance on main routes
10. **No entity stacking** — No enemy + item on the same tile. No NPC on a door tile (5)
11. **Quest property name** — NPC quest field is `questGive`, not `quest` or anything else
12. **Interior maps** — Door tiles in interior walls must REPLACE wall tiles (tile 5 instead of tile 1), not sit behind them. The exit door must be on a walkable tile, not buried in solid walls
13. **solidTiles consistency** — Your `solidTiles` array includes every tile type you use as a wall/barrier and excludes every tile type you use as walkable floor
14. **Win condition item/flag** — The win condition references an item that exists on a map, or a flag that gets set by an NPC's `questGive`

---

## Map Design Guide

### Building Structures (houses, temples, shops)

A building is a rectangle of wall (1) with roof (6) on top and a door (5) in the front wall:
```
6 6 6     ← roof row
1 1 1     ← wall row
1 5 1     ← wall with door (tile 5 — walkable)
```
If the door is a portal to an interior, add it to `doorPortals`.

### Interior Maps

Fill the entire grid with wall/cave wall, then carve out a walkable floor inside:
```
11 11 11 11 11 11 ...    ← all cave wall
11 10 10 10 10 11 ...    ← floor inside walls
11 10 10 10 10 11 ...
11 10 10 10  5 11 ...    ← exit door (tile 5) IN the wall
11 11 11 11 11 11 ...
```
The exit door tile (5) REPLACES one wall tile — it does NOT go on top of or behind a wall.

### Biome Recipes

| Biome | Floor | Wall | Deco | Enemies |
|-------|-------|------|------|---------|
| Village | 0 grass, 3 path, 18 flowers | 1 wall, 6 roof, 4 tree | 24 fence | none |
| Forest | 0 grass, 20 dark grass | 4 tree | 18 flowers, 2 water | frog, slime, wolf |
| Desert | 7 sand, 3 path | 1 wall | 12 stalagmite | snake, skeleton |
| Snow | 15 snow, 16 ice | 17 pine tree | 18 flowers | wolf, bat |
| Cave | 10 cave floor | 11 cave wall | 12 stalagmite | spider, rat, bat |
| Dungeon | 8 dungeon floor | 13 dungeon wall | 14 bones, 22 carpet | skeleton, ghost |
| Swamp | 20 dark grass, 2 water | 4 tree | 19 bridge | frog, snake, slime |
| Town | 21 cobble, 3 path | 1 wall, 6 roof, 24 fence | 18 flowers, 23 bookshelf | none |

### Layout Patterns

- **Hub-and-spoke**: Village in center, 2-3 wilderness maps branching out, 1 dungeon/cave at the end
- **Linear**: Village → Forest → Camp → Cave (each connecting to the next)
- **3-5 maps total** is the sweet spot. Enough variety without sprawl.
- Villages and towns should have NO enemies
- Wilderness maps: 3-5 enemies, scattered herbs
- Dungeons/caves: 3-6 enemies, boss-tier enemy guarding the objective

### Difficulty Curve

| Area | Enemy HP | Enemy ATK | Enemy XP | Drops |
|------|----------|-----------|----------|-------|
| Easy (forest) | 6-10 | 1-2 | 8-12 | herbs |
| Medium (camp) | 12-18 | 3-4 | 16-25 | herbs |
| Hard (dungeon) | 18-25 | 4-6 | 30-40 | herbs, rare items |

Player starts with 18-25 HP and 2-3 ATK. By the final area they should be level 2-3 with ~30 HP and 4-6 ATK (with weapon).

---

## Complete Example: The Fairy Forest

A fully working game demonstrating all features. Study this as a reference.

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Fairy Forest</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{image-rendering:pixelated;border:2px solid #333}</style>
</head><body><canvas id="game"></canvas>
<script src="rpg-engine.js"></script>
<script>
RPG.create({
  title: 'The Fairy Forest',

  colors: {
    grass:'#4a8a3b', grass2:'#3d7531', path:'#c4a55a', water:'#3b7dae',
    wall:'#8a7a62', roof:'#7a4a2a', door:'#5a3a1a', tree:'#2d6a1e', trunk:'#6b4226',
    darkGrass:'#2a6a22', darkGrass2:'#225a1a',
    cobble:'#8a8078', fence:'#b89a6a',
    caveFloor:'#3a3530', caveFloor2:'#342f2a', caveWall:'#2a2520',
    player:'#f0d080', shadow:'rgba(0,0,0,0.2)', uiBorder:'#f0d080',
    hpFill:'#e05050', hpBg:'#444', mpFill:'#50a0e0', xpFill:'#f0c830', white:'#fff',
  },

  solidTiles: [1, 2, 4, 6, 11, 12, 23, 24],
  treeTiles: [4],

  player: { name:'Pip', x:9, y:9, hp:18, mp:8, atk:2 },
  combat: { dash:true, gun:false },
  startMap: 'village',

  winCondition: {
    item: 'moonstone',
    title: 'THE FOREST IS SAVED!',
    message: 'Pip recovered the Moonstone! The forest blooms once more.',
  },

  items: {
    herb:      { name:'Forest Herb',  color:'#5cb85c', icon:'herb',  desc:'A healing herb. +5 HP.', heal:5 },
    staff:     { name:'Oak Staff',    color:'#8b6914', icon:'staff', desc:'A sturdy staff. +4 ATK.', weapon:true, atk:4 },
    cave_key:  { name:'Cave Key',     color:'#f0c830', icon:'key',   desc:'Opens the goblin cave.' },
    moonstone: { name:'Moonstone',    color:'#c8b0ff', icon:'gem',   desc:'The ancient Moonstone!' },
  },

  enemyTypes: {
    slime:    { name:'Slime',       color:'#70c870', hp:8,  atk:2, xp:10, speed:0.8, drops:['herb'] },
    frog:     { name:'Forest Frog', color:'#4a9a3a', hp:10, atk:2, xp:12, speed:1.0, drops:['herb'] },
    goblin:   { name:'Goblin',      color:'#5a8a3a', hp:14, atk:3, xp:20, speed:0.7, drops:['herb'] },
    wolf:     { name:'Dire Wolf',   color:'#5a5a62', hp:18, atk:4, xp:28, speed:0.6, drops:['herb'] },
    spider:   { name:'Cave Spider', color:'#3a2a2a', hp:12, atk:3, xp:16, speed:0.9, drops:['herb'] },
    rat:      { name:'Cave Rat',    color:'#7a6a5a', hp:6,  atk:1, xp:6,  speed:1.2, drops:['herb'] },
    skeleton: { name:'Skeleton',    color:'#e0d8c8', hp:22, atk:5, xp:35, speed:0.5, drops:['herb'] },
  },

  maps: {
    village: {
      name: 'Dewdrop Village',
      tiles: [
        [4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4],
        [4,0,18,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,4],
        [4,0,0,6,6,6,0,0,0,0,0,0,0,6,6,6,0,0,0,4],
        [4,0,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,4],
        [4,0,0,1,5,1,0,0,18,0,18,0,0,1,5,1,0,0,0,4],
        [4,0,0,0,3,0,0,0,0,0,0,0,0,0,3,0,0,0,0,4],
        [4,18,0,0,3,3,3,3,3,3,3,3,3,3,3,0,0,18,0,4],
        [4,0,0,0,0,0,0,3,0,0,0,3,0,0,0,0,0,0,0,4],
        [4,0,0,0,0,0,0,3,0,0,0,3,0,0,0,0,0,0,0,4],
        [4,0,0,0,0,0,0,3,0,0,0,3,0,0,0,0,0,0,0,4],
        [4,0,0,0,18,0,0,3,0,18,0,3,0,0,18,0,0,0,0,4],
        [4,0,0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,0,0,4],
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        [4,0,18,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,4],
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
      ],
      npcs: [
        { x:6, y:7, name:'Elder Oak', color:'#7eb8da', dir:2,
          questGive: { flag:'has_cave_key', item:'cave_key' },
          dialogue:[
            "Pip! The Moonstone has been stolen!",
            "Goblins took it deep into their cave to the north.",
            "Without it, our forest will wither and die.",
            "Take this key — it opens the cave entrance.",
            "Be brave, little one. We're counting on you.",
          ]},
        { x:12, y:7, name:'Herbalist', color:'#da7e9e', dir:1, trader:true,
          trades:[{ give:'herb', giveQty:3, receive:'staff', receiveQty:1 }],
          dialogue:[
            "Hello dear! I craft staves from rare herbs.",
            "Bring me 3 Forest Herbs and I'll make you one!",
          ]},
        { x:10, y:4, name:'Innkeeper', color:'#daa87e', dir:0,
          dialogue:[
            "Welcome to the Dewdrop Inn!",
            "Dangerous creatures lurk in the woods to the north.",
            "Stock up on herbs before you venture out.",
          ]},
      ],
      exits: { north: { map:'woods', spawnX:9, spawnY:13 } },
      exitTiles: { north:[8,9] },
      items: [{ x:2, y:10, item:'herb' }, { x:16, y:10, item:'herb' }],
      enemies: [],
    },

    woods: {
      name: 'Enchanted Woods',
      tiles: [
        [4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4],
        [4,20,20,20,4,20,20,0,0,0,0,20,20,4,20,20,20,20,20,4],
        [4,20,20,4,20,20,0,0,0,0,0,0,20,20,4,20,20,18,20,4],
        [4,20,20,20,20,0,0,0,18,0,18,0,0,20,20,20,20,20,20,4],
        [4,4,20,20,0,0,0,0,0,0,0,0,0,0,20,20,4,20,20,4],
        [4,20,20,0,0,0,0,0,0,0,0,0,0,0,0,20,20,20,20,4],
        [4,20,0,0,0,0,2,2,0,0,0,2,2,0,0,0,0,20,20,4],
        [4,20,0,0,0,2,2,2,2,0,2,2,2,2,0,0,0,0,20,4],
        [4,20,20,0,0,0,2,2,0,0,0,2,2,0,0,0,20,20,20,4],
        [4,20,20,0,0,0,0,0,0,0,0,0,0,0,0,0,20,20,20,4],
        [4,20,20,20,0,0,0,0,0,18,0,0,0,0,20,20,20,20,20,4],
        [4,4,20,20,20,0,0,0,0,0,0,0,0,20,20,20,4,20,20,4],
        [4,20,20,20,20,20,0,0,0,0,0,0,20,20,20,20,20,20,20,4],
        [4,20,20,20,20,20,20,0,0,0,0,20,20,20,20,20,20,20,20,4],
        [4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4],
      ],
      npcs: [],
      exits: {
        south: { map:'village', spawnX:9, spawnY:1 },
        north: { map:'camp', spawnX:9, spawnY:13 },
      },
      exitTiles: { south:[8,9], north:[8,9] },
      items: [{ x:9, y:10, item:'herb' }],
      enemies: [
        { x:4, y:4, type:'frog' }, { x:14, y:5, type:'frog' }, { x:10, y:9, type:'frog' },
        { x:3, y:9, type:'slime' }, { x:15, y:3, type:'slime' },
      ],
    },

    camp: {
      name: 'Goblin Camp',
      tiles: [
        [4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4],
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        [4,0,0,0,24,24,24,24,24,24,24,24,24,24,24,0,0,0,0,4],
        [4,0,0,24,21,21,21,21,21,21,21,21,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,21,21,21,21,21,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,21,21,21,21,21,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,1,1,5,1,1,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,1,6,6,6,1,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,21,21,3,21,21,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,21,21,3,21,21,21,21,21,24,0,0,0,4],
        [4,0,0,24,21,21,21,21,3,3,3,21,21,21,21,24,0,0,0,4],
        [4,0,0,0,24,24,24,24,3,3,24,24,24,24,24,0,0,0,0,4],
        [4,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,4],
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        [4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4],
      ],
      npcs: [],
      exits: { south: { map:'woods', spawnX:9, spawnY:1 } },
      exitTiles: { south:[8,9] },
      items: [],
      enemies: [
        { x:5, y:4, type:'goblin' }, { x:13, y:4, type:'goblin' },
        { x:9, y:10, type:'goblin' }, { x:6, y:9, type:'wolf' },
      ],
    },

    cave: {
      name: 'Goblin Cave',
      tiles: [
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,11,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,11,10,10,10,10,10,11],
        [11,10,10,12,10,10,10,10,11,11,11,10,10,10,10,12,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,11,11,10,10,10,10,10,10,10,10,10,10,10,10,10,11,11,11,11],
        [11,10,10,10,10,10,11,10,10,10,10,10,11,10,10,10,10,10,10,11],
        [11,10,10,10,10,10,11,10,10,10,10,10,11,10,10,10,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,10,12,10,10,10,10,11,10,11,10,10,10,10,12,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,11,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,11,10,10,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,5,10,10,10,10,10,10,10,10,10,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
      ],
      npcs: [],
      exits: {},
      exitTiles: {},
      items: [{ x:9, y:1, item:'moonstone' }],
      enemies: [
        { x:2, y:2, type:'spider' }, { x:17, y:2, type:'spider' },
        { x:4, y:8, type:'rat' }, { x:14, y:8, type:'rat' },
        { x:9, y:5, type:'skeleton' },
      ],
    },
  },

  doorPortals: {
    camp: [
      { x:9, y:6, map:'cave', spawnX:9, spawnY:12,
        locked:true, unlockFlag:'has_cave_key', lockedMsg:"The cave entrance is sealed with a heavy lock." },
    ],
    cave: [
      { x:9, y:13, map:'camp', spawnX:9, spawnY:7, locked:false },
    ],
  },
});
</script></body></html>
```
