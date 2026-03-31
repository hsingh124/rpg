# RPG Custom Asset Builder

This skill provides guidelines and patterns for creating custom 2D top-down assets for the `rpg-engine.js` library — including tiles, enemies, bosses, NPCs, collectables, and characters — by implementing the `drawTile` and/or `drawEnemy` callbacks.

When a user asks to add new visual asset types or improve existing ones, follow these aesthetic and technical guidelines to ensure consistency with the engine's charming, pixel-perfect, animated aesthetic.

---

## Callback Signatures

### `drawTile(ctx, type, x, y, px, py, T, C)`
- `ctx`: CanvasRenderingContext2D
- `type`: Integer tile ID (custom tiles start at **25**)
- `x`, `y`: Grid column/row
- `px`, `py`: Pixel coordinates (`x * T, y * T`)
- `T`: Tile size (always 32)
- `C`: Color palette object. **Always use fallbacks** like `C.grass || '#4a7a3b'`

### `drawEnemy(ctx, type, enemy, px, py, T, C, hurt)`
- `ctx`: CanvasRenderingContext2D
- `type`: String enemy type ID (e.g. `'dragon'`, `'golem'`)
- `enemy`: Enemy object with `{ color, hp, maxHp, dir, moveTimer, alive }`
- `px`, `py`: Pixel coordinates of the enemy
- `T`: Tile size (always 32)
- `C`: Color palette object
- `hurt`: Boolean — `true` when the enemy is in hurt animation (flash white)

---

## Core Aesthetic Principles

### 1. Checkerboard Foundations for Floor Tiles
Break up flat floors using a subtle alternating pattern:
```javascript
ctx.fillStyle = (x + y) % 2 ? (C.grass || '#4a7a3b') : (C.grass2 || '#3d6b31');
ctx.fillRect(px, py, T, T);
```

### 2. Deterministic Pseudo-Randomness
**Never use `Math.random()`** for static tile details — it causes flickering on redraws. Use modulo arithmetic:
```javascript
if ((x * 7 + y * 13) % 11 < 3) {
  // draw pebble/tuft/flower — same spot every frame
}
```

### 3. Shadows and Highlights
Give structures volume with low-opacity overlays:
- **Shadows:** `ctx.fillStyle = 'rgba(0,0,0,0.15)'`
- **Highlights:** `ctx.fillStyle = 'rgba(255,255,255,0.08)'`
- **Ground shadows** under tall objects: `ctx.ellipse(...)` with `rgba(0,0,0,0.2)`

### 4. Animation via `Date.now()`
For dynamic elements (water, lava, magic, fire, floating items), use time + spatial offsets:
```javascript
const t = Date.now();
const wave = Math.sin(t / 600 + x * 2 + y * 3) * 0.15;
```
Keep offsets small and subtle. Phase by `x` and `y` so adjacent tiles don't move in lockstep.

### 5. Multi-Layering
Build complex objects from layered primitives (`fillRect`, `arc`, `moveTo`/`lineTo`, `ellipse`):
- Background/floor first
- Ground shadow
- Main body/structure
- Highlight accents
- Animated overlay (glow, sparkle, hover)

### 6. Hurt Flash for Enemies
When `hurt` is `true`, replace the body color with `'#fff'` and eye/detail colors with `'#ddd'`:
```javascript
ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#5cb85c');
```

---

## Custom Tile Examples

### Decorative / Environment Tiles

