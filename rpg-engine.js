// RPG Engine v1.1 — 2D Top-Down RPG Game Library
// Usage: RPG.create({ ...config }) — see docs for config shape
// Built-in tile & enemy art — callbacks are optional overrides
const RPG = {
  create(cfg) {
    // --- Canvas Setup ---
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const TILE = 32, COLS = 20, ROWS = 15;
    canvas.width = COLS * TILE;
    canvas.height = ROWS * TILE;
    document.title = cfg.title || 'RPG';

    const C = cfg.colors || {};
    const SOLID = new Set(cfg.solidTiles || []);
    const TREE_TILES = new Set(cfg.treeTiles || [4]);
    const ITEMS = cfg.items || {};
    const ENEMY_TYPES = cfg.enemyTypes || {};
    const DOOR_PORTALS = cfg.doorPortals || {};
    const MAPS = {};
    const MAP_ITEMS = {};
    const MAP_ENEMIES = {};

    // Split maps config into MAPS + MAP_ITEMS + MAP_ENEMIES
    for (const [id, m] of Object.entries(cfg.maps)) {
      MAPS[id] = { name: m.name, tiles: m.tiles, npcs: m.npcs || [], exits: m.exits || {}, exitTiles: m.exitTiles || {} };
      MAP_ITEMS[id] = (m.items || []).map(i => ({ ...i }));
      MAP_ENEMIES[id] = (m.enemies || []).map(e => {
        const t = ENEMY_TYPES[e.type];
        return { ...e, hp: t ? t.hp : 10, maxHp: t ? t.hp : 10, dir: Math.floor(Math.random() * 4), moveTimer: Math.random() * 2, hurtTimer: 0, alive: true };
      });
    }

    // --- Game Flags ---
    const gameFlags = {};
    function setFlag(f) { gameFlags[f] = true; checkWinCondition(); }
    function hasFlag(f) { return !!gameFlags[f]; }

    // --- Win Condition ---
    function checkWinCondition() {
      if (gameWon || !winCfg) return;
      if (winCfg.item && player.inventory.includes(winCfg.item)) { gameWon = true; winTimer = 0; }
      if (winCfg.flag && hasFlag(winCfg.flag)) { gameWon = true; winTimer = 0; }
    }

    // --- Player ---
    const pc = cfg.player || {};
    const player = {
      x: pc.x ?? 9, y: pc.y ?? 9, dir: 0,
      hp: pc.hp || 20, maxHp: pc.hp || 20,
      mp: pc.mp || 10, maxMp: pc.mp || 10,
      xp: 0, maxXp: 50, level: 1,
      name: pc.name || 'Hero',
      moving: false, moveT: 0, fromX: pc.x ?? 9, fromY: pc.y ?? 9,
      animFrame: 0, animTimer: 0,
      speed: pc.speed || 6, runSpeed: pc.runSpeed || 12,
      inventory: [], gold: 0,
      baseAtk: pc.atk || 2, equippedWeapon: null,
      attacking: false, attackTimer: 0, attackCooldown: 0,
      hurtTimer: 0, iFrames: 0,
      dashing: false, dashTimer: 0, dashDuration: 0.15,
      dashFromX: 0, dashFromY: 0, dashToX: 0, dashToY: 0, dashDist: 3,
      hasGun: false, gunCooldown: 0,
    };

    const combat = cfg.combat || {};
    let damageFloats = [], particles = [], projectiles = [], afterimages = [];
    let currentMapId = cfg.startMap || Object.keys(MAPS)[0];
    let transitioning = false, transitionAlpha = 0, transitionTarget = null;
    let keys = {}, keyOrder = [];
    let dialogueState = null, messageQueue = [], currentMessage = null, messageTimer = 0;
    let inventoryOpen = false, inventoryCursor = 0;
    let tradeOpen = false, tradeCursor = 0, tradeNpc = null;
    let gameWon = false, winTimer = 0;
    const winCfg = cfg.winCondition || null; // { item:'moonstone' } or { flag:'boss_defeated' } + { title, message }

    function currentMap() { return MAPS[currentMapId]; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    function getDirDelta(dir) {
      if (dir === 0) return { dx: 0, dy: 1 };
      if (dir === 3) return { dx: 0, dy: -1 };
      if (dir === 1) return { dx: -1, dy: 0 };
      return { dx: 1, dy: 0 };
    }

    function showMessage(text) { messageQueue.push(text); }

    function getPlayerAtk() {
      let atk = player.baseAtk;
      if (player.equippedWeapon && ITEMS[player.equippedWeapon]) atk += ITEMS[player.equippedWeapon].atk;
      return atk;
    }

    // --- Inventory helpers ---
    function getInventoryDisplay() {
      const counts = {};
      for (const id of player.inventory) counts[id] = (counts[id] || 0) + 1;
      return Object.entries(counts).map(([id, qty]) => ({ id, item: ITEMS[id], qty }));
    }
    function countItem(id) { return player.inventory.filter(i => i === id).length; }
    function removeItems(id, qty) { let r = 0; player.inventory = player.inventory.filter(i => { if (i === id && r < qty) { r++; return false; } return true; }); }
    function addItems(id, qty) { for (let i = 0; i < qty; i++) player.inventory.push(id); }

    // --- Collision ---
    function canMove(x, y) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      if (SOLID.has(currentMap().tiles[y][x])) return false;
      for (const npc of currentMap().npcs) { if (npc.x === x && npc.y === y) return false; }
      for (const e of (MAP_ENEMIES[currentMapId] || [])) { if (e.alive && e.x === x && e.y === y) return false; }
      return true;
    }

    // --- Default Tile Renderer ---
    // Tile types: 0=grass 1=wall 2=water 3=path 4=tree 5=door 6=roof 7=sand
    // 8=dungeon_floor 9=lava 10=cave_floor 11=cave_wall 12=stalagmite
    // 13=dungeon_wall 14=bones 15=snow 16=ice 17=pine_tree 18=flowers
    // 19=bridge 20=dark_grass 21=cobblestone 22=carpet 23=bookshelf 24=fence
    function defaultDrawTile(ctx, type, x, y, px, py, TILE, C) {
      const t = Date.now();
      switch (type) {
        case 0: // grass
          ctx.fillStyle = (x+y)%2 ? (C.grass||'#4a7a3b') : (C.grass2||'#3d6b31');
          ctx.fillRect(px, py, TILE, TILE);
          if ((x*7+y*13)%11 < 3) { ctx.fillStyle = C.grass2||'#3d6b31'; ctx.fillRect(px+8,py+22,2,5); ctx.fillRect(px+14,py+20,2,6); ctx.fillRect(px+20,py+23,2,4); }
          break;
        case 1: // wall
          ctx.fillStyle = C.wall||'#7a6652'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py+TILE-4, TILE, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
          ctx.strokeRect(px+1, py+1, TILE/2-1, TILE/2-1);
          ctx.strokeRect(px+TILE/2, py+TILE/2, TILE/2-1, TILE/2-1);
          break;
        case 2: // water
          ctx.fillStyle = C.water||'#3b6d9e'; ctx.fillRect(px, py, TILE, TILE);
          const wv = Math.sin(t/600+x*2+y*3)*0.15;
          ctx.fillStyle = `rgba(255,255,255,${0.08+wv})`; ctx.fillRect(px+4, py+8+Math.sin(t/800+x)*4, 12, 3);
          ctx.fillStyle = `rgba(255,255,255,${0.05+wv*0.5})`; ctx.fillRect(px+14, py+20+Math.sin(t/900+y)*3, 10, 2);
          break;
        case 3: // path
          ctx.fillStyle = C.path||'#c4a55a'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          if ((x+y*3)%5===0) ctx.fillRect(px+6,py+10,4,3);
          if ((x*2+y)%7===0) ctx.fillRect(px+16,py+20,5,3);
          break;
        case 4: // tree
          ctx.fillStyle = (x+y)%2 ? (C.grass||'#4a7a3b') : (C.grass2||'#3d6b31');
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.trunk||'#6b4226'; ctx.fillRect(px+13, py+18, 6, 14);
          ctx.fillStyle = C.tree||'#2d5a1e';
          ctx.beginPath(); ctx.arc(px+16, py+12, 14, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(0,50,0,0.25)';
          ctx.beginPath(); ctx.arc(px+13, py+10, 7, 0, Math.PI*2); ctx.fill();
          break;
        case 5: // door
          ctx.fillStyle = C.path||'#c4a55a'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.door||'#5a3a1a'; ctx.fillRect(px+4, py+2, 24, 28);
          ctx.fillStyle = C.uiBorder||'#e8c170'; ctx.fillRect(px+20, py+14, 4, 4); // handle
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px+4, py+2, 24, 3); // top shadow
          break;
        case 6: // roof
          ctx.fillStyle = C.roof||'#8b3a3a'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          for (let i = 0; i < TILE; i += 8) ctx.fillRect(px, py+i, TILE, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px, py+TILE-2, TILE, 2);
          break;
        case 7: // sand
          ctx.fillStyle = (x+y)%2 ? (C.sand||'#d4b96a') : (C.sand2||'#c8a85a');
          ctx.fillRect(px, py, TILE, TILE);
          if ((x*5+y*3)%9<2) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.beginPath(); ctx.arc(px+10+((x*7)%12), py+12+((y*5)%10), 3, 0, Math.PI*2); ctx.fill(); }
          break;
        case 8: // dungeon floor
          ctx.fillStyle = (x+y)%2 ? (C.dungeonFloor||'#4a4540') : (C.dungeonFloor2||'#3e3a35');
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.strokeRect(px+1, py+1, TILE-2, TILE-2);
          break;
        case 9: // lava
          ctx.fillStyle = C.lava||'#cc4400'; ctx.fillRect(px, py, TILE, TILE);
          const lv = Math.sin(t/400+x*3+y*2)*0.3;
          ctx.fillStyle = `rgba(255,200,0,${0.3+lv})`; ctx.fillRect(px+2, py+4+Math.sin(t/500+x)*6, 14, 6);
          ctx.fillStyle = `rgba(255,100,0,${0.2+lv*0.5})`; ctx.fillRect(px+12, py+16+Math.sin(t/600+y)*4, 12, 5);
          break;
        case 10: // cave floor
          ctx.fillStyle = (x+y)%2 ? (C.caveFloor||'#3a3530') : (C.caveFloor2||'#342f2a');
          ctx.fillRect(px, py, TILE, TILE);
          if ((x*3+y*7)%9<2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(px+4, py+4, 8, 6); }
          break;
        case 11: // cave wall
          ctx.fillStyle = C.caveWall||'#2a2520'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px, py+TILE-6, TILE, 6);
          ctx.fillStyle = 'rgba(100,80,60,0.12)'; ctx.fillRect(px+3, py+5, 10, 6);
          break;
        case 12: // stalagmite
          ctx.fillStyle = C.caveFloor||'#3a3530'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.caveWall||'#2a2520';
          ctx.beginPath(); ctx.moveTo(px+10, py+TILE); ctx.lineTo(px+16, py+4); ctx.lineTo(px+22, py+TILE); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px+15, py+8, 2, 12);
          break;
        case 13: // dungeon wall
          ctx.fillStyle = C.dungeonWall||'#3a3545'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px, py+TILE-5, TILE, 5);
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
          ctx.strokeRect(px+2, py+2, TILE-4, TILE/2-2);
          break;
        case 14: // bones
          ctx.fillStyle = C.dungeonFloor||'#4a4540'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#c8c0b0';
          ctx.fillRect(px+6, py+14, 14, 3); ctx.fillRect(px+10, py+10, 3, 10);
          ctx.beginPath(); ctx.arc(px+12, py+10, 4, 0, Math.PI*2); ctx.fill();
          break;
        case 15: // snow
          ctx.fillStyle = (x+y)%2 ? (C.snow||'#e8e8f0') : (C.snow2||'#d8d8e8');
          ctx.fillRect(px, py, TILE, TILE);
          if ((x*3+y*11)%8<2) { ctx.fillStyle = 'rgba(200,210,255,0.3)'; ctx.beginPath(); ctx.arc(px+8+((x*7)%16), py+10+((y*5)%12), 2, 0, Math.PI*2); ctx.fill(); }
          break;
        case 16: // ice
          ctx.fillStyle = C.ice||'#a0c8e8'; ctx.fillRect(px, py, TILE, TILE);
          const iv = Math.sin(t/1000+x+y)*0.1;
          ctx.fillStyle = `rgba(255,255,255,${0.15+iv})`; ctx.fillRect(px+3, py+5, 10, 4);
          ctx.fillStyle = `rgba(255,255,255,${0.1+iv*0.5})`; ctx.fillRect(px+16, py+18, 8, 3);
          break;
        case 17: // pine tree
          ctx.fillStyle = (x+y)%2 ? (C.grass||'#4a7a3b') : (C.grass2||'#3d6b31');
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.trunk||'#6b4226'; ctx.fillRect(px+14, py+22, 4, 10);
          ctx.fillStyle = C.pine||'#1a5028';
          ctx.beginPath(); ctx.moveTo(px+16, py+2); ctx.lineTo(px+26, py+16); ctx.lineTo(px+6, py+16); ctx.fill();
          ctx.beginPath(); ctx.moveTo(px+16, py+8); ctx.lineTo(px+28, py+24); ctx.lineTo(px+4, py+24); ctx.fill();
          break;
        case 18: // flowers
          ctx.fillStyle = (x+y)%2 ? (C.grass||'#4a7a3b') : (C.grass2||'#3d6b31');
          ctx.fillRect(px, py, TILE, TILE);
          const fc = ['#e55','#e8e','#ee5','#5be','#f90'];
          for (let i = 0; i < 4; i++) {
            const fx = px+6+((x*7+i*11)%20), fy = py+6+((y*5+i*13)%20);
            ctx.fillStyle = fc[(x+y+i)%fc.length];
            ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#2d5a1e'; ctx.fillRect(fx-0.5, fy+3, 1.5, 4);
          }
          break;
        case 19: // bridge / wooden planks
          ctx.fillStyle = C.water||'#3b6d9e'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.bridge||'#8b6914'; ctx.fillRect(px, py+2, TILE, TILE-4);
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(px, py+10, TILE, 2); ctx.fillRect(px, py+20, TILE, 2);
          break;
        case 20: // dark grass (swamp/deep forest)
          ctx.fillStyle = (x+y)%2 ? (C.darkGrass||'#2a5a22') : (C.darkGrass2||'#224a1a');
          ctx.fillRect(px, py, TILE, TILE);
          if ((x*9+y*3)%7<2) { ctx.fillStyle = 'rgba(0,40,0,0.2)'; ctx.fillRect(px+6,py+18,3,8); ctx.fillRect(px+18,py+16,3,10); }
          break;
        case 21: // cobblestone
          ctx.fillStyle = C.cobble||'#8a8078'; ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
          ctx.strokeRect(px+1, py+1, 14, 14); ctx.strokeRect(px+16, py+1, 14, 14);
          ctx.strokeRect(px+8, py+16, 14, 14);
          break;
        case 22: // carpet (interior)
          ctx.fillStyle = C.carpet||'#8b3050'; ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = C.carpetBorder||'#c4a55a'; ctx.lineWidth = 1; ctx.strokeRect(px+2, py+2, TILE-4, TILE-4);
          break;
        case 23: // bookshelf
          ctx.fillStyle = C.wood||'#6b4226'; ctx.fillRect(px, py, TILE, TILE);
          const bc = ['#8b3030','#3050a0','#2a7030','#8b6014','#604080'];
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
              ctx.fillStyle = bc[(x+y+row+col)%bc.length];
              ctx.fillRect(px+2+col*7, py+2+row*10, 6, 8);
            }
          }
          break;
        case 24: // fence
          ctx.fillStyle = (x+y)%2 ? (C.grass||'#4a7a3b') : (C.grass2||'#3d6b31');
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = C.fence||'#b89a6a';
          ctx.fillRect(px, py+10, TILE, 3); ctx.fillRect(px, py+20, TILE, 3);
          ctx.fillRect(px+4, py+6, 3, 20); ctx.fillRect(px+25, py+6, 3, 20);
          break;
        default:
          ctx.fillStyle = '#333'; ctx.fillRect(px, py, TILE, TILE);
      }
    }

    // --- Default Enemy Renderer ---
    // Built-in enemy visuals: slime, frog, snake, skeleton, ghost, bat, spider, wolf, goblin, rat
    function defaultDrawEnemy(ctx, type, enemy, px, py, TILE, C, hurt) {
      const t = Date.now();
      switch (type) {
        case 'slime': {
          const bounce = Math.sin(t/300)*2;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#5cb85c');
          ctx.beginPath(); ctx.ellipse(px+16, py+22+bounce, 12, 10-bounce/2, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = hurt?'#ddd':'#333'; ctx.fillRect(px+11, py+18+bounce, 3, 3); ctx.fillRect(px+18, py+18+bounce, 3, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(px+12, py+16+bounce, 3, 0, Math.PI*2); ctx.fill();
          break;
        }
        case 'frog': {
          const hop = Math.abs(Math.sin(t/400))*3;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#4a8a3a');
          ctx.beginPath(); ctx.ellipse(px+16, py+22-hop, 11, 8, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(px+11, py+16-hop, 4, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+21, py+16-hop, 4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#222';
          ctx.beginPath(); ctx.arc(px+12, py+16-hop, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+20, py+16-hop, 2, 0, Math.PI*2); ctx.fill();
          break;
        }
        case 'snake': {
          const wave = Math.sin(t/300)*3;
          ctx.strokeStyle = hurt?'#fff':(enemy.color||'#7a6a4a'); ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px+6, py+22);
          ctx.quadraticCurveTo(px+12, py+16+wave, px+16, py+20);
          ctx.quadraticCurveTo(px+22, py+24-wave, px+28, py+18); ctx.stroke();
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#7a6a4a');
          ctx.beginPath(); ctx.arc(px+28, py+18, 5, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#c00'; ctx.fillRect(px+30, py+17, 4, 2); // tongue
          ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(px+29, py+16, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.lineCap = 'butt';
          break;
        }
        case 'skeleton': {
          const bob = Math.sin(t/500)*1;
          ctx.fillStyle = hurt?'#fff':'#e8e0d0';
          // skull
          ctx.beginPath(); ctx.arc(px+16, py+8+bob, 7, 0, Math.PI*2); ctx.fill();
          // body
          ctx.fillRect(px+14, py+15+bob, 4, 10);
          // ribs
          ctx.fillRect(px+10, py+17+bob, 12, 2); ctx.fillRect(px+11, py+21+bob, 10, 2);
          // arms
          ctx.fillRect(px+7, py+16+bob, 4, 2); ctx.fillRect(px+21, py+16+bob, 4, 2);
          ctx.fillRect(px+6, py+16+bob, 2, 8); ctx.fillRect(px+24, py+16+bob, 2, 8);
          // legs
          ctx.fillRect(px+12, py+25+bob, 3, 6); ctx.fillRect(px+17, py+25+bob, 3, 6);
          // eyes
          ctx.fillStyle = hurt?'#ddd':'#333';
          ctx.fillRect(px+13, py+7+bob, 2, 2); ctx.fillRect(px+17, py+7+bob, 2, 2);
          break;
        }
        case 'ghost': case 'wraith': {
          const float = Math.sin(t/500)*4;
          const alpha = 0.6+Math.sin(t/700)*0.2;
          ctx.globalAlpha = hurt?1:alpha;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#8a7acc');
          ctx.beginPath();
          ctx.moveTo(px+6, py+28); ctx.lineTo(px+6, py+12+float);
          ctx.quadraticCurveTo(px+16, py+2+float, px+26, py+12+float);
          ctx.lineTo(px+26, py+28);
          ctx.quadraticCurveTo(px+22, py+24, px+20, py+28);
          ctx.quadraticCurveTo(px+16, py+24, px+12, py+28);
          ctx.quadraticCurveTo(px+8, py+24, px+6, py+28);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(px+12, py+14+float, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+20, py+14+float, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#333';
          ctx.beginPath(); ctx.arc(px+12, py+15+float, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+20, py+15+float, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'bat': {
          const flap = Math.sin(t/150)*8;
          const bob = Math.sin(t/400)*3;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#4a3a5a');
          // wings
          ctx.beginPath();
          ctx.moveTo(px+16, py+16+bob);
          ctx.quadraticCurveTo(px+4, py+10+bob+flap, px+2, py+18+bob);
          ctx.lineTo(px+8, py+16+bob); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px+16, py+16+bob);
          ctx.quadraticCurveTo(px+28, py+10+bob+flap, px+30, py+18+bob);
          ctx.lineTo(px+24, py+16+bob); ctx.fill();
          // body
          ctx.beginPath(); ctx.ellipse(px+16, py+16+bob, 5, 6, 0, 0, Math.PI*2); ctx.fill();
          // eyes
          ctx.fillStyle = hurt?'#ddd':'#ff3333';
          ctx.fillRect(px+13, py+14+bob, 2, 2); ctx.fillRect(px+17, py+14+bob, 2, 2);
          break;
        }
        case 'spider': {
          const bob = Math.sin(t/600)*1.5;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#3a2a2a');
          // body
          ctx.beginPath(); ctx.ellipse(px+16, py+18+bob, 7, 6, 0, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+16, py+12+bob, 5, 0, Math.PI*2); ctx.fill();
          // legs (4 per side)
          ctx.strokeStyle = hurt?'#fff':(enemy.color||'#3a2a2a'); ctx.lineWidth = 1.5;
          for (let i = 0; i < 4; i++) {
            const ly = py+15+bob+i*3, ang = 0.3+i*0.15;
            ctx.beginPath(); ctx.moveTo(px+10, ly); ctx.lineTo(px+3, ly-4+i*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px+22, ly); ctx.lineTo(px+29, ly-4+i*2); ctx.stroke();
          }
          // eyes
          ctx.fillStyle = hurt?'#ddd':'#cc0000';
          ctx.fillRect(px+13, py+10+bob, 2, 2); ctx.fillRect(px+17, py+10+bob, 2, 2);
          ctx.fillRect(px+11, py+12+bob, 2, 1); ctx.fillRect(px+19, py+12+bob, 2, 1);
          break;
        }
        case 'wolf': {
          const run = Math.sin(t/250)*2;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#6a6a72');
          // body
          ctx.beginPath(); ctx.ellipse(px+16, py+20+run*0.3, 12, 7, 0, 0, Math.PI*2); ctx.fill();
          // head
          ctx.beginPath(); ctx.ellipse(px+26, py+16, 6, 5, -0.3, 0, Math.PI*2); ctx.fill();
          // ears
          ctx.beginPath(); ctx.moveTo(px+24, py+12); ctx.lineTo(px+22, py+6); ctx.lineTo(px+20, py+12); ctx.fill();
          ctx.beginPath(); ctx.moveTo(px+28, py+12); ctx.lineTo(px+27, py+6); ctx.lineTo(px+25, py+12); ctx.fill();
          // legs
          ctx.fillRect(px+8, py+25, 3, 6+run); ctx.fillRect(px+14, py+25, 3, 6-run);
          ctx.fillRect(px+20, py+25, 3, 6+run); ctx.fillRect(px+24, py+25, 3, 6-run);
          // tail
          ctx.beginPath(); ctx.moveTo(px+4, py+18); ctx.quadraticCurveTo(px+1, py+12+Math.sin(t/400)*3, px+3, py+10); ctx.lineWidth = 2.5; ctx.strokeStyle = hurt?'#fff':(enemy.color||'#6a6a72'); ctx.stroke();
          // eye
          ctx.fillStyle = hurt?'#ddd':'#ff6600'; ctx.beginPath(); ctx.arc(px+28, py+15, 1.5, 0, Math.PI*2); ctx.fill();
          // snout
          ctx.fillStyle = '#444'; ctx.fillRect(px+30, py+16, 2, 2);
          break;
        }
        case 'goblin': {
          const bob = Math.sin(t/400)*1.5;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#5a8a3a');
          // body
          ctx.fillRect(px+10, py+14+bob, 12, 12);
          // head
          ctx.beginPath(); ctx.arc(px+16, py+10+bob, 7, 0, Math.PI*2); ctx.fill();
          // ears
          ctx.beginPath(); ctx.moveTo(px+9, py+10+bob); ctx.lineTo(px+4, py+6+bob); ctx.lineTo(px+10, py+8+bob); ctx.fill();
          ctx.beginPath(); ctx.moveTo(px+23, py+10+bob); ctx.lineTo(px+28, py+6+bob); ctx.lineTo(px+22, py+8+bob); ctx.fill();
          // eyes
          ctx.fillStyle = hurt?'#ddd':'#ff0';
          ctx.fillRect(px+12, py+8+bob, 3, 3); ctx.fillRect(px+18, py+8+bob, 3, 3);
          ctx.fillStyle = '#333'; ctx.fillRect(px+13, py+9+bob, 1.5, 1.5); ctx.fillRect(px+19, py+9+bob, 1.5, 1.5);
          // legs
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#5a8a3a');
          ctx.fillRect(px+11, py+26+bob, 4, 5); ctx.fillRect(px+18, py+26+bob, 4, 5);
          break;
        }
        case 'rat': {
          const scurry = Math.sin(t/200)*2;
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#7a6a5a');
          ctx.beginPath(); ctx.ellipse(px+16, py+22+scurry*0.3, 8, 5, 0, 0, Math.PI*2); ctx.fill();
          // head
          ctx.beginPath(); ctx.ellipse(px+24, py+20, 4, 3.5, -0.2, 0, 0, Math.PI*2); ctx.fill();
          // ears
          ctx.beginPath(); ctx.arc(px+22, py+16, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+26, py+16, 3, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#daa'; ctx.beginPath(); ctx.arc(px+22, py+16, 1.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(px+26, py+16, 1.5, 0, Math.PI*2); ctx.fill();
          // tail
          ctx.strokeStyle = hurt?'#fff':'#9a7a6a'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(px+8, py+22); ctx.quadraticCurveTo(px+2, py+16+scurry, px+4, py+12); ctx.stroke();
          // eye
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px+26, py+19, 1, 0, Math.PI*2); ctx.fill();
          break;
        }
        default: {
          // generic blob fallback
          ctx.fillStyle = hurt?'#fff':(enemy.color||'#aa5555');
          ctx.beginPath(); ctx.ellipse(px+16, py+20, 12, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#333'; ctx.fillRect(px+11, py+17, 3, 3); ctx.fillRect(px+18, py+17, 3, 3);
        }
      }
    }

    // Resolve draw functions: user callbacks > defaults
    const drawTileFn = cfg.drawTile || defaultDrawTile;
    const drawEnemyFn = cfg.drawEnemy || defaultDrawEnemy;

    // --- Transitions ---
    function startTransition(target) { transitioning = true; transitionTarget = target; transitionAlpha = 0; }

    function updateTransition(dt) {
      transitionAlpha += dt * 3;
      if (transitionAlpha >= 1 && transitionTarget) {
        currentMapId = transitionTarget.map;
        player.x = transitionTarget.spawnX; player.y = transitionTarget.spawnY;
        player.fromX = player.x; player.fromY = player.y;
        player.moving = false; player.moveT = 0;
        dialogueState = null; transitionTarget = null;
      }
      if (transitionAlpha >= 2) { transitioning = false; transitionAlpha = 0; }
    }

    function checkScreenTransition() {
      const map = currentMap(), exits = map.exits;
      if (!exits) return;
      if (player.y === 0 && exits.north && (map.exitTiles.north || []).includes(player.x)) startTransition(exits.north);
      else if (player.y === ROWS - 1 && exits.south && (map.exitTiles.south || []).includes(player.x)) startTransition(exits.south);
      else if (player.x === COLS - 1 && exits.east && (map.exitTiles.east || []).includes(player.y)) startTransition(exits.east);
      else if (player.x === 0 && exits.west && (map.exitTiles.west || []).includes(player.y)) startTransition(exits.west);
    }

    // --- Door Portals ---
    function tryDoorPortal(tx, ty) {
      const portals = DOOR_PORTALS[currentMapId];
      if (!portals) return false;
      for (const p of portals) {
        if (p.x === tx && p.y === ty) {
          if (p.locked && !hasFlag(p.unlockFlag)) { showMessage(p.lockedMsg || "It's locked."); return true; }
          startTransition({ map: p.map, spawnX: p.spawnX, spawnY: p.spawnY }); return true;
        }
      }
      return false;
    }

    function checkDoorPortalAuto() {
      const tile = currentMap().tiles[player.y]?.[player.x];
      if (tile !== 5) return;
      const portals = DOOR_PORTALS[currentMapId];
      if (!portals) return;
      for (const p of portals) {
        if (p.x === player.x && p.y === player.y) {
          if (p.locked && !hasFlag(p.unlockFlag)) { showMessage(p.lockedMsg || "It's locked."); return; }
          startTransition({ map: p.map, spawnX: p.spawnX, spawnY: p.spawnY }); return;
        }
      }
    }

    // --- Items ---
    function tryPickupItem() {
      const items = MAP_ITEMS[currentMapId];
      if (!items) return;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].x === player.x && items[i].y === player.y) {
          const picked = items.splice(i, 1)[0];
          if (picked.item === 'gun') { player.hasGun = true; showMessage('Found the gun! Press F to fire!'); }
          else { player.inventory.push(picked.item); }
          showMessage(`Picked up ${ITEMS[picked.item].name}!`);
          checkWinCondition();
        }
      }
    }

    // --- Interaction ---
    function handleInteract() {
      if (dialogueState) {
        const npc = dialogueState.npc;
        dialogueState.line++;
        if (dialogueState.line >= npc.dialogue.length) {
          dialogueState = null;
          if (npc.trader) { tradeOpen = true; tradeNpc = npc; tradeCursor = 0; }
          if (npc.questGive && !hasFlag(npc.questGive.flag)) {
            setFlag(npc.questGive.flag);
            if (npc.questGive.item) { player.inventory.push(npc.questGive.item); showMessage(`Received ${ITEMS[npc.questGive.item].name}!`); }
          }
        }
        return;
      }
      tryPickupItem();
      if (tryDoorPortal(player.x, player.y)) return;
      let tx = player.x, ty = player.y;
      if (player.dir === 0) ty++; else if (player.dir === 3) ty--;
      else if (player.dir === 1) tx--; else tx++;
      for (const npc of currentMap().npcs) { if (npc.x === tx && npc.y === ty) { dialogueState = { npc, line: 0 }; return; } }
      if (tryDoorPortal(tx, ty)) return;
    }

    // --- Combat ---
    function spawnParticles(x, y, color, count, spread) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y, vx: (Math.random() - 0.5) * (spread || 200), vy: (Math.random() - 0.5) * (spread || 200),
          life: 0.3 + Math.random() * 0.2, color, size: 2 + Math.random() * 3,
        });
      }
    }

    function hitEnemy(e, dmg) {
      e.hp -= dmg; e.hurtTimer = 0.25;
      damageFloats.push({ x: e.x * TILE + 16, y: e.y * TILE, text: `-${dmg}`, color: '#fff', timer: 0.8 });
      spawnParticles(e.x * TILE + 16, e.y * TILE + 16, '#fff', 6);
      if (e.hp <= 0) {
        e.alive = false;
        const et = ENEMY_TYPES[e.type];
        player.xp += et.xp;
        damageFloats.push({ x: e.x * TILE + 16, y: e.y * TILE - 10, text: `+${et.xp} XP`, color: '#f1c40f', timer: 1.2 });
        spawnParticles(e.x * TILE + 16, e.y * TILE + 16, et.color, 12, 300);
        if (et.drops.length > 0) {
          const dropId = et.drops[Math.floor(Math.random() * et.drops.length)];
          MAP_ITEMS[currentMapId].push({ x: e.x, y: e.y, item: dropId });
        }
        checkLevelUp();
      }
    }

    function playerDashSlash() {
      if (!combat.dash) return;
      if (player.dashing || player.attackCooldown > 0) return;
      const { dx, dy } = getDirDelta(player.dir);
      const enemies = MAP_ENEMIES[currentMapId] || [];
      let dist = 0;
      for (let i = 1; i <= player.dashDist; i++) {
        const nx = player.x + dx * i, ny = player.y + dy * i;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) break;
        if (SOLID.has(currentMap().tiles[ny][nx])) break;
        if (currentMap().npcs.some(n => n.x === nx && n.y === ny)) break;
        dist = i;
      }
      if (dist === 0) {
        player.attacking = true; player.attackTimer = 0.15; player.attackCooldown = 0.3;
        const tx = player.x + dx, ty = player.y + dy;
        for (const e of enemies) { if (e.alive && e.x === tx && e.y === ty) { hitEnemy(e, getPlayerAtk() + Math.floor(Math.random() * 3)); break; } }
        return;
      }
      player.dashing = true; player.dashTimer = 0;
      player.dashFromX = player.x; player.dashFromY = player.y;
      player.dashToX = player.x + dx * dist; player.dashToY = player.y + dy * dist;
      player.attacking = true; player.attackTimer = player.dashDuration + 0.1;
      player.attackCooldown = 0.3; player.iFrames = player.dashDuration + 0.15;
      afterimages.push({ x: player.x, y: player.y, dir: player.dir, timer: 0.3 });
      const dmg = getPlayerAtk() + Math.floor(Math.random() * 3) + 2;
      const wColor = player.equippedWeapon ? ITEMS[player.equippedWeapon].color : '#aaddff';
      for (let i = 1; i <= dist; i++) {
        const cx = player.x + dx * i, cy = player.y + dy * i;
        for (const e of enemies) { if (e.alive && e.x === cx && e.y === cy) hitEnemy(e, dmg); }
        spawnParticles(cx * TILE + 16, cy * TILE + 16, wColor, 3, 80);
      }
      player.x = player.dashToX; player.y = player.dashToY;
    }

    function playerShoot() {
      if (!combat.gun || !player.hasGun || player.gunCooldown > 0) return;
      player.gunCooldown = 0.4;
      const { dx, dy } = getDirDelta(player.dir);
      const mx = player.x * TILE + 16 + dx * 16, my = player.y * TILE + 16 + dy * 16;
      spawnParticles(mx, my, '#55ddff', 5, 100);
      projectiles.push({
        x: player.x * TILE + 16 + dx * 20, y: player.y * TILE + 16 + dy * 20,
        vx: dx * 500, vy: dy * 500, life: 1.5, dmg: Math.floor(getPlayerAtk() * 0.8) + 2, trail: [],
      });
    }

    function checkLevelUp() {
      while (player.xp >= player.maxXp) {
        player.xp -= player.maxXp; player.level++;
        player.maxHp += 5; player.hp = player.maxHp;
        player.maxMp += 3; player.mp = player.maxMp;
        player.baseAtk += 1; player.maxXp = Math.floor(player.maxXp * 1.5);
        showMessage(`LEVEL UP! Now Lv.${player.level}  HP+5  ATK+1`);
      }
    }

    function useOrEquipSelected() {
      const inv = getInventoryDisplay();
      if (!inv[inventoryCursor]) return;
      const entry = inv[inventoryCursor];
      if (entry.item.weapon) {
        player.equippedWeapon = entry.id;
        showMessage(`Equipped ${entry.item.name}! ATK: ${player.baseAtk + entry.item.atk}`);
      } else if (entry.item.heal) {
        removeItems(entry.id, 1); player.hp = Math.min(player.maxHp, player.hp + entry.item.heal);
        showMessage(`Used ${entry.item.name}! +${entry.item.heal} HP`);
        inventoryCursor = Math.min(inventoryCursor, getInventoryDisplay().length - 1);
      }
    }

    function executeTrade() {
      if (!tradeNpc || !tradeNpc.trades[tradeCursor]) return;
      const t = tradeNpc.trades[tradeCursor];
      if (countItem(t.give) >= t.giveQty) {
        removeItems(t.give, t.giveQty); addItems(t.receive, t.receiveQty);
        showMessage(`Traded! Received ${t.receiveQty}x ${ITEMS[t.receive].name}`);
      } else { showMessage(`Not enough ${ITEMS[t.give].name}! Need ${t.giveQty}.`); }
    }

    // --- Enemy AI ---
    function enemyAI(dt) {
      const enemies = MAP_ENEMIES[currentMapId] || [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const et = ENEMY_TYPES[e.type];
        if (e.hurtTimer > 0) e.hurtTimer -= dt;
        e.moveTimer -= dt * et.speed;
        if (e.moveTimer > 0) continue;
        e.moveTimer = 1 + Math.random() * 1.5;
        const distX = player.x - e.x, distY = player.y - e.y;
        const dist = Math.abs(distX) + Math.abs(distY);
        let mx = 0, my = 0;
        if (dist <= 5 && dist > 0) {
          if (Math.abs(distX) >= Math.abs(distY)) mx = distX > 0 ? 1 : -1; else my = distY > 0 ? 1 : -1;
        } else { const r = Math.floor(Math.random() * 4); if (r === 0) my = -1; else if (r === 1) my = 1; else if (r === 2) mx = -1; else mx = 1; }
        if (my === -1) e.dir = 3; else if (my === 1) e.dir = 0; else if (mx === -1) e.dir = 1; else if (mx === 1) e.dir = 2;
        const nx = e.x + mx, ny = e.y + my;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !SOLID.has(currentMap().tiles[ny][nx])) {
          const blocked = enemies.some(o => o !== e && o.alive && o.x === nx && o.y === ny) || currentMap().npcs.some(n => n.x === nx && n.y === ny);
          if (!blocked && !(nx === player.x && ny === player.y)) { e.x = nx; e.y = ny; }
        }
        if (dist === 1 && player.iFrames <= 0) {
          const dmg = Math.max(1, et.atk - Math.floor(player.level * 0.5));
          player.hp -= dmg; player.hurtTimer = 0.3; player.iFrames = 0.8;
          damageFloats.push({ x: player.x * TILE + 16, y: player.y * TILE, text: `-${dmg}`, color: '#e74c3c', timer: 0.8 });
          if (player.hp <= 0) {
            player.hp = player.maxHp; currentMapId = cfg.startMap || Object.keys(MAPS)[0];
            player.x = pc.x ?? 9; player.y = pc.y ?? 9;
            player.fromX = player.x; player.fromY = player.y; player.moving = false;
            showMessage('You were defeated! Respawned.');
          }
        }
      }
    }

    // --- Input ---
    window.addEventListener('keydown', e => {
      const c = e.code;
      if (!keys[c]) { keys[c] = true; keyOrder.push(c); }
      if (c === 'KeyI' || c === 'Tab') { e.preventDefault(); if (!tradeOpen) { inventoryOpen = !inventoryOpen; inventoryCursor = 0; } return; }
      if (c === 'Escape') { if (tradeOpen) { tradeOpen = false; tradeNpc = null; } else if (inventoryOpen) inventoryOpen = false; else if (dialogueState) dialogueState = null; return; }
      if (c === 'KeyE' || c === 'KeyX') { if (!inventoryOpen && !tradeOpen && !dialogueState) playerDashSlash(); return; }
      if (c === 'KeyF') { if (!inventoryOpen && !tradeOpen && !dialogueState) playerShoot(); return; }
      if (c === 'Space' || c === 'Enter') { e.preventDefault(); if (tradeOpen) executeTrade(); else if (inventoryOpen) useOrEquipSelected(); else handleInteract(); return; }
      if (inventoryOpen || tradeOpen) {
        if (c === 'ArrowUp' || c === 'KeyW') { if (inventoryOpen) inventoryCursor = Math.max(0, inventoryCursor - 1); if (tradeOpen) tradeCursor = Math.max(0, tradeCursor - 1); }
        if (c === 'ArrowDown' || c === 'KeyS') {
          if (inventoryOpen) inventoryCursor = Math.min(getInventoryDisplay().length - 1, inventoryCursor + 1);
          if (tradeOpen && tradeNpc) tradeCursor = Math.min(tradeNpc.trades.length - 1, tradeCursor + 1);
        }
      }
    });
    window.addEventListener('keyup', e => { const c = e.code; keys[c] = false; keyOrder = keyOrder.filter(k => k !== c); });

    // --- Update ---
    function update(dt) {
      if (transitioning) { updateTransition(dt); return; }
      if (currentMessage) { messageTimer -= dt; if (messageTimer <= 0) currentMessage = null; }
      if (!currentMessage && messageQueue.length) { currentMessage = messageQueue.shift(); messageTimer = 2; }
      player.animTimer += dt;
      if (player.animTimer > 0.2) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }
      if (player.attacking) { player.attackTimer -= dt; if (player.attackTimer <= 0) player.attacking = false; }
      if (player.attackCooldown > 0) player.attackCooldown -= dt;
      if (player.hurtTimer > 0) player.hurtTimer -= dt;
      if (player.iFrames > 0) player.iFrames -= dt;
      if (player.gunCooldown > 0) player.gunCooldown -= dt;
      if (player.dashing) { player.dashTimer += dt; if (player.dashTimer >= player.dashDuration) { player.dashing = false; player.fromX = player.x; player.fromY = player.y; tryPickupItem(); checkDoorPortalAuto(); checkScreenTransition(); } }
      for (let i = damageFloats.length - 1; i >= 0; i--) { damageFloats[i].timer -= dt; damageFloats[i].y -= dt * 40; if (damageFloats[i].timer <= 0) damageFloats.splice(i, 1); }
      for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.size *= 0.95; if (p.life <= 0) particles.splice(i, 1); }
      for (let i = afterimages.length - 1; i >= 0; i--) { afterimages[i].timer -= dt; if (afterimages[i].timer <= 0) afterimages.splice(i, 1); }
      // Projectiles
      const enemies = MAP_ENEMIES[currentMapId] || [];
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.trail.push({ x: pr.x, y: pr.y, life: 0.15 });
        pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
        for (let t = pr.trail.length - 1; t >= 0; t--) { pr.trail[t].life -= dt; if (pr.trail[t].life <= 0) pr.trail.splice(t, 1); }
        const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS || SOLID.has(currentMap().tiles[ty]?.[tx])) { spawnParticles(pr.x, pr.y, '#55ddff', 8); projectiles.splice(i, 1); continue; }
        let hit = false;
        for (const e of enemies) { if (!e.alive) continue; if (Math.abs(pr.x - (e.x * TILE + 16)) < 14 && Math.abs(pr.y - (e.y * TILE + 16)) < 14) { hitEnemy(e, pr.dmg); spawnParticles(pr.x, pr.y, '#55ddff', 8, 250); projectiles.splice(i, 1); hit = true; break; } }
        if (!hit && pr.life <= 0) projectiles.splice(i, 1);
      }
      enemyAI(dt);
      if (dialogueState || inventoryOpen || tradeOpen) return;
      if (player.dashing) return;
      if (player.moving) {
        const spd = (keys['ShiftLeft'] || keys['ShiftRight']) ? player.runSpeed : player.speed;
        player.moveT += dt * spd;
        if (player.moveT >= 1) { player.moving = false; player.moveT = 0; tryPickupItem(); checkDoorPortalAuto(); checkScreenTransition(); }
        return;
      }
      let dx = 0, dy = 0;
      for (let i = keyOrder.length - 1; i >= 0; i--) {
        const k = keyOrder[i];
        if (k === 'ArrowUp' || k === 'KeyW') { dy = -1; player.dir = 3; break; }
        if (k === 'ArrowDown' || k === 'KeyS') { dy = 1; player.dir = 0; break; }
        if (k === 'ArrowLeft' || k === 'KeyA') { dx = -1; player.dir = 1; break; }
        if (k === 'ArrowRight' || k === 'KeyD') { dx = 1; player.dir = 2; break; }
      }
      if ((dx || dy) && canMove(player.x + dx, player.y + dy)) {
        player.fromX = player.x; player.fromY = player.y;
        player.x += dx; player.y += dy; player.moving = true; player.moveT = 0;
      }
    }

    // --- Drawing ---
    function drawCharacter(x, y, color, dir, frame) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = C.shadow || 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(px + 16, py + 30, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      const bob = Math.sin(frame * Math.PI * 0.5) * 1.5;
      ctx.fillStyle = color; ctx.fillRect(px + 8, py + 10 + bob, 16, 16);
      ctx.fillStyle = '#f5d5a0'; ctx.fillRect(px + 10, py + 2 + bob, 12, 12);
      ctx.fillStyle = '#333';
      if (dir === 0) { ctx.fillRect(px + 12, py + 8 + bob, 3, 3); ctx.fillRect(px + 18, py + 8 + bob, 3, 3); }
      else if (dir === 3) { ctx.fillStyle = '#c4a060'; ctx.fillRect(px + 11, py + 3 + bob, 10, 6); }
      else if (dir === 1) { ctx.fillRect(px + 10, py + 8 + bob, 3, 3); }
      else { ctx.fillRect(px + 19, py + 8 + bob, 3, 3); }
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(px + 10, py + 26 + bob, 5, 6); ctx.fillRect(px + 17, py + 26 + bob, 5, 6);
    }

    function drawPlayer() {
      if (player.iFrames > 0 && !player.dashing && Math.floor(player.iFrames * 10) % 2 === 0) return;
      let dx, dy;
      if (player.dashing) {
        const t = Math.min(player.dashTimer / player.dashDuration, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        dx = lerp(player.dashFromX, player.dashToX, eased);
        dy = lerp(player.dashFromY, player.dashToY, eased);
      } else if (player.moving) { dx = lerp(player.fromX, player.x, player.moveT); dy = lerp(player.fromY, player.y, player.moveT); }
      else { dx = player.x; dy = player.y; }
      for (const ai of afterimages) { ctx.globalAlpha = ai.timer / 0.3 * 0.4; drawCharacter(ai.x, ai.y, '#88bbff', ai.dir, 0); ctx.globalAlpha = 1; }
      if (player.dashing) {
        const { dx: ddx, dy: ddy } = getDirDelta(player.dir);
        const wColor = player.equippedWeapon ? ITEMS[player.equippedWeapon].color : '#aaddff';
        const t = Math.min(player.dashTimer / player.dashDuration, 1);
        ctx.globalAlpha = 0.6 * (1 - t); ctx.strokeStyle = wColor; ctx.lineWidth = 2;
        const sx = player.dashFromX * TILE + 16, sy = player.dashFromY * TILE + 16, ex = dx * TILE + 16, ey = dy * TILE + 16;
        for (let line = -1; line <= 1; line++) { const off = line * 8; ctx.beginPath(); ctx.moveTo(sx + ddy * off, sy + ddx * off); ctx.lineTo(ex + ddy * off, ey + ddx * off); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (player.hurtTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 30) * 0.3;
      drawCharacter(dx, dy, player.hurtTimer > 0 ? '#ff6666' : (C.player || '#e8c170'), player.dir, player.moving ? player.animFrame : 0);
      ctx.globalAlpha = 1;
      if (player.attacking) {
        const { dx: adx, dy: ady } = getDirDelta(player.dir);
        const slashX = dx * TILE + 16 + adx * TILE, slashY = dy * TILE + 16 + ady * TILE;
        const progress = 1 - (player.attackTimer / (player.dashing ? player.dashDuration + 0.1 : 0.15));
        const wColor = player.equippedWeapon ? ITEMS[player.equippedWeapon].color : '#cceeff';
        ctx.save(); ctx.translate(slashX, slashY);
        let baseAngle = 0;
        if (player.dir === 0) baseAngle = Math.PI * 0.5; else if (player.dir === 3) baseAngle = -Math.PI * 0.5; else if (player.dir === 1) baseAngle = Math.PI;
        ctx.globalAlpha = (1 - progress) * 0.9; ctx.strokeStyle = wColor; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 16 + progress * 8, baseAngle - 1.2 + progress * 0.5, baseAngle + 1.2 - progress * 0.5); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 12 + progress * 6, baseAngle - 0.8 + progress * 1.5, baseAngle + 0.8 - progress * 1.5); ctx.stroke();
        ctx.globalAlpha = 1; ctx.restore();
      }
    }

    function drawItemIcon(px, py, itemId, size) {
      const item = ITEMS[itemId]; if (!item) return;
      const s = size || 16, cx = px + s / 2, cy = py + s / 2;
      ctx.fillStyle = item.color;
      if (item.icon === 'herb') { ctx.fillRect(px + s * 0.4, py + s * 0.3, s * 0.15, s * 0.5); ctx.beginPath(); ctx.arc(cx - s * 0.1, py + s * 0.3, s * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + s * 0.15, py + s * 0.4, s * 0.18, 0, Math.PI * 2); ctx.fill(); }
      else if (item.icon === 'shroom') { ctx.fillStyle = '#d0c8b0'; ctx.fillRect(cx - 1, cy, 3, s * 0.35); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, Math.PI, 0); ctx.fill(); }
      else if (item.icon === 'fossil') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2); ctx.fill(); }
      else if (item.icon === 'gem') { ctx.beginPath(); ctx.moveTo(cx, py + s * 0.15); ctx.lineTo(px + s * 0.8, cy); ctx.lineTo(cx, py + s * 0.85); ctx.lineTo(px + s * 0.2, cy); ctx.closePath(); ctx.fill(); }
      else if (item.icon === 'crystal') { ctx.beginPath(); ctx.moveTo(cx - s * 0.15, py + s * 0.8); ctx.lineTo(cx, py + s * 0.1); ctx.lineTo(cx + s * 0.15, py + s * 0.8); ctx.fill(); }
      else if (item.icon === 'potion') { ctx.fillRect(cx - s * 0.1, py + s * 0.15, s * 0.2, s * 0.2); ctx.beginPath(); ctx.arc(cx, py + s * 0.6, s * 0.25, 0, Math.PI * 2); ctx.fill(); }
      else if (item.icon === 'scroll') { ctx.fillRect(px + s * 0.2, py + s * 0.2, s * 0.6, s * 0.6); }
      else if (item.icon === 'feather') { ctx.beginPath(); ctx.moveTo(cx, py + s * 0.1); ctx.quadraticCurveTo(px + s * 0.8, cy, cx, py + s * 0.9); ctx.quadraticCurveTo(px + s * 0.4, cy, cx, py + s * 0.1); ctx.fill(); }
      else if (item.icon === 'coin') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2); ctx.fill(); }
      else if (item.icon === 'sword') { ctx.fillStyle = '#888'; ctx.fillRect(cx - 1, py + s * 0.1, 3, s * 0.55); ctx.fillStyle = item.color; ctx.fillRect(cx - 4, py + s * 0.55, 9, 3); ctx.fillStyle = '#a08050'; ctx.fillRect(cx - 1.5, py + s * 0.6, 4, s * 0.3); }
      else if (item.icon === 'staff') { ctx.fillStyle = '#8B6914'; ctx.fillRect(cx - 1.5, py + s * 0.15, 3, s * 0.75); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(cx, py + s * 0.18, s * 0.18, 0, Math.PI * 2); ctx.fill(); }
      else if (item.icon === 'gun') { ctx.fillStyle = '#888'; ctx.fillRect(px + s * 0.15, cy - 2, s * 0.7, 5); ctx.fillStyle = item.color; ctx.fillRect(px + s * 0.1, cy - 3, s * 0.35, 7); }
      else if (item.icon === 'key') { ctx.beginPath(); ctx.arc(px + s * 0.3, py + s * 0.35, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(px + s * 0.4, py + s * 0.3, s * 0.45, s * 0.12); ctx.fillRect(px + s * 0.7, py + s * 0.3, s * 0.1, s * 0.25); }
      else if (item.icon === 'seal') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = item.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2); ctx.stroke(); }
      else if (item.icon === 'bone') { ctx.fillRect(px + s * 0.1, cy - 2, s * 0.8, 4); ctx.beginPath(); ctx.arc(px + s * 0.1, cy, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(px + s * 0.9, cy, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillRect(px + 2, py + 2, s - 4, s - 4); }
    }

    function drawGroundItems() {
      const items = MAP_ITEMS[currentMapId]; if (!items) return;
      for (const gi of items) {
        const px = gi.x * TILE + 8, py = gi.y * TILE + 8;
        const bob = Math.sin(Date.now() / 400 + gi.x * 3 + gi.y * 7) * 3;
        ctx.globalAlpha = 0.3; ctx.fillStyle = ITEMS[gi.item].color;
        ctx.beginPath(); ctx.arc(px + 8, py + 8 + bob, 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; drawItemIcon(px, py + bob, gi.item, 16);
      }
    }

    function drawOneEnemy(e) {
      if (!e.alive) return;
      const et = ENEMY_TYPES[e.type];
      const px = e.x * TILE, py = e.y * TILE;
      ctx.fillStyle = C.shadow || 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(px + 16, py + 30, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      const hurt = e.hurtTimer > 0;
      drawEnemyFn(ctx, e.type, { ...e, color: et.color }, px, py, TILE, C, hurt);
      if (e.hp < e.maxHp) { ctx.fillStyle = '#333'; ctx.fillRect(px + 4, py - 4, 24, 4); ctx.fillStyle = '#e74c3c'; ctx.fillRect(px + 4, py - 4, 24 * (e.hp / e.maxHp), 4); }
      ctx.fillStyle = '#ff9999'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(et.name, px + 16, py - 6);
    }

    function drawProjectiles() {
      for (const pr of projectiles) {
        for (const t of pr.trail) { ctx.globalAlpha = t.life / 0.15 * 0.4; ctx.fillStyle = '#55ddff'; ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1; ctx.fillStyle = '#aaeeff'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#55ddff'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
    }

    function drawParticles() { for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 4); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } ctx.globalAlpha = 1; }
    function drawDamageFloats() { for (const f of damageFloats) { ctx.globalAlpha = Math.min(1, f.timer * 2); ctx.fillStyle = f.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1; }

    function drawUI() {
      const pad = 8, barW = 120, barH = 10;
      ctx.fillStyle = 'rgba(20,20,40,0.85)'; ctx.fillRect(pad, pad, 160, 80);
      ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, 160, 80);
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = C.white || '#fff';
      ctx.fillText(`${player.name}  Lv.${player.level}`, pad + 8, pad + 16);
      ctx.fillStyle = C.hpBg || '#555'; ctx.fillRect(pad + 8, pad + 24, barW, barH); ctx.fillStyle = C.hpFill || '#e74c3c'; ctx.fillRect(pad + 8, pad + 24, barW * (player.hp / player.maxHp), barH);
      ctx.fillStyle = C.white || '#fff'; ctx.font = '9px monospace'; ctx.fillText(`HP ${player.hp}/${player.maxHp}`, pad + 10, pad + 32);
      ctx.fillStyle = C.hpBg || '#555'; ctx.fillRect(pad + 8, pad + 38, barW, barH); ctx.fillStyle = C.mpFill || '#3498db'; ctx.fillRect(pad + 8, pad + 38, barW * (player.mp / player.maxMp), barH);
      ctx.fillStyle = C.white || '#fff'; ctx.fillText(`MP ${player.mp}/${player.maxMp}`, pad + 10, pad + 46);
      ctx.fillStyle = C.hpBg || '#555'; ctx.fillRect(pad + 8, pad + 52, barW, barH); ctx.fillStyle = C.xpFill || '#f1c40f'; ctx.fillRect(pad + 8, pad + 52, barW * (player.xp / player.maxXp), barH);
      ctx.fillStyle = C.white || '#fff'; ctx.fillText(`XP ${player.xp}/${player.maxXp}`, pad + 10, pad + 60);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '9px monospace';
      const weaponName = player.equippedWeapon ? ITEMS[player.equippedWeapon].name : 'Fists';
      ctx.fillText(`ATK: ${getPlayerAtk()}  [${weaponName}]`, pad + 8, pad + 74);
      if (player.hasGun) { ctx.fillStyle = 'rgba(20,20,40,0.7)'; ctx.fillRect(pad, pad + 86, 70, 18); ctx.strokeStyle = '#55ddff'; ctx.strokeRect(pad, pad + 86, 70, 18); ctx.fillStyle = player.gunCooldown > 0 ? '#555' : '#55ddff'; ctx.font = '9px monospace'; ctx.fillText('F: Gun', pad + 4, pad + 98); }
      // Area name - measured
      ctx.font = 'bold 12px monospace'; const areaName = currentMap().name;
      const nameW = ctx.measureText(areaName).width + 20;
      ctx.fillStyle = 'rgba(20,20,40,0.7)'; ctx.fillRect(canvas.width - nameW - pad, pad, nameW, 22);
      ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.strokeRect(canvas.width - nameW - pad, pad, nameW, 22);
      ctx.fillStyle = C.uiBorder || '#e8c170'; ctx.textAlign = 'right'; ctx.fillText(areaName, canvas.width - pad - 8, pad + 15);
      // Controls
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      ctx.fillText('WASD:Move  Shift:Run  E:Dash  F:Shoot  Space:Talk  I:Inv', canvas.width - pad, canvas.height - pad);
      // Message
      if (currentMessage) {
        ctx.font = '11px monospace'; const msgW = ctx.measureText(currentMessage).width + 24;
        ctx.fillStyle = 'rgba(20,20,40,0.9)'; ctx.fillRect(canvas.width / 2 - msgW / 2, canvas.height - 44, msgW, 24);
        ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.strokeRect(canvas.width / 2 - msgW / 2, canvas.height - 44, msgW, 24);
        ctx.fillStyle = C.white || '#fff'; ctx.textAlign = 'center'; ctx.fillText(currentMessage, canvas.width / 2, canvas.height - 28);
      }
    }

    function drawDialogue() {
      if (!dialogueState) return;
      const npc = dialogueState.npc, text = npc.dialogue[dialogueState.line];
      const boxH = 80, boxY = canvas.height - boxH - 8;
      ctx.fillStyle = 'rgba(20,20,40,0.92)'; ctx.fillRect(8, boxY, canvas.width - 16, boxH);
      ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.lineWidth = 2; ctx.strokeRect(8, boxY, canvas.width - 16, boxH);
      ctx.fillStyle = C.uiBorder || '#e8c170'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText(npc.name, 20, boxY + 20);
      ctx.fillStyle = C.white || '#fff'; ctx.font = '12px monospace';
      const words = text.split(' '); let line = '', lineY = boxY + 40;
      for (const word of words) { const test = line + word + ' '; if (ctx.measureText(test).width > canvas.width - 48) { ctx.fillText(line, 20, lineY); line = word + ' '; lineY += 16; } else line = test; }
      ctx.fillText(line, 20, lineY);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      ctx.fillText(dialogueState.line < npc.dialogue.length - 1 ? '[Space] Continue' : '[Space] Close', canvas.width - 20, boxY + boxH - 8);
    }

    function drawInventory() {
      if (!inventoryOpen) return;
      const w = 280, h = 300, ox = (canvas.width - w) / 2, oy = (canvas.height - h) / 2;
      ctx.fillStyle = 'rgba(15,15,30,0.94)'; ctx.fillRect(ox, oy, w, h);
      ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, w, h);
      ctx.fillStyle = C.uiBorder || '#e8c170'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('INVENTORY', ox + w / 2, oy + 22);
      const inv = getInventoryDisplay();
      if (inv.length === 0) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.fillText('Empty', ox + w / 2, oy + 80); }
      else {
        const rowH = 28, maxV = Math.floor((h - 70) / rowH), scroll = Math.max(0, inventoryCursor - maxV + 1);
        for (let i = 0; i < Math.min(inv.length, maxV); i++) {
          const idx = i + scroll; if (idx >= inv.length) break;
          const entry = inv[idx], ry = oy + 44 + i * rowH;
          if (idx === inventoryCursor) { ctx.fillStyle = 'rgba(232,193,112,0.15)'; ctx.fillRect(ox + 6, ry - 4, w - 12, rowH - 2); ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.lineWidth = 1; ctx.strokeRect(ox + 6, ry - 4, w - 12, rowH - 2); }
          drawItemIcon(ox + 14, ry - 1, entry.id, 18);
          ctx.fillStyle = C.white || '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(entry.item.name, ox + 38, ry + 12);
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'right'; ctx.fillText(`x${entry.qty}`, ox + w - 14, ry + 12);
        }
        if (inv[inventoryCursor]) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(inv[inventoryCursor].item.desc, ox + w / 2, oy + h - 20); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('[I] Close  [W/S] Navigate  [Space] Equip/Use', ox + w / 2, oy + h - 4);
    }

    function drawTradeMenu() {
      if (!tradeOpen || !tradeNpc) return;
      const w = 340, h = 260, ox = (canvas.width - w) / 2, oy = (canvas.height - h) / 2;
      ctx.fillStyle = 'rgba(15,15,30,0.94)'; ctx.fillRect(ox, oy, w, h);
      ctx.strokeStyle = C.uiBorder || '#e8c170'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, w, h);
      ctx.fillStyle = C.uiBorder || '#e8c170'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${tradeNpc.name}'s Trades`, ox + w / 2, oy + 22);
      const trades = tradeNpc.trades, startY = oy + 46, rowH = 32;
      for (let i = 0; i < trades.length; i++) {
        const t = trades[i], ry = startY + i * rowH, has = countItem(t.give) >= t.giveQty;
        if (i === tradeCursor) { ctx.fillStyle = 'rgba(232,193,112,0.15)'; ctx.fillRect(ox + 6, ry - 4, w - 12, rowH - 2); }
        drawItemIcon(ox + 14, ry, t.give, 16);
        ctx.fillStyle = has ? '#5cb85c' : '#cc5555'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${t.giveQty}x`, ox + 34, ry + 12);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('-->', ox + w / 2 - 20, ry + 12);
        drawItemIcon(ox + w / 2 + 14, ry, t.receive, 16);
        ctx.fillStyle = C.white || '#fff'; ctx.fillText(`${t.receiveQty}x`, ox + w / 2 + 34, ry + 12);
        ctx.fillStyle = has ? 'rgba(92,184,92,0.7)' : 'rgba(200,80,80,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.fillText(`(have ${countItem(t.give)})`, ox + w - 14, ry + 12);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('[W/S] Navigate  [Space] Trade  [Esc] Close', ox + w / 2, oy + h - 10);
    }

    function drawTransition() { if (!transitioning) return; const alpha = transitionAlpha <= 1 ? transitionAlpha : 2 - transitionAlpha; ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    function drawWinScreen(dt) {
      winTimer += dt;
      const fade = Math.min(winTimer / 1.5, 1);
      ctx.fillStyle = `rgba(0,0,0,${fade * 0.85})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (winTimer < 0.5) return;
      const textFade = Math.min((winTimer - 0.5) / 1, 1);
      ctx.globalAlpha = textFade;
      // Stars
      const starCount = 12;
      for (let i = 0; i < starCount; i++) {
        const sx = 80 + ((i * 137 + 50) % (canvas.width - 160));
        const sy = 60 + ((i * 89 + 30) % (canvas.height - 120));
        const twinkle = Math.sin(Date.now() / 400 + i * 2) * 0.4 + 0.6;
        ctx.globalAlpha = textFade * twinkle;
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = textFade;
      // Title
      const wt = winCfg.title || 'VICTORY!';
      ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = C.uiBorder || '#e8c170';
      const titleY = canvas.height / 2 - 40 + Math.sin(Date.now() / 1000) * 3;
      ctx.fillText(wt, canvas.width / 2, titleY);
      // Message
      const wm = winCfg.message || 'You completed the quest!';
      ctx.font = '14px monospace'; ctx.fillStyle = C.white || '#fff';
      // Word wrap
      const words = wm.split(' '); let line = '', lineY = canvas.height / 2 + 10;
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > canvas.width - 100) { ctx.fillText(line, canvas.width / 2, lineY); line = word + ' '; lineY += 20; }
        else line = test;
      }
      ctx.fillText(line, canvas.width / 2, lineY);
      // Stats
      if (winTimer > 2) {
        const statFade = Math.min((winTimer - 2) / 1, 1);
        ctx.globalAlpha = statFade * textFade;
        ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`Level ${player.level}  |  ${player.name}`, canvas.width / 2, canvas.height / 2 + 70);
      }
      ctx.globalAlpha = 1;
    }

    // --- Game Loop ---
    let lastTime = 0;
    function gameLoop(time) {
      const dt = Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
      if (!gameWon) update(dt);
      const map = currentMap();
      // Draw tiles
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const t = map.tiles[y][x], px = x * TILE, py = y * TILE;
        drawTileFn(ctx, t, x, y, px, py, TILE, C);
      }
      drawGroundItems();
      // Y-sorted entities
      const entities = [];
      map.npcs.forEach(n => entities.push({ type: 'npc', y: n.y, obj: n }));
      (MAP_ENEMIES[currentMapId] || []).forEach(e => { if (e.alive) entities.push({ type: 'enemy', y: e.y, obj: e }); });
      const py = player.moving ? lerp(player.fromY, player.y, player.moveT) : player.y;
      entities.push({ type: 'player', y: py });
      entities.sort((a, b) => a.y - b.y);
      for (const e of entities) {
        if (e.type === 'player') drawPlayer();
        else if (e.type === 'npc') { drawCharacter(e.obj.x, e.obj.y, e.obj.color, e.obj.dir, 0); ctx.fillStyle = C.white || '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(e.obj.name, e.obj.x * TILE + 16, e.obj.y * TILE - 2); }
        else if (e.type === 'enemy') drawOneEnemy(e.obj);
      }
      // Redraw tree tiles on top
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (TREE_TILES.has(map.tiles[y][x])) drawTileFn(ctx, map.tiles[y][x], x, y, x * TILE, y * TILE, TILE, C);
      }
      drawProjectiles(); drawParticles(); drawDamageFloats();
      drawUI(); drawDialogue(); drawInventory(); drawTradeMenu(); drawTransition();
      if (gameWon) drawWinScreen(dt);
      requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);

    // Debug API (access via window.RPG_DEBUG)
    window.RPG_DEBUG = {
      teleport(mapId, x, y) { currentMapId = mapId; player.x = x; player.y = y; player.fromX = x; player.fromY = y; player.moving = false; },
      getPlayer() { return { x: player.x, y: player.y, map: currentMapId, hp: player.hp, inv: player.inventory }; },
      giveItem(id) { player.inventory.push(id); checkWinCondition(); },
      setFlag(f) { setFlag(f); },
    };
  }
};
