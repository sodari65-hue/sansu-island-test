// DungeonManager ― ダンジョン（出題・称号・報酬 実装計画書 4章）
//
//  ・知識・技能 …… その地方の敵2種の山札から引く（敵と同じ山札なので、両方の間でも重ならない）
//  ・思考・判断・表現 … ダンジョン専用の固定問題（答え＋理由の2段階選択）
//  ・出す順番は data/dungeons/*.json の sequence のとおり
//
// マップや仕掛けはまだ設計されていないので、いまは「とびらの部屋」を1つずつ進む形にしてある。
// まちがえても体力は減らない（ヒントを見て、もう一度）。

import { toHTML, speak, stopSpeak } from './furigana.js';
import { runTwoStep } from './twostep.js';
import { shuffle } from './questions.js';
import { showQuestionRef } from './playtest.js';

const $ = id => document.getElementById(id);

export function createDungeon({ getFurigana, getGrade, getSpeech }){
  const el = {
    root: $('dgn'), title: $('dgnTitle'), doors: $('dgnDoors'), tag: $('dgnTag'),
    q: $('dgnQ'), ans: $('dgnAns'), msg: $('dgnMsg'), speak: $('dgnSpeak'), close: $('dgnClose'),
  };
  const H = t => toHTML(t, getFurigana());
  let S = null;
  const isOpen = () => !!S;
  const say  = (text, cls = '') => { el.msg.className = 'encMsg ' + cls; el.msg.innerHTML = H(text); };
  const talk = text => { if (getSpeech() && text) speak(text, getGrade()); };

  function close(){
    stopSpeak();
    el.root.classList.add('hide');
    el.ans.innerHTML = '';
    const s = S; S = null;
    return s;
  }
  function end(res){ const s = close(); s?.onEnd?.(res); }

  el.speak.addEventListener('click', () => { if (S?.speakText) speak(S.speakText, getGrade()); });
  el.close.addEventListener('click', () => { if (S) end({ result: 'quit', at: S.i }); });

  function drawDoors(){
    el.doors.innerHTML = S.dg.sequence.map((s, k) => {
      const cls = k < S.i ? 'done' : k === S.i ? 'now' : '';
      const kind = s === 'knowledge' ? '' : ' think';
      return `<span class="door ${cls}${kind}">${k < S.i ? '✓' : k + 1}</span>`;
    }).join('<span class="doorLine"></span>');
  }

  /**
   * @param dg    data/dungeons/*.json
   * @param hooks { draw(key, battle)→問題|null, onAnswer(entry), onEnd(res) }
   */
  function start(dg, hooks){
    S = { dg, hooks, i: 0, t0: 0, kCount: 0, battle: { groups: new Set() }, onEnd: hooks.onEnd, speakText: '' };
    el.root.classList.remove('hide');
    el.title.innerHTML = H(dg.name);
    showQuestionRef('dgnQ', dg.id);
    el.tag.classList.toggle('hide', dg.status !== 'draft');
    room();
  }

  function room(){
    if (!S) return;
    drawDoors();
    if (S.i >= S.dg.sequence.length) return clear();
    const step = S.dg.sequence[S.i];
    const session = S, roomIndex = S.i;
    let settled = false;
    const active = () => S === session && S.i === roomIndex && !settled;
    const advance = ms => { settled = true; setTimeout(() => { if (S === session && S.i === roomIndex){ S.i++; room(); } }, ms); };
    S.t0 = performance.now();
    say('');

    if (step === 'knowledge'){
      // 敵2種の山札から かわりばんこに引く
      const keys = S.dg.knowledgeFrom;
      const key = keys[S.kCount % keys.length];
      let q = S.hooks.draw(key, S.battle);
      if (!q && keys.length > 1) q = S.hooks.draw(keys[(S.kCount + 1) % keys.length], S.battle);
      S.kCount++;
      if (!q){
        el.q.innerHTML = H('この とびらの {問題|もんだい}が ありません。');
        el.ans.innerHTML = '';
        say('{先生|せんせい}が かくにんした {問題|もんだい}が まだ ありません。', 'warn');
        return;
      }
      S.speakText = q.speech || q.text;
      showQuestionRef('dgnQ', q.id);
      el.q.innerHTML = `<span class="roomTag">とびら ${S.i + 1}</span>` + H(q.text);
      talk(S.speakText);
      let tries = 0;
      const judge = ok => {
        if (!active()) return;
        tries++;
        S.hooks.onAnswer?.({ qid: q.id, correct: ok, tries, ms: performance.now() - S.t0 });
        if (ok){
          say('とびらが ひらいた！', 'ok');
          el.ans.innerHTML = '';
          advance(900);
        } else {
          const hint = q.hint || 'もう いちど かんがえてみよう。';
          say('とびらは びくとも しない…。ヒント：' + hint, 'ng');
          talk(hint);
        }
      };
      if (q.type === 'number') numberPad(q.unitLabel, v => judge(Math.abs(v - q.answer) <= (q.tolerance ?? 1e-9)));
      else {
        el.ans.className = 'encAns choices'; el.ans.innerHTML = '';
        shuffle((q.choices || []).map((_, k) => k)).forEach(k => {
          const c = q.choices[k];
          const b = document.createElement('button');
          b.className = 'ansBtn'; b.innerHTML = H(c);
          b.addEventListener('click', () => { if (k !== q.answer) b.disabled = true; judge(k === q.answer); });
          el.ans.append(b);
        });
      }
      return;
    }

    // 思考・判断・表現（固定の2段階選択）
    const id = step.slice('thinking:'.length);
    const t = S.dg.thinking.find(x => x.id === id);
    showQuestionRef('dgnQ', t.id);
    S.speakText = t.text;
    el.q.innerHTML = `<span class="roomTag think">かんがえる とびら</span>` + H(t.text);
    talk(t.text);
    runTwoStep(el.ans, t, {
      H, say, talk,
      onStep: ({ stage, correct, tries }) => {
        if (!active()) return false;
        S.hooks.onAnswer?.({ qid: `${t.id}-${stage}`, correct, tries, ms: performance.now() - S.t0 });
      },
      onDone: () => {
        if (!active()) return;
        say('りゆうまで しっかり いえた！ とびらが ひらいた！', 'ok');
        talk('とびらが ひらいた');
        advance(1100);
      },
    });
  }

  function numberPad(unitLabel, onSubmit){
    el.ans.className = 'encAns pad';
    el.ans.innerHTML = `
      <div class="padView"><span id="dPadVal">0</span><span class="padUnit">${H(unitLabel || '')}</span></div>
      <div class="padKeys">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k=".">.</button><button data-k="0">0</button><button data-k="del" class="k2">けす</button>
        <button data-k="ok" class="ok">こたえる</button>
      </div>`;
    let val = '';
    const view = $('dPadVal');
    el.ans.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'del') val = val.slice(0, -1);
      else if (k === 'ok'){ if (val !== '' && val !== '.') onSubmit(Number(val)); return; }
      else if (k === '.'){ if (!val.includes('.') && val.length < 7) val += (val === '' ? '0.' : '.'); }
      else if (val.length < 7) val += k;
      view.textContent = val === '' ? '0' : val;
    }));
  }

  function clear(){
    el.q.innerHTML = H(`「${S.dg.name}」を クリアした！`);
    say('いちばん おくの とびらが ひらいた！', 'ok');
    talk('ダンジョン クリア');
    el.ans.className = 'encAns choices'; el.ans.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'ansBtn ok'; b.textContent = 'そとへ でる';
    b.addEventListener('click', () => end({ result: 'clear', id: S.dg.id }));
    el.ans.append(b);
  }

  return { start, isOpen, close };
}
