// 敵キャラ8種（敵・ボス・NPC設計書 3章）
//   A1 かずっこ / A2 けいさんバチ / B1 かたちブロック / B2 ますますガメ
//   C1 はかりドリ / C2 とけいモグラ / D1 グラフンボ / D2 ヨミトリフクロウ
// ・学年ごとの違いは「色と数値だけ」。モデルは共通で、体の色を学年の色にする
// ・動きは 待機・移動・攻撃・やられ の4種類を全種類で共通にする
// ・主人公とならんだときの大きさをそろえる（高さ2前後）
// ・問題が1問もない種類（5年の C2 など）は出てこない

import { heightAt } from './terrain.js';
import { gradientMap, outlineMaterial, mergeChildren } from './toon.js';
import { REGION_R, G5C, RESPAWN_SEC } from './config.js';

function makeRng(seed){
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function shade(hex, t){   // t>0 明るく / t<0 暗く
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t))));
  return '#' + [16, 8, 0].map(s => f((n >> s) & 255).toString(16).padStart(2, '0')).join('');
}

/** 小さな絵を コードで描いて テクスチャにする */
function canvasTex(THREE, w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildModel(THREE, sp, color){
  const g = new THREE.Group();
  const body = new THREE.Group();       // 動きはこちらに
  g.add(body);
  const grad = gradientMap(THREE, 3);
  const T = c => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
  const B = c => new THREE.MeshBasicMaterial({ color: c });
  const ol = outlineMaterial(THREE, '#1b1410', 0.045);
  const add = (geo, mat, parent = body, outline = false) => {
    const m = new THREE.Mesh(geo, mat); parent.add(m);
    if (outline) m.add(new THREE.Mesh(geo, ol));
    return m;
  };
  const eyes = (y, z, sp_ = 0.26, r = 0.17, parent = body) => {
    for (const s of [-sp_, sp_]){
      const w = add(new THREE.SphereGeometry(r, 10, 8), B('#ffffff'), parent); w.position.set(s, y, z);
      const p = add(new THREE.SphereGeometry(r * 0.5, 8, 6), B('#1b1410'), parent); p.position.set(s, y, z + r * 0.65);
    }
  };
  const main = color, light = shade(color, 0.45), dark = shade(color, -0.35);
  const parts = {};

  switch (sp.id){
    case 'A1': { // かずっこ：数字のバッジをつけたスライム
      const b = add(new THREE.SphereGeometry(0.85, 16, 12), T(main), body, true);
      b.scale.set(1.1, 0.9, 1); b.position.y = 0.78;
      const badge = add(new THREE.CircleGeometry(0.34, 18), new THREE.MeshBasicMaterial({
        map: canvasTex(THREE, 64, 64, (x, w) => { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill();
          x.fillStyle = dark; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7', 32, 35); }) }));
      badge.position.set(0, 0.62, 0.9); badge.rotation.x = -0.15;
      eyes(1.02, 0.72, 0.28, 0.16);
      parts.main = b;
      break;
    }
    case 'A2': { // けいさんバチ：＋−×÷のしま模様
      const tex = canvasTex(THREE, 64, 64, (x) => {
        x.fillStyle = main; x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#ffd84a'; for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64);
        x.fillStyle = dark; x.font = 'bold 12px sans-serif'; x.textAlign = 'center';
        ['＋', '−', '×', '÷'].forEach((s, i) => x.fillText(s, 12 + i * 16, 36));
      });
      const b = add(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }), body, true);
      b.scale.set(0.95, 0.9, 1.25); b.rotation.y = Math.PI / 2; b.position.y = 1.7;
      const st = add(new THREE.ConeGeometry(0.12, 0.35, 6), B('#2a2a2a')); st.rotation.x = -Math.PI / 2; st.position.set(0, 1.7, -0.85);
      const wm = new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide });
      parts.wings = [-1, 1].map(s => { const w = add(new THREE.CircleGeometry(0.45, 12), wm); w.position.set(s * 0.45, 2.15, -0.1); w.rotation.x = -Math.PI / 2.4; return w; });
      eyes(1.85, 0.62, 0.22, 0.15);
      parts.main = b;
      break;
    }
    case 'B1': { // かたちブロック：積み木のいきもの
      const c1 = add(new THREE.BoxGeometry(1.0, 0.8, 0.8), T(main), body, true); c1.position.y = 0.4;
      const c2 = add(new THREE.CylinderGeometry(0.38, 0.38, 0.6, 10), T(light), body, true); c2.position.y = 1.1;
      const tri = new THREE.Shape(); tri.moveTo(-0.45, 0); tri.lineTo(0.45, 0); tri.lineTo(0, 0.6); tri.closePath();
      const c3 = add(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: false }), T(dark), body, true);
      c3.position.set(0, 1.4, -0.25);
      eyes(0.5, 0.42, 0.24, 0.13);
      parts.main = c1;
      break;
    }
    case 'B2': { // ますますガメ：甲羅がマス目
      const tex = canvasTex(THREE, 64, 64, (x) => { x.fillStyle = main; x.fillRect(0, 0, 64, 64);
        x.strokeStyle = light; x.lineWidth = 3; for (let i = 0; i <= 64; i += 12.8){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); } });
      const sh = add(new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }), body, true);
      sh.scale.y = 0.75; sh.position.y = 0.35;
      const head = add(new THREE.SphereGeometry(0.34, 12, 10), T('#9ad08a'), body, true); head.position.set(0, 0.62, 1.0);
      eyes(0.72, 1.24, 0.14, 0.09);
      for (const [x, z] of [[-0.6, 0.55], [0.6, 0.55], [-0.6, -0.55], [0.6, -0.55]]){
        const f = add(new THREE.CylinderGeometry(0.16, 0.18, 0.4, 8), T('#9ad08a')); f.position.set(x, 0.2, z);
      }
      parts.main = sh; parts.head = head;
      break;
    }
    case 'C1': { // はかりドリ：くちばしが定規
      const b = add(new THREE.SphereGeometry(0.65, 14, 12), T(main), body, true); b.position.y = 1.15; b.scale.set(1, 1.05, 1);
      const beakTex = canvasTex(THREE, 64, 16, (x) => { x.fillStyle = '#ffe066'; x.fillRect(0, 0, 64, 16);
        x.fillStyle = '#6b4a1a'; for (let i = 2; i < 64; i += 6) x.fillRect(i, 0, 1.5, i % 12 < 6 ? 8 : 5); });
      const beak = add(new THREE.BoxGeometry(0.12, 0.08, 0.7), new THREE.MeshLambertMaterial({ map: beakTex }));
      beak.position.set(0, 1.12, 0.9);
      parts.beak = beak;
      for (const s of [-0.22, 0.22]){ const l = add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), T('#f0a52c')); l.position.set(s, 0.3, 0); }
      const tail = add(new THREE.ConeGeometry(0.25, 0.5, 6), T(dark)); tail.rotation.x = -1.1; tail.position.set(0, 1.25, -0.65);
      eyes(1.35, 0.52, 0.24, 0.14);
      parts.main = b;
      break;
    }
    case 'C2': { // とけいモグラ：顔が時計
      const b = add(new THREE.SphereGeometry(0.75, 14, 12), T(dark), body, true); b.scale.set(1, 1.1, 0.95); b.position.y = 0.85;
      const clock = add(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({
        map: canvasTex(THREE, 64, 64, (x) => { x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill();
          x.strokeStyle = '#333'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 32); x.lineTo(32, 12); x.moveTo(32, 32); x.lineTo(46, 36); x.stroke();
          for (let i = 0; i < 12; i++){ const a = i / 12 * 6.283; x.fillRect(32 + Math.cos(a) * 25 - 1, 32 + Math.sin(a) * 25 - 1, 3, 3); } }) }));
      clock.position.set(0, 1.0, 0.72);
      const nose = add(new THREE.SphereGeometry(0.1, 8, 6), B('#ff8fa3')); nose.position.set(0, 0.62, 0.72);
      parts.main = b;
      break;
    }
    case 'D1': { // グラフンボ：体が棒グラフのキノコ
      const barH = [0.7, 1.1, 0.85];
      parts.bars = barH.map((h, i) => {
        const bar = add(new THREE.BoxGeometry(0.3, 1, 0.3), T(i === 1 ? light : main), body, i === 1);
        bar.scale.y = h; bar.position.set((i - 1) * 0.34, h / 2, 0); bar.userData.h = h;
        return bar;
      });
      const cap = add(new THREE.SphereGeometry(0.72, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), T('#e2603f'), body, true);
      cap.scale.y = 0.6; cap.position.y = 1.15;
      for (const [x, z] of [[0.3, 0.3], [-0.35, 0.1], [0.05, -0.4]]){
        const d = add(new THREE.SphereGeometry(0.1, 6, 4), B('#ffffff')); d.position.set(x, 1.15 + 0.35, z);
      }
      eyes(0.85, 0.2, 0.2, 0.12);
      parts.cap = cap; parts.main = parts.bars[1];
      break;
    }
    case 'D2': { // ヨミトリフクロウ：めがね
      const b = add(new THREE.SphereGeometry(0.7, 14, 12), T(main), body, true); b.scale.set(0.95, 1.2, 0.9); b.position.y = 1.0;
      const belly = add(new THREE.SphereGeometry(0.5, 12, 10), T(light)); belly.scale.set(0.9, 1.1, 0.5); belly.position.set(0, 0.85, 0.4);
      eyes(1.35, 0.55, 0.24, 0.17);
      for (const s of [-0.24, 0.24]){
        const ring = add(new THREE.TorusGeometry(0.2, 0.035, 6, 16), B('#1b1410')); ring.position.set(s, 1.35, 0.62);
      }
      const bridge = add(new THREE.BoxGeometry(0.1, 0.03, 0.03), B('#1b1410')); bridge.position.set(0, 1.38, 0.64);
      for (const s of [-1, 1]){ const e = add(new THREE.ConeGeometry(0.14, 0.32, 5), T(dark)); e.position.set(s * 0.36, 1.9, 0); e.rotation.z = -s * 0.3; }
      const beak = add(new THREE.ConeGeometry(0.08, 0.18, 5), B('#f0a52c')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.18, 0.66);
      parts.main = b;
      break;
    }
  }
  // 動かない部品を1つにまとめて、描画を軽くする（うごく羽・棒グラフ・首は そのまま）
  const keep = new Set([...(parts.wings || []), ...(parts.bars || []), parts.head, parts.cap].filter(Boolean));
  mergeChildren(THREE, body, keep);
  return { group: g, body, parts };
}

