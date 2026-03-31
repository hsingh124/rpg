const fs = require('fs');
let html = fs.readFileSync('editor.html', 'utf8');

// 1. Add btnPlay
html = html.replace('<button id="btnExport" class="primary" style="font-weight:700">▶ Export</button>', 
  '<button id="btnExport" class="primary">Export</button>\n  <button id="btnPlay" class="success" style="font-weight:700">▶ Play</button>');

// 2. Replace drawSingleTile
const newDrawSingleTile = `function drawSingleTile(ctx, type, x, y, px, py) {
  const info = TILE_INFO[type] || TILE_INFO[0];
  // Base color
  if (info.color2 && (x+y)%2) {
    ctx.fillStyle = info.color2;
  } else {
    ctx.fillStyle = info.color;
  }
  ctx.fillRect(px, py, TILE, TILE);

  const t = 0; // static rendering for editor
  const C = {}; // Fallback colors

  switch(type) {
    case 0: // grass
      if ((x*7+y*13)%11 < 3) { ctx.fillStyle = C.grass2||'#3d6b31'; ctx.fillRect(px+8,py+22,2,5); ctx.fillRect(px+14,py+20,2,6); ctx.fillRect(px+20,py+23,2,4); }
      break;
    case 1: // wall bricks
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py+TILE-4, TILE, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
      ctx.strokeRect(px+1, py+1, TILE/2-1, TILE/2-1);
      ctx.strokeRect(px+TILE/2, py+TILE/2, TILE/2-1, TILE/2-1);
      break;
    case 2: // water shimmer
      const wv = Math.sin(t/600+x*2+y*3)*0.15;
      ctx.fillStyle = \`rgba(255,255,255,\${0.08+wv})\`; ctx.fillRect(px+4, py+8+Math.sin(t/800+x)*4, 12, 3);
      ctx.fillStyle = \`rgba(255,255,255,\${0.05+wv*0.5})\`; ctx.fillRect(px+14, py+20+Math.sin(t/900+y)*3, 10, 2);
      break;
    case 3: // path specks
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      if ((x+y*3)%5===0) ctx.fillRect(px+6,py+10,4,3);
      if ((x*2+y)%7===0) ctx.fillRect(px+16,py+20,5,3);
      break;
    case 4: // tree
      ctx.fillStyle = C.trunk||'#6b4226'; ctx.fillRect(px+13, py+18, 6, 14);
      ctx.fillStyle = C.tree||'#2d5a1e';
      ctx.beginPath(); ctx.arc(px+16, py+12, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,50,0,0.25)';
      ctx.beginPath(); ctx.arc(px+13, py+10, 7, 0, Math.PI*2); ctx.fill();
      break;
    case 5: // door
      ctx.fillStyle = C.door||'#5a3a1a'; ctx.fillRect(px+4, py+2, 24, 28);
      ctx.fillStyle = C.uiBorder||'#e8c170'; ctx.fillRect(px+20, py+14, 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px+4, py+2, 24, 3);
      break;
    case 6: // roof lines
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < TILE; i += 8) ctx.fillRect(px, py+i, TILE, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px, py+TILE-2, TILE, 2);
      break;
    case 7: // sand
      if ((x*5+y*3)%9<2) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.beginPath(); ctx.arc(px+10+((x*7)%12), py+12+((y*5)%10), 3, 0, Math.PI*2); ctx.fill(); }
      break;
    case 8: // dungeon floor
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.strokeRect(px+1, py+1, TILE-2, TILE-2);
      break;
    case 9: // lava glow
      const lv = Math.sin(t/400+x*3+y*2)*0.3;
      ctx.fillStyle = \`rgba(255,200,0,\${0.3+lv})\`; ctx.fillRect(px+2, py+4+Math.sin(t/500+x)*6, 14, 6);
      ctx.fillStyle = \`rgba(255,100,0,\${0.2+lv*0.5})\`; ctx.fillRect(px+12, py+16+Math.sin(t/600+y)*4, 12, 5);
      break;
    case 10: // cave floor
      if ((x*3+y*7)%9<2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(px+4, py+4, 8, 6); }
      break;
    case 11: // cave wall shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px, py+TILE-6, TILE, 6);
      ctx.fillStyle = 'rgba(100,80,60,0.12)'; ctx.fillRect(px+3, py+5, 10, 6);
      break;
    case 12: // stalagmite spike
      ctx.fillStyle = C.caveWall||'#2a2520';
      ctx.beginPath(); ctx.moveTo(px+10, py+TILE); ctx.lineTo(px+16, py+4); ctx.lineTo(px+22, py+TILE); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px+15, py+8, 2, 12);
      break;
    case 13: // dungeon wall
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(px, py+TILE-5, TILE, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
      ctx.strokeRect(px+2, py+2, TILE-4, TILE/2-2);
      break;
    case 14: // bones
      ctx.fillStyle = '#c8c0b0';
      ctx.fillRect(px+6, py+14, 14, 3); ctx.fillRect(px+10, py+10, 3, 10);
      ctx.beginPath(); ctx.arc(px+12, py+10, 4, 0, Math.PI*2); ctx.fill();
      break;
    case 15: // snow
      if ((x*3+y*11)%8<2) { ctx.fillStyle = 'rgba(200,210,255,0.3)'; ctx.beginPath(); ctx.arc(px+8+((x*7)%16), py+10+((y*5)%12), 2, 0, Math.PI*2); ctx.fill(); }
      break;
    case 16: // ice
      const iv = Math.sin(t/1000+x+y)*0.1;
      ctx.fillStyle = \`rgba(255,255,255,\${0.15+iv})\`; ctx.fillRect(px+3, py+5, 10, 4);
      ctx.fillStyle = \`rgba(255,255,255,\${0.1+iv*0.5})\`; ctx.fillRect(px+16, py+18, 8, 3);
      break;
    case 17: // pine tree
      ctx.fillStyle = C.trunk||'#6b4226'; ctx.fillRect(px+14, py+22, 4, 10);
      ctx.fillStyle = C.pine||'#1a5028';
      ctx.beginPath(); ctx.moveTo(px+16, py+2); ctx.lineTo(px+26, py+16); ctx.lineTo(px+6, py+16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px+16, py+8); ctx.lineTo(px+28, py+24); ctx.lineTo(px+4, py+24); ctx.fill();
      break;
    case 18: // flowers
      const fc = ['#e55','#e8e','#ee5','#5be','#f90'];
      for (let i = 0; i < 4; i++) {
        const fx = px+6+((x*7+i*11)%20), fy = py+6+((y*5+i*13)%20);
        ctx.fillStyle = fc[(x+y+i)%fc.length];
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2d5a1e'; ctx.fillRect(fx-0.5, fy+3, 1.5, 4);
      }
      break;
    case 19: // bridge
      ctx.fillStyle = C.bridge||'#8b6914'; ctx.fillRect(px, py+2, TILE, TILE-4);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(px, py+10, TILE, 2); ctx.fillRect(px, py+20, TILE, 2);
      break;
    case 20: // dark grass
      if ((x*9+y*3)%7<2) { ctx.fillStyle = 'rgba(0,40,0,0.2)'; ctx.fillRect(px+6,py+18,3,8); ctx.fillRect(px+18,py+16,3,10); }
      break;
    case 21: // cobblestone
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(px+1, py+1, 14, 14); ctx.strokeRect(px+16, py+1, 14, 14);
      ctx.strokeRect(px+8, py+16, 14, 14);
      break;
    case 22: // carpet
      ctx.strokeStyle = C.carpetBorder||'#c4a55a'; ctx.lineWidth = 1; ctx.strokeRect(px+2, py+2, TILE-4, TILE-4);
      break;
    case 23: // bookshelf
      const bc = ['#8b3030','#3050a0','#2a7030','#8b6014','#604080'];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillStyle = bc[(x+y+row+col)%bc.length];
          ctx.fillRect(px+2+col*7, py+2+row*10, 6, 8);
        }
      }
      break;
    case 24: // fence
      ctx.fillStyle = C.fence||'#b89a6a';
      ctx.fillRect(px, py+10, TILE, 3); ctx.fillRect(px, py+20, TILE, 3);
      ctx.fillRect(px+4, py+6, 3, 20); ctx.fillRect(px+25, py+6, 3, 20);
      break;
  }
}`;

html = html.replace(/function drawSingleTile\(ctx, type, x, y, px, py\) \{[\s\S]*?    \}\n  \}\n\}/, newDrawSingleTile);

// 3. Add playProject function and bind it
const playProjFn = `function playProject() {
  const cfg = generateExport();
  const cfgStr = configToJs(cfg, 2);
  const engineUrl = new URL('rpg-engine.js', window.location.href).href;
  const gameHtml = \`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\${project.title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{image-rendering:pixelated;border:2px solid #333}</style>
</head><body><canvas id="game"></canvas>
<script src="\${engineUrl}"><\\/script>
<script>
RPG.create(\${cfgStr});
<\\/script></body></html>\`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(gameHtml);
    win.document.close();
  } else {
    alert("Popup blocked! Please allow popups to play the game.");
  }
}

function showExport() {`;

html = html.replace('function showExport() {', playProjFn);
html = html.replace("document.getElementById('btnExport').addEventListener('click', showExport);", "document.getElementById('btnExport').addEventListener('click', showExport);\ndocument.getElementById('btnPlay').addEventListener('click', playProject);");

fs.writeFileSync('editor.html', html);
console.log('Patched editor.html successfully.');
