// ゲーム本体のとりまとめ ― データの読みこみ・描画・ゲームループ・保存のタイミング。

import * as THREE from '../vendor/three.module.js';
import { VILLAGE_R, QUALITY, AUTOSAVE_SEC, CAM, WEATHER_START, ISLAND_R, ENCOUNTER_R, CONTACT_R, CONTACT_GRACE } from './config.js';
import { buildIsland, buildSea, biomeAt, biomeSky, clamp, heightAt } from './terrain.js';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { createControls } from './controls.js';
import { createWeather } from './weather.js';
import { createEnemies } from './enemies.js';
import { createBattle } from './battle.js';
import { createQuest } from './quest.js';
import { createDungeon } from './dungeon.js';
import { createQuestionManager } from './questions.js';
import { createTitles } from './titles.js';
import { createUnlocks } from './unlocks.js';
import { createScreens } from './screens.js';
import { loadCharacter, createCharacter } from './character.js';
import { createItemFactory } from './items.js';
import { createUI } from './ui.js';
import * as SAVE from './save.js';
import * as BACKUP from './backup.js';
import { stopSpeak } from './furigana.js';
import { isChecked } from './review.js';
import { PLAYTEST, mountPlaytestNotice } from './playtest.js';

const REGION_GRADE = 5;     // いま開いている地方（火山）の学年

async function json(path){
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(path + ' が読めません');
  return r.json();
}
const tryJson = path => json(path).catch(() => null);

