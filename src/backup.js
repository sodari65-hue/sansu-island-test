// BackupManager ― 記録をファイルに書き出す／読みこむ（出題・称号・報酬 実装計画書 11章）
//
// iPad の Safari は、しばらく開かないサイトの保存データを消すことがある。
// そのための「きろくを ほぞん」「きろくを よみこむ」。
//
//  ・書き出すのは、ハンドルネームとゲームの進み具合だけ（本名・クラス・番号は入っていない）
//  ・ファイルは その iPad の中（「ファイル」アプリ）に保存される。外のサーバーへは送らない
//  ・こわれたファイルや、ちがうアプリのファイルは、読みこまずにエラーを出す（いまの記録は消えない）
//  ・上書きする前の記録は「1つ前の記録」として残し、もどせるようにする

import { migrate } from './save.js';
import { SAVE_VERSION } from './config.js';
import { PLAYTEST } from './playtest.js';

const APP = PLAYTEST ? 'sansu-island-playtest' : 'sansu-island';
const KIND = 'backup';

/** こわれ・書きかえを見つけるための印（暗号ではない。こわれたかどうかを見るだけ） */
export function checksum(text){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 書き出す中身をつくる */
export function makeBackup(state){
  const data = JSON.parse(JSON.stringify(state));
  const body = JSON.stringify(data);
  return {
    app: APP, kind: KIND,
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    name: state.name,
    check: checksum(body),
    data,
  };
}

export function fileName(state, d = new Date()){
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const safe = String(state.name).replace(/[\\/:*?"<>|\s]/g, '');
  return `${PLAYTEST ? 'sansu_playtest' : 'sansu'}_${safe}_${ymd}.json`;
}

/**
 * 読みこんだ文字列を調べる。
 * @returns {{ok:true, data, preview} | {ok:false, error}}
 */
export function parseBackup(text){
  let f;
  try { f = JSON.parse(text); }
  catch (e){ return { ok: false, error: 'この ファイルは よめません（こわれているか、ちがう しゅるいの ファイルです）。' }; }

  if (!f || f.app !== APP || f.kind !== KIND || !f.data){
    return { ok: false, error: 'さんすうアイランドの きろくファイルでは ありません。' };
  }
  if (checksum(JSON.stringify(f.data)) !== f.check){
    return { ok: false, error: 'ファイルが こわれているか、書きかえられています。読みこみませんでした。' };
  }
  if (typeof f.data.name !== 'string' || !f.data.name){
    return { ok: false, error: 'なまえが 入っていない きろくです。' };
  }
  if ((f.saveVersion ?? 1) > SAVE_VERSION){
    return { ok: false, error: 'あたらしい ゲームで つくられた きろくです。ゲームを さいしんに してから 読みこんでください。' };
  }
  const data = migrate(f.data, f.data.name);    // 古い形なら いまの形に直す
  const titles = Object.values(data.titleLevels || {}).reduce((a, v) => a + v, 0);
  return {
    ok: true, data,
    preview: {
      name: data.name, grade: data.grade,
      titles, bosses: data.defeatedBosses.length,
      quests: data.clearedQuests.length, dungeons: data.clearedDungeons.length,
      savedAt: f.savedAt,
    },
  };
}

/** ファイルとして書き出す（iPad では「ファイルに保存」になる） */
export function download(state){
  const blob = new Blob([JSON.stringify(makeBackup(state), null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(state);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return a.download;
}

/** ファイルを1つえらんでもらって、その文字列を返す */
export function pickFile(){
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 2_000_000) return resolve({ error: 'ファイルが 大きすぎます。' });
      const r = new FileReader();
      r.onload = () => resolve({ text: String(r.result), name: f.name });
      r.onerror = () => resolve({ error: 'ファイルが よめませんでした。' });
      r.readAsText(f);
    };
    inp.click();
  });
}