```javascript
// Tile 25 — Glowing Crystal
case 25: {
  ctx.fillStyle = C.caveFloor || '#3a3530';
  ctx.fillRect(px, py, T, T);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(px+16, py+28, 8, 3, 0, 0, Math.PI*2); ctx.fill();
  // crystal body
  ctx.fillStyle = C.crystal || '#55ddff';
  ctx.beginPath();
  ctx.moveTo(px+16, py+4); ctx.lineTo(px+22, py+14);
  ctx.lineTo(px+20, py+26); ctx.lineTo(px+12, py+26);
  ctx.lineTo(px+10, py+14); ctx.closePath(); ctx.fill();
  // highlight edge
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px+11, py+8, 2, 14);
  // animated glow
  const glow = 0.15 + Math.sin(Date.now()/500 + x + y) * 0.1;
  ctx.fillStyle = `rgba(85,221,255,${glow})`;
  ctx.beginPath(); ctx.arc(px+16, py+16, 14, 0, Math.PI*2); ctx.fill();
  break;
}

// Tile 26 — Treasure Chest (collectable marker)
case 26: {
  ctx.fillStyle = (x+y)%2 ? (C.dungeonFloor||'#4a4540') : (C.dungeonFloor2||'#3e3a35');
  ctx.fillRect(px, py, T, T);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(px+16, py+28, 10, 3, 0, 0, Math.PI*2); ctx.fill();
  // chest body
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px+6, py+14, 20, 14);
  // lid
  ctx.fillStyle = '#a06830';
  ctx.beginPath(); ctx.moveTo(px+4, py+14); ctx.quadraticCurveTo(px+16, py+6, px+28, py+14); ctx.fill();
  // metal bands
  ctx.fillStyle = '#e8c170'; ctx.fillRect(px+6, py+14, 20, 2); ctx.fillRect(px+14, py+14, 4, 14);
  // lock
  ctx.fillStyle = '#f0d890';
  ctx.beginPath(); ctx.arc(px+16, py+21, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(px+16, py+21, 1.5, 0, Math.PI*2); ctx.fill();
  break;
}

// Tile 27 — Animated Torch on Wall
case 27: {
  const t = Date.now();
  ctx.fillStyle = C.wall || '#7a6652'; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py+28, T, 4);
  // bracket
  ctx.fillStyle = '#555'; ctx.fillRect(px+14, py+10, 4, 14);
  // flame
  const flicker = Math.sin(t/100 + x*5) * 2;
  const flicker2 = Math.cos(t/130 + y*3) * 1.5;
  ctx.fillStyle = '#ff6600';
  ctx.beginPath(); ctx.ellipse(px+16+flicker2, py+8+flicker, 5, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.ellipse(px+16+flicker2*0.5, py+7+flicker*0.7, 3, 4, 0, 0, Math.PI*2); ctx.fill();
  // light glow
  const glow = 0.05 + Math.sin(t/200 + x) * 0.03;
  ctx.fillStyle = `rgba(255,150,50,${glow})`;
  ctx.beginPath(); ctx.arc(px+16, py+10, 18, 0, Math.PI*2); ctx.fill();
  break;
}

// Tile 28 — Magic Portal / Warp Pad
case 28: {
  const t = Date.now();
  ctx.fillStyle = C.dungeonFloor || '#4a4540'; ctx.fillRect(px, py, T, T);
  // swirling portal
  const rot = t / 1000;
  ctx.fillStyle = `rgba(130,80,220,${0.3 + Math.sin(t/400)*0.1})`;
  ctx.beginPath(); ctx.ellipse(px+16, py+16, 13, 13, rot, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(180,120,255,${0.2 + Math.sin(t/300+1)*0.1})`;
  ctx.beginPath(); ctx.ellipse(px+16, py+16, 9, 9, -rot*1.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(220,180,255,${0.3 + Math.sin(t/500)*0.15})`;
  ctx.beginPath(); ctx.arc(px+16, py+16, 5, 0, Math.PI*2); ctx.fill();
  // sparkles
  for (let i = 0; i < 3; i++) {
    const angle = rot*2 + i*2.1;
    const r = 10 + Math.sin(t/400+i)*3;
    const sx = px+16 + Math.cos(angle)*r;
    const sy = py+16 + Math.sin(angle)*r;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(sx, sy, 2, 2);
  }
  break;
}
```

---

## Custom Enemy / Boss Examples

### Standard Enemy — Mushroom

```javascript
case 'mushroom': {
  const bob = Math.sin(t/400) * 1.5;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(px+16, py+28, 8, 3, 0, 0, Math.PI*2); ctx.fill();
  // stem
  ctx.fillStyle = hurt ? '#fff' : '#e8dcc8';
  ctx.fillRect(px+12, py+18+bob, 8, 10);
  // cap
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#cc3333');
  ctx.beginPath(); ctx.arc(px+16, py+16+bob, 11, Math.PI, 0); ctx.fill();
  // spots
  ctx.fillStyle = hurt ? '#ddd' : '#fff';
  ctx.beginPath(); ctx.arc(px+12, py+12+bob, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+20, py+10+bob, 2.5, 0, Math.PI*2); ctx.fill();
  // eyes
  ctx.fillStyle = hurt ? '#ddd' : '#333';
  ctx.fillRect(px+12, py+20+bob, 2, 2); ctx.fillRect(px+18, py+20+bob, 2, 2);
  break;
}
```

### Boss Enemy — Dragon

Bosses should feel larger and more imposing. Use the full 32×32 tile and more elaborate animation:

```javascript
case 'dragon': {
  const t = Date.now();
  const wingFlap = Math.sin(t/300) * 6;
  const breathe = Math.sin(t/500) * 1.5;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(px+16, py+28, 14, 4, 0, 0, Math.PI*2); ctx.fill();
  // wings
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#aa2222');
  ctx.beginPath();
  ctx.moveTo(px+12, py+14+breathe);
  ctx.quadraticCurveTo(px-2, py+4+wingFlap, px+2, py+18+breathe);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px+20, py+14+breathe);
  ctx.quadraticCurveTo(px+34, py+4+wingFlap, px+30, py+18+breathe);
  ctx.fill();
  // body
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#aa2222');
  ctx.beginPath(); ctx.ellipse(px+16, py+18+breathe, 9, 10, 0, 0, Math.PI*2); ctx.fill();
  // belly highlight
  ctx.fillStyle = hurt ? '#eee' : '#dd8844';
  ctx.beginPath(); ctx.ellipse(px+16, py+20+breathe, 5, 6, 0, 0, Math.PI*2); ctx.fill();
  // head
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#aa2222');
  ctx.beginPath(); ctx.arc(px+16, py+8+breathe, 7, 0, Math.PI*2); ctx.fill();
  // horns
  ctx.fillStyle = hurt ? '#ddd' : '#885522';
  ctx.beginPath(); ctx.moveTo(px+10, py+6+breathe); ctx.lineTo(px+7, py-2+breathe); ctx.lineTo(px+13, py+4+breathe); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px+22, py+6+breathe); ctx.lineTo(px+25, py-2+breathe); ctx.lineTo(px+19, py+4+breathe); ctx.fill();
  // eyes
  ctx.fillStyle = hurt ? '#ddd' : '#ff4400';
  ctx.beginPath(); ctx.arc(px+13, py+7+breathe, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+19, py+7+breathe, 2, 0, Math.PI*2); ctx.fill();
  // fire breath (intermittent)
  if (Math.sin(t/800) > 0.3) {
    const fireLen = 6 + Math.sin(t/150) * 3;
    ctx.fillStyle = `rgba(255,100,0,${0.6 + Math.sin(t/100)*0.2})`;
    ctx.beginPath(); ctx.moveTo(px+14, py+12+breathe); ctx.lineTo(px+16, py+12+breathe+fireLen);
    ctx.lineTo(px+18, py+12+breathe); ctx.fill();
    ctx.fillStyle = `rgba(255,200,0,${0.5 + Math.sin(t/120)*0.2})`;
    ctx.beginPath(); ctx.moveTo(px+15, py+12+breathe); ctx.lineTo(px+16, py+10+breathe+fireLen);
    ctx.lineTo(px+17, py+12+breathe); ctx.fill();
  }
  break;
}
```

### Boss Enemy — Golem

```javascript
case 'golem': {
  const t = Date.now();
  const step = Math.abs(Math.sin(t/600)) * 2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(px+16, py+30, 12, 3, 0, 0, Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle = hurt ? '#fff' : '#5a5550';
  ctx.fillRect(px+8, py+22, 6, 9+step); ctx.fillRect(px+18, py+22, 6, 9-step);
  // body
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#6a6560');
  ctx.fillRect(px+6, py+8, 20, 16);
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px+10, py+12); ctx.lineTo(px+14, py+18); ctx.lineTo(px+11, py+22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+22, py+10); ctx.lineTo(px+19, py+16); ctx.stroke();
  // arms
  ctx.fillStyle = hurt ? '#fff' : '#5a5550';
  ctx.fillRect(px+2, py+10, 5, 14); ctx.fillRect(px+25, py+10, 5, 14);
  // fists
  ctx.fillRect(px+1, py+22, 7, 5); ctx.fillRect(px+24, py+22, 7, 5);
  // head
  ctx.fillStyle = hurt ? '#fff' : (enemy.color || '#6a6560');
  ctx.fillRect(px+9, py+2, 14, 8);
  // glowing eyes
  const eyeGlow = 0.7 + Math.sin(t/300) * 0.3;
  ctx.fillStyle = hurt ? '#ddd' : `rgba(255,100,0,${eyeGlow})`;
  ctx.fillRect(px+12, py+5, 3, 3); ctx.fillRect(px+18, py+5, 3, 3);
  break;
}
```

---

## Custom Collectable / Ground Item Appearance

Ground items are rendered by the engine using the `icon` field. The 15 built-in icons are: `herb`, `shroom`, `fossil`, `gem`, `crystal`, `potion`, `scroll`, `feather`, `coin`, `sword`, `staff`, `gun`, `key`, `seal`, `bone`.

To create **new visual item types**, define custom items with existing icons and unique colors:

```javascript
items: {
  // Collectable gems with distinct colors
  ruby:      { name:'Ruby',      color:'#e03030', icon:'gem',     desc:'A fiery ruby.' },
  sapphire:  { name:'Sapphire',  color:'#3060e0', icon:'gem',     desc:'A brilliant sapphire.' },
  emerald:   { name:'Emerald',   color:'#30c050', icon:'gem',     desc:'A verdant emerald.' },
  // Boss drop
  dragon_fang: { name:'Dragon Fang', color:'#ffccaa', icon:'bone', desc:'A fang from a slain dragon.' },
  // Magic scroll
  fireball:  { name:'Fire Scroll', color:'#ff6600', icon:'scroll', desc:'Unleashes a fireball.' },
  // Currency
  gold_coin: { name:'Gold Coin',  color:'#f0c830', icon:'coin',   desc:'Shiny gold.' },
}
```

---

## NPC Character Customization

NPCs are rendered by the engine as colored sprites. Customize via the config properties:

```javascript
{
  x:5, y:7, name:'King Aldric', color:'#daa520',  // gold-colored character
  dir:0,  // 0=down, 1=left, 2=right, 3=up
  dialogue:["I am the king!", "Bring me the dragon's fang."],
  // Optional: make them a trader
  trader: true,
  trades: [{ give:'dragon_fang', giveQty:1, receive:'ruby', receiveQty:3 }],
  // Optional: make them a quest giver
  questGive: { flag:'quest_done', item:'sapphire' },
}
```

NPCs can be static or mobile. Add `wander: true` with `wanderRadius` for random wandering near their origin, or `patrol: [[x1,y1],[x2,y2],...]` for waypoint loops. Control movement with `speed` (1-5) and `pauseTime` (seconds between moves). NPCs stop and face the player during dialogue, then resume movement.

---

## Integration into RPG.create()

```javascript
RPG.create({
  // ... standard config ...
  solidTiles: [1, 2, 4, 6, 25, 27],  // add custom solid tile IDs
  treeTiles: [4, 17],                  // add tiles that render above the player

  drawTile(ctx, type, x, y, px, py, T, C) {
    switch(type) {
      case 25: { /* crystal */ break; }
      case 26: { /* chest */ break; }
      case 27: { /* torch */ break; }
      case 28: { /* portal */ break; }
      default: return; // fall through to engine defaults for tiles 0-24
    }
  },

  drawEnemy(ctx, type, enemy, px, py, T, C, hurt) {
    const t = Date.now();
    switch(type) {
      case 'dragon':   { /* dragon boss */ break; }
      case 'golem':    { /* golem boss */ break; }
      case 'mushroom': { /* mushroom enemy */ break; }
      default: return; // fall through to engine defaults for built-in types
    }
  },

  enemyTypes: {
    // Custom boss: high HP, high ATK, rare drop
    dragon: { name:'Fire Dragon', color:'#aa2222', hp:40, atk:6, xp:100, speed:0.4, drops:['dragon_fang'] },
    golem:  { name:'Stone Golem', color:'#6a6560', hp:50, atk:5, xp:80,  speed:0.3, drops:['ruby'] },
    mushroom: { name:'Toxic Shroom', color:'#cc3333', hp:12, atk:3, xp:15, speed:0.9, drops:['shroom'] },
    // Built-in types still work without drawEnemy overrides:
    slime:  { name:'Slime', color:'#5cb85c', hp:8, atk:2, xp:10, speed:0.8, drops:['herb'] },
  },
});
```

---

## Design Tips

- **Bosses**: HP 30-60, ATK 5-8, speed 0.3-0.5. Give them dramatic animations (fire breath, ground pound, wing flap). Use larger visual elements that fill the full 32×32 tile.
- **Super enemies**: Use `canDash`, `ranged`, and `chaseDistance: 0` on enemy types for aggressive behavior. Super enemies dash toward the player, fire projectiles from afar, and chase from any distance. Combine all three for terrifying boss encounters.
- **Traders**: Give them warm/inviting colors (#daa520 gold, #da7e7e rose). Place them in safe zones (villages/camps).
- **Quest NPCs**: Use dialogue to tell the story. The `questGive.flag` can unlock `doorPortals` with `unlockFlag`.
- **Collectables**: Use `icon:'gem'` or `icon:'crystal'` with varied colors for distinct visual identity. Boss drops should use `icon:'bone'` or `icon:'fossil'`.
- **Custom tiles**: Always add to `solidTiles` if they block movement. Add to `treeTiles` if they should render on top of entities (archways, tall crystals).