export async function boot(){
  mountPlaytestNotice();
  const canvas = document.getElementById('cv');
  const ui = createUI();

  function fail(msg){
    const m = document.getElementById('fatal');
    m.textContent = msg;
    m.classList.remove('hide');
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e){
    fail('この iPad では 3D（WebGL）を つかえません。' + e.message);
    return;
  }

  // ---- データと設定を読む ------------------------------------------------

  const [speciesD, gradesD, bossesD, npcsD, titlesCfg, unlockCfg, itemsCfg, ...questFiles] = await Promise.all([
    json('./data/species.json'), json('./data/grades.json'), json('./data/bosses.json'), json('./data/npcs.json'),
    json('./config/titles.json'), json('./config/unlocks.json'), json('./config/items.json'),
    ...[1, 2, 3, 4, 5, 6].map(g => tryJson(`./data/quests/g${g}.json`)),
  ]);
  const species = speciesD.species, grades = gradesD.grades, bosses = bossesD.bosses;
  const allQuests = questFiles.flatMap(f => (f?.quests || []).map(q => ({ ...q, grade: q.grade ?? f.grade })));
  const dungeonIds = [...new Set(Object.values(unlockCfg.bossUnlock).map(u => u.requireDungeon).filter(Boolean))];
  const dungeons = (await Promise.all(dungeonIds.map(id => tryJson(`./data/dungeons/${id}.json`)))).filter(Boolean);
  const bossData = new Map();
  await Promise.all(bosses.filter(b => b.file).map(async b => { const d = await tryJson('./data/' + b.file); if (d) bossData.set(b.id, d); }));
  const charCfg = await loadCharacter(THREE);

  const titles  = createTitles({ cfg: titlesCfg, species, grades });
  const unlocks = createUnlocks({ cfg: unlockCfg, itemsCfg, species, grades, bosses, titles, quests: allQuests, dungeons });
  const makeItem = createItemFactory(THREE, id => unlocks.itemDef(id));

  // ---- シーン ------------------------------------------------------------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fe0ff);
  scene.fog = new THREE.Fog(0x9fe0ff, 130, 340);
  // 見える距離は霧（340）より少し先まで。霧で見えないところは描かない（軽くするため）
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 380);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88b98a, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(90, 150, 60);
  scene.add(sun);

  scene.add(buildIsland(THREE));
  scene.add(buildSea(THREE));
  const world = buildWorld(THREE, scene, { npcs: npcsD.npcs, bosses, dungeons });
  const weather = createWeather(THREE, scene);

  let state = null;             // 保存データ（ログインしてから入る）
  const allowDraft = () => PLAYTEST || !!state?.settings?.draft;
  const qm = createQuestionManager({ getState: () => state, allowDraft });
  await qm.load(REGION_GRADE);

  const regionGrade = grades.find(g => g.grade === REGION_GRADE);
  const foes = createEnemies(THREE, scene, world, {
    species, gradeInfo: regionGrade,
    available: sid => qm.rawCount(`g${REGION_GRADE}_${sid}`) > 0,   // 問題が1問もない種類は出さない
  });

  const heroModel = createCharacter(THREE, { makeItem });
  const player = createPlayer(THREE, scene, heroModel, 0, VILLAGE_R * 0.45);
  player.root.visible = false;

  // ---- 画質 --------------------------------------------------------------

  let qualityMode = 'auto';
  let qCap = Math.min(window.devicePixelRatio || 1, 2);
  function applyQuality(){
    const cap = qualityMode === 'auto' ? qCap : QUALITY[qualityMode];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    resize();
  }
  function resize(){
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { applyQuality(); });
  applyQuality();

  // ---- 状態 --------------------------------------------------------------

  let controls = null;
  let playing = false;
  let sinceSave = 0;
  let place = null;
  let lastBlockToast = 0;
  let battleTarget = null;       // たたかい中の相手 { kind:'enemy'|'boss', e?, id?, x, z }
  // ぶつかったら たたかい（2026-09-22 仕様変更）。おわった直後に また はじまらないよう、
  // すこし待つ（touchGrace）＋ いま たたかった相手からは いちど はなれるまで反応しない（noTouch）
  let touchGrace = 0;
  let noTouch = null;
  const hintTier = new Map();    // ヒント役：単元ごとに何回きいたか

  const getFurigana = () => !!state?.settings?.furigana;
  const getGrade    = () => state?.grade ?? 5;
  const getSpeech   = () => !!state?.settings?.speech;

  const battle = createBattle({
    getFurigana, getGrade, getSpeech,
    onHero: a => player.model.play(a),
    onFoe: a => {
      if (!battleTarget) return;
      if (battleTarget.kind === 'enemy'){
        if (a === 'defeat') foes.defeat(battleTarget.e); else foes.play(battleTarget.e, a);
      } else bossAnim(battleTarget.id, a);
    },
  });
  const quest   = createQuest({ getFurigana, getGrade, getSpeech });
  const dungeon = createDungeon({ getFurigana, getGrade, getSpeech });
  const screens = createScreens({ THREE, getFurigana, getGrade, getSpeech, titles, unlocks, species, grades, charCfg, makeItem });
  const busy = () => battle.isOpen() || quest.isOpen() || dungeon.isOpen() || screens.isOpen() || ui.isMessageOpen() || ui.isMenuOpen();

  // ---- ログイン ----------------------------------------------------------

  function toLogin(){
    playing = false;
    player.root.visible = false;
    stopSpeak();
    controls?.reset();
    weather.reset();
    battle.close(); quest.close(); dungeon.close(); screens.closeAll();
    endBattleCamera();
    scene.background.setHex(0x9fe0ff);
    scene.fog.color.setHex(0x9fe0ff);
    ui.closeMenu();
    ui.showLogin(SAVE.listProfiles(), {
      exists: name => SAVE.exists(name),
      onStart: ({ name, grade }) => {
        const found = SAVE.load(name);
        begin(found || SAVE.newState(name, grade), !!found);
      },
      onResume: p => {
        const s = SAVE.load(p.name);
        begin(s || SAVE.newState(p.name, p.grade), !!s);
      },
      onDelete: p => { SAVE.remove(p.name); toLogin(); },
    });
  }

  function applyCostume(){
    const c = state.costume;
    heroModel.setHatColor(c.hatColor);
    heroModel.setFace(c.face);
    heroModel.setItem(unlocks.owned(state).has(c.item) ? c.item : 'item_acorn');
  }

  function begin(s, resumed){
    state = s;
    state.stats.sessions = (state.stats.sessions || 0) + 1;
    qualityMode = state.settings.quality || 'auto';
    applyQuality();
    ui.setFurigana(state.settings.furigana, state.grade);
    ui.setSpeech(state.settings.speech);
    ui.hideLogin();
    ui.setHud(state);
    applyCostume();

    player.setPos(state.pos.x, state.pos.z);
    player.root.visible = true;
    if (!controls) controls = createControls({ onAction: doAction });
    controls.reset();
    controls.resetCam();
    foes.reset();
    refreshQuizInfo();

    place = world.placeName(state.pos.x, state.pos.z);
    ui.setPlace(place.label);
    camFollow(1);
    playing = true;
    sinceSave = 0;
    SAVE.save(state);

    if (!resumed){
      // はじめての人は、まず着せかえ
      ui.showBanner('ようこそ！ まずは じぶんの キャラを きめよう');
      screens.openCharSelect(state, () => { applyCostume(); save(); ui.showBanner('ようこそ ' + place.label); });
    } else {
      ui.showBanner('つづきから！ ' + place.label);
    }
  }

  function refreshQuizInfo(){
    const all = [...qm.byId.values()];
    ui.setQuizInfo({
      checked: all.filter(isChecked).length,
      draft: all.filter(q => q.status === 'draft').length,
      total: all.length,
    });
  }

  // ---- そうさ ------------------------------------------------------------

  function nearest(){
    let best = null, bd = 1e9;
    for (const it of world.interactables){
      const d = Math.hypot(player.state.x - it.x, player.state.z - it.z);
      if (d < it.r && d < bd){ bd = d; best = it; }
    }
    return best;
  }

  function doAction(name){
    if (!playing) return;
    if (ui.isMessageOpen()){ ui.nextMessage(); return; }
    if (busy()) return;

    if (name === 'jump'){ player.jump(); return; }

    if (name === 'attack'){
      const e = foes.nearest(player.state.x, player.state.z, ENCOUNTER_R);
      if (!e){ player.swing(); ui.toast('ちかくに {魔物|まもの}は いないよ。'); return; }
      startBattle(e);
      return;
    }
    if (name === 'talk'){
      const it = nearest();
      if (!it){ ui.toast('ここには はなす {相手|あいて}が いないよ。'); return; }
      controls.reset();
      const a = it.action || '';
      if (a.startsWith('npc:'))     return talkNpc(it.npc, it.name);
      if (a.startsWith('boss:'))    return openBossGate(a.slice(5));
      if (a.startsWith('dungeon:')) return enterDungeon(a.slice(8));
      ui.openMessage({ name: it.name, lines: it.lines, onClose: () => save() });
    }
  }

  // ---- NPC ---------------------------------------------------------------

  function talkNpc(n, name){
    const lines = t => n.lines.filter(l => l.trigger === t).map(l => l.text);
    if (n.role === 'quest'){
      const qid = n.quests?.[0];
      const q = allQuests.find(x => x.id === qid);
      if (qid && state.clearedQuests.includes(qid)){
        return ui.openMessage({ name, lines: lines('cleared:' + qid).length ? lines('cleared:' + qid) : ['ありがとう！'] });
      }
      if (!q || (!isChecked(q) && !(allowDraft() && q.status === 'draft'))){
        return ui.openMessage({ name, lines: lines('locked').length ? lines('locked') : ['いまは たのみごとは ないよ。'] });
      }
      return startQuest(q);
    }
    if (n.role === 'hint'){
      // さいきん まちがえた問題の単元に合わせて、1→2→3回目と くわしくなる
      const miss = [...state.log].reverse().find(e => (!e.correct || e.tries > 1) && qm.byId.has(e.qid));   // 1回でも まちがえた問題
      if (!miss) return ui.openMessage({ name, lines: [...lines('talk'), 'いまは まちがえた {問題|もんだい}は ないようじゃな。'] });
      const q = qm.byId.get(miss.qid);
      const tag = `g${q.grade}-${q.unit}`;
      const k = hintTier.get(tag) || 0;
      hintTier.set(tag, k + 1);
      const tier = (k % 3) + 1;
      const h = lines(`hint:${tag}:${tier}`);
      return ui.openMessage({ name, lines: [`「${q.unit}」の ヒント（${tier}こめ）じゃ。`, ...(h.length ? h : ['この {単元|たんげん}の ヒントは まだ ないのう。'])] });
    }
    ui.openMessage({ name, lines: lines('talk'), onClose: () => save() });
  }

  // ---- たたかい・クエスト・ダンジョン・ボス ------------------------------

  function logAnswer(kind, e){
    SAVE.addLog(state, { region: place?.id || '', kind, ...e });
  }

  /** 進み具合が変わったあとに、持ち物・ボス挑戦権の変化を知らせる */
  function snapshot(){
    return {
      items: new Set(unlocks.owned(state)),
      bosses: Object.fromEntries(Object.keys(unlockCfg.bossUnlock).map(id => [id, unlocks.bossStatus(state, id).ok])),
    };
  }
  function announce(before){
    const after = snapshot();
    for (const id of after.items) if (!before.items.has(id)){
      const d = unlocks.itemDef(id);
      screens.popup(`もちもの「${d.name}」を てにいれた！`, 'メニューの「きがえる」で もてるよ');
    }
    for (const [id, ok] of Object.entries(after.bosses)) if (ok && !before.bosses[id]){
      const b = bosses.find(x => x.id === id);
      screens.popup('ボスに いどめるように なった！', `{${b.name}|${b.yomi}}の とりでへ いこう`);
    }
  }

  function startBattle(e){
    controls.reset();
    stopSpeak();
    battleTarget = { kind: 'enemy', e, x: e.x, z: e.z };
    foes.freeze(e);
    player.face(e.x, e.z);
    const key = `g${e.grade}_${e.sp.id}`;
    battle.startEnemy(
      { name: e.sp.name, hp: e.hp, coins: 10 },
      {
        draw: b => qm.draw(key, b),
        onAnswer: x => logAnswer('敵', x),
        noQuestionMsg: allowDraft()
          ? 'この {魔物|まもの}の {問題|もんだい}が ありません。'
          : '{先生|せんせい}が かくにんした {問題|もんだい}が まだ ありません。（{先生|せんせい}は メニューの「せんせい{用|よう}」から ためせます）',
        onEnd: res => {
          foes.freeze(null);
          endBattleCamera();
          touchGrace = CONTACT_GRACE;
          noTouch = e;
          if (res.result === 'win'){
            const before = snapshot();
            const t = titles.addKill(state, key);
            state.coins += res.coins || 0;
            ui.setHud(state);
            if (t.up){
              player.cheer();
              screens.popup(`{称号|しょうごう}「${t.name}」`,
                t.level < 5 ? `つぎは ${titles.thresholds[t.level]}{体|たい}で「${titles.nameOf(key, t.level + 1)}」` : 'さいこうの でんせつ！');
            } else {
              ui.toast(`${e.sp.name}を たおした！（${t.count}{体|たい}め）`, 1800);
            }
            announce(before);
          } else if (res.result === 'lose'){
            player.damaged();
          }
          save();
        },
      }
    );
  }

  function startQuest(q){
    stopSpeak();
    quest.start(q, {
      done: false,
      onAnswer: x => logAnswer('クエスト', x),
      onEnd: res => {
        if (res.result === 'clear' && !state.clearedQuests.includes(q.id)){
          const before = snapshot();
          state.clearedQuests.push(q.id);
          state.coins += res.coins || 0;
          ui.setHud(state);
          player.cheer();
          announce(before);
        }
        save();
      },
    });
  }

  function enterDungeon(id){
    const dg = dungeons.find(d => d.id === id);
    if (!dg) return ui.toast('この ほらあなは まだ じゅんびちゅう。');
    if (!isChecked(dg) && !(allowDraft() && dg.status === 'draft')){
      return ui.openMessage({ name: dg.name, lines: ['おくから つめたい かぜが ふいてくる…。', '（{先生|せんせい}が かくにんした {問題|もんだい}が まだ ないので、いまは はいれません）'] });
    }
    stopSpeak();
    dungeon.start(dg, {
      draw: (key, b) => qm.draw(key, b),
      onAnswer: x => logAnswer('ダンジョン', x),
      onEnd: res => {
        if (res.result === 'clear' && !state.clearedDungeons.includes(dg.id)){
          const before = snapshot();
          state.clearedDungeons.push(dg.id);
          player.cheer();
          screens.popup(`「${dg.name}」を クリア！`, 'ボスへの みちが ひとつ ひらいた');
          announce(before);
        }
        save();
      },
    });
  }

  function openBossGate(id){
    const b = bosses.find(x => x.id === id);
    const data = bossData.get(id);
    const nm = `{${b.name}|${b.yomi}}`;
    if (!data){
      return ui.openMessage({ name: nm + 'の とりで', lines: [`${nm}の とりで。`, '（この ボスは まだ じゅんびちゅう）'] });
    }
    if (!isChecked(data) && !(allowDraft() && data.status === 'draft')){
      return ui.openMessage({ name: nm + 'の とりで', lines: ['とびらは かたく しまっている…。', '（{先生|せんせい}が かくにんした ボスの {問題|もんだい}が まだ ないので、いまは いどめません）'] });
    }
    const st = unlocks.bossStatus(state, id);
    if (!st.ok && !state.settings.skipBossLock){
      // どこまで そろったかを見せる（あと何をすればよいか、自分で わかるように）
      const lines = st.reqs.map(r => r.kind === 'title'
        ? `${r.done ? '✓' : '・'} ${r.label}（${r.enemy} ${r.have}/${r.need}{体|たい}）`
        : `${r.done ? '✓' : '・'} ${r.label}${r.exists ? '' : '（じゅんびちゅう）'}`);
      return ui.openMessage({ name: nm + 'の とりで', lines: ['ボスに いどむには…\n' + lines.join('\n')] });
    }
    startBoss(id, data);
  }

  function startBoss(id, data){
    stopSpeak();
    controls.reset();
    const sp = world.bossSpots[id];
    battleTarget = { kind: 'boss', id, x: sp.x, z: sp.z };
    player.face(sp.x, sp.z);
    battle.startBoss(data, {
      onAnswer: x => logAnswer('ボス', x),
      onEnd: res => {
        endBattleCamera();
        if (res.result === 'win'){
          const before = snapshot();
          if (!state.defeatedBosses.includes(id)){
            state.defeatedBosses.push(id);
            screens.popup(`「{${data.name}|${data.yomi}}」を たおした！`, 'ずかんに とうろく されたよ');
          } else ui.toast('もう一度 たおした！', 2000);
          announce(before);
        }
        save();
      },
    });
  }

  // ボスのモデルのうごき
  const bossAnimState = {};
  function bossAnim(id, a){ bossAnimState[id] = { a, t: 0 }; }
  function updateBosses(dt, t){
    for (const [id, m] of Object.entries(world.bossModels || {})){
      const inner = m.inner;
      inner.position.set(0, Math.sin(t * 1.3) * 0.15, 0);
      inner.rotation.set(0, inner.rotation.y, 0);
      const s = bossAnimState[id];
      if (!s) continue;
      s.t += dt;
      const p = Math.min(1, s.t / 0.7);
      if (s.a === 'attack') inner.position.z += Math.sin(p * Math.PI) * 2.2;
      if (s.a === 'hit'){ inner.position.x += Math.sin(s.t * 45) * 0.25 * (1 - p); inner.rotation.z = Math.sin(p * Math.PI) * 0.15; }
      if (s.a === 'defeat'){ inner.position.y += Math.abs(Math.sin(s.t * 6)) * 0.6; if (s.t > 2) delete bossAnimState[id]; continue; }
      if (p >= 1) delete bossAnimState[id];
    }
  }

  // ---- メニュー ----------------------------------------------------------

  function screenCtx(){
    return {
      state,
      summary: () => SAVE.summary(state),
      hasPrev: () => SAVE.hasPrevious(state.name),
      onBackup: () => { save(); return BACKUP.download(state); },
      onRestore: async done => {
        const f = await BACKUP.pickFile();
        if (!f) return;
        if (f.error) return done({ ok: false, text: f.error });
        const r = BACKUP.parseBackup(f.text);
        if (!r.ok) return done({ ok: false, text: r.error });
        const p = r.preview;
        const when = p.savedAt ? new Date(p.savedAt).toLocaleString('ja-JP') : '？';
        const msg = `この きろくを よみこみますか？\n\nなまえ：${p.name}（${p.grade}年）\n称号：${p.titles}\nボス：${p.bosses}　クエスト：${p.quests}　ダンジョン：${p.dungeons}\nほぞんした日：${when}\n\nいまの きろくは「1つまえの きろく」として のこります。`;
        if (!confirm(msg)) return done({ ok: false, text: 'よみこみを やめました。' });
        SAVE.keepPrevious(p.name);
        SAVE.save(r.data);
        const same = p.name === state.name;
        if (same){ state = SAVE.load(p.name); afterLoad(); }
        done({ ok: true, text: same ? 'きろくを よみこみました。' : `「${p.name}」の きろくを この iPad に いれました。ログイン がめんから えらべます。` });
      },
      onPrev: done => {
        const s = SAVE.restorePrevious(state.name);
        if (s){ state = s; afterLoad(); done('1つ まえの きろくに もどしました。（もう一度 おすと もとに もどります）'); }
      },
    };
  }
  function afterLoad(){
    ui.setHud(state); applyCostume();
    player.setPos(state.pos.x, state.pos.z); camFollow(1);
  }

  document.getElementById('camBtn').addEventListener('click', () => {
    if (!controls) return;
    controls.resetCam();
    camFollow(0.5);
    ui.toast('カメラを もとに もどしたよ。', 1200);
  });

  document.getElementById('menuBtn').addEventListener('click', () => {
    if (!playing || battle.isOpen() || quest.isOpen() || dungeon.isOpen()) return;
    if (ui.isMenuOpen()){ ui.closeMenu(); return; }
    if (ui.isMessageOpen()) ui.closeMessage();
    controls.reset();
    stopSpeak();
    ui.openMenu(state, SAVE.summary(state), {
      onTitles:   () => { ui.closeMenu(); screens.openTitles(screenCtx()); },
      onItems:    () => { ui.closeMenu(); screens.openItems(screenCtx()); },
      onRecords:  () => { ui.closeMenu(); screens.openRecords(screenCtx()); },
      onDress:    () => { ui.closeMenu(); screens.openCharSelect(state, () => { applyCostume(); player.cheer(); save(); }); },
      onFurigana: v => { state.settings.furigana = v; ui.setFurigana(v, state.grade); ui.setPlace(place.label); save(); },
      onSpeech:   v => { state.settings.speech = v; ui.setSpeech(v); if (!v) stopSpeak(); save(); },
      onQuality:  v => { state.settings.quality = v; qualityMode = v; applyQuality(); save(); },
      onDraft:    v => { state.settings.draft = v; save(); },
      onSkipBoss: v => { state.settings.skipBossLock = v; save(); },
      onVillage:  () => { player.setPos(0, VILLAGE_R * 0.45); camFollow(1); save(); },
      onLogout:   () => { save(); toLogin(); },
      onDelete:   () => { SAVE.remove(state.name); state = null; toLogin(); },
    });
  });

  // ---- 保存 --------------------------------------------------------------

  function save(){
    if (!state) return;
    state.pos.x = player.state.x;
    state.pos.z = player.state.z;
    state.pos.region = place?.id || 'village';
    SAVE.save(state);
    sinceSave = 0;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ stopSpeak(); controls?.reset(); if (playing) save(); }
  });
  window.addEventListener('pagehide', () => { if (playing) save(); });

  // ---- カメラ ------------------------------------------------------------

  const camWant = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function camFollow(k){
    const c = controls ? controls.cam : CAM;
    const hd = Math.cos(c.pitch) * c.dist;
    const vy = Math.sin(c.pitch) * c.dist;
    camWant.set(player.state.x + Math.sin(c.yaw) * hd, player.root.position.y + vy + 1.2, player.state.z + Math.cos(c.yaw) * hd);
    const floor = heightAt(camWant.x, camWant.z) + 2.2;
    if (camWant.y < floor) camWant.y = floor;
    camera.position.lerp(camWant, k);
    camLook.set(player.state.x, player.root.position.y + 1.7, player.state.z);
    camera.lookAt(camLook);
  }

  /** たたかい中：主人公と相手を横から見て、画面の左に入れる（右は問題） */
  function battleCam(k){
    const t = battleTarget;
    const hx = player.state.x, hz = player.state.z;
    const dx = t.x - hx, dz = t.z - hz, d = Math.hypot(dx, dz) || 1;
    const mx = (hx + t.x) / 2, mz = (hz + t.z) / 2;
    const nx = -dz / d, nz = dx / d;                      // 横の向き
    const boss = t.kind === 'boss';
    const my = Math.max(heightAt(mx, mz), player.root.position.y);
    camWant.set(mx + nx * (boss ? 17 : 11), my + (boss ? 7 : 4.5), mz + nz * (boss ? 17 : 11));
    const floor = heightAt(camWant.x, camWant.z) + 2.2;
    if (camWant.y < floor) camWant.y = floor;
    camera.position.lerp(camWant, k);
    camLook.set(mx, my + (boss ? 2.6 : 1.4), mz);
    camera.lookAt(camLook);
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w > 760) camera.setViewOffset(w, h, w * 0.24, 0, w, h);   // 見た目を左へずらす
    else camera.clearViewOffset();
  }
  function endBattleCamera(){ battleTarget = null; camera.clearViewOffset(); }

  // ---- 気候（空の色と天気） ----------------------------------------------

  const skyWant = new THREE.Color();
  function updateClimate(dt){
    const b = biomeAt(player.state.x, player.state.z);
    const rgb = biomeSky(b.w);
    skyWant.setRGB(rgb[0], rgb[1], rgb[2]);
    scene.background.lerp(skyWant, Math.min(1, dt * 1.2));
    scene.fog.color.copy(scene.background);
    const curve = v => clamp((v - WEATHER_START) / (0.75 - WEATHER_START), 0, 1);
    return { snow: curve(b.w.g6), ash: curve(b.w.g5) };
  }

  // ---- ゲームループ ------------------------------------------------------

  let last = performance.now();
  let fpsN = 0, fpsT = 0, adjT = 0;

  function loop(now){
    requestAnimationFrame(loop);
    if (document.hidden){ last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    step(dt, now);
  }

  /** 1コマ分。ループから呼ぶほか、動作確認でも直接呼べるように分けてある。 */
  function step(dt, now = performance.now()){
    const t = now / 1000;
    world.update(dt, t);
    updateBosses(dt, t);

    if (playing){
      controls.tick(dt);
      foes.update(dt, t, player.state.x, player.state.z);

      const blocked = busy();
      const raw = blocked ? { x: 0, y: 0 } : controls.read();
      const c = controls.cam;
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      const mv = { x: sy * raw.y + cy * raw.x, y: cy * raw.y - sy * raw.x };

      const bx = player.state.x, bz = player.state.z;
      player.update(dt, mv, world.canWalk);

      const want = Math.hypot(mv.x, mv.y);
      const went = Math.hypot(player.state.x - bx, player.state.z - bz);
      if (want > 0.25 && went < 0.01 && now - lastBlockToast > 2200){
        const p = world.probe(bx + mv.x * 1.8, bz + mv.y * 1.8);
        if (!p.ok && p.why === 'closed'){
          lastBlockToast = now;
          ui.toast(`{${p.region.name}|${p.region.yomi}}の {地方|ちほう}（${p.region.grade}{年|ねん}）は まだ じゅんびちゅう。`);
        } else if (!p.ok && p.why === 'sea'){
          lastBlockToast = now; ui.toast('{水|みず}の 中には 入れないよ。');
        } else if (!p.ok && p.why === 'lava'){
          lastBlockToast = now; ui.toast('あつい！ {溶岩|ようがん}には ちかづけない。');
        }
      }

      const pl = world.placeName(player.state.x, player.state.z);
      if (!place || pl.id !== place.id){
        place = pl;
        ui.setPlace(pl.label);
        ui.showBanner(pl.label);
        if (pl.id === 'g5' && state.grade < 5) setTimeout(() => ui.toast('ここは 5{年|ねん}の {地方|ちほう}。むずかしいよ！'), 1500);
        save();
      }

      // ぶつかったら たたかい
      if (touchGrace > 0) touchGrace -= dt;
      if (noTouch && (!noTouch.alive || Math.hypot(player.state.x - noTouch.x, player.state.z - noTouch.z) > CONTACT_R + 2.5)) noTouch = null;
      if (!blocked && touchGrace <= 0){
        const hit = foes.nearest(player.state.x, player.state.z, CONTACT_R);
        if (hit && hit !== noTouch && !hit.anim) startBattle(hit);
      }

      if (blocked || busy()){
        ui.setTalkHint(false);
      } else {
        const e = foes.nearest(player.state.x, player.state.z, ENCOUNTER_R);
        const it = nearest();
        if (e)       ui.setTalkHint(true, e.sp.name + 'が ちかくに いる！');
        else if (it) ui.setTalkHint(true, it.name + 'と はなせる');
        else         ui.setTalkHint(false);
      }

      state.stats.playSec += dt;
      sinceSave += dt;
      if (sinceSave >= AUTOSAVE_SEC) save();

      if (battleTarget && battle.isOpen()) battleCam(Math.min(1, dt * 4));
      else { if (battleTarget) endBattleCamera(); camFollow(Math.min(1, dt * 6)); }
      const w = updateClimate(dt);
      weather.update(dt, t, camera.position, w.snow, w.ash);
    } else {
      const a = t * 0.04;
      camera.position.set(Math.cos(a) * ISLAND_R * 1.35, ISLAND_R * 0.5, Math.sin(a) * ISLAND_R * 1.35);
      camera.lookAt(0, 6, 0);
    }

    renderer.render(scene, camera);

    fpsN++; fpsT += dt;
    if (fpsT >= 1){
      const fps = fpsN / fpsT;
      ui.setFps(Math.round(fps) + ' fps');
      fpsN = 0; fpsT = 0;
      if (qualityMode === 'auto'){
        adjT++;
        if (adjT >= 3){
          if (fps < 27 && qCap > 1){ qCap = qCap === 2 ? 1.5 : 1; applyQuality(); adjT = 0; }
          else if (fps > 54 && qCap < 2 && (window.devicePixelRatio || 1) > qCap){ qCap = qCap === 1 ? 1.5 : 2; applyQuality(); adjT = 0; }
        }
      }
    }
  }

  // ---- はじめる ----------------------------------------------------------

  if (!SAVE.storageOK()) ui.toast('この ブラウザでは 保存が できません（プライベートブラウズ？）。', 6000);
  requestAnimationFrame(loop);
  toLogin();

  // 動作確認用（コンソールから見る）
  window.SI = {
    get state(){ return state; }, set state(v){ state = v; },
    world, player, heroModel, ui, renderer, scene, camera, weather, foes, battle, quest, dungeon, screens,
    qm, titles, unlocks, bossData, dungeons, allQuests,
    get controls(){ return controls; }, get playing(){ return playing; },
    save, step, startBattle, openBossGate, enterDungeon, talkNpc, applyCostume,
  };
}
