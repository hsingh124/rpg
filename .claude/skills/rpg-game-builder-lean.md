# RPG Game Builder (Lean)

Build a 2D top-down RPG as a single `index.html`. Vanilla JS + Canvas 2D API. No dependencies.

## VALIDATION — Check before outputting

1. Every `exitTiles` position is NOT in SOLID. E.g., `exitTiles:{east:[6,7]}` → `tiles[6][19]` and `tiles[7][19]` must be walkable
2. Every map in MAPS is reachable from the starting map via exits/portals
3. Exits are bidirectional — A→B means B→A exists
4. Every DOOR_PORTALS (x,y) has tile 5 in that map's tiles grid. NOT 0, NOT floor — exactly 5
5. Interior exit doors are on walkable tiles, not buried in solid walls
6. Path tiles (3) connect to exit edges — no isolated center loops
7. No entity overlap: no enemy+item on same tile, no NPC on door tile or blocking only path
8. `handleInteract`: NPCs checked BEFORE door portals on facing tile
9. NPC quest property is `questGive` — not `quest` or anything else
10. player.x/y stay as integers. Dash uses lerp only for DRAWING
11. Area name box uses `ctx.measureText()`, never fixed pixel width
12. All input uses `e.code` (e.g., `'KeyW'`), never `e.key`

## Ask the user

1. Theme/setting 2. Story 3. Maps (3-5, what biomes) 4. Layout (hub-and-spoke or linear) 5. NPCs 6. Combat (dash-slash / ranged gun / none) 7. Enemies 8. Weapons 9. Items 10. Trading 11. Player name/stats 12. Color palette 13. Enterable buildings (locked?) 14. Quests 15. Special mechanics

## Architecture

```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TITLE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{image-rendering:pixelated;border:2px solid #333}</style>
</head><body><canvas id="game"></canvas><script>
// ALL CODE HERE
</script></body></html>
```

## Core

```js
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const TILE=32,COLS=20,ROWS=15;
canvas.width=COLS*TILE; canvas.height=ROWS*TILE;
```

## Colors — single C object

```js
const C={grass:'#4a7a3b',grass2:'#3d6b31',path:'#c4a55a',water:'#3b6d9e',
wall:'#7a6652',roof:'#8b3a3a',door:'#5a3a1a',tree:'#2d5a1e',trunk:'#6b4226',
player:'#e8c170',npc:'#7eb8da',npc2:'#da7e7e',npc3:'#7eda8e',
shadow:'rgba(0,0,0,0.2)',uiBorder:'#e8c170',hpFill:'#e74c3c',hpBg:'#555',
mpFill:'#3498db',xpFill:'#f1c40f',white:'#fff'};
```

## Tiles — integers, 20x15 grid

```js
// 0=grass 1=wall 2=water 3=path 4=tree 5=door 6=roof 7=sand 8=dungeon_floor
// 9=lava 10=cave_floor 11=cave_wall 12=stalagmite 13=dungeon_wall 14=bones
const SOLID=new Set([1,2,4,6,9,11,12,13,17]);
```

Rules: each biome needs floor+wall+2 decorative tiles. Use `(x+y)%2` for checkerboard floors. Animate with `Math.sin(Date.now()/speed)`. Trees redrawn after entities for depth.

## Maps

```js
const MAPS={
  village:{name:'Name',
    tiles:[[/*20 ints*/],/*...15 rows*/],
    npcs:[{x:4,y:5,name:'Elder',color:C.npc,dir:0,dialogue:["Line1","Line2"]}],
    exits:{north:{map:'forest',spawnX:9,spawnY:13}},
    exitTiles:{north:[8,9]}
  }
};
```

**CRITICAL**: Exit edge tiles MUST be walkable (replace border tree/wall with path at exit positions). Paths must connect interior to exits. All maps reachable. Exits bidirectional. SpawnX/Y must be walkable.

## Items

```js
const ITEMS={
  herb:{name:'Herb',color:'#5cb85c',icon:'herb',desc:'Heals 5 HP.'},
  sword:{name:'Sword',color:'#a08050',icon:'sword',desc:'+3 ATK',weapon:true,atk:3},
  gun:{name:'Gun',color:'#55ddff',icon:'gun',desc:'Press F to fire!'},
};
const MAP_ITEMS={village:[{x:1,y:9,item:'herb'}]};
```

