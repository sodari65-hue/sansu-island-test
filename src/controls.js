// そうさ ―
//   左下の丸        … 歩く（スティック）
//   右下のボタン    … たたかう・はなす・ジャンプ
//   なにもない場所  … 指でなぞると視点をまわす／2本指でズーム
// 指が同時に何本でも動くように Pointer Events を使う。

import { CAM } from './config.js';

export function createControls({ onAction } = {}){
  const stick  = document.getElementById('stick');
  const knob   = document.getElementById('knob');
  const canvas = document.getElementById('cv');

  const move = { x: 0, y: 0 };
  const keys = new Set();
  const cam  = { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist };

  // ---- 歩く（スティック） ------------------------------------------------

  let sid = null, scx = 0, scy = 0, srad = 52;

  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };

  function stickDown(e){
    if (sid !== null) return;
    sid = e.pointerId;
    const r = stick.getBoundingClientRect();
    scx = r.left + r.width / 2;
    scy = r.top + r.height / 2;
    srad = r.width * 0.34;
    try { stick.setPointerCapture(sid); } catch (err){}
    stick.classList.add('on');
    stickMove(e);
  }
  function stickMove(e){
    if (e.pointerId !== sid) return;
    let dx = e.clientX - scx, dy = e.clientY - scy;
    const d = Math.hypot(dx, dy);
    if (d > srad){ dx = dx / d * srad; dy = dy / d * srad; }
    setKnob(dx, dy);
    move.x = dx / srad;
    move.y = dy / srad;
    e.preventDefault();
  }
  function stickUp(e){
    if (e.pointerId !== sid) return;
    try { stick.releasePointerCapture(sid); } catch (err){}
    sid = null;
    stick.classList.remove('on');
    setKnob(0, 0);
    move.x = 0; move.y = 0;
  }

  stick.addEventListener('pointerdown', stickDown);
  stick.addEventListener('pointermove', stickMove);
  stick.addEventListener('pointerup', stickUp);
  stick.addEventListener('pointercancel', stickUp);

  // ---- 視点（画面のあいているところをなぞる） ----------------------------

  const touches = new Map();     // pointerId -> {x, y}
  let pinchDist = 0;

  function camDown(e){
    // 指が HUD の上を通っても追いつづけられるようにする
    try { canvas.setPointerCapture(e.pointerId); } catch (err){}
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) pinchDist = twoFingerDist();
  }
  function twoFingerDist(){
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function camMove(e){
    const prev = touches.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    prev.x = e.clientX; prev.y = e.clientY;

    if (touches.size >= 2){
      // 2本指 … ズーム
      const d = twoFingerDist();
      if (pinchDist > 0){
        cam.dist = clamp(cam.dist * (pinchDist / d), CAM.distMin, CAM.distMax);
      }
      pinchDist = d;
    } else {
      // 1本指 … まわす／見上げ下ろし
      cam.yaw   -= dx * CAM.turnSpeed;
      cam.pitch  = clamp(cam.pitch + dy * CAM.turnSpeed * 0.6, CAM.pitchMin, CAM.pitchMax);
    }
    e.preventDefault();
  }
  function camUp(e){
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
  }

  canvas.addEventListener('pointerdown', camDown);
  canvas.addEventListener('pointermove', camMove);
  canvas.addEventListener('pointerup', camUp);
  canvas.addEventListener('pointercancel', camUp);
  canvas.addEventListener('wheel', e => {
    cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 1.6, CAM.distMin, CAM.distMax);
    e.preventDefault();
  }, { passive: false });

  function resetCam(){
    cam.yaw = CAM.yaw; cam.pitch = CAM.pitch; cam.dist = CAM.dist;
  }

  // ---- 大きい丸ボタン ----------------------------------------------------

  for (const b of document.querySelectorAll('[data-action]')){
    b.addEventListener('click', () => onAction?.(b.dataset.action));
  }

  // ---- パソコンで試すとき用 ----------------------------------------------

  const KEYMAP = {
    ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
    ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
    KeyQ:'camL', KeyE:'camR',
  };
  function onKey(e, isDown){
    const k = KEYMAP[e.code];
    if (k){
      isDown ? keys.add(k) : keys.delete(k);
      e.preventDefault();
      return;
    }
    if (!isDown) return;
    if (e.code === 'Space')  { onAction?.('jump');   e.preventDefault(); }
    if (e.code === 'Enter' || e.code === 'KeyF') { onAction?.('talk');   e.preventDefault(); }
    if (e.code === 'KeyZ' || e.code === 'KeyJ')  { onAction?.('attack'); e.preventDefault(); }
    if (e.code === 'KeyR')   { resetCam(); e.preventDefault(); }
  }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  /** ゲームループから毎コマ呼ぶ。キーボードでの視点回転もここで進める。 */
  function tick(dt){
    if (keys.has('camL')) cam.yaw += dt * 1.6;
    if (keys.has('camR')) cam.yaw -= dt * 1.6;
  }

  /** スティックの傾き（キーボード入力もまぜる） */
  function read(){
    if (sid !== null || keys.size === 0) return move;
    const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const ky = (keys.has('down')  ? 1 : 0) - (keys.has('up')   ? 1 : 0);
    if (!kx && !ky) return move;
    const d = Math.hypot(kx, ky) || 1;
    return { x: kx / d, y: ky / d };
  }

  function reset(){
    keys.clear();
    if (sid !== null){ try { stick.releasePointerCapture(sid); } catch (e){} }
    sid = null; move.x = 0; move.y = 0; setKnob(0, 0);
    stick.classList.remove('on');
    touches.clear(); pinchDist = 0;
  }

  function destroy(){
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
  }

  return { read, tick, reset, destroy, cam, resetCam };
}

function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
