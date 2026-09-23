// 天気 ― 雪原に近づくと雪、火山に近づくと灰。
// 地方の「近さ」がそのまま降る量になるので、境目がなく、じわっと変わる。
//
// 点（Points）を1種類につき1つだけ使う。プレイヤーのまわりの箱の中で粒を
// ぐるぐる使いまわすので、いくら歩いても数はふえない＝軽い。

const BOX = { w: 70, h: 40, d: 70 };   // 粒をまく箱の大きさ

/** まるい粒の絵をコードで作る（画像ファイルは使わない） */
function dotTexture(THREE){
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
let DOT = null;

function makeField(THREE, { count, size, color, opacity }){
  const pos = new Float32Array(count * 3);
  const spd = new Float32Array(count * 2);   // 落ちる速さ・横ゆれの位相
  for (let i = 0; i < count; i++){
    pos[i * 3    ] = (Math.random() - 0.5) * BOX.w;
    pos[i * 3 + 1] = Math.random() * BOX.h;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX.d;
    spd[i * 2    ] = 0.5 + Math.random() * 0.9;
    spd[i * 2 + 1] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (!DOT) DOT = dotTexture(THREE);
  const mat = new THREE.PointsMaterial({
    color, size, map: DOT, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;   // 常にカメラのまわりにあるので切らない
  points.visible = false;
  return { points, pos, spd, count, baseOpacity: opacity };
}

export function createWeather(THREE, scene){
  const snow = makeField(THREE, { count: 900, size: 0.55, color: 0xffffff, opacity: 0.95 });
  const ash  = makeField(THREE, { count: 420, size: 0.40, color: 0xffb066, opacity: 0.8 });
  scene.add(snow.points, ash.points);

  // いまの強さ（0〜1）。目標へゆっくり近づけて、急に降りださないようにする。
  let snowNow = 0, ashNow = 0;

  function step(f, dt, t, cx, cy, cz, strength, fall, drift, up){
    f.points.visible = strength > 0.01;
    if (!f.points.visible) return;
    f.points.material.opacity = f.baseOpacity * strength;

    const p = f.pos;
    for (let i = 0; i < f.count; i++){
      const i3 = i * 3;
      const sp = f.spd[i * 2], ph = f.spd[i * 2 + 1];
      p[i3 + 1] += (up ? fall * sp : -fall * sp) * dt;
      p[i3    ] += Math.sin(t * 0.8 + ph) * drift * dt;
      p[i3 + 2] += Math.cos(t * 0.6 + ph) * drift * dt;

      // 箱からはみ出したら反対がわへ回す（カメラ基準）
      let dx = p[i3] - cx, dy = p[i3 + 1] - cy, dz = p[i3 + 2] - cz;
      if (dx >  BOX.w / 2) p[i3] -= BOX.w; else if (dx < -BOX.w / 2) p[i3] += BOX.w;
      if (dz >  BOX.d / 2) p[i3 + 2] -= BOX.d; else if (dz < -BOX.d / 2) p[i3 + 2] += BOX.d;
      if (dy < -BOX.h / 2) p[i3 + 1] += BOX.h; else if (dy > BOX.h / 2) p[i3 + 1] -= BOX.h;
    }
    f.points.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * @param wSnow 雪原への近さ 0〜1
   * @param wAsh  火山への近さ 0〜1
   * @param cam   カメラの位置（このまわりに粒をまく）
   */
  function update(dt, t, cam, wSnow, wAsh){
    const k = Math.min(1, dt * 1.2);      // ゆっくり強くなる／弱くなる
    snowNow += (wSnow - snowNow) * k;
    ashNow  += (wAsh  - ashNow)  * k;
    step(snow, dt, t, cam.x, cam.y, cam.z, snowNow, 3.2, 1.1, false);
    step(ash,  dt, t, cam.x, cam.y, cam.z, ashNow,  1.6, 0.7, true);   // 灰は舞い上がる
  }

  function reset(){
    snowNow = 0; ashNow = 0;
    snow.points.visible = false;
    ash.points.visible = false;
  }

  return { update, reset, get snow(){ return snowNow; }, get ash(){ return ashNow; } };
}
