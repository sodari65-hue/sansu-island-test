import { FIELD, CAVE, GATES, TREASURE, HOUSES, NPC, PORTAL, QUEST_NPC, DUNGEON_SPOTS, BOSS_SPOTS, tile, hash } from './core.js';
import { regionOf, domainName } from './regions.js';
import { paintEnemy } from './enemy-art.js';

// All art is drawn locally in Canvas2D. No engine, texture download or 3D context.
export function createRenderer(canvas){
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('このブラウザでは2D画面を表示できません。');
  let width = 0, height = 0, dpr = 1, unit = 48;
  const camera = { x: FIELD.spawn.x, y: FIELD.spawn.y };
  function resize(){
    width = canvas.clientWidth; height = canvas.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    unit = Math.min(54, Math.max(34, height / 14));
  }
  function oval(x, y, rx, ry, color){ ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function rect(x, y, w, h, color){ ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function line(points, color, width = 2){ ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  function label(text, x, y, color = '#fffcdf'){
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    rect(x - w / 2 - 8, y - 11, w + 16, 23, '#213e36d9'); ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
  }
  function tree(x, y, region){
    oval(x + 5, y + 5, 23, 9, '#163a3433'); rect(x - 4, y - 30, 8, 35, '#795838');
    if (region.theme==='volcano'){ line([[x - 16, y - 43], [x, y - 24], [x + 16, y - 38]], '#795838', 5); return; }
    if (region.theme==='coast'){
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;line([[x,y-45],[x+Math.cos(a)*18,y-50+Math.sin(a)*12],[x+Math.cos(a)*30,y-43+Math.sin(a)*20]],'#508c68',8);}return;
    }
    if (['snow','mountain'].includes(region.theme)){
      for(let i=0;i<3;i++){ctx.fillStyle=region.theme==='snow'?'#f2f3df':region.tree;ctx.beginPath();ctx.moveTo(x,y-76+i*15);ctx.lineTo(x-24+i*3,y-28+i*8);ctx.lineTo(x+24-i*3,y-28+i*8);ctx.fill();}return;
    }
    oval(x + 4, y - 37, 27, 26, '#34664c'); oval(x - 8, y - 49, 23, 22, '#477d51'); oval(x + 4, y - 59, 18, 15, '#649450');
    oval(x - 10, y - 57, 6, 3, '#92b568');
  }
  function mushroom(x, y, state, t, walking = false, npc = false){
    const bob = walking ? Math.sin(t * 13) * 2 : Math.sin(t * 2) * .6;
    oval(x, y + 3, 18, 7, '#173c3544');
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(state.facing || 1, 1);
    const foot = walking ? Math.sin(t * 13) * 3 : 0;
    oval(-7, -1 + foot, 6, 4, '#654b38'); oval(7, -1 - foot, 6, 4, '#654b38');
    oval(0, -17, 14, 19, '#f9e8b2'); oval(-4, -19, 9, 16, '#fff3cc');
    // Handle runs into the palm, with the fingers painted on top.
    line([[10, -20], [21, -18]], '#e9d092', 7);
    if (!npc && state.item === 'wand'){
      line([[22, -11], [26, -42]], '#835938', 5);
      ctx.save(); ctx.translate(28, -46); ctx.fillStyle = '#f6cc63'; ctx.beginPath();
      for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 12; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.fill(); oval(-1, -2, 3, 3, '#fff2a5'); ctx.restore();
    } else if (!npc){
      line([[23, -18], [23, -9]], '#5b5942', 3);
      const glow = ctx.createRadialGradient(23, 1, 1, 23, 1, 30); glow.addColorStop(0, '#ffe49980'); glow.addColorStop(1, '#ffe49900');
      oval(23, 1, 30, 30, glow); rect(17, -8, 13, 20, '#715e3e'); rect(19, -5, 9, 13, '#ffdc79'); rect(20, -4, 4, 11, '#fff2b7');
    }
    oval(20, -18, 5, 4, '#fff0bf');
    oval(-5, -24, 2, 3, '#353c36'); oval(5, -24, 2, 3, '#353c36');
    line([[-3, -17], [0, -15], [3, -17]], '#966342', 1.5);
    oval(0, -39, 25, 13, '#9e5345');
    ctx.fillStyle = npc ? '#91b973' : state.hat; ctx.beginPath(); ctx.ellipse(0, -42, 25, 23, 0, Math.PI, Math.PI * 2); ctx.lineTo(25, -39); ctx.quadraticCurveTo(0, -29, -25, -39); ctx.fill();
    oval(-10, -48, 6, 4, '#fff2cf'); oval(9, -52, 5, 5, '#fff2cf'); oval(17, -40, 4, 3, '#fff2cf'); ctx.restore();
  }
  function draw(state, foes, now, dt, moving){
    if (!width || width !== canvas.clientWidth || height !== canvas.clientHeight) resize();
    const map = state.map, bounds = map === 'cave' ? CAVE : FIELD;
    const region=regionOf(state.regionGrade||5);
    const clampCam = (p, size, view) => view >= size ? size / 2 : Math.max(view / 2, Math.min(size - view / 2, p));
    const tx = clampCam(state.x, bounds.width, width / unit), ty = clampCam(state.y - .5, bounds.height, height / unit);
    if (camera.map !== map) { camera.x = tx; camera.y = ty; camera.map = map; }
    camera.x += (tx - camera.x) * Math.min(1, dt * 10); camera.y += (ty - camera.y) * Math.min(1, dt * 10);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rect(0, 0, width, height, map === 'cave' ? '#242e39' : region.water);
    const ox = width / 2 - camera.x * unit, oy = height / 2 - camera.y * unit;
    const left = Math.max(0, Math.floor(-ox / unit) - 1), top = Math.max(0, Math.floor(-oy / unit) - 2);
    const right = Math.min(bounds.width, Math.ceil((width - ox) / unit) + 1), bottom = Math.min(bounds.height, Math.ceil((height - oy) / unit) + 3);
    const props = [];
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++){
      const type = tile(map, x, y, state.doors, region.grade), px = ox + x * unit, py = oy + y * unit, n = hash(x, y);
      let color;
      if (map === 'cave') color = type === 'wall' ? '#293644' : (n < .5 ? '#656b6b' : '#696f6e');
      else if (type === 'water'||type==='pond') color = region.water;
      else if (type === 'path') color = n < .5 ? '#d9c798' : '#decca0';
      else if (type === 'cliff') color = '#797966';
      else if(type==='lava')color=n<.5?'#d87948':'#bf643f';
      else if(type==='ice')color=n<.5?'#a4cbd3':'#b1d7dd';
      else if(type==='rock')color=n<.5?'#94988b':'#8a9081';
      else { const light=(n-.5)*9; color = `rgb(${region.ground.map(c=>Math.round(c+light)).join(',')})`; }
      rect(px, py, unit + .5, unit + .5, color);
      if (map === 'cave'){
        if (type === 'wall'){ rect(px + 2, py + 3, unit - 4, unit - 5, '#334451'); rect(px + 2, py + 3, unit - 4, 4, '#42515a'); }
        else { rect(px + 4, py + 4, unit - 8, 1, '#87908755'); if (n < .25) line([[px + 8, py + 13], [px + 13, py + 18], [px + 9, py + 22]], '#505d60'); }
      } else if (['water','pond','ice','lava'].includes(type)) { line([[px + 7, py + 20], [px + 20, py + 22], [px + 34, py + 20]], '#f2e6b477', 2); }
      else if (type === 'grass' || type === 'tree'){
        rect(px + unit * n, py + 14, 3, 5, '#73935c');
        if (n > .82 && x < 42){ oval(px + 16, py + 24, 3, 3, '#f9e5b1'); oval(px + 28, py + 36, 2, 2, '#fff7da'); }
      }
      if (type === 'tree') props.push({ y: y + 1, draw: () => tree(px + unit / 2, py + unit, region) });
    }
    const at = p => [ox + p.x * unit, oy + p.y * unit];
    if (map === 'field'){
      for (const h of HOUSES) props.push({ y: h.y + h.h, draw: () => {
        const x = ox + h.x * unit, y = oy + h.y * unit, w = h.w * unit, hgt = h.h * unit;
        rect(x + 9, y + hgt - 4, w, 14, '#45634433'); rect(x, y, w, hgt, '#efd7a2'); rect(x + w - 17, y, 17, hgt, '#d4b982');
        rect(x + w / 2 - 13, y + hgt - 51, 26, 51, '#775a3b'); rect(x + 18, y + hgt - 49, 30, 24, '#749990');
        line([[x + 33, y + hgt - 49], [x + 33, y + hgt - 25]], '#f6e4b0', 3);
        ctx.fillStyle = '#b5674f'; ctx.beginPath(); ctx.moveTo(x - 10, y + 15); ctx.lineTo(x + w / 2, y - 35); ctx.lineTo(x + w + 10, y + 15); ctx.closePath(); ctx.fill();
        line([[x - 10, y + 15], [x + w + 10, y + 15]], '#865541', 5);
      }});
      for(const spot of DUNGEON_SPOTS){
        const [ex,ey]=at(spot);
        oval(ex, ey - 33, 60, 48, region.theme==='snow'?'#b5c9c8':'#727562'); oval(ex, ey - 23, 36, 38, '#3b4440'); oval(ex, ey - 19, 25, 30, '#1d3335');
        rect(ex - 23, ey - 19, 46, 31, '#1d3335'); label(`${domainName(region.grade,spot.domain)}の どうくつ`, ex, ey - 88);
      }
      for(const spot of BOSS_SPOTS){
        const [x,y]=at(spot);rect(x-35,y-62,70,65,'#7c7c6e');rect(x-44,y-68,21,71,'#a5a28c');rect(x+23,y-68,21,71,'#a5a28c');
        rect(x-18,y-35,36,39,'#384c49');rect(x-31,y-88,4,26,'#5b675c');rect(x-27,y-88,26,14,region.accent);
        label(`${domainName(region.grade,spot.domain)}の ボス`,x,y-106);
      }
      props.push({ y: NPC.y, draw: () => { const [x, y] = at(NPC); mushroom(x, y, { facing: 1 }, now, false, true); label('あんないにん', x, y - 77); } });
      props.push({y:QUEST_NPC.y,draw:()=>{const[x,y]=at(QUEST_NPC);mushroom(x,y,{facing:-1},now,false,true);label('おねがいごと',x,y-77);}});
      const[px,py]=at(PORTAL);rect(px-4,py-36,8,40,'#7b6247');rect(px-27,py-48,54,24,region.accent);label('世界地図',px,py-65);
      for (const e of foes) if (!e.cooldown) props.push({ y: e.y, draw: () => { const [x, y] = at(e); paintEnemy(ctx, e.sid, x, y, now + e.x, .85, region.grade); } });
      label(`${region.name}の村`, ox + 14 * unit, oy + 22 * unit);
      label(`${region.grade}年の たんけんみち →`, ox + 28 * unit, oy + 25 * unit);
      label('↑ どうくつ', ox + 53 * unit, oy + 24 * unit);
    } else {
      GATES.forEach((gy, i) => {
        const x = ox + 10 * unit, y = oy + gy * unit;
        if (i >= state.doors){ rect(x, y + 9, unit * 3, unit - 10, '#705841'); for (let j = 0; j < 6; j++) rect(x + j * unit / 2 + 3, y + 12, unit / 2 - 6, unit - 15, '#ad9568'); rect(x, y + 18, unit * 3, 5, '#5a6055'); }
        else { rect(x, y, 8, unit, '#b1a171'); rect(x + unit * 3 - 8, y, 8, unit, '#b1a171'); }
        label(i < state.doors ? 'ひらいた！' : `とびら ${i + 1}`, x + 1.5 * unit, y - 14);
        for (const side of [8.5, 14.5]){
          const tx = ox + side * unit, ty = oy + (gy + .8) * unit;
          const glow = ctx.createRadialGradient(tx, ty, 2, tx, ty, 65); glow.addColorStop(0, '#ffd78455'); glow.addColorStop(1, '#ffd78400'); oval(tx, ty, 65, 65, glow);
          rect(tx - 4, ty - 10, 8, 25, '#55483f'); oval(tx, ty - 12, 7 + Math.sin(now * 5) * 1.5, 12, '#f4b756'); oval(tx, ty - 10, 3, 7, '#fff1b0');
        }
      });
      const [cx, cy] = at(TREASURE);
      rect(cx - 24, cy - 22, 48, 28, state.cleared ? '#8b7c55' : '#be9050'); rect(cx - 24, cy - 14, 48, 5, '#e8cd85'); rect(cx - 4, cy - 16, 8, 13, '#f7e7a7');
      label(state.cleared ? 'たからばこ・クリア！' : 'たからばこ', cx, cy - 45);
      label('↓ 外へもどる', ox + 11.5 * unit, oy + 61.7 * unit);
    }
    props.push({ y: state.y, draw: () => { const [x, y] = at(state); mushroom(x, y, state, now, moving); } });
    props.sort((a, b) => a.y - b.y).forEach(p => p.draw());
    // A quiet vignette gives depth without blur shaders or expensive post-processing.
    const shade = ctx.createRadialGradient(width / 2, height / 2, height * .3, width / 2, height / 2, Math.max(width, height) * .75);
    shade.addColorStop(0, '#102e2500'); shade.addColorStop(1, map === 'cave' ? '#101b3260' : '#153d2e24'); rect(0, 0, width, height, shade);
  }
  return { draw, resize };
}
