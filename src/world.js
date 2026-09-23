// 島の上に置くもの ― はじまりの村、5年の地方（火山）、道の門、看板、
// NPC（data/npcs.json）、火口のボスのとりで4つ、ダンジョンの入口。
// 木や岩は「その場所がどの地方に近いか」で種類が変わる。境目を作らず、じわっと入れかわる。
// くり返し出てくるものは InstancedMesh にまとめ、さらに区画ごとに分けて、
// 画面の外のぶんが描かれないようにしてある（島が広くても軽い）。

import {
  ISLAND_R, VILLAGE_R, REGION_R, REGIONS, G5, G5C, regionCenter,
  BIOMES, BIOME_CENTER
} from './config.js';
import { heightAt, onRoad, gatePos, biomeAt, biomeNum, ONSEN } from './terrain.js';
import { mergeChildren } from './toon.js';

const SECT = 4;   // 区画の数（4×4＝16）

function makeRng(seed){
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * @param data { npcs, bosses, dungeons }  data/*.json から読んだもの
 */
export function buildWorld(THREE, scene, data = {}){
  const M  = c => new THREE.MeshLambertMaterial({ color: c });
  const MF = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const grp = new THREE.Group();
  grp.name = 'world';
  scene.add(grp);

  const interactables = [];   // はなす で反応するもの
  const solids = [];          // ぶつかるもの（円）
  const animated = [];        // 毎コマ動かすもの

  const put = (obj, x, z, yOff = 0) => {
    obj.position.set(x, heightAt(x, z) + yOff, z);
    grp.add(obj);
    return obj;
  };
  const S = 1.7;   // 建物などの大きさ（島を広げたぶん大きくする）

  // ---- 村の建物 ----------------------------------------------------------

  function makeHouse(wall, roof){
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 2.8), MF(wall));
    b.position.y = 1.0; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.6, 4), MF(roof));
    r.position.y = 2.8; r.rotation.y = Math.PI / 4; g.add(r);
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.12), M(0x8a5d3b));
    d.position.set(0, 0.6, 1.42); g.add(d);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.12), M(0xffe9a8));
    w.position.set(0.9, 1.4, 1.42); g.add(w);
    g.scale.setScalar(S);
    return mergeChildren(THREE, g);
  }

  const HOUSES = [
    { a: 200, r: 0.62, wall: 0xfff0d6, roof: 0xe06a6a },
    { a: 248, r: 0.70, wall: 0xffe6c9, roof: 0x5aa9e0 },
    { a: 292, r: 0.64, wall: 0xfff6ea, roof: 0x9b7ad0 },
    { a: 115, r: 0.60, wall: 0xfff3e2, roof: 0x7ec46a },
    { a:  62, r: 0.70, wall: 0xffeedd, roof: 0xe0a85a },
    { a: 340, r: 0.66, wall: 0xfdf0e0, roof: 0x4fb6a8 },
  ];
  for (const h of HOUSES){
    const rad = h.a * Math.PI / 180;
    const x = Math.cos(rad) * VILLAGE_R * h.r, z = Math.sin(rad) * VILLAGE_R * h.r;
    const o = put(makeHouse(h.wall, h.roof), x, z);
    o.rotation.y = -rad + Math.PI / 2;
    solids.push({ x, z, r: 2.2 * S });
  }

  // 井戸
  {
    const x = -3.0, z = -12.0;
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.85, 12), MF(0xb9b2a6));
    w.position.y = 0.42; g.add(w);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), M(0x4aa8d8));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.78; g.add(water);
    for (const s of [-1, 1]){
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 6), M(0x8a5d3b));
      p.position.set(s * 0.8, 1.25, 0); g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.75, 4), MF(0xc06a4a));
    roof.position.y = 2.35; roof.rotation.y = Math.PI / 4; g.add(roof);
    g.scale.setScalar(S);
    put(mergeChildren(THREE, g), x, z);
    solids.push({ x, z, r: 1.3 * S });
  }

  // ---- 看板 --------------------------------------------------------------

  function makeSign(boardColor = 0xdcb57e, w = 2.2, h = 1.2){
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.7, 6), M(0x8a5d3b));
    p.position.y = 0.85; g.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), MF(boardColor));
    b.position.y = 1.85; g.add(b);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.11, 0.03), M(0x6b4a2f));
    l1.position.set(0, 1.97, 0.095); g.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.11, 0.03), M(0x6b4a2f));
    l2.position.set(-w * 0.08, 1.70, 0.095); g.add(l2);
    g.scale.setScalar(S);
    return mergeChildren(THREE, g);
  }

  function addTalk(o, { id, x, z, r = 6.0, name, lines, action, npc }){
    const it = { id, x, z, r, name, lines, action, npc, obj: o };
    interactables.push(it);
    return it;
  }

  // 村の案内板
  {
    const x = 2.0, z = 9.0;
    const s = put(makeSign(), x, z);
    s.rotation.y = Math.PI;
    addTalk(s, {
      id: 'sign-village', x, z, name: '{案内板|あんないばん}',
      lines: [
        'ここは {はじまりの村|はじまりのむら}。',
        '6つの {地方|ちほう}へ {道|みち}が つづいているよ。',
        '{歩|ある}いていくと、だんだん けしきが かわっていく。さむい {方|ほう}へ {行|い}くと {雪|ゆき}が ふってくるよ。',
        'いまは {火山|かざん}の {地方|ちほう}（5{年|ねん}）だけ {入|はい}れるんだ。',
      ],
    });
    solids.push({ x, z, r: 1.4 });
  }

  // ---- 村人 --------------------------------------------------------------

  function makeNpc(cloth, hair){
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 10), M(cloth));
    b.position.y = 0.66; g.add(b);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), M(0xffe0c0));
    head.position.y = 1.4; g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(hair));
    cap.position.y = 1.42; g.add(cap);
    const eye = new THREE.MeshBasicMaterial({ color: 0x33475a });
    for (const s of [-0.13, 0.13]){
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
      e.position.set(s, 1.38, 0.33); g.add(e);
    }
    g.scale.setScalar(S);
    return mergeChildren(THREE, g);
  }

  // 位置の決め方：pos（そのまま）／ place（5年の門から地方の中へ fromGate だけ進み、side で左右）／ near:onsen0
  const g5gate = gatePos(G5);
  const g5dir = { x: Math.cos(G5.deg * Math.PI / 180), z: Math.sin(G5.deg * Math.PI / 180) };
  function npcSpot(n){
    if (n.pos) return n.pos;
    if (n.place){
      const f = n.place.fromGate ?? 10, side = n.place.side ?? 1;
      return { x: g5gate.x + g5dir.x * f - g5dir.z * side * 7, z: g5gate.z + g5dir.z * f + g5dir.x * side * 7 };
    }
    if (n.near === 'onsen0'){
      const o0 = ONSEN[0];
      return { x: o0.x + o0.r + 4.5, z: o0.z + 3.0 };
    }
    return { x: 0, z: 0 };
  }
  for (const n of data.npcs || []){
    if (!['village', 'g5'].includes(n.region)) continue;
    const { x, z } = npcSpot(n);
    const o = put(makeNpc(n.look?.cloth || '#7b9be0', n.look?.hair || '#4a3a30'), x, z);
    o.rotation.y = Math.atan2(-x + (n.region === 'g5' ? g5gate.x : 0), -z + (n.region === 'g5' ? g5gate.z : 0));
    addTalk(o, { id: n.npc_id, x, z, r: 6.0, name: n.name, action: 'npc:' + n.npc_id, npc: n });
    solids.push({ x, z, r: 1.2 });
    animated.push({ kind: 'npc', obj: o, base: o.position.y, ph: x });
  }

  // ---- 地方の門 ----------------------------------------------------------

  function makeGate(open){
    const g = new THREE.Group();
    const col = open ? 0xd2543f : 0x9b7d5c;
    for (const s of [-1, 1]){
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 4.4, 8), MF(col));
      p.position.set(s * 3.0, 2.2, 0); g.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.46, 0.46), MF(col));
    bar.position.y = 4.3; g.add(bar);
    if (!open){
      for (let i = 0; i < 2; i++){
        const pl = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 0.2), MF(0xbfa07a));
        pl.position.set(0, 1.5 + i * 1.1, 0); pl.rotation.z = i ? -0.13 : 0.13; g.add(pl);
      }
    }
    g.scale.setScalar(S);
    return mergeChildren(THREE, g);
  }

  for (const rg of REGIONS){
    const p = gatePos(rg);
    const o = put(makeGate(rg.open), p.x, p.z);
    o.rotation.y = -Math.atan2(p.z, p.x) + Math.PI / 2;

    const sx = p.x + Math.cos((rg.deg + 90) * Math.PI / 180) * 7.5;
    const sz = p.z + Math.sin((rg.deg + 90) * Math.PI / 180) * 7.5;
    const s = put(makeSign(rg.open ? 0xf0d7a8 : 0xc9b295, 2.4, 1.1), sx, sz);
    s.rotation.y = -Math.atan2(sz, sx) + Math.PI / 2 + Math.PI;

    const lines = rg.open
      ? [
          `{${rg.name}|${rg.yomi}}の {地方|ちほう}（${rg.grade}{年|ねん}）`,
          'ここから {先|さき}は ' + rg.grade + '{年|ねん}の べんきょうだよ。',
          '{魔物|まもの}に ぶつかると、もんだいで たたかいが はじまる。',
          '{山|やま}の てっぺんの {火口|かこう}には ボスが いる。',
        ]
      : [
          `{${rg.name}|${rg.yomi}}の {地方|ちほう}（${rg.grade}{年|ねん}）`,
          'ここは まだ じゅんびちゅう。{門|もん}は しまっている。',
          `でも このあたりまで {来|く}ると、{${rg.name}|${rg.yomi}}の けはいが するでしょう？`,
          'つぎの だんかいで {通|とお}れるように なるよ。',
        ];
    addTalk(s, { id: 'gate-' + rg.id, x: sx, z: sz, r: 6.0, name: '{立|た}てふだ', lines });
    solids.push({ x: sx, z: sz, r: 1.4 });
  }

  // ---- 5年の地方（火山） -------------------------------------------------

  const craterY = heightAt(G5C.x, G5C.z);

  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(8.5, 28),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a })
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(G5C.x, craterY + 0.25, G5C.z);
  grp.add(lava);
  animated.push({ kind: 'lava', obj: lava });

  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xd8d2cc, transparent: true, opacity: 0.4, depthWrite: false });
  for (let i = 0; i < 7; i++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(3.0 + i * 0.8, 8, 6), smokeMat.clone());
    s.position.set(G5C.x, craterY + 5 + i * 6, G5C.z);
    grp.add(s);
    animated.push({ kind: 'smoke', obj: s, base: craterY + 5, i, n: 7, span: 42 });
  }

  // 温泉
  for (const o of ONSEN){
    const { x, z, y, r } = o;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.7, 1.2, 22), MF(0x8c6f63));
    rim.position.set(x, y + 0.02, z); grp.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.9, 24), M(0x9fdcea));
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, y + 0.66, z); grp.add(water);
    solids.push({ x, z, r: r + 0.6 });
    for (let i = 0; i < 3; i++){
      const st = new THREE.Mesh(new THREE.SphereGeometry(1.3 + i * 0.4, 7, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
      st.position.set(x, y + 2.0, z); grp.add(st);
      animated.push({ kind: 'smoke', obj: st, base: y + 2.0, i, n: 3, span: 9 });
    }
  }

  // 火口のまわりに ボスのとりでを4つ（学年×領域で1体ずつ）。台本（file）があるボスだけ戦える
  const BOSS_ANGLE = { A: 270, B: 330, C: 150, D: 210 };   // D が いちばん 村がわ（さいしょに ためせる）
  const bossSpots = {};
  function makeFortress(open){
    const g = new THREE.Group();
    for (const s2 of [-1, 1]){
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 6.5, 6), MF(open ? 0x3f3230 : 0x6d625c));
      pl.position.set(s2 * 4.5, 3.2, 0); g.add(pl);
      if (open){
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 7), new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
        fire.position.set(s2 * 4.5, 7.2, 0); g.add(fire);
        animated.push({ kind: 'fire', obj: fire, ph: s2 });
      }
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 7), MF(0x4a3a36));
    slab.position.y = 0.3; g.add(slab);
    return mergeChildren(THREE, g, new Set(g.children.filter(c => c.material?.type === 'MeshBasicMaterial')));
  }
  for (const b of (data.bosses || []).filter(b => b.grade === 5)){
    const a = BOSS_ANGLE[b.domain] * Math.PI / 180;
    const x = G5C.x + Math.cos(a) * 15.5, z = G5C.z + Math.sin(a) * 15.5;
    const f = put(makeFortress(!!b.file), x, z);
    f.rotation.y = Math.atan2(G5C.x - x, G5C.z - z) + Math.PI;
    bossSpots[b.id] = { x, z, rot: f.rotation.y };
    addTalk(f, { id: 'gate-' + b.id, x, z, r: 8.0, name: `{${b.name}|${b.yomi}}の とりで`, action: 'boss:' + b.id });
  }

  // ボスのモデル（台本があるボスだけ）
  const bossModels = {};
  function makeWhale(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.0, 18, 14), MF(0x3f6fb0)); body.scale.set(1.4, 0.9, 1); body.position.y = 2.2; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), MF(0xcfe3f7)); belly.scale.set(1.3, 0.6, 0.85); belly.position.set(0, 1.6, 0.35); g.add(belly);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 4), MF(0x3f6fb0)); tail.rotation.z = Math.PI / 2; tail.position.set(-3.1, 2.6, 0); g.add(tail);
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.8 })); spout.position.set(0.6, 4.4, 0); g.add(spout);
    for (const s2 of [-0.55, 0.55]){
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M(0xffffff)); e.position.set(1.9, 2.5, s2 + 0.8); g.add(e);
      const pp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M(0x1b1410)); pp.position.set(2.1, 2.5, s2 + 0.9); g.add(pp);
    }
    g.rotation.y = -Math.PI / 2;     // 顔を +z に
    mergeChildren(THREE, g, new Set([spout]));
    const w = new THREE.Group(); w.add(g); return w;
  }
  function makeWolf(){
    const g = new THREE.Group();
    const grey = MF(0x8e939c), light = MF(0xd9dde3);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), grey); body.scale.set(0.8, 0.8, 1.35); body.position.y = 1.7; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), grey); head.position.set(0, 2.5, 1.35); g.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), light); snout.rotation.x = Math.PI / 2; snout.position.set(0, 2.35, 2.1); g.add(snout);
    for (const s2 of [-0.35, 0.35]){
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), grey); ear.position.set(s2, 3.25, 1.25); g.add(ear);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M(0xffe066)); e.position.set(s2 * 0.8, 2.7, 1.95); g.add(e);
    }
    for (const [x2, z2] of [[-0.5, 0.8], [0.5, 0.8], [-0.5, -0.8], [0.5, -0.8]]){
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.2, 6), grey); l.position.set(x2, 0.6, z2); g.add(l);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 6), light); tail.rotation.x = -1.1; tail.position.set(0, 2.0, -1.8); g.add(tail);
    mergeChildren(THREE, g);
    const w = new THREE.Group(); w.add(g); return w;
  }
  function makeDragon(){
    const g = new THREE.Group(), purple = MF(0x7860b8), mint = MF(0x7cd9c0), cream = MF(0xffedb3);
    const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); g.add(m); return m; };
    part(new THREE.SphereGeometry(1.5,12,8), purple,0,1.9,0).scale.set(.85,1.1,1);
    part(new THREE.SphereGeometry(.95,12,8), purple,0,3.65,.55);
    part(new THREE.BoxGeometry(1.2,.55,.9), mint,0,3.35,1.35);
    for(let i=0;i<3;i++)part(new THREE.BoxGeometry(.9,.42,.18),i<2?mint:cream,0,1.5+i*.48,1.55);
    for(const side of [-1,1]){
      part(new THREE.ConeGeometry(.25,.85,5),cream,side*.6,4.65,.25).rotation.z=-side*.25;
      part(new THREE.SphereGeometry(.22,8,6),M(0xffffff),side*.49,3.8,1.28);
      part(new THREE.SphereGeometry(.1,8,6),M(0x241b33),side*.49,3.8,1.48);
      part(new THREE.SphereGeometry(.48,8,6),purple,side*.9,.45,.6).scale.set(1,.7,1.5);
      const wing=part(new THREE.ConeGeometry(1.15,2.5,3),mint,side*1.9,2.8,-.25);
      wing.scale.z=.18;wing.rotation.z=-side*.8;
    }
    part(new THREE.ConeGeometry(.55,2.5,7),purple,0,1,-2).rotation.x=-1.2;
    mergeChildren(THREE,g);const w=new THREE.Group();w.add(g);return w;
  }
  function makeGolem(){
    const g=new THREE.Group(),stone=MF(0x7b98a5),light=MF(0xb8d2d8),gold=MF(0xffcc55);
    const block=(w,h,d,x,y,z,mat=stone)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
    block(2.4,2.1,1.5,0,2.1,0);block(1.65,1.3,1.5,0,3.85,.1,light);
    for(const s of [-1,1]){
      block(.85,1.3,1.1,s*.75,.7,0);block(.95,2,1.1,s*1.85,2,0).rotation.z=s*.15;
      block(.3,.24,.1,s*.4,3.95,.9,gold);
    }
    block(.5,.12,.12,0,3.5,.9);
    const badge=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.12,3),gold);
    badge.rotation.x=Math.PI/2;badge.position.set(0,2.25,.85);g.add(badge);
    mergeChildren(THREE,g);const w=new THREE.Group();w.add(g);return w;
  }
  const BOSS_MODEL = { 'boss-g5-A': makeDragon, 'boss-g5-B': makeGolem, 'boss-g5-D': makeWhale, 'boss-g5-C': makeWolf };
  for (const [id, make] of Object.entries(BOSS_MODEL)){
    const sp = bossSpots[id]; if (!sp) continue;
    const m = make();
    // とりでの前（村がわ）に出す。柱の かげに かくれないように
    const bx = sp.x + Math.sin(sp.rot) * 4.5, bz = sp.z + Math.cos(sp.rot) * 4.5;
    m.position.set(bx, heightAt(bx, bz) + 0.6, bz);
    m.rotation.y = sp.rot + Math.PI;           // 村のほう（こちら）を向く
    grp.add(m);
    bossModels[id] = { obj: m, inner: m.children[0], base: m.position.clone() };
  }

  // ダンジョンの入口（ふもとの ほらあな）
  const dungeonSpots = {};
  const DUNGEON_ANGLE = { A: 285, B: 345, C: 145, D: 245 };
  for (const d of data.dungeons || []){
    const a = (DUNGEON_ANGLE[d.domain] ?? 245) * Math.PI / 180;
    const x = G5C.x + Math.cos(a) * 34, z = G5C.z + Math.sin(a) * 34;
    const g = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 1.3, 8, 14, Math.PI), MF(0x5a4a44)); arch.position.y = 0.2; g.add(arch);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x120c0a })); dark.position.set(0, 0.2, -0.3); g.add(dark);
    const flames = new Set();
    for (const s2 of [-1, 1]){
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5), M(0x6b4a2f)); t.position.set(s2 * 4.6, 1.2, 0.8); g.add(t);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 })); fl.position.set(s2 * 4.6, 2.7, 0.8); g.add(fl);
      animated.push({ kind: 'fire', obj: fl, ph: s2 * 2 });
      flames.add(fl);
    }
    mergeChildren(THREE, g, flames);
    const o = put(g, x, z);
    o.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));   // 火口と反対の、歩ける外がわへ向ける
    dungeonSpots[d.id] = { x, z };
    addTalk(o, { id: 'dungeon-' + d.id, x, z, r: 7.0, name: d.name, action: 'dungeon:' + d.id });
    solids.push({ x: x - Math.cos(a) * 1.5, z: z - Math.sin(a) * 1.5, r: 2.0 });
  }

  // ---- 気候ごとの木・岩・花 ----------------------------------------------

  const cyl  = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s);
  const cone = (r, h, s)    => new THREE.ConeGeometry(r, h, s);
  const ico  = (r)          => new THREE.IcosahedronGeometry(r, 0);

  const TREES = {
    meadow: [
      { g: cyl(0.26, 0.34, 1.7, 4), c: 0x9a6b3f, y: 0.85 },
      { g: ico(1.5),                c: 0x62c46a, y: 2.5, sy: 0.8 },
    ],
    forest: [
      { g: cyl(0.32, 0.44, 2.4, 4), c: 0x7a5330, y: 1.2 },
      { g: cone(1.7, 3.4, 5),       c: 0x2f7f45, y: 3.3 },
      { g: cone(1.15, 2.4, 5),      c: 0x3a9455, y: 5.2 },
    ],
    palm: [
      { g: cyl(0.22, 0.34, 3.8, 4), c: 0xb08a52, y: 1.9 },
      { g: cone(2.2, 0.8, 5),       c: 0x5fbf5e, y: 4.0 },
      { g: cone(1.3, 0.6, 5),       c: 0x76d072, y: 4.4 },
    ],
    alpine: [
      { g: cyl(0.26, 0.34, 1.8, 4), c: 0x6e5540, y: 0.9 },
      { g: cone(1.25, 3.2, 5),      c: 0x4a7a5c, y: 3.0 },
    ],
    dead: [
      { g: cyl(0.24, 0.36, 2.6, 4), c: 0x5a4a42, y: 1.3 },
      { g: cone(0.6, 1.2, 4),       c: 0x4a3c36, y: 2.9 },
    ],
    snowy: [
      { g: cyl(0.3, 0.38, 2.0, 4),  c: 0x6b5344, y: 1.0 },
      { g: cone(1.55, 3.0, 5),      c: 0x35694e, y: 3.0 },
      { g: cone(1.05, 1.8, 5),      c: 0xf2f7ff, y: 4.9 },
    ],
  };

  const rng = makeRng(20260921);
  const dummy = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  const SPAN = (ISLAND_R + 14) * 2;
  const sectorOf = (x, z) => {
    const i = Math.min(SECT - 1, Math.max(0, Math.floor((x + SPAN / 2) / SPAN * SECT)));
    const j = Math.min(SECT - 1, Math.max(0, Math.floor((z + SPAN / 2) / SPAN * SECT)));
    return j * SECT + i;
  };
  const emptyBuckets = () => Array.from({ length: SECT * SECT }, () => []);

  const treeSpots = {}; for (const k in TREES) treeSpots[k] = emptyBuckets();
  const rockSpots = emptyBuckets();
  const flowerSpots = emptyBuckets();

  const dVol = (x, z) => Math.hypot(x - G5C.x, z - G5C.z);
  const farFromSolids = (x, z, pad = 3.5) =>
    !solids.some(s => Math.hypot(x - s.x, z - s.z) < s.r + pad);

  const TRIES = 20000;
  const ROLL  = 5.0;   // 大きいほど まばらになる
  for (let i = 0; i < TRIES; i++){
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (ISLAND_R - 26);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;

    if (r < VILLAGE_R * 0.7) continue;
    const dv = dVol(x, z);
    if (dv < REGION_R * 0.42) continue;          // 火口のまわりは何も生えない
    if (onRoad(x, z, 11)) continue;
    const h = heightAt(x, z);
    if (h < 1.2) continue;
    if (!farFromSolids(x, z)) continue;

    const b = biomeAt(x, z);
    const type = b.top === 'center' ? BIOME_CENTER.trees : BIOMES[b.top].trees;
    const dens = biomeNum(b.w, 'density');
    const flw  = biomeNum(b.w, 'flowers');
    const rck  = biomeNum(b.w, 'rocks');

    const spot = { x, z, s: 0.8 + rng() * 0.55, ry: rng() * Math.PI * 2, y: h };
    const sc = sectorOf(x, z);
    const roll = rng() * ROLL;
    if (roll < dens)                   treeSpots[type][sc].push(spot);
    else if (roll < dens + rck * 0.45) rockSpots[sc].push({ ...spot, snow: b.w.g6 > 0.4, hot: b.w.g5 > 0.4 });
    else if (roll < dens + rck * 0.45 + flw * 0.45) flowerSpots[sc].push(spot);
  }

  /** 区画ごとに InstancedMesh を作る（画面の外は描かれない） */
  function instanceBuckets(geo, mat, buckets, place){
    for (const spots of buckets){
      if (!spots.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach((p, i) => place(p, i, m));
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      grp.add(m);
    }
  }

  for (const [type, parts] of Object.entries(TREES)){
    for (const part of parts){
      const mat = MF(part.c);
      instanceBuckets(part.g, mat, treeSpots[type], (p, i, m) => {
        dummy.position.set(p.x, p.y + part.y * p.s, p.z);
        dummy.rotation.set(0, p.ry, 0);
        dummy.scale.set(p.s, p.s * (part.sy || 1), p.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
    }
  }

  instanceBuckets(ico(0.85), MF(0xffffff), rockSpots, (p, i, m) => {
    dummy.position.set(p.x, p.y + 0.32 * p.s, p.z);
    dummy.rotation.set(rng() * 0.4, p.ry, rng() * 0.4);
    dummy.scale.set(p.s, p.s * 0.8, p.s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, tmpCol.setHex(p.snow ? 0xdfeaf4 : (p.hot ? 0x5d4a44 : 0x9fadb8)));
  });

  const fcolors = [0xff8fb1, 0xffe066, 0xffffff, 0xc79bff];
  instanceBuckets(new THREE.TetrahedronGeometry(0.3), M(0xffffff), flowerSpots, (p, i, m) => {
    dummy.position.set(p.x, p.y + 0.02, p.z);
    dummy.rotation.set(0, p.ry, 0);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, tmpCol.setHex(fcolors[i % fcolors.length]));
  });

  // ---- 歩いてよいかの判定 ------------------------------------------------

  /** @returns {{ok:boolean, why?:string, region?:object}} */
  function probe(x, z){
    const r = Math.hypot(x, z);
    if (r > ISLAND_R - 22) return { ok: false, why: 'sea' };
    if (heightAt(x, z) < 0.35) return { ok: false, why: 'sea' };

    for (const rg of REGIONS){
      if (rg.open) continue;
      const c = regionCenter(rg);
      if (Math.hypot(x - c.x, z - c.z) < REGION_R) return { ok: false, why: 'closed', region: rg };
    }
    if (dVol(x, z) < 10) return { ok: false, why: 'lava' };

    for (const s of solids){
      if (Math.hypot(x - s.x, z - s.z) < s.r) return { ok: false, why: 'solid' };
    }
    return { ok: true };
  }
  const canWalk = (x, z) => probe(x, z).ok;

  function regionAt(x, z){
    if (dVol(x, z) < REGION_R) return G5;
    for (const rg of REGIONS){
      if (rg.open) continue;
      const c = regionCenter(rg);
      if (Math.hypot(x - c.x, z - c.z) < REGION_R) return rg;
    }
    return null;
  }
  function placeName(x, z){
    const rg = regionAt(x, z);
    if (rg) return { id: rg.id, label: `{${rg.name}|${rg.yomi}}の{地方|ちほう}` };
    if (Math.hypot(x, z) < VILLAGE_R + 5) return { id: 'village', label: '{はじまりの村|はじまりのむら}' };
    let near = null, nd = 1e9;
    for (const rg2 of REGIONS){
      const c = regionCenter(rg2);
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < nd){ nd = d; near = rg2; }
    }
    if (near && nd < REGION_R * 1.9){
      return { id: 'to-' + near.id, label: `{${near.name}|${near.yomi}}へ むかう {道|みち}` };
    }
    return { id: 'field', label: '{島|しま}の {野原|のはら}' };
  }

  // ---- 毎コマの動き ------------------------------------------------------

  const lavaA = new THREE.Color(0xff6a1a), lavaB = new THREE.Color(0xffc247);
  function update(dt, t){
    for (const a of animated){
      if (a.kind === 'npc'){
        a.obj.position.y = a.base + Math.sin(t * 1.8 + a.ph) * 0.06;
      } else if (a.kind === 'lava'){
        a.obj.material.color.copy(lavaA).lerp(lavaB, (Math.sin(t * 1.6) + 1) / 2 * 0.7);
      } else if (a.kind === 'fire'){
        a.obj.scale.setScalar(0.85 + Math.sin(t * 7 + a.ph) * 0.18);
      } else if (a.kind === 'smoke'){
        const p = ((t * 0.16 + a.i / a.n) % 1);
        a.obj.position.y = a.base + p * a.span;
        a.obj.material.opacity = 0.4 * (1 - p) * (p < 0.12 ? p / 0.12 : 1);
        a.obj.scale.setScalar(0.7 + p * 1.6);
      }
    }
  }

  return { group: grp, interactables, canWalk, probe, regionAt, placeName, update, craterY, bossSpots, bossModels, dungeonSpots };
}
