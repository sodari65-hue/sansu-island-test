// たたかい ― 敵との1問1答（知識・技能）と、ボス戦（概念的な理解）。
//
// 敵：正解すると主人公の攻撃（体当たり）。まちがえると敵の攻撃を受け、ヒントが出て、同じ問題をもう一度。
// ボス：data/bosses/*.json の台本どおりに進む。毎回同じ問題・同じ順番で、選択肢の並びだけ入れかえる。
//   twoStep（答え→理由）… 答えで1、理由で1 ダメージ
//   level（ならす）… 高い列のブロックを低い列へうつして、ぜんぶ同じ高さにする
//   bar（テープ）… もとにする量を1とみて、くらべる量のぶんだけのばす
//
// たたかい中は画面の右に問題を出し、左に主人公と相手が見えるようにする（onHero / onFoe で動きを出す）。

import { toHTML, speak, stopSpeak } from './furigana.js';
import { PLAYER_HP } from './config.js';
import { shuffle } from './questions.js';
import { runTwoStep } from './twostep.js';
import { fractionWidget, anglesWidget } from './boss-widgets.js';
import { showQuestionRef } from './playtest.js';

const $ = id => document.getElementById(id);

export function createBattle({ getFurigana, getGrade, getSpeech, onHero, onFoe }){
  const el = {
    root: $('enc'), foe: $('encFoe'), foeHp: $('encFoeHp'), tag: $('encTag'),
    fig: $('encFig'), q: $('encQ'), ans: $('encAns'), msg: $('encMsg'),
    myHp: $('encMyHp'), speak: $('encSpeak'), close: $('encClose'),
  };
  const H = t => toHTML(t, getFurigana());
  const hearts = (n, max) => '♥'.repeat(Math.max(0, n)) + '<span class="off">' + '♥'.repeat(Math.max(0, max - n)) + '</span>';

  let S = null;
  const isOpen = () => !!S;
  const say  = (text, cls = '') => { el.msg.className = 'encMsg ' + cls; el.msg.innerHTML = H(text); };
  const talk = text => { if (getSpeech() && text) speak(text, getGrade()); };
  const later = (ms, fn) => { const id = S?.id; setTimeout(() => { if (S && S.id === id) fn(); }, ms); };

  function open(foeName, maxHp){
    el.root.classList.remove('hide');
    el.root.classList.add('side');
    el.foe.innerHTML = H(foeName);
    el.fig.innerHTML = ''; el.ans.innerHTML = ''; el.q.innerHTML = '';
    S.maxHp = maxHp;
    draw();
  }
  function close(){
    stopSpeak();
    el.root.classList.add('hide');
    el.root.classList.remove('side');
    el.fig.innerHTML = ''; el.ans.innerHTML = '';
    const s = S; S = null;
    return s;
  }
  function end(res){ const s = close(); s?.onEnd?.(res); }
  function draw(){
    el.foeHp.innerHTML = hearts(S.foeHp, S.maxHp);
    el.myHp.innerHTML  = hearts(S.myHp, PLAYER_HP);
  }

  el.speak.addEventListener('click', () => { if (S?.speakText) speak(S.speakText, getGrade()); });
  el.close.addEventListener('click', () => {
    if (!S) return;
    // まちがえたまま にげたときも、その問題は「まちがい」として記録にのこす（ヒント役が使う）
    if (S.mode === 'enemy' && S.q && S.tries > 0) S.hooks.onAnswer?.({ qid: S.q.id, correct: false, tries: S.tries, ms: performance.now() - S.t0 });
    end({ result: 'escape' });
  });

  // ---- こたえ方の部品 ----------------------------------------------------

  function choiceButtons(choices, onPick){
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    shuffle(choices.map((_, i) => i)).forEach(i => {
      const c = choices[i];
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = H(c);
      b.addEventListener('click', () => onPick(i, b));
      el.ans.append(b);
    });
  }

  /** 数を入れる（iPad のキーボードを出さずにすむよう、大きなテンキー。小数点あり） */
  function numberPad(unitLabel, onSubmit){
    el.ans.className = 'encAns pad';
    el.ans.innerHTML = `
      <div class="padView"><span id="padVal">0</span><span class="padUnit">${H(unitLabel || '')}</span></div>
      <div class="padKeys">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k=".">.</button><button data-k="0">0</button><button data-k="del" class="k2">けす</button>
        <button data-k="ok" class="ok">こたえる</button>
      </div>`;
    let val = '';
    const view = $('padVal');
    el.ans.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'del') val = val.slice(0, -1);
      else if (k === 'ok'){ if (val !== '' && val !== '.') onSubmit(Number(val)); return; }
      else if (k === '.'){ if (!val.includes('.') && val.length < 7) val += (val === '' ? '0.' : '.'); }
      else if (val.length < 7) val += k;
      view.textContent = val === '' ? '0' : val;
    }));
  }

  /** テープ図：ぜんぶで total こ の めもり。指でなぞって いくつぶんかを きめる */
  function barWidget(st, onSubmit){
    el.ans.className = 'encAns bar';
    el.ans.innerHTML = `
      <div class="barLabel">${H(st.label || '')}</div>
      <div class="barTrack" id="barTrack"><div class="barFill" id="barFill"></div><div class="barTicks" id="barTicks"></div>
        <div class="barOne">1</div></div>
      <div class="barRead">いま <b id="barVal">0</b> / ${st.total}</div>
      <button class="ansBtn ok" id="barOk">これで いく</button>`;
    const track = $('barTrack'), fill = $('barFill'), read = $('barVal');
    $('barTicks').innerHTML = Array.from({ length: st.total }, () => '<i></i>').join('');
    let val = 0;
    const set = n => { val = Math.max(0, Math.min(st.total, n)); fill.style.width = (val / st.total * 100) + '%'; read.textContent = val; };
    const from = e => { const r = track.getBoundingClientRect(); set(Math.round((e.clientX - r.left) / r.width * st.total)); };
    let drag = false;
    track.addEventListener('pointerdown', e => { drag = true; try { track.setPointerCapture(e.pointerId); } catch (x){} from(e); e.preventDefault(); });
    track.addEventListener('pointermove', e => { if (drag){ from(e); e.preventDefault(); } });
    track.addEventListener('pointerup', () => { drag = false; });
    track.addEventListener('pointercancel', () => { drag = false; });
    $('barOk').addEventListener('click', () => onSubmit(val));
    set(0);
  }

  /** ならす：高い列のブロックをタップ → 低い列をタップ で1こ うつす */
  function levelWidget(st, onDone){
    const cols = st.columns.slice();
    const goal = cols.reduce((a, v) => a + v, 0) / cols.length;
    const maxH = Math.max(...cols) + 1;
    let pick = -1;
    el.ans.className = 'encAns level';
    function render(){
      el.ans.innerHTML = `<div class="lvWrap">${cols.map((h, i) => `
        <button class="lvCol${pick === i ? ' pick' : ''}" data-i="${i}" style="--h:${maxH}">
          <span class="lvStack">${'<i></i>'.repeat(h)}</span>
          <span class="lvNum">${h}${H(st.unit || '')}</span>
        </button>`).join('')}</div>
        <div class="lvRow"><button class="ansBtn" id="lvReset">はじめから</button></div>`;
      el.ans.querySelectorAll('.lvCol').forEach(b => b.addEventListener('click', () => tap(Number(b.dataset.i))));
      $('lvReset').addEventListener('click', () => { cols.splice(0, cols.length, ...st.columns); pick = -1; render(); });
    }
    function tap(i){
      if (pick < 0){ if (cols[i] > 0){ pick = i; } }
      else if (pick === i){ pick = -1; }
      else { cols[pick]--; cols[i]++; pick = -1; }
      render();
      if (cols.every(v => v === goal)){ el.ans.innerHTML = ''; later(350, onDone); }
    }
    render();
  }

  // ---- 敵とのたたかい ----------------------------------------------------

  /**
   * @param foe   { name, hp, coins }
   * @param hooks { draw(battle)→問題|null, onAnswer(entry), onEnd(res), noQuestionMsg }
   */
  function startEnemy(foe, hooks){
    S = { id: Math.random(), mode: 'enemy', foe, foeHp: foe.hp, myHp: PLAYER_HP, q: null, tries: 0, t0: 0,
          battle: { groups: new Set() }, onEnd: hooks.onEnd, hooks, speakText: '' };
    open(foe.name, foe.hp);
    nextQuestion();
  }

  function nextQuestion(){
    const q = S.hooks.draw(S.battle);
    if (!q){
      el.tag.classList.add('hide');
      el.q.innerHTML = H('出せる {問題|もんだい}が ありません。');
      el.ans.className = 'encAns'; el.ans.innerHTML = '';
      say(S.hooks.noQuestionMsg || '{先生|せんせい}が かくにんした {問題|もんだい}が まだ ありません。', 'warn');
      return;
    }
    S.q = q; S.tries = 0; S.t0 = performance.now();
    showQuestionRef('encQ', q.id);
    S.speakText = q.speech || q.text;
    el.tag.classList.toggle('hide', q.status !== 'draft');
    el.q.innerHTML = H(q.text);
    say('');
    draw();
    talk(S.speakText);
    if (q.type === 'number') numberPad(q.unitLabel, v => answerEnemy(Math.abs(v - q.answer) <= (q.tolerance ?? 1e-9)));
    else choiceButtons(q.choices || [], i => answerEnemy(i === q.answer));
  }

  function answerEnemy(correct){
    if (!S || S.mode !== 'enemy') return;
    S.tries++;
    stopSpeak();
    if (correct){
      S.hooks.onAnswer?.({ qid: S.q.id, correct: true, tries: S.tries, ms: performance.now() - S.t0 });
      S.foeHp--; draw();
      onHero?.('attack'); setTimeout(() => onFoe?.('hit'), 250);
      say('せいかい！ たいあたり！', 'ok');
      el.ans.innerHTML = '';
      later(1000, () => {
        if (S.foeHp > 0) return nextQuestion();
        onFoe?.('defeat');
        say(`${S.foe.name}を たおした！`, 'ok');
        later(1100, () => end({ result: 'win', coins: S.foe.coins }));
      });
    } else {
      S.myHp--; draw();
      onFoe?.('attack'); setTimeout(() => onHero?.('damaged'), 300);
      if (S.myHp <= 0){
        S.hooks.onAnswer?.({ qid: S.q.id, correct: false, tries: S.tries, ms: performance.now() - S.t0 });
        say('ちからつきた…。でも だいじょうぶ、また ちょうせん しよう！', 'ng');
        el.ans.innerHTML = '';
        later(1800, () => end({ result: 'lose' }));
      } else {
        const hint = S.q.hint || 'もう いちど かんがえてみよう。';
        say('ざんねん。ヒント：' + hint, 'ng');
        talk(hint);
      }
    }
  }

  // ---- ボス戦 ------------------------------------------------------------

  /**
   * @param boss  data/bosses/*.json
   * @param hooks { onAnswer(entry), onEnd(res) }
   */
  function startBoss(boss, hooks){
    S = { id: Math.random(), mode: 'boss', boss, foeHp: boss.hp, myHp: PLAYER_HP, stage: -1, t0: 0,
          onEnd: hooks.onEnd, hooks, speakText: boss.taunt };
    open(boss.name, boss.hp);
    showQuestionRef('encQ', boss.id);
    el.tag.classList.toggle('hide', boss.status !== 'draft');
    el.q.innerHTML = H(boss.taunt);
    say('まちがった かんがえで こうげきしてきた！ {正|ただ}しい かんがえで {反論|はんろん}しよう。', 'warn');
    talk(boss.taunt);
    onFoe?.('attack'); setTimeout(() => onHero?.('damaged'), 300);
    el.ans.className = 'encAns choices'; el.ans.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'ansBtn ok'; b.textContent = 'たちむかう！';
    b.addEventListener('click', () => bossStage(0));
    el.ans.append(b);
  }

  function hitBoss(text){
    S.foeHp--; draw();
    onHero?.('attack'); setTimeout(() => onFoe?.('hit'), 250);
    say(text, 'ok');
  }
  /** ボスの攻撃を受ける。たおれたら false。text が null なら文は出さない（呼び出し元が出す） */
  function hitMe(text){
    S.myHp--; draw();
    onFoe?.('attack'); setTimeout(() => onHero?.('damaged'), 300);
    if (S.myHp <= 0){
      say('ちからつきた…。でも ボスの まちがいは {見|み}えてきたはず。もう一度！', 'ng');
      el.ans.innerHTML = '';
      later(2000, () => end({ result: 'lose' }));
      return false;
    }
    if (text){ say(text, 'ng'); talk(text.replace(/^ヒント：/, '')); }
    return true;
  }

  function bossStage(i){
    if (!S) return;
    const st = S.boss.stages[i];
    if (!st || S.foeHp <= 0) return bossWin();
    S.stage = i; S.t0 = performance.now();
    const qid = `${S.boss.id}-${i + 1}`;
    showQuestionRef('encQ', qid);
    const session = S;
    let settled = false;
    const active = () => S === session && S.stage === i && S.myHp > 0 && !settled;
    say('');

    if (st.kind === 'twoStep'){
      S.speakText = st.text;
      el.q.innerHTML = H(st.text);
      talk(st.text);
      runTwoStep(el.ans, st, {
        H, say, talk,
        onStep: ({ stage, correct, tries }) => {
          if (!active()) return false;
          S.hooks.onAnswer?.({ qid: `${qid}-${stage}`, correct, tries, ms: performance.now() - S.t0 });
          if (correct){ hitBoss(stage === 'answer' ? 'せいかい！ たいあたり！' : 'りゆうも ばっちり！ たいあたり！'); return true; }
          return hitMe(null);          // ヒントの文は runTwoStep が まちがえた選択肢に合わせて出す
        },
        onDone: () => { if (active()){ settled = true; later(1200, () => bossStage(i + 1)); } },
      });
      return;
    }
    if (st.kind === 'level'){
      S.speakText = st.say + '　' + st.text;
      el.q.innerHTML = H(st.say) + '<div class="subQ">' + H(st.text) + '</div>';
      talk(st.say + '。' + st.text);
      say(st.hint, '');
      levelWidget(st, () => {
        if (!active()) return;
        settled = true;
        S.hooks.onAnswer?.({ qid, correct: true, tries: 1, ms: performance.now() - S.t0 });
        hitBoss(st.ok);
        el.ans.innerHTML = '';
        later(1600, () => bossStage(i + 1));
      });
      return;
    }
    if (['bar', 'fraction', 'angles'].includes(st.kind)){
      S.speakText = st.say + '　' + st.text;
      el.q.innerHTML = H(st.say) + '<div class="subQ">' + H(st.text) + '</div>';
      talk(st.say + '。' + st.text);
      let tries = 0;
      const widget = st.kind === 'bar' ? (_, data, submit) => barWidget(data, submit) : st.kind === 'fraction' ? fractionWidget : anglesWidget;
      widget(el.ans, st, v => {
        if (!active()) return;
        tries++;
        S.hooks.onAnswer?.({ qid, correct: v === st.answer, tries, ms: performance.now() - S.t0 });
        if (v === st.answer){
          settled = true;
          const pin = document.createElement('div');
          pin.className = 'pinned';
          pin.innerHTML = st.kind === 'bar'
            ? `<div class="pinCap">${H(st.cap || '')}</div><div class="barTrack small"><div class="barFill" style="width:${st.answer / st.total * 100}%"></div></div>`
            : H(st.ok);
          el.fig.append(pin);
          hitBoss(st.ok);
          el.ans.innerHTML = '';
          later(1700, () => bossStage(i + 1));
        } else {
          hitMe('ヒント：' + st.hint);
        }
      });
    }
  }

  function bossWin(){
    onFoe?.('defeat');
    const lines = S.boss.beaten || [];
    let k = 0;
    say('ボスを たおした！ ずかんに とうろく されたよ。', 'ok');
    el.ans.className = 'encAns choices'; el.ans.innerHTML = '';
    const next = () => {
      if (!S) return;
      if (k >= lines.length) return end({ result: 'win', boss: S.boss.id });
      el.q.innerHTML = H(lines[k]); talk(lines[k]); k++;
    };
    const b = document.createElement('button');
    b.className = 'ansBtn ok'; b.textContent = 'つぎへ';
    b.addEventListener('click', next);
    el.ans.append(b);
    onHero?.('cheer');
    next();
  }

  return { startEnemy, startBoss, isOpen, close };
}
