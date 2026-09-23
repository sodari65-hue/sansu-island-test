// 主人公の うごき（歩く・ジャンプ・地面にそう）。見た目と表情・6種の動きは character.js のキャラにまかせる。

import { WALK_SPEED, JUMP_TIME } from './config.js';
import { heightAt, lerp } from './terrain.js';

/**
 * @param model createCharacter() でつくったキャラ
 */
export function createPlayer(THREE, scene, model, startX = 0, startZ = 4){
  const root = new THREE.Group();
  root.add(model.root);
  scene.add(root);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 18),
    new THREE.MeshBasicMaterial({ color: 0x15402a, transparent: true, opacity: 0.2, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  root.add(shadow);

  const state = {
    x: startX, z: startZ,
    heading: 0,
    jump: -1,          // 0以上ならジャンプ中の経過秒
    moving: false,
    groundY: heightAt(startX, startZ),
  };

  function setPos(x, z){
    state.x = x; state.z = z;
    state.groundY = heightAt(x, z);
    root.position.set(x, state.groundY, z);
  }
  setPos(startX, startZ);

  function jump(){
    if (state.jump >= 0) return;
    state.jump = 0;
    model.play('jump');
  }
  const swing   = () => model.play('attack');
  const cheer   = () => model.play('cheer');
  const damaged = () => model.play('damaged');

  /** 相手のほうを向く（たたかいのとき） */
  function face(x, z){ state.heading = Math.atan2(x - state.x, z - state.z); }

  /**
   * @param move    {x,z} すすむ向き（-1〜1）。カメラ基準への変換はゲーム側でしてある
   * @param canWalk (x,z) => boolean
   */
  function update(dt, move, canWalk){
    const len = Math.hypot(move.x, move.y);
    state.moving = len > 0.12;

    if (state.moving){
      const k = Math.min(1, len);
      const vx = (move.x / len) * k * WALK_SPEED * dt;
      const vz = (move.y / len) * k * WALK_SPEED * dt;
      // 壁にぶつかっても止まりきらないよう、縦横を別々に試す
      if (canWalk(state.x + vx, state.z)) state.x += vx;
      if (canWalk(state.x, state.z + vz)) state.z += vz;

      const want = Math.atan2(move.x, move.y);
      const diff = ((want - state.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      state.heading += diff * Math.min(1, dt * 12);
    }

    const gy = heightAt(state.x, state.z);
    state.groundY = lerp(state.groundY, gy, Math.min(1, dt * 14));

    let up = 0;
    if (state.jump >= 0){
      state.jump += dt;
      const p = state.jump / JUMP_TIME;
      if (p >= 1) state.jump = -1; else up = Math.sin(p * Math.PI) * 1.6;
    }

    root.position.set(state.x, state.groundY, state.z);
    model.root.position.y = up;
    model.root.rotation.y = state.heading;
    model.update(dt, { moving: state.moving && state.jump < 0 });
    shadow.scale.setScalar(Math.max(0.45, 1 - up * 0.3));
  }

  return { root, state, model, update, jump, swing, cheer, damaged, face, setPos };
}