/**
 * @param sp        data/species.json の1種
 * @param gradeInfo data/grades.json の1学年
 */
export function createEnemies(THREE, scene, world, { species, gradeInfo, available }){
  const rng = makeRng(777);
  const grp = new THREE.Group();
  grp.name = 'enemies';
  scene.add(grp);

  // 問題があるものだけ出す（available(sid) が false の種類は出てこない）
  const kinds = species.filter(s => available(s.id));
  const list = [];
  const PER = 2;
  kinds.forEach((sp, ki) => {
    for (let n = 0; n < PER; n++){
      let x = 0, z = 0, ok = false;
      // 種類ごとに火山のまわりの すこしずつ ちがう方角に置く
      const base = (ki / kinds.length) * Math.PI * 2;
      for (let t = 0; t < 300 && !ok; t++){
        const a = base + (rng() - 0.5) * 1.1;
        const d = REGION_R * (0.5 + rng() * 0.4);
        x = G5C.x + Math.cos(a) * d; z = G5C.z + Math.sin(a) * d;
        ok = world.canWalk(x, z);
      }
      if (!ok) continue;
      const m = buildModel(THREE, sp, gradeInfo.color);
      m.group.position.set(x, heightAt(x, z), z);
      grp.add(m.group);
      list.push({
        sp, grade: gradeInfo.grade, hp: gradeInfo.hp, obj: m.group, body: m.body, parts: m.parts,
        x, z, homeX: x, homeZ: z, alive: true, respawnIn: 0,
        dir: rng() * Math.PI * 2, turnIn: 1 + rng() * 3, ph: rng() * 6.28,
        anim: null, animT: 0, speed: gradeInfo.speed * (sp.move === 'slow' ? 0.4 : sp.move === 'perch' ? 0 : 1),
      });
    }
  });

  function nearest(px, pz, range){
    let best = null, bd = range;
    for (const e of list){
      if (!e.alive) continue;
      const d = Math.hypot(px - e.x, pz - e.z);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  }

  /** 攻撃（こちらへ とびかかる）・やられ（ちぢんで消える） */
  function play(e, name){ e.anim = name; e.animT = 0; }

  function defeat(e){
    play(e, 'defeat');
    e.respawnIn = RESPAWN_SEC;
  }

  function animate(e, dt, t, px, pz, moving){
    const b = e.body, m = e.sp.move, P = e.parts;
    b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);

    // 待機・移動
    if (m === 'hop')        b.position.y = Math.abs(Math.sin(t * 3 + e.ph)) * (moving ? 0.5 : 0.18);
    if (m === 'fly'){       b.position.y = Math.sin(t * 2.2 + e.ph) * 0.25;
                            P.wings?.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * 28) * 0.5; }); }
    if (m === 'roll')       b.rotation.z = Math.sin(t * 4 + e.ph) * (moving ? 0.35 : 0.12);
    if (m === 'slow' && P.head) P.head.position.z = 1.0 + Math.sin(t * 1.5 + e.ph) * 0.08;
    if (m === 'peck')       b.rotation.x = Math.max(0, Math.sin(t * 2.4 + e.ph)) ** 6 * 0.6;
    if (m === 'burrow')     b.position.y = -0.9 + (Math.sin(t * 0.8 + e.ph) * 0.5 + 0.5) * 0.9;
    if (m === 'stretch')    P.bars?.forEach((bar, i) => { const s = 1 + Math.sin(t * 2.5 + i * 1.3 + e.ph) * 0.3; bar.scale.y = bar.userData.h * s; bar.position.y = bar.userData.h * s / 2; });
    if (m === 'perch')      b.rotation.y = Math.sin(t * 0.7 + e.ph) * 0.7;

    // 攻撃・やられ
    if (e.anim){
      e.animT += dt;
      if (e.anim === 'attack'){
        const p = Math.min(1, e.animT / 0.6);
        b.position.z += Math.sin(p * Math.PI) * 1.2;
        b.rotation.x += Math.sin(p * Math.PI) * 0.3;
        if (p >= 1) e.anim = null;
      } else if (e.anim === 'hit'){
        const p = Math.min(1, e.animT / 0.45);
        b.position.x += Math.sin(e.animT * 50) * 0.12 * (1 - p);
        b.scale.setScalar(1 - Math.sin(p * Math.PI) * 0.15);
        if (p >= 1) e.anim = null;
      } else if (e.anim === 'defeat'){
        const p = Math.min(1, e.animT / 0.8);
        b.scale.set(1 + p * 0.3, Math.max(0.01, 1 - p), 1 + p * 0.3);
        b.rotation.y += p * 6;
        if (p >= 1){ e.anim = null; e.alive = false; e.obj.visible = false; }
      }
    }
  }

  let frozen = null;   // たたかい中の相手はうごかさない
  function update(dt, t, px, pz){
    for (const e of list){
      if (!e.alive){
        e.respawnIn -= dt;
        if (e.respawnIn <= 0){ e.alive = true; e.obj.visible = true; e.x = e.homeX; e.z = e.homeZ; }
        continue;
      }
      let moving = false;
      const toP = Math.hypot(px - e.x, pz - e.z);
      if (e === frozen || toP < 12){
        e.obj.rotation.y = Math.atan2(px - e.x, pz - e.z);
      } else if (e.speed > 0){
        e.turnIn -= dt;
        if (e.turnIn <= 0){ e.dir += (rng() - 0.5) * 2.2; e.turnIn = 1.5 + rng() * 3; }
        const sp = e.speed * dt;
        const nx = e.x + Math.sin(e.dir) * sp, nz = e.z + Math.cos(e.dir) * sp;
        if (world.canWalk(nx, nz) && Math.hypot(nx - e.homeX, nz - e.homeZ) < 16){ e.x = nx; e.z = nz; moving = true; }
        else e.dir += 1.6;
        e.obj.rotation.y = e.dir;
      }
      e.obj.position.set(e.x, heightAt(e.x, e.z), e.z);
      animate(e, dt, t, px, pz, moving);
    }
  }

  function reset(){
    for (const e of list){ e.alive = true; e.obj.visible = true; e.anim = null; e.x = e.homeX; e.z = e.homeZ; e.respawnIn = 0; }
  }

  return { group: grp, list, kinds, nearest, defeat, play, update, reset, freeze: e => { frozen = e; } };
}

/** 称号一覧などで使う、1体だけのモデル（表示用） */
export function buildEnemyModel(THREE, sp, color){ return buildModel(THREE, sp, color).group; }