Icons: herb(arc+rect), potion(rect+arc), coin(arc), sword(rects), gun(rects), crystal(triangle), feather(quadraticCurveTo), key(arc+rects). Gun sets `player.hasGun=true`.

## Enemies

```js
const ENEMY_TYPES={
  slime:{name:'Slime',color:'#5cb85c',hp:8,atk:2,xp:10,speed:0.8,drops:['herb']}
};
const MAP_ENEMIES={village:[]};// village=safe!
```

Each type needs unique canvas visual. AI: chase within 5 Manhattan tiles, else random wander. Adjacent+no iFrames → damage player. Death: alive=false, award XP, drop item, burst particles.

## Player

```js
const player={x:9,y:9,dir:0,hp:20,maxHp:20,mp:10,maxMp:10,xp:0,maxXp:50,level:1,
name:'Hero',moving:false,moveT:0,fromX:9,fromY:9,
animFrame:0,animTimer:0,speed:6,runSpeed:12,
inventory:[],gold:0,baseAtk:2,equippedWeapon:null,
attacking:false,attackTimer:0,attackCooldown:0,hurtTimer:0,iFrames:0,
dashing:false,dashTimer:0,dashDuration:0.15,
dashFromX:0,dashFromY:0,dashToX:0,dashToY:0,dashDist:3,
hasGun:false,gunCooldown:0};
```

Level up: maxHp+=5, maxMp+=3, baseAtk+=1, maxXp*=1.5. Death: reset HP, teleport to start.

## Input — use e.code, NOT e.key

```js
let keys={},keyOrder=[];
window.addEventListener('keydown',e=>{
  const c=e.code;
  if(!keys[c]){keys[c]=true;keyOrder.push(c);}
  // Handle Space/Enter→handleInteract, I/Tab→inventory, E/X→dash, F→gun, Esc→close
});
window.addEventListener('keyup',e=>{const c=e.code;keys[c]=false;keyOrder=keyOrder.filter(k=>k!==c);});
```

Movement reads keyOrder from END for latest-key-wins priority:
```js
let dx=0,dy=0;
for(let i=keyOrder.length-1;i>=0;i--){const k=keyOrder[i];
  if(k==='ArrowUp'||k==='KeyW'){dy=-1;player.dir=3;break;}
  if(k==='ArrowDown'||k==='KeyS'){dy=1;player.dir=0;break;}
  if(k==='ArrowLeft'||k==='KeyA'){dx=-1;player.dir=1;break;}
  if(k==='ArrowRight'||k==='KeyD'){dx=1;player.dir=2;break;}}
```

Run: `keys['ShiftLeft']||keys['ShiftRight']` → use runSpeed.

## Movement — tile-to-tile with lerp

```js
if(player.moving){
  const spd=(keys['ShiftLeft']||keys['ShiftRight'])?player.runSpeed:player.speed;
  player.moveT+=dt*spd;
  if(player.moveT>=1){player.moving=false;player.moveT=0;tryPickupItem();checkDoorPortalAuto();checkScreenTransition();}
  return;
}
```

## Flags & Quests

```js
const gameFlags={};
function setFlag(f){gameFlags[f]=true;}
function hasFlag(f){return !!gameFlags[f];}
```

Quest NPCs use `questGive` (EXACT name):
```js
{x:5,y:5,name:'Nomad',color:C.npc,dir:0,
  questGive:{flag:'temple_key',item:'temple_key'},
  dialogue:["Line1","Line2","Take this key."]}
```

## Door Portals

```js
const DOOR_PORTALS={
  desert:[{x:5,y:4,map:'temple_interior',spawnX:9,spawnY:13,
    locked:true,unlockFlag:'temple_key',lockedMsg:"It's sealed."}],
  temple_interior:[{x:9,y:14,map:'desert',spawnX:5,spawnY:5,locked:false}]
};
```

**CRITICAL**: tiles[portal.y][portal.x] MUST === 5. Interior exit doors must be on walkable tiles (replace wall if needed). Never lock exit portals. Never place NPCs on portal tiles.

```js
function checkDoorPortalAuto(){
  const tile=currentMap().tiles[player.y]?.[player.x];
  if(tile!==5)return;
  const portals=DOOR_PORTALS[currentMapId];if(!portals)return;
  for(const p of portals){if(p.x===player.x&&p.y===player.y){
    if(p.locked&&!hasFlag(p.unlockFlag)){showMessage(p.lockedMsg||"Locked.");return;}
    startTransition({map:p.map,spawnX:p.spawnX,spawnY:p.spawnY});return;}}
}
```

