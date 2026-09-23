// トゥーン調（段階的な陰影）と黒い輪郭線の共通部品。主人公と敵で同じ見た目にそろえる。

const gradCache = new Map();

/** 陰影の段階（3段なら 暗・中・明） */
export function gradientMap(THREE, steps = 3){
  if (gradCache.has(steps)) return gradCache.get(steps);
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++){
    const v = Math.round(90 + (165 * i) / Math.max(1, steps - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  gradCache.set(steps, t);
  return t;
}

/** 輪郭線：面の向きにそって少しふくらませた裏返しモデルを、黒でぬる */
export function outlineMaterial(THREE, color = '#1b1410', width = 0.035){
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = position + normal * ${Number(width).toFixed(4)};`
    );
  };
  return m;
}

/**
 * 動かない部品を、材質の種類ごとに1つのメッシュへまとめる（描画命令を減らして iPad で軽くする）。
 * 色は「頂点の色」に移すので、色ちがいの部品もまとめられる。
 * まとめないもの：keep に入れた部品／子をもつ部品（輪郭線つき）／絵（map）をはった部品
 */
export function mergeChildren(THREE, parent, keep = new Set()){
  const groups = new Map();
  for (const m of [...parent.children]){
    if (!m.isMesh || keep.has(m) || m.children.length || m.material.map || Array.isArray(m.material)) continue;
    const mt = m.material;
    const key = `${mt.type}|${mt.transparent ? mt.opacity : 'o'}|${mt.side}|${mt.flatShading ? 'f' : 's'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const list of groups.values()){
    if (list.length < 2) continue;
    const parts = list.map(m => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      return { g, c: m.material.color };
    });
    const total = parts.reduce((a, p) => a + p.g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const { g, c } of parts){
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < n; i++){ col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += n;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
    merged.computeBoundingSphere();
    const mat = list[0].material.clone();
    mat.color.set(0xffffff);
    mat.vertexColors = true;
    parent.add(new THREE.Mesh(merged, mat));
    for (const m of list) parent.remove(m);
  }
  return parent;
}

export function toonMaterial(THREE, color, opts = {}){
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(THREE, opts.steps ?? 3), ...opts.extra });
}
