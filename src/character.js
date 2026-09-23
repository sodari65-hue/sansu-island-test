// 主人公キャラ（キノコ）を character/config/character.json の数値から組み立てる。
// （キャラ生成・選択画面 設計書 4〜7章）
//
//  ・固定パーツ：cap（かさ）/ gills（ひだ）/ body（柄）/ arm_L・arm_R / leg_L・leg_R / wing_L・wing_R / face
//  ・変更パーツ：hat（帽子。色だけ変える）/ face（4表情。画像の表示位置を切りかえる）/ item（右手に持つ）
//  ・見た目：MeshToonMaterial の段階的な陰影 ＋ ひとまわり大きい裏返しモデルを黒で描く輪郭線
//  ・動き：idle / walk / jump / cheer / attack / damaged（ボーンは使わず、パーツごとに動かす）
//
// ※ 設計書では Blender でつくった GLB を読みこむ流れだが、この環境には Blender がないため、
//   同じ数値からブラウザの中で直接組み立てている。パーツIDと動きIDは設計書どおり。

import { gradientMap, outlineMaterial } from './toon.js';

let CFG = null;
let FACE_IMG = null;

/** 設定と表情画像を読む（ゲームの最初に1回） */
export async function loadCharacter(THREE){
  if (CFG) return CFG;
  const r = await fetch('./character/config/character.json', { cache: 'no-store' });
  CFG = await r.json();
  FACE_IMG = await new Promise(res => {
    new THREE.TextureLoader().load('./' + CFG.faceTexture, t => res(t), undefined, () => res(null));
  });
  return CFG;
}
export const characterConfig = () => CFG;