## handleInteract — EXACT order

```js
function handleInteract(){
  if(dialogueState){
    dialogueState.line++;
    if(dialogueState.line>=dialogueState.npc.dialogue.length){
      if(dialogueState.npc.questGive&&!hasFlag(dialogueState.npc.questGive.flag)){
        setFlag(dialogueState.npc.questGive.flag);
        if(dialogueState.npc.questGive.item){
          player.inventory.push(dialogueState.npc.questGive.item);
          showMessage('Received '+ITEMS[dialogueState.npc.questGive.item].name+'!');}}
      if(dialogueState.npc.trader){tradeOpen=dialogueState.npc;tradeIndex=0;}
      dialogueState=null;}
    return;}
  tryPickupItem();
  if(tryDoorPortal(player.x,player.y))return;
  let tx=player.x,ty=player.y;
  if(player.dir===0)ty++;else if(player.dir===3)ty--;
  else if(player.dir===1)tx--;else tx++;
  // NPCs FIRST on facing tile
  for(const npc of currentMap().npcs){if(npc.x===tx&&npc.y===ty){dialogueState={npc,line:0};return;}}
  // Door portals SECOND on facing tile
  if(tryDoorPortal(tx,ty))return;
}
```

## Combat

**Dash-slash**: Zoom dashDist tiles (3), damage enemies in path, afterimage+particles, iFrames. player.x/y stay as integers — use lerp(dashFromX,dashToX,t) ONLY for drawing. At dash end: `player.x=player.dashToX; player.y=player.dashToY;` Cooldown 0.3s.

**Gun**: Press F, projectile at 500px/s, trail array, wall/enemy collision, 0.4s cooldown. Requires player.hasGun (set by picking up gun item).

**Particles**: `{x,y,vx,vy,life,color,size}` — move, shrink(*0.95), fade. Spawn for: hits(white), deaths(enemy color), dash trail, gun muzzle/impact.

**Damage floats**: `{x,y,text,color,timer}` — float up, fade out.

## Draw Order

1. Tiles 2. Ground items (bob+glow) 3. Entities sorted by Y (NPCs, enemies, player) 4. Trees redrawn on top 5. Projectiles 6. Particles 7. Damage floats 8. HUD 9. Dialogue 10. Inventory/Trade 11. Transition overlay

## Characters

```js
function drawCharacter(x,y,color,dir,frame){
  const px=x*TILE,py=y*TILE;
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();
  ctx.ellipse(px+16,py+30,10,4,0,0,Math.PI*2);ctx.fill();
  const bob=Math.sin(frame*Math.PI*0.5)*1.5;
  ctx.fillStyle=color;ctx.fillRect(px+8,py+10+bob,16,16);
  ctx.fillStyle='#f5d5a0';ctx.fillRect(px+10,py+2+bob,12,12);
  ctx.fillStyle='#333';
  if(dir===0){ctx.fillRect(px+12,py+6+bob,3,3);ctx.fillRect(px+17,py+6+bob,3,3);}
  else if(dir===3){ctx.fillStyle=color;ctx.fillRect(px+10,py+2+bob,12,5);}
  else if(dir===1){ctx.fillRect(px+11,py+6+bob,3,3);}
  else{ctx.fillRect(px+18,py+6+bob,3,3);}
  ctx.fillStyle='#5a4a3a';
  ctx.fillRect(px+10,py+26+bob,5,6);ctx.fillRect(px+17,py+26+bob,5,6);
}
```

## HUD

Area name box — dynamic width:
```js
ctx.font='bold 12px monospace';
const nameW=ctx.measureText(currentMap().name).width+20;
ctx.fillRect(canvas.width-nameW-8,8,nameW,24);
```

Stats box top-left: name+level, HP/MP/XP bars, ATK+weapon. Gun indicator below if hasGun. Controls hint bottom-right.

## Transitions

Fade to black: transitionAlpha 0→1 (fade out), swap map+spawn, 1→2 (fade in).

## Game Loop

```js
let lastTime=0;
function gameLoop(time){
  const dt=Math.min((time-lastTime)/1000,0.05);lastTime=time;
  update(dt);draw();requestAnimationFrame(gameLoop);}
requestAnimationFrame(gameLoop);
```

Update order: transition check → timers → dash → particles → projectiles → enemy AI → (if menu open, return) → player movement.
