// 持ち物のモデル（出題・称号・報酬 実装計画書 8.5）
// モデルは どんぐり＋9種だけ。色（学年）と柄（敵の種類×段階）は表面の絵で変える。
// すべてコードで作る（画像ファイルなし）。

/** 柄を描く（2Dの一覧画面でも使う） */
export function paintPattern(g, size, pattern, color){
  const light = mix(color, '#ffffff', 0.45), dark = mix(color, '#000000', 0.25);
  g.fillStyle = color; g.fillRect(0, 0, size, size);
  const u = size / 8;
  g.save();
  switch (pattern){
    case 'stripe':
      g.strokeStyle = light; g.lineWidth = u * 1.2;
      for (let i = -size; i < size * 2; i += u * 3){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke(); }
      break;
    case 'sparkle':
      g.fillStyle = '#ffffff';
      for (const [x, y, r] of [[2, 2, 1.3], [6, 3, 0.9], [4, 6, 1.1], [1, 6, 0.7], [6.5, 6.5, 0.7]]) star4(g, x * u, y * u, r * u);
      break;
    case 'dots':
      g.fillStyle = light;
      for (let y = 0; y < 8; y += 2.6) for (let x = (y % 5.2 ? 1.3 : 0); x < 8.5; x += 2.6){
        g.beginPath(); g.arc(x * u + u * 0.7, y * u + u * 0.7, u * 0.7, 0, 7); g.fill();
      }
      break;
    case 'check':
      g.fillStyle = light;
      for (let y = 0; y < 8; y += 2) for (let x = (y / 2) % 2 ? 2 : 0; x < 8; x += 4) g.fillRect(x * u, y * u, u * 2, u * 2);
      break;
    case 'star':
      g.fillStyle = '#fff6b0';
      for (const [x, y, r] of [[2, 2, 1.4], [6, 5.5, 1.4], [5.5, 1.5, 0.8], [1.5, 6, 0.8]]) star5(g, x * u, y * u, r * u);
      break;
    case 'q1': {  // にじ
      const cs = ['#ff6b6b', '#ffb347', '#ffe066', '#6bd66b', '#5aa9ff', '#a07cff'];
      cs.forEach((c, i) => { g.fillStyle = mix(c, color, 0.25); g.fillRect(0, i * size / 6, size, size / 6 + 1); });
      break;
    }
    case 'q2':    // ハート
      g.fillStyle = '#ffd1dc';
      for (const [x, y] of [[2, 2], [6, 2.5], [4, 5.5], [1, 6.5], [7, 6.8]]) heart(g, x * u, y * u, u * 0.9);
      break;
    case 'q3':    // なみ
      g.strokeStyle = light; g.lineWidth = u * 0.7;
      for (let y = 1; y < 8; y += 2.2){
        g.beginPath();
        for (let x = 0; x <= 8; x += 0.25) g.lineTo(x * u, (y + Math.sin(x * 1.6) * 0.5) * u);
        g.stroke();
      }
      break;
    case 'q4':    // くも
      g.fillStyle = '#ffffff';
      for (const [x, y] of [[2.2, 2.5], [5.8, 5.5]]){
        for (const [dx, dy, r] of [[0, 0, 1], [1, -0.3, 1.2], [2, 0, 0.9]]){ g.beginPath(); g.arc((x + dx - 1) * u, (y + dy) * u, r * u, 0, 7); g.fill(); }
      }
      break;
    default: // plain（むじ）
      g.fillStyle = dark; g.globalAlpha = 0.18; g.fillRect(0, size * 0.7, size, size * 0.3); g.globalAlpha = 1;
  }
  g.restore();
}