/** ひだの放射線の絵（コードで描く） */
function gillsTexture(THREE, p){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = p.color; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = p.lineColor; g.lineWidth = 2;
  for (let i = 0; i < p.lines; i++){
    const a = (i / p.lines) * Math.PI * 2;
    g.beginPath(); g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
    g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * キャラを1体つくる。
 * @param makeItem (id) => THREE.Object3D  持ち物のモデルをつくる関数（items.js）
 */
export function createCharacter(THREE, { makeItem } = {}){
  const cfg = CFG;
  const P = cfg.parts;
  const grad = gradientMap(THREE, cfg.toonSteps);
  const olMat = outlineMaterial(THREE, cfg.outline.color, cfg.outline.width);
  const toon = color => new THREE.MeshToonMaterial({ color, gradientMap: grad });

  const root = new THREE.Group();      // 世界での位置と向き
  const rig  = new THREE.Group();      // はずみ・かたむき（動きで使う）
  root.add(rig);
  rig.scale.setScalar(cfg.scale);

  let triangles = 0;
  /** パーツを足す（輪郭線つき） */
  function part(geo, mat, parent, { outline = true, name } = {}){
    const m = new THREE.Mesh(geo, mat);
    m.name = name || '';
    parent.add(m);
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    if (outline){
      const o = new THREE.Mesh(geo, olMat);
      o.name = (name || '') + ':outline';
      m.add(o);
      triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    }
    return m;
  }

  // ---- 足 ----
  const legs = {};
  // キャラは +z（こちら）を向くので、右は -x がわ
  for (const [side, sx] of [['L', 1], ['R', -1]]){
    const pivot = new THREE.Group();
    pivot.position.set(sx * P.leg.x, P.leg.y + P.leg.length * 0.5, 0);
    rig.add(pivot);
    const leg = part(new THREE.CapsuleGeometry(P.leg.radius, P.leg.length * 0.6, 3, 8), toon(P.leg.color), pivot, { name: 'leg_' + side });
    leg.position.y = -P.leg.length * 0.5;
    legs[side] = pivot;
  }

  // ---- 柄（胴体）：下がふくらんだ形 ----
  const prof = [];
  const n = 10;
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const bulge = Math.sin(t * Math.PI) * 0.05;
    prof.push(new THREE.Vector2(P.body.bottomRadius + (P.body.topRadius - P.body.bottomRadius) * t + bulge * (1 - t), t * P.body.height));
  }
  prof.unshift(new THREE.Vector2(0.001, 0));
  prof.push(new THREE.Vector2(0.001, P.body.height));
  const body = part(new THREE.LatheGeometry(prof, 12), toon(P.body.color), rig, { name: 'body' });
  body.position.y = P.body.y - P.body.height / 2;

  // ---- 腕（肩を支点にまわす） ----
  const arms = {};
  let handR = null;
  for (const [side, sx] of [['L', 1], ['R', -1]]){
    const pivot = new THREE.Group();
    pivot.position.set(sx * P.arm.x, P.arm.y, 0);
    pivot.rotation.z = sx * 0.55;           // 少し開いた形がふつう（外がわへ）
    rig.add(pivot);
    const a = part(new THREE.CapsuleGeometry(P.arm.radius, P.arm.length * 0.7, 3, 6), toon(P.arm.color), pivot, { name: 'arm_' + side });
    a.position.y = -P.arm.length * 0.5;
    const hand = part(new THREE.SphereGeometry(P.arm.handRadius, 8, 6), toon(P.arm.color), pivot, { name: 'hand_' + side });
    hand.position.y = -P.arm.length;
    arms[side] = pivot;
    if (side === 'R') handR = hand;
  }
  const itemSlot = new THREE.Group();
  itemSlot.position.set(0, -0.02, 0.06);
  handR.add(itemSlot);

  // ---- 羽（せなか） ----
  const wings = {};
  const ws = new THREE.Shape();
  ws.moveTo(0, 0);
  ws.bezierCurveTo(P.wing.width * 0.2, P.wing.height, P.wing.width, P.wing.height * 1.1, P.wing.width, P.wing.height * 0.45);
  ws.bezierCurveTo(P.wing.width * 0.9, 0.02, P.wing.width * 0.35, -0.04, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(ws, 8);
  const wingMat = new THREE.MeshToonMaterial({ color: P.wing.color, gradientMap: grad, side: THREE.DoubleSide });
  for (const [side, sx] of [['L', 1], ['R', -1]]){
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.06, P.wing.y, P.wing.z);
    rig.add(pivot);
    const w = part(wingGeo, wingMat, pivot, { outline: false, name: 'wing_' + side });
    w.scale.x = sx;
    w.rotation.y = sx * 0.35;
    // ふちどり（羽は平らなので、少し大きい同じ形を後ろに置く）
    const edge = new THREE.Mesh(wingGeo, new THREE.MeshBasicMaterial({ color: P.wing.edge, side: THREE.DoubleSide }));
    edge.scale.set(1.08, 1.08, 1); edge.position.z = -0.005;
    w.add(edge);
    wings[side] = pivot;
  }

  // ---- かさ・ひだ・顔・帽子（まとめて かたむけられるようにする） ----
  const head = new THREE.Group();
  head.position.y = P.cap.y;
  rig.add(head);

  const cap = part(new THREE.SphereGeometry(P.cap.radius, 20, 11), toon(P.cap.color), head, { name: 'cap' });
  cap.scale.y = P.cap.squash;

  const gills = part(new THREE.CircleGeometry(P.gills.radius, 20),
    new THREE.MeshToonMaterial({ map: gillsTexture(THREE, P.gills), gradientMap: grad, side: THREE.DoubleSide }),
    head, { outline: false, name: 'gills' });
  gills.rotation.x = Math.PI / 2;
  gills.position.y = P.gills.y - P.cap.y;

  // 顔：かさの前面にはる。4つの表情を並べた1枚の画像の、どこを見せるかで切りかえる
  const faceTex = FACE_IMG ? FACE_IMG.clone() : null;
  if (faceTex){
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.repeat.set(0.25, 1);
    faceTex.needsUpdate = true;
  }
  const F = P.face;
  const face = part(
    new THREE.SphereGeometry(P.cap.radius * 1.012, 20, 10, F.phiStart, F.phiLength, F.thetaStart, F.thetaLength),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, alphaTest: 0.35, depthWrite: false,
                                  polygonOffset: true, polygonOffsetFactor: -2 }),
    cap, { outline: false, name: 'face' });

  // 通学帽（ドーム＋前のつば＋上のボタン）
  const hat = new THREE.Group();
  hat.position.y = P.hat.y - P.cap.y;
  hat.rotation.x = P.hat.tilt;
  head.add(hat);
  const hatMat = toon(cfg.hatColors[0].color);
  const dome = part(new THREE.SphereGeometry(P.hat.radius, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, hat, { name: 'hat' });
  dome.scale.y = P.hat.height / P.hat.radius;
  const brim = part(new THREE.CylinderGeometry(P.hat.brim, P.hat.brim, 0.035, 12, 1, false, -Math.PI / 2, Math.PI), hatMat, hat, { name: 'hat_brim' });
  brim.position.set(0, 0.01, P.hat.radius * 0.72);
  brim.scale.set(1.25, 1, 0.9);
  const button = part(new THREE.SphereGeometry(0.055, 8, 6), toon(P.hat.buttonColor), hat, { name: 'hat_button' });
  button.position.y = P.hat.height;

  // ---- 表情・帽子・持ち物 ----------------------------------------------

  const faceIndex = id => Math.max(0, cfg.faces.findIndex(f => f.id === id));
  let baseFace = 'smile';
  function showFace(id){ if (faceTex) faceTex.offset.x = faceIndex(id) * 0.25; }
  function setFace(id){ baseFace = id; if (!oneShot) showFace(id); }

  function setHatColor(id){
    const c = cfg.hatColors.find(h => h.id === id) || cfg.hatColors[0];
    hatMat.color.set(c.color);
  }

  let itemId = null;
  function setItem(id){
    itemId = id;
    itemSlot.clear();
    if (id && makeItem){
      const m = makeItem(id);
      if (m) itemSlot.add(m);
    }
  }

  // ---- 動き -------------------------------------------------------------
  // base（idle / walk）はくり返し、one-shot（jump / cheer / attack / damaged）は1回だけ。

  const ANIM = cfg.animations;
  let oneShot = null, oneT = 0, clock = 0, walkMix = 0;
  const autoFace = Object.fromEntries(cfg.faces.filter(f => f.auto).map(f => [f.auto, f.id]));

  function play(name){
    if (!ANIM[name] || ANIM[name].loop) return;
    oneShot = name; oneT = 0;
    showFace(autoFace[name] || baseFace);
  }

  /** @param moving 歩いているか */
  function update(dt, { moving = false } = {}){
    clock += dt;
    walkMix += ((moving ? 1 : 0) - walkMix) * Math.min(1, dt * 8);

    // まず ふつうの形にもどす
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    legs.L.rotation.set(0, 0, 0); legs.R.rotation.set(0, 0, 0);
    arms.L.rotation.set(0, 0, 0.55); arms.R.rotation.set(0, 0, -0.55);
    wings.L.rotation.set(0, 0, 0); wings.R.rotation.set(0, 0, 0);

    // idle（2秒でふわふわ）
    const ip = (clock / ANIM.idle.duration) * Math.PI * 2;
    rig.position.y += Math.sin(ip) * 0.03 * (1 - walkMix);
    arms.L.rotation.z += Math.sin(ip) * 0.06; arms.R.rotation.z -= Math.sin(ip) * 0.06;
    const flap = Math.sin(clock * 3) * 0.18;
    wings.L.rotation.y = flap; wings.R.rotation.y = -flap;

    // walk（0.8秒で1歩ずつ交互）
    if (walkMix > 0.01){
      const wp = (clock / ANIM.walk.duration) * Math.PI * 2;
      const s = Math.sin(wp) * walkMix;
      legs.L.rotation.x = s * 0.7; legs.R.rotation.x = -s * 0.7;
      arms.L.rotation.x = -s * 0.6; arms.R.rotation.x = s * 0.6;
      rig.rotation.z = Math.sin(wp) * 0.06 * walkMix;
      rig.position.y += Math.abs(Math.cos(wp)) * 0.06 * walkMix;
      head.rotation.z = -Math.sin(wp) * 0.04 * walkMix;
    }

    // 1回だけの動き
    if (oneShot){
      oneT += dt;
      const D = ANIM[oneShot].duration;
      const p = Math.min(1, oneT / D);
      const up = Math.sin(p * Math.PI);
      if (oneShot === 'jump'){
        arms.L.rotation.z = 0.55 + up * 1.9; arms.R.rotation.z = -0.55 - up * 1.9;
        legs.L.rotation.x = up * 0.5; legs.R.rotation.x = up * 0.5;
        wings.L.rotation.y = -Math.sin(oneT * 22) * 0.5; wings.R.rotation.y = Math.sin(oneT * 22) * 0.5;
        head.rotation.x = -up * 0.15;
      } else if (oneShot === 'cheer'){
        const hop = Math.abs(Math.sin(p * Math.PI * 2));
        rig.position.y += hop * 0.28;
        arms.L.rotation.z =  2.5 - Math.sin(oneT * 14) * 0.25;
        arms.R.rotation.z = -2.5 + Math.sin(oneT * 14) * 0.25;
        wings.L.rotation.y = -Math.sin(oneT * 18) * 0.6; wings.R.rotation.y = Math.sin(oneT * 18) * 0.6;
      } else if (oneShot === 'attack'){
        // 体当たり：ためて、前へ とびこんで、もどる
        const dash = p < 0.3 ? -p / 0.3 * 0.12 : Math.sin(((p - 0.3) / 0.7) * Math.PI) * 0.55;
        rig.position.z += dash;
        rig.rotation.x = p < 0.3 ? -0.2 * (p / 0.3) : 0.45 * Math.sin(((p - 0.3) / 0.7) * Math.PI);
        arms.L.rotation.x = -1.2 * up; arms.R.rotation.x = -1.2 * up;
      } else if (oneShot === 'damaged'){
        rig.rotation.x = -0.45 * up;
        rig.position.z -= 0.25 * up;
        rig.position.x += Math.sin(oneT * 40) * 0.04 * (1 - p);
        arms.L.rotation.z = 1.2 * up + 0.55; arms.R.rotation.z = -1.2 * up - 0.55;
      }
      if (p >= 1){ oneShot = null; showFace(baseFace); }
    }
  }

  setHatColor(cfg.hatColors[0].id);
  showFace(baseFace);

  /** 持ち物だけ黒い影にする（未解放の表示用） */
  function silhouette(on){
    itemSlot.traverse(o => {
      if (!o.isMesh || o.name.endsWith(':outline')) return;
      if (on){ o.userData.mat ||= o.material; o.material = new THREE.MeshBasicMaterial({ color: 0x2a2a2a }); }
      else if (o.userData.mat){ o.material = o.userData.mat; }
    });
  }

  return {
    root, rig, head, itemSlot,
    setHatColor, setFace, setItem, silhouette, play, update,
    get item(){ return itemId; }, get face(){ return baseFace; }, get playing(){ return oneShot; },
    triangles: () => triangles,
    height: (P.hat.y + P.hat.height) * cfg.scale,
  };
}
