// QuestionManager ― 知識・技能の問題を「山札（シャッフルバッグ）」で出す。
// （出題・称号・報酬 実装計画書 2章）
//
//  1. 学年×敵の種類ごとに、問題IDの山札を作ってシャッフルする
//  2. 上から順に出す → 山札を一巡するまで同じ問題は出ない
//  3. 空になったら作りなおす。直近に出た問題は後ろ半分に回す
//  4. 同じ戦いの中、直前3問と同じ「同型グループ」は避ける（それしかなければ許す）
//
// 敵とダンジョンは同じ山札から引くので、両方の間でも重ならない。
// 山札の状態は保存データの questionDecks に入る（残りの順番と直近のIDだけ）。
//
// ★ 出すのは status が "checked"（先生が確認ずみ）のものだけ。
//   allowDraft が true のときだけ、したがき（draft）もまぜる（先生が試すとき用）。

import { isChecked } from './review.js';
const cache = new Map();
async function loadJSON(path){
  if (!cache.has(path)){
    cache.set(path, fetch(path, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null));
  }
  return cache.get(path);
}

const DOMAINS = ['A', 'B', 'C', 'D'];
const RECENT_MAX = 8;

/** 並びを混ぜる（Fisher–Yates） */
export function shuffle(arr, rnd = Math.random){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 山札の中身が変わったかを見分けるための短い印（IDの並びから作る） */
function versionOf(ids){
  let h = 2166136261 >>> 0;
  for (const id of ids.slice().sort()) for (let i = 0; i < id.length; i++){
    h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36) + '-' + ids.length;
}

export function createQuestionManager({ getState, allowDraft }){
  const byId = new Map();        // id -> 問題
  const pools = new Map();       // 'g5_A1' -> [問題…]（status でしぼる前）
  let unitsMap = null;

  const usable = q => isChecked(q) || (allowDraft() && q.status === 'draft');
  const groupOf = q => q?.variantGroup || q?.id;

  /** その学年の問題と、系統↔単元の対応を読む */
  async function load(grade){
    const [units, ...files] = await Promise.all([
      loadJSON('./data/units.json'),
      ...DOMAINS.map(d => loadJSON(`./data/questions/g${grade}-${d}.json`)),
    ]);
    unitsMap = units?.grades?.[String(grade)] || {};
    const all = [];
    files.forEach((f, i) => {
      for (const q of f?.questions || []){
        const qq = { ...q, grade, domain: f.domain || DOMAINS[i] };
        all.push(qq); byId.set(qq.id, qq);
      }
    });
    for (const [sid, units] of Object.entries(unitsMap)){
      // species を明示した問題は、単元が共通でもその敵だけに入れる。
      // タグのない既存問題は unit による従来どおりの振り分けを保つ。
      pools.set(`g${grade}_${sid}`, all.filter(q => q.species ? q.species === sid : units.includes(q.unit)));
    }
    return all;
  }

  /** 出してよい問題（先生の確認ずみ。試すときは したがきも） */
  function poolOf(key){
    return (pools.get(key) || []).filter(usable);
  }
  const hasPool = key => poolOf(key).length > 0;
  const rawCount = key => (pools.get(key) || []).length;

  /** 山札を用意する。問題の追加・削除や、したがき設定の切りかえにも追いつく。 */
  function deckFor(key){
    const st = getState();
    st.questionDecks ||= {};
    const ids = poolOf(key).map(q => q.id);
    const ver = versionOf(ids);
    let d = st.questionDecks[key];

    if (!d){
      d = st.questionDecks[key] = { poolVersion: ver, remaining: shuffle(ids), recent: [] };
    } else if (d.poolVersion !== ver){
      const now = new Set(ids);
      d.remaining = d.remaining.filter(id => now.has(id));   // 消えた問題を取りのぞく
      d.recent    = d.recent.filter(id => now.has(id));
      const known = new Set([...d.remaining, ...d.recent]);
      for (const id of ids){                                 // ふえた問題をランダムな位置へ
        if (known.has(id)) continue;
        d.remaining.splice(Math.floor(Math.random() * (d.remaining.length + 1)), 0, id);
      }
      d.poolVersion = ver;
    }
    if (!d.remaining.length && ids.length){
      // 作りなおし：直近に出たものは後ろ半分へ
      const recent = new Set(d.recent);
      const fresh = shuffle(ids.filter(id => !recent.has(id)));
      const late  = ids.filter(id => recent.has(id));
      // 前半は直近に出ていない問題だけにする（少なくとも1問）
      const front = Math.max(Math.floor(fresh.length / 2), Math.min(1, fresh.length));
      d.remaining = [...fresh.slice(0, front), ...shuffle([...fresh.slice(front), ...late])];
    }
    return d;
  }

  /**
   * 1問ひく。
   * @param key     'g5_A1' など
   * @param battle  { groups:Set } その戦いで出した同型グループ（同じ戦いでは出さない）
   */
  function draw(key, battle = null){
    const pool = poolOf(key);
    if (!pool.length) return null;
    const d = deckFor(key);

    const avoid = new Set(battle?.groups || []);
    for (const id of d.recent.slice(-3)) avoid.add(groupOf(byId.get(id)));

    const inBattle = id => battle?.groups?.has(groupOf(byId.get(id)));
    let at = d.remaining.findIndex(id => !avoid.has(groupOf(byId.get(id))));
    if (at < 0) at = d.remaining.findIndex(id => !inBattle(id));   // 直近はゆるしても、同じ戦いの重複はさける
    let id;
    if (at >= 0) id = d.remaining.splice(at, 1)[0];
    else {
      // 山札の残りが ぜんぶ この戦いで出た型のとき（山札の終わりぎわ）：
      // 山札の外から、この戦いに まだ出ていない型を1問かりる（残りは山札に のこす）
      const spare = shuffle(pool.map(q => q.id).filter(x => !inBattle(x) && !d.remaining.includes(x)));
      id = spare.find(x => !d.recent.includes(x)) ?? spare[0] ?? d.remaining.splice(0, 1)[0];   // それもなければ許す
    }
    d.recent.push(id);
    if (d.recent.length > RECENT_MAX) d.recent.splice(0, d.recent.length - RECENT_MAX);
    const q = byId.get(id);
    battle?.groups?.add(groupOf(q));
    return q;
  }

  /** 表示用：山札の残り（先生に見せる／テスト用） */
  function deckInfo(key){
    const d = getState()?.questionDecks?.[key];
    return { pool: poolOf(key).length, raw: rawCount(key), remaining: d?.remaining.length ?? 0 };
  }

  return { load, draw, hasPool, poolOf, rawCount, deckInfo, byId, get units(){ return unitsMap; } };
}
