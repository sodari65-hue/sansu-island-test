// SaveManager ― 保存と再開。データは端末の中（localStorage）だけ。
// キー： sansu-island:{なまえ}
//
// 児童の本名・学級・出席番号はあつかわない。「なまえ」は本人が言葉をえらんで作った
// ハンドルネーム（例：ひかるドラゴンはかせ）で、個人を特定しない。
//
// 保存データの形（出題・称号・報酬 実装計画書 10章）
//   持ち物・ボス挑戦権・全クリアは保存しない（称号やクリア記録から毎回計算する）。

import { SAVE_PREFIX, SAVE_INDEX, SAVE_VERSION, LOG_MAX, VILLAGE_R } from './config.js';
import { defaultFurigana } from './furigana.js';

export function storageOK(){
  try {
    const k = SAVE_PREFIX + ':test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e){ return false; }
}

export const keyOf   = name => `${SAVE_PREFIX}:${name}`;
export const prevKey = name => `${SAVE_PREFIX}:${name}:prev`;   // 1つ前の記録（読みこみで上書きする前）

function readJSON(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e){ return fallback; }
}

/** この端末で遊んだ「なまえ」の一覧 */
export function listProfiles(){
  const list = readJSON(SAVE_INDEX, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter(p => p && typeof p.name === 'string' && p.name)
    .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
}

export function exists(name){
  return listProfiles().some(p => p.name === name) || !!readJSON(keyOf(name), null);
}

function touchIndex(state){
  const list = listProfiles().filter(p => p.name !== state.name);
  list.unshift({ name: state.name, grade: state.grade, lastAt: state.stats.lastAt });
  try { localStorage.setItem(SAVE_INDEX, JSON.stringify(list.slice(0, 50))); } catch (e){}
}

export function newState(name, grade){
  const now = new Date().toISOString();
  return {
    saveVersion: SAVE_VERSION,
    name, grade: Number(grade),
    costume: { hatColor: 'yellow', face: 'smile', item: 'item_acorn' },
    pos: { x: 0, z: VILLAGE_R * 0.45, region: 'village' },
    coins: 0,
    defeatCounts: {},       // { g5_A1: 34 }  学年×敵の種類ごとの倒した数
    titleLevels: {},        // { g5_A1: 4 }   演出が二重に出ないように段階も保存
    clearedDungeons: [],
    clearedQuests: [],
    defeatedBosses: [],
    questionDecks: {},      // 山札（残りの順番と直近の出題ID）
    settings: {
      furigana: defaultFurigana(Number(grade)),
      speech: true,
      quality: 'auto',
      draft: false,         // したがきの問題も出す（先生の確認用。ふだんは OFF）
      skipBossLock: false,  // ボスの条件をとばす（先生の確認用。ふだんは OFF）
    },
    log: [],                // 記録（計画書 3-3 の形）
    stats: { playSec: 0, sessions: 0, firstAt: now, lastAt: now },
  };
}

/**
 * 古い形の保存データを、いまの形に直す。
 * v1（〜2026-09-21）: dex / quests{} → v2: defeatedBosses / clearedQuests[] など
 */
export function migrate(s, name){
  if (!s || typeof s !== 'object') return null;
  const ver = s.saveVersion ?? s.v ?? 1;
  const nm = name ?? s.name;
  const base = newState(nm, s.grade || 5);
  const out = {
    ...base, ...s,
    name: nm,
    costume:  { ...base.costume,  ...(s.costume  || {}) },
    pos:      { ...base.pos,      ...(s.pos      || {}) },
    settings: { ...base.settings, ...(s.settings || {}) },
    stats:    { ...base.stats,    ...(s.stats    || {}) },
    defeatCounts:    obj(s.defeatCounts),
    titleLevels:     obj(s.titleLevels),
    questionDecks:   obj(s.questionDecks),
    clearedDungeons: arr(s.clearedDungeons),
    clearedQuests:   arr(s.clearedQuests),
    defeatedBosses:  arr(s.defeatedBosses),
    log: arr(s.log),
  };
  if (ver < 2){
    out.defeatedBosses = uniq([...out.defeatedBosses, ...arr(s.dex)]);
    out.clearedQuests  = uniq([...out.clearedQuests, ...Object.keys(obj(s.quests))]);
  }
  delete out.v; delete out.dex; delete out.quests;
  out.saveVersion = SAVE_VERSION;
  return out;
}
const obj  = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const arr  = v => Array.isArray(v) ? v : [];
const uniq = a => [...new Set(a)];

/** 保存を読む。なければ null。 */
export function load(name){
  return migrate(readJSON(keyOf(name), null), name);
}

export function save(state){
  if (!state) return false;
  state.stats.lastAt = new Date().toISOString();
  try {
    localStorage.setItem(keyOf(state.name), JSON.stringify(state));
    touchIndex(state);
    return true;
  } catch (e){
    return false;
  }
}

/** 読みこみで上書きする前に、いまの記録を「1つ前」として残す */
export function keepPrevious(name){
  try {
    const cur = localStorage.getItem(keyOf(name));
    if (cur) localStorage.setItem(prevKey(name), cur);
    return !!cur;
  } catch (e){ return false; }
}
export function hasPrevious(name){ return !!readJSON(prevKey(name), null); }
export function restorePrevious(name){
  try {
    const prevRaw = localStorage.getItem(prevKey(name));
    if (!prevRaw) return null;
    const curRaw = localStorage.getItem(keyOf(name));
    const s = migrate(JSON.parse(prevRaw), name);
    // いまの記録と入れかえる（もう一度おすと、元にもどせる）
    if (curRaw) localStorage.setItem(prevKey(name), curRaw);
    else localStorage.removeItem(prevKey(name));
    save(s);
    return s;
  } catch (e){ return null; }
}

export function remove(name){
  try {
    localStorage.removeItem(keyOf(name));
    localStorage.removeItem(prevKey(name));
    const list = listProfiles().filter(p => p.name !== name);
    localStorage.setItem(SAVE_INDEX, JSON.stringify(list));
    return true;
  } catch (e){ return false; }
}

/**
 * 記録を1件ふやす（計画書 3-3）。
 * { 日時, 地方, 種類（敵/クエスト/ダンジョン/ボス）, 問題ID, 正誤, 試行回数, かかった時間 }
 */
export function addLog(state, { region, kind, qid, correct, tries, ms }){
  if (!state) return;
  state.log.push({
    at: new Date().toISOString(),
    region: region ?? '',
    kind:   kind   ?? '',
    qid:    qid    ?? '',
    correct: !!correct,
    tries:  tries ?? 1,
    ms:     Math.round(ms ?? 0),
  });
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
}

/** 記録のまとめ（先生に見せる画面で使う） */
export function summary(state){
  const log = state?.log || [];
  const byKind = {};
  for (const e of log){
    const k = e.kind || 'その他';
    (byKind[k] ||= { n: 0, ok: 0 }).n++;
    if (e.correct) byKind[k].ok++;
  }
  return {
    total: log.length,
    ok: log.filter(e => e.correct).length,
    byKind,
    minutes: Math.floor((state?.stats?.playSec || 0) / 60),
    quests: (state?.clearedQuests || []).length,
    dungeons: (state?.clearedDungeons || []).length,
    bosses: (state?.defeatedBosses || []).length,
  };
}
