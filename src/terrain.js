// 島の地形と気候。乱数を使わないので、何度ひらいても同じ島になる。

import {
  ISLAND_R, BEACH_W, VILLAGE_R, REGION_R, GATE_R,
  REGIONS, regionCenter, G5C, VOLCANO_H, SEA_Y,
  ONSEN_SPEC, BIOMES, BIOME_CENTER, BIOME_REACH, CHUNKS, CHUNK_DIV
} from './config.js';

export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
export const lerp  = (a, b, t) => a + (b - a) * t;

// a から b へ、なめらかに 0→1 になる（a>b でも使える）
export function sstep(a, b, t){
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

// 点から線分までのきょり
export function distSeg(px, pz, ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  let t = L2 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = clamp(t, 0, 1);
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

// 各地方の中心（毎回計算しないよう先に出しておく）
export const CENTERS = REGIONS.map(r => ({ r, c: regionCenter(r) }));

// 村のふちから各地方の門までの道
export const ROADS = REGIONS.map(r => {
  const c = regionCenter(r);
  const L = Math.hypot(c.x, c.z);
  const ux = c.x / L, uz = c.z / L;
  return {
    id: r.id, open: r.open,
    ax: ux * (VILLAGE_R - 2), az: uz * (VILLAGE_R - 2),
    bx: ux * GATE_R,          bz: uz * GATE_R,
    ux, uz
  };
});

export function gatePos(r){
  const c = regionCenter(r);
  const L = Math.hypot(c.x, c.z);
  return { x: c.x / L * GATE_R, z: c.z / L * GATE_R };
}

// ---- 高さ ----------------------------------------------------------------

/** 温泉の平らな地面を入れる前の高さ（温泉の高さを決めるのに使う） */
function baseHeight(x, z){
  let h = 2.6
    + Math.sin(x * 0.022) * Math.cos(z * 0.027) * 3.4
    + Math.sin((x * 0.6 + z * 0.8) * 0.019) * 2.6
    + Math.cos((x * 0.8 - z * 0.6) * 0.034) * 1.3
    + Math.sin((x - z) * 0.011) * 2.0;

  // 火山（5年の地方）
  const dv = Math.hypot(x - G5C.x, z - G5C.z);
  if (dv < REGION_R){
    const cone   = sstep(REGION_R, 8.0, dv) * VOLCANO_H;
    const crater = sstep(15.0, 4.0, dv) * 16.0;    // まん中をへこませる
    h = Math.max(h, 1.0 + cone - crater);
  }

  // 4年の地方は山がちにする（火山とは別の、ごつごつした高まり）
  const g4 = CENTERS.find(e => e.r.id === 'g4');
  const d4 = Math.hypot(x - g4.c.x, z - g4.c.z);
  if (d4 < REGION_R + 10){
    h += sstep(REGION_R + 10, 5, d4) * (13 + Math.sin(x * 0.07) * Math.cos(z * 0.065) * 6.5);
  }

  // 6年（雪原）はなだらかな雪の丘
  const g6 = CENTERS.find(e => e.r.id === 'g6');
  const d6 = Math.hypot(x - g6.c.x, z - g6.c.z);
  if (d6 < REGION_R + 10){
    h += sstep(REGION_R + 10, 8, d6) * (6.5 + Math.sin(x * 0.035 + z * 0.03) * 3.5);
  }
  return h;
}

// 温泉（地面を平らにする場所）。高さはここで決まる。
export const ONSEN = ONSEN_SPEC.map(o => {
  const a = o.deg * Math.PI / 180;
  const x = G5C.x + Math.cos(a) * o.dist;
  const z = G5C.z + Math.sin(a) * o.dist;
  return { x, z, r: o.r, y: baseHeight(x, z) };
});

export function heightAt(x, z){
  const r = Math.hypot(x, z);
  if (r > ISLAND_R + 10) return -4;

  let h = baseHeight(x, z);

  // 温泉のまわりは平らに（斜面に湯だまりが埋まらないように）
  for (const o of ONSEN){
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.r + 8) h = lerp(h, o.y, sstep(o.r + 8, o.r, d));
  }

  // 村は平らに
  h = lerp(h, 1.0, sstep(VILLAGE_R + 12, VILLAGE_R - 6, r));

  // 道も平らに
  for (const rd of ROADS){
    const s = distSeg(x, z, rd.ax, rd.az, rd.bx, rd.bz);
    if (s.d < 11) h = lerp(h, 1.2, sstep(11, 5.5, s.d));
  }

  // 砂浜 → 海へ落とす
  const edge = sstep(ISLAND_R, ISLAND_R - BEACH_W, r);  // 島の内側で 1
  return h * edge - (1 - edge) * 5.0;
}

// ---- 気候（地方への近さ） ------------------------------------------------

const BIOME_IDS = REGIONS.map(r => r.id);

/**
 * その場所が、どの地方の「らしさ」にどれだけ寄っているか。
 * 地方の半径の BIOME_REACH 倍まで、じわっと効く。合計が1になるようにそろえる。
 * @returns {{w: Object, top: string, topW: number}}
 */
export function biomeAt(x, z){
  const w = {};
  let sum = 0;
  for (const { r, c } of CENTERS){
    const d = Math.hypot(x - c.x, z - c.z);
    const v = sstep(REGION_R * BIOME_REACH, REGION_R * 0.4, d);
    w[r.id] = v;
    sum += v;
  }
  // 残りは「はじまりの村のまわり」
  const center = Math.max(0, 1 - sum);
  const total = sum + center;
  let top = 'center', topW = center / total;
  for (const id of BIOME_IDS){
    w[id] /= total;
    if (w[id] > topW){ top = id; topW = w[id]; }
  }
  w.center = center / total;
  return { w, top, topW };
}

/** 気候にあわせて混ぜた色 */
export function biomeGround(w){
  let r = BIOME_CENTER.ground[0] * w.center;
  let g = BIOME_CENTER.ground[1] * w.center;
  let b = BIOME_CENTER.ground[2] * w.center;
  for (const id of BIOME_IDS){
    const k = w[id];
    if (k <= 0) continue;
    const c = BIOMES[id].ground;
    r += c[0] * k; g += c[1] * k; b += c[2] * k;
  }
  return [r, g, b];
}

/** 気候にあわせて混ぜた空の色（0xRRGGBB を返す） */
export function biomeSky(w){
  const mix = [0, 0, 0];
  const add = (hex, k) => {
    mix[0] += ((hex >> 16) & 255) / 255 * k;
    mix[1] += ((hex >> 8) & 255) / 255 * k;
    mix[2] += (hex & 255) / 255 * k;
  };
  add(BIOME_CENTER.sky, w.center);
  for (const id of BIOME_IDS) if (w[id] > 0) add(BIOMES[id].sky, w[id]);
  return mix;
}

/** 気候ごとの値（木の多さなど）を混ぜる */
export function biomeNum(w, key){
  let v = BIOME_CENTER[key] * w.center;
  for (const id of BIOME_IDS) if (w[id] > 0) v += BIOMES[id][key] * w[id];
  return v;
}

// ---- 場所の種類（色分けと、歩ける／歩けないの判定に使う） ----------------

export function onRoad(x, z, w = 7){
  for (const rd of ROADS){
    if (distSeg(x, z, rd.ax, rd.az, rd.bx, rd.bz).d < w) return true;
  }
  return false;
}

export function zoneAt(x, z, h){
  const r  = Math.hypot(x, z);
  const dv = Math.hypot(x - G5C.x, z - G5C.z);
  if (h < 0.2) return 'sand';
  if (onRoad(x, z)) return 'road';
  if (dv < REGION_R * 0.66) return 'rock';   // 火山の山はだ
  if (r < VILLAGE_R + 5)    return 'village';
  return 'ground';
}

// 決まった「ばらつき」（乱数のかわり）
export function hash2(x, z){
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---- 島のメッシュを作る --------------------------------------------------

const SAND    = [0.945, 0.882, 0.706];
const ROAD    = [0.784, 0.639, 0.451];
const VILLAGE = [0.580, 0.835, 0.510];
const ROCK_LO = [0.541, 0.435, 0.388];
const ROCK_HI = [0.290, 0.220, 0.212];

/**
 * 島を四角いかたまり（チャンク）に分けて作る。
 * 1枚の大きなメッシュだと画面の外まで毎回描いてしまうが、
 * 分けておけば Three.js が見えていないかたまりを自動で省いてくれる。
 */
export function buildIsland(THREE){
  const grp = new THREE.Group();
  grp.name = 'island';
  const W  = (ISLAND_R + 14) * 2;
  const CW = W / CHUNKS;                       // かたまり1つの1辺
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (let cz = 0; cz < CHUNKS; cz++){
    for (let cx = 0; cx < CHUNKS; cx++){
      const ox = -W / 2 + CW * (cx + 0.5);
      const oz = -W / 2 + CW * (cz + 0.5);
      // まるごと海の中のかたまりは作らない
      if (Math.hypot(ox, oz) - CW * 0.75 > ISLAND_R + 4) continue;
      const m = buildChunk(THREE, mat, ox, oz, CW);
      if (m) grp.add(m);
    }
  }
  return grp;
}

function buildChunk(THREE, mat, ox, oz, CW){
  const N = CHUNK_DIV;
  const geo = new THREE.PlaneGeometry(CW, CW, N, N);
  geo.rotateX(-Math.PI / 2);
  geo.translate(ox, 0, oz);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++){
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }

  const g = geo.toNonIndexed();
  geo.dispose();

  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let t = 0; t < p.count; t += 3){
    // 三角形のまん中で色を決める（面ごとに1色＝カクカクした見た目）
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++){ cx += p.getX(t + k); cy += p.getY(t + k); cz += p.getZ(t + k); }
    cx /= 3; cy /= 3; cz /= 3;

    const zone = zoneAt(cx, cz, cy);
    let c;
    if (zone === 'sand')         c = SAND;
    else if (zone === 'road')    c = ROAD;
    else if (zone === 'village') c = VILLAGE;
    else if (zone === 'rock'){
      const dv = Math.hypot(cx - G5C.x, cz - G5C.z);
      const up = clamp((cy - 2) / (VOLCANO_H - 2), 0, 1);
      const k  = Math.max(up, sstep(14, 4, dv) * 0.85);
      c = [lerp(ROCK_LO[0], ROCK_HI[0], k), lerp(ROCK_LO[1], ROCK_HI[1], k), lerp(ROCK_LO[2], ROCK_HI[2], k)];
    } else {
      // ふつうの地面は、近くの地方の気候にあわせて色が変わっていく
      c = biomeGround(biomeAt(cx, cz).w);
      // 高いところは雪をかぶる（山・雪原らしさ）
      const snow = sstep(VOLCANO_H * 0.62, VOLCANO_H * 0.95, cy);
      if (snow > 0 && Math.hypot(cx - G5C.x, cz - G5C.z) > REGION_R){
        c = [lerp(c[0], 0.95, snow), lerp(c[1], 0.97, snow), lerp(c[2], 1.0, snow)];
      }
    }
    const n = 0.93 + hash2(Math.round(cx * 2), Math.round(cz * 2)) * 0.14;
    for (let k = 0; k < 3; k++){
      col[(t + k) * 3    ] = clamp(c[0] * n, 0, 1);
      col[(t + k) * 3 + 1] = clamp(c[1] * n, 0, 1);
      col[(t + k) * 3 + 2] = clamp(c[2] * n, 0, 1);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return new THREE.Mesh(g, mat);
}

export function buildSea(THREE){
  const grp = new THREE.Group();
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(430, 64),
    new THREE.MeshLambertMaterial({ color: 0x3ea9dd })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  grp.add(sea);

  for (let i = 0; i < 3; i++){
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_R - 7 + i * 8, ISLAND_R - 2 + i * 8, 84),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.36 - i * 0.1, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = SEA_Y + 0.05 + i * 0.01;
    grp.add(ring);
  }
  grp.name = 'sea';
  return grp;
}
