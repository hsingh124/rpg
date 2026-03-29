# RPG Game Builder (Library)

Build a 2D top-down RPG using `rpg-engine.js`. Model provides data + 2 callbacks. Engine handles everything else.

## HTML Template

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TITLE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{image-rendering:pixelated;border:2px solid #333}</style>
</head><body><canvas id="game"></canvas>
<script src="rpg-engine.js"></script>
<script>
RPG.create({ /* config here */ });
</script></body></html>
```

## RPG.create(config) — Full Shape

```js
RPG.create({
  title: 'Game Title',

  colors: {
    grass:'#4a7a3b', grass2:'#3d6b31', path:'#c4a55a', water:'#3b6d9e',
    wall:'#7a6652', roof:'#8b3a3a', door:'#5a3a1a', tree:'#2d5a1e', trunk:'#6b4226',
    player:'#e8c170', npc:'#7eb8da', npc2:'#da7e7e', npc3:'#7eda8e',
    shadow:'rgba(0,0,0,0.2)', uiBorder:'#e8c170',
    hpFill:'#e74c3c', hpBg:'#555', mpFill:'#3498db', xpFill:'#f1c40f', white:'#fff',
    // Add any custom colors for your theme
  },

  // Tile integers that block movement
  solidTiles: [1, 2, 4, 6, 9, 11, 12, 13, 17],
  // Tile integers redrawn on top of entities (depth)
  treeTiles: [4, 17],

  player: { name:'Hero', x:9, y:9, hp:20, mp:10, atk:2 },
  combat: { dash:true, gun:true },
  startMap: 'village',

  items: {
    herb:  {name:'Herb',   color:'#5cb85c', icon:'herb',   desc:'Heals 5 HP.', heal:5},
    sword: {name:'Sword',  color:'#a08050', icon:'sword',  desc:'+3 ATK', weapon:true, atk:3},
    gun:   {name:'Gun',    color:'#55ddff', icon:'gun',    desc:'Press F to fire!'},
    key:   {name:'Key',    color:'#f1c40f', icon:'key',    desc:'Opens something.'},
    // icon options: herb, shroom, fossil, gem, crystal, potion, scroll, feather,
    //              coin, sword, staff, gun, key, seal, bone
    // heal:N → consumable. weapon:true,atk:N → equippable. gun item → sets player.hasGun
  },

  enemyTypes: {
    slime: {name:'Slime', color:'#5cb85c', hp:8, atk:2, xp:10, speed:0.8, drops:['herb']},
    // speed: movement frequency (higher=faster). drops: random item on death
  },

  maps: {
    village: {
      name: 'Greenleaf Village',
      tiles: [
        // 15 rows × 20 cols of integers
        // 0=grass 1=wall 2=water 3=path 4=tree 5=door 6=roof 7=sand
        // 8=dungeon_floor 9=lava 10=cave_floor 11=cave_wall 12=stalagmite
        // 13=dungeon_wall 14=bones 15+ custom (define in drawTile)
        [4,4,4,4,4,4,4,4,3,3,4,4,4,4,4,4,4,4,4,4],  // row 0 - north exit at cols 8,9
        // ... 13 more rows ...
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],  // row 14
      ],
      npcs: [
        {x:4, y:5, name:'Elder', color:'#7eb8da', dir:0,
         dialogue:["Welcome!", "Be careful out there."]},
        // trader NPC:
        {x:8, y:7, name:'Smith', color:'#da7e7e', dir:0, trader:true,
         trades:[{give:'herb', giveQty:3, receive:'sword', receiveQty:1}],
         dialogue:["Want to trade?"]},
        // quest NPC (MUST use questGive, not quest):
        {x:6, y:6, name:'Nomad', color:'#7eda8e', dir:0,
         questGive:{flag:'temple_key', item:'key'},
         dialogue:["The temple is sealed.", "Take this key."]},
      ],
      exits: {
        north: {map:'forest', spawnX:9, spawnY:13},
      },
      exitTiles: {
        north: [8, 9],  // which cols/rows are walkable at that edge
      },
      items: [{x:3, y:9, item:'herb'}],
      enemies: [],  // village = safe!
    },
    forest: {
      name: 'Dark Forest',
      tiles: [/* 15×20 grid */],
      npcs: [],
      exits: {
        south: {map:'village', spawnX:9, spawnY:1},  // bidirectional!
      },
      exitTiles: {south: [8, 9]},
      items: [],
      enemies: [{x:5, y:5, type:'slime'}, {x:12, y:8, type:'slime'}],
    },
  },

  doorPortals: {
    // Map ID → array of portals. Tile at (x,y) MUST be 5 in that map's grid
    desert: [
      {x:5, y:4, map:'temple_interior', spawnX:9, spawnY:13,
       locked:true, unlockFlag:'temple_key', lockedMsg:"It's sealed."},
    ],
    temple_interior: [
      {x:9, y:14, map:'desert', spawnX:5, spawnY:5, locked:false},
    ],
  },

  // REQUIRED: custom tile rendering
  drawTile(ctx, type, x, y, px, py, TILE, C) {
    // type = integer from tiles grid. px/py = pixel coords. TILE = 32
    if (type === 0) { ctx.fillStyle = (x+y)%2 ? C.grass : C.grass2; ctx.fillRect(px,py,TILE,TILE); }
    else if (type === 1) { ctx.fillStyle = C.wall; ctx.fillRect(px,py,TILE,TILE); }
    else if (type === 3) { ctx.fillStyle = C.path; ctx.fillRect(px,py,TILE,TILE); }
    else if (type === 4) {
      ctx.fillStyle = (x+y)%2 ? C.grass : C.grass2; ctx.fillRect(px,py,TILE,TILE);
      ctx.fillStyle = C.trunk; ctx.fillRect(px+13,py+16,6,16);
      ctx.fillStyle = C.tree; ctx.beginPath(); ctx.arc(px+16,py+12,14,0,Math.PI*2); ctx.fill();
    }
    else if (type === 5) { ctx.fillStyle = C.path; ctx.fillRect(px,py,TILE,TILE); ctx.fillStyle = C.door; ctx.fillRect(px+4,py+2,24,28); }
    else if (type === 6) { ctx.fillStyle = C.roof; ctx.fillRect(px,py,TILE,TILE); }
    // ... handle all tile types used in your maps
  },

  // REQUIRED: custom enemy rendering
  drawEnemy(ctx, type, enemy, px, py, TILE, C, hurt) {
    // type = enemy type string (e.g. 'slime'). hurt = boolean (flash white)
    if (type === 'slime') {
      const bounce = Math.sin(Date.now()/300)*2;
      ctx.fillStyle = hurt ? '#fff' : '#5cb85c';
      ctx.beginPath(); ctx.ellipse(px+16, py+20+bounce, 12, 10-bounce/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.fillRect(px+11,py+17,3,3); ctx.fillRect(px+18,py+17,3,3);
    }
  },
});
```

## VALIDATION — Check before outputting

1. Every `exitTiles` position is NOT in solidTiles. E.g., `exitTiles:{east:[6,7]}` → `tiles[6][19]` and `tiles[7][19]` must be walkable
2. Every map in `maps` is reachable from startMap via exits/portals
3. Exits are bidirectional — A→B means B→A exists
4. Every doorPortals (x,y) has tile 5 in that map's tiles grid — NOT 0, NOT floor — exactly 5
5. Interior exit doors are on walkable tiles, not buried in solid walls
6. Path tiles (3) connect to exit edges — no isolated center loops
7. No entity overlap: no enemy+item on same tile, no NPC on door tile
8. NPC quest property is `questGive` — not `quest` or anything else
9. SpawnX/SpawnY in exits and portals must land on walkable tiles
10. Every tile type used in tiles grids has a case in drawTile
11. Every enemy type used in maps.enemies has a case in drawEnemy
12. All maps have 15 rows × 20 columns exactly

## Engine Handles (you don't write this)

- Canvas 640×480, 32px tiles, 20×15 grid
- Input: WASD/arrows move, Shift run, E/X dash, F shoot, Space interact, I inventory, Esc close
- Tile-to-tile movement with lerp animation
- Collision (solid tiles, NPCs, enemies)
- Screen transitions (fade to black) at map edges
- Door portals (auto-enter on tile 5, locked/unlocked via flags)
- handleInteract: NPCs checked BEFORE door portals on facing tile
- Dash-slash combat (lerp for drawing only, integer positions)
- Gun projectiles with trail
- Enemy AI (chase within 5 tiles, wander otherwise)
- Damage, particles, afterimages, damage floats
- Inventory, trading, dialogue UI
- HUD (HP/MP/XP bars, area name with measureText, controls hint)
- Level up, death/respawn
- Quest flags (setFlag/hasFlag via questGive)

## Tips

- Use `(x+y)%2` for checkerboard grass/floor variation
- Use `Math.sin(Date.now()/speed)` for animation (water shimmer, enemy bounce)
- Each biome needs: floor tile + wall tile + 2 decorative tiles minimum
- Trees: draw grass first, then trunk+canopy (they get redrawn on top of entities)
- Make villages safe (no enemies), put enemies in wilderness/dungeons
- 3-5 maps is ideal. Hub-and-spoke or linear layout
- Interior maps: small (fill most with wall/roof, carve walkable interior)