function star4(g, x, y, r){
  g.beginPath();
  for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function star5(g, x, y, r){
  g.beginPath();
  for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function heart(g, x, y, s){
  g.beginPath(); g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.5, y - s, x, y - s * 0.2);
  g.bezierCurveTo(x + s * 0.5, y - s, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  g.fill();
}
function mix(a, b, t){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 持ち物のモデルを作る関数を返す。
 * @param itemDef (id) => { model, color, pattern }
 */
export function createItemFactory(THREE, itemDef){
  const texCache = new Map();
  function tex(pattern, color){
    const k = pattern + color;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    paintPattern(c.getContext('2d'), 64, pattern, color);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    texCache.set(k, t);
    return t;
  }
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const P = (pattern, color) => new THREE.MeshLambertMaterial({ map: tex(pattern, color) });
  const mesh = (geo, mat, g, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const WOOD = 0x9a6b3f, GOLD = 0xf2c94c;

  const BUILD = {
    acorn(g){
      const b = mesh(new THREE.SphereGeometry(0.13, 12, 10), L(0xa8743f), g, 0, 0.05, 0); b.scale.y = 1.25;
      const c = mesh(new THREE.SphereGeometry(0.14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), P('check', '#6b4a2b'), g, 0, 0.14, 0);
      c.scale.y = 0.6;
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 5), L(0x5b3d22), g, 0, 0.23, 0);
    },
    tool_A(g, m){   // かずの つえ
      mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6), L(WOOD), g, 0, 0.05, 0);
      const c = mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), m, g, 0, 0.38, 0); c.rotation.set(0.5, 0.6, 0.3);
    },
    tool_B(g, m){   // さんかく じょうぎ
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.36, 0); s.lineTo(0, 0.28); s.closePath();
      const h = new THREE.Path(); h.moveTo(0.06, 0.05); h.lineTo(0.2, 0.05); h.lineTo(0.06, 0.16); h.closePath();
      s.holes.push(h);
      const t = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }), m, g, -0.05, 0.02, 0);
      t.rotation.z = 0.3;
    },
    tool_C(g, m){   // ものさし ソード
      mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), m, g, 0, 0.33, 0);
      mesh(new THREE.BoxGeometry(0.2, 0.035, 0.05), L(GOLD), g, 0, 0.07, 0);
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), L(WOOD), g, 0, 0.0, 0);
    },
    tool_D(g, m){   // グラフの はた
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5), L(0xdddddd), g, 0, 0.12, 0);
      const f = mesh(new THREE.PlaneGeometry(0.26, 0.18), m, g, 0.13, 0.33, 0);
      f.material.side = THREE.DoubleSide;
      [0.05, 0.1, 0.07].forEach((h, i) => mesh(new THREE.BoxGeometry(0.04, h, 0.012), L(0xffffff), g, 0.05 + i * 0.07, 0.25 + h / 2, 0.01));
    },
    acc_A(g, m){    // ひらめきの ほうせき
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), L(GOLD), g, 0, 0.0, 0);
      const gem = mesh(new THREE.OctahedronGeometry(0.13, 0), m, g, 0, 0.26, 0); gem.scale.y = 1.35;
    },
    acc_B(g, m){    // かたちの メダル
      mesh(new THREE.BoxGeometry(0.06, 0.16, 0.01), L(0xe2463f), g, -0.03, 0.26, 0).rotation.z = 0.2;
      mesh(new THREE.BoxGeometry(0.06, 0.16, 0.01), L(0x2f7fd6), g, 0.03, 0.26, 0).rotation.z = -0.2;
      const d = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18), m, g, 0, 0.1, 0.01); d.rotation.x = Math.PI / 2;
    },
    acc_C(g, m){    // はかりの ペンダント
      mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), L(GOLD), g, 0, 0.3, 0);
      const dr = mesh(new THREE.SphereGeometry(0.09, 12, 10), m, g, 0, 0.13, 0); dr.scale.set(1, 1.3, 0.7);
    },
    acc_D(g, m){    // よみときの ルーペ
      const rim = mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), m, g, 0, 0.3, 0);
      mesh(new THREE.CircleGeometry(0.11, 18), new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), g, 0, 0.3, 0);
      mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.2, 6), L(WOOD), g, 0, 0.08, 0);
      rim.rotation.y = 0.001;
    },
    crown(g, m){    // しまの かんむり
      mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 14, 1, true), m, g, 0, 0.2, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++){
        const a = (i / 6) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.035, 0.1, 5), L(GOLD), g, Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15);
      }
    },
  };

  return function makeItem(id){
    const def = itemDef(id);
    if (!def) return null;
    const g = new THREE.Group();
    const build = BUILD[def.model] || BUILD.acorn;
    build(g, P(def.pattern || 'plain', def.color || '#999999'));
    g.rotation.x = -0.25;
    return g;
  };
}
