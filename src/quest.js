// クエスト ― プロジェクト型の課題を1ステップずつ進める。
// データは data/quests/g*.json。ステップの種類は select / multi / input / order / twoStep の5つ。
// twoStep は「答え＋理由」の2段階選択（出題・称号・報酬 実装計画書 3章）。

import { toHTML, speak, stopSpeak } from './furigana.js';
import { runTwoStep } from './twostep.js';
import { shuffle } from './questions.js';
import { showQuestionRef } from './playtest.js';

const $ = id => document.getElementById(id);

export function createQuest({ getFurigana, getGrade, getSpeech }){
  const el = {
    root:  $('qst'),
    title: $('qstTitle'),
    giver: $('qstGiver'),
    step:  $('qstStep'),
    body:  $('qstBody'),
    table: $('qstTable'),
    ans:   $('qstAns'),
    msg:   $('qstMsg'),
    speak: $('qstSpeak'),
    close: $('qstClose'),
  };

  const H = t => toHTML(t, getFurigana());
  let S = null;

  const isOpen = () => !!S;
  function say(text, cls = ''){ el.msg.className = 'encMsg ' + cls; el.msg.innerHTML = H(text); }
  function talk(text){ if (getSpeech()) speak(text, getGrade()); }

  function close(){
    stopSpeak();
    el.root.classList.add('hide');
    el.table.innerHTML = ''; el.ans.innerHTML = '';
    const s = S; S = null;
    return s;
  }

  el.speak.addEventListener('click', () => { if (S?.speakText) speak(S.speakText, getGrade()); });
  el.close.addEventListener('click', () => {
    if (!S) return;
    const s = S; close(); s.onEnd?.({ result: 'quit' });
  });

  /**
   * @param quest data/quests のクエスト1本
   * @param hooks { onAnswer(entry), onEnd(res), done:boolean }
   */
  function start(quest, hooks){
    S = { quest, i: -1, tries: 0, t0: 0, speakText: '', onEnd: hooks.onEnd, hooks };
    el.root.classList.remove('hide');
    el.title.innerHTML = H(quest.title);
    showQuestionRef('qstBody', quest.id);
    el.giver.innerHTML = H(quest.giver);
    el.step.textContent = '';
    el.table.innerHTML = '';
    el.ans.innerHTML = '';

    const intro = hooks.done
      ? quest.intro + '（この クエストは クリアずみ。もう一度 やってみる？）'
      : quest.intro;
    el.body.innerHTML = H(intro) + '<div class="mission">' + H('【' + quest.mission + '】') + '</div>';
    S.speakText = intro;
    say('');
    talk(intro);

    const b = document.createElement('button');
    b.className = 'ansBtn ok';
    b.textContent = 'ひきうける';
    b.addEventListener('click', () => nextStep());
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    el.ans.append(b);
  }

  function nextStep(){
    if (!S) return;
    S.i++;
    const steps = S.quest.steps;
    if (S.i >= steps.length) return finish();

    const st = steps[S.i];
    showQuestionRef('qstBody', `${S.quest.id}-s${S.i + 1}`);
    S.tries = 0; S.t0 = performance.now();
    el.step.textContent = `ステップ ${S.i + 1} / ${steps.length}`;
    el.body.innerHTML = H(st.prompt);
    S.speakText = st.prompt;
    say('');
    talk(st.prompt);

    el.table.innerHTML = st.dataTable ? renderTable(st.dataTable) : '';

    if (st.kind === 'input') inputPad(st);
    else if (st.kind === 'twoStep') twoStep(st);
    else if (st.kind === 'multi') multi(st);
    else if (st.kind === 'order') order(st);
    else single(st);
  }

  function renderTable(t){
    const head = (t.head || []).map(h => `<th>${H(h)}</th>`).join('');
    const rows = (t.rows || []).map(r => '<tr>' + r.map(c => `<td>${H(c)}</td>`).join('') + '</tr>').join('');
    return `<table class="qTable"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function judge(ok, st){
    S.tries++;
    stopSpeak();
    const qid = `${S.quest.id}-s${S.i + 1}`;
    if (ok){
      S.hooks.onAnswer?.({ qid, correct: true, tries: S.tries, ms: performance.now() - S.t0 });
      say(st.feedback || 'そのとおり！', 'ok');
      talk(st.feedback || 'そのとおり');
      el.ans.className = 'encAns choices';
      el.ans.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'ansBtn ok';
      b.textContent = S.i + 1 >= S.quest.steps.length ? 'けっかを つたえる' : 'つぎへ';
      b.addEventListener('click', () => nextStep());
      el.ans.append(b);
    } else {
      say('もう いちど。ヒント：' + (st.hint || 'よく 見てみよう。'), 'ng');
      talk(st.hint || '');
    }
  }

  function twoStep(st){
    let tries = 0;
    runTwoStep(el.ans, st, {
      H, say, talk: t => talk(t),
      onStep: ({ correct }) => { tries++; },
      onDone: () => {
        S.tries = tries - 1;          // judge が 1 足すので、合計の回数にそろえる
        judge(true, st);
      },
    });
  }

  function single(st){
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    shuffle(st.choices.map((_, i) => i)).forEach(i => {
      const c = st.choices[i];
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = H(c);
      b.addEventListener('click', () => judge(i === st.answer, st));
      el.ans.append(b);
    });
  }

  function multi(st){
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    const picked = new Set();
    shuffle(st.choices.map((_, i) => i)).forEach(i => {
      const c = st.choices[i];
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = H(c);
      b.addEventListener('click', () => {
        if (picked.has(i)){ picked.delete(i); b.classList.remove('on'); }
        else { picked.add(i); b.classList.add('on'); }
      });
      el.ans.append(b);
    });
    const ok = document.createElement('button');
    ok.className = 'ansBtn ok';
    ok.textContent = 'これで こたえる';
    ok.addEventListener('click', () => {
      const a = [...st.answer].sort().join(',');
      const p = [...picked].sort().join(',');
      judge(a === p, st);
    });
    el.ans.append(ok);
  }

  function order(st){
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    const seq = [];
    const btns = shuffle(st.choices.map((_, i) => i)).map(i => {
      const c = st.choices[i];
      const b = document.createElement('button');
      b.className = 'ansBtn';
      b.innerHTML = `<span class="num"></span>${H(c)}`;
      b.addEventListener('click', () => {
        if (seq.includes(i)) return;
        seq.push(i);
        b.classList.add('on');
        b.querySelector('.num').textContent = seq.length;
        if (seq.length === st.choices.length){
          judge(seq.join(',') === st.answer.join(','), st);
        }
      });
      el.ans.append(b);
      return b;
    });
    const reset = document.createElement('button');
    reset.className = 'ansBtn';
    reset.textContent = 'やりなおす';
    reset.addEventListener('click', () => {
      seq.length = 0;
      btns.forEach(b => { b.classList.remove('on'); b.querySelector('.num').textContent = ''; });
    });
    el.ans.append(reset);
    say('はやい じゅんに タップしてね。');
  }

  function inputPad(st){
    el.ans.className = 'encAns pad';
    el.ans.innerHTML = `
      <div class="padView"><span id="qPadVal">0</span><span class="padUnit">${H(st.unitLabel || '')}</span></div>
      <div class="padKeys">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k=".">.</button>
        <button data-k="0">0</button>
        <button data-k="del" class="k2">けす</button>
        <button data-k="ok" class="ok">こたえる</button>
      </div>`;
    let val = '';
    const view = $('qPadVal');
    el.ans.querySelectorAll('[data-k]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'del') val = val.slice(0, -1);
        else if (k === 'ok'){ if (val !== '' && val !== '.') judge(Math.abs(Number(val) - st.answer) <= (st.tolerance ?? 1e-9), st); return; }
        else if (k === '.'){ if (!val.includes('.') && val.length < 7) val += (val === '' ? '0.' : '.'); }
        else if (val.length < 7) val += k;
        view.textContent = val === '' ? '0' : val;
      });
    });
  }

  function finish(){
    const q = S.quest;
    const coins = q.reward?.coins || 0;
    el.step.textContent = 'クリア！';
    el.body.innerHTML = H(`おつかれさま！ 「${q.title}」を やりとげた。`);
    el.table.innerHTML = '';
    say(`コイン ＋${coins}`, 'ok');           // 持ち物は、名前つきのポップアップで知らせる
    talk('クリア、おめでとう');
    el.ans.className = 'encAns choices';
    el.ans.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'ansBtn ok';
    b.textContent = 'とじる';
    b.addEventListener('click', () => {
      const s = S; close();
      s.onEnd?.({ result: 'clear', coins, questId: q.id, item: q.reward?.item });
    });
    el.ans.append(b);
  }

  return { start, isOpen, close };
}
