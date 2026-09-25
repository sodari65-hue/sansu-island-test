import { shuffle } from '../questions.js';
import { runTwoStep } from '../twostep.js';
import { toHTML, speak, stopSpeak } from '../furigana.js';
import { rememberIssue } from '../playtest.js';

// Shared two-step logic and question data; this view owns its session lifetime.
export function mountQuestion(box, q, { ruby, grade, trial, onAttempt, onSolved }){
  let active = true, settled = false, tries = 0;
  const start = performance.now(), H = text => toHTML(text, ruby);
  box.replaceChildren();
  const ref = document.createElement('div'); ref.className = 'qref';
  const id = document.createElement('span'); id.textContent = `問題ID：${q.id}`; ref.append(id);
  if (trial){
    const memo = document.createElement('button'); memo.textContent = 'この問題を メモ';
    memo.onclick = () => { try { rememberIssue(q.id); memo.textContent = 'メモしました'; memo.disabled = true; } catch { memo.textContent = '保存できません。IDを先生に見せてね'; } };
    ref.append(memo);
  }
  const read = document.createElement('button'); read.textContent = 'よみあげ';
  read.onclick = () => speak(q.speech || q.text, grade); ref.append(read);
  const text = document.createElement('div'); text.className = 'question'; text.innerHTML = H(q.text);
  const answers = document.createElement('div'); answers.className = 'encAns choices';
  const feedback = document.createElement('div'); feedback.className = 'feedback'; feedback.setAttribute('role', 'status');
  box.append(ref, text, answers, feedback);
  const say = (text, cls = '') => { if (!active) return; feedback.innerHTML = H(text); feedback.className = `feedback ${cls}`; };
  const record = entry => {
    if (!active || settled) return false;
    onAttempt({ qid: q.id, ...entry, ms: Math.round(performance.now() - start) });
    return active;
  };
  function done(){
    if (!active || settled) return;
    settled = true; stopSpeak(); answers.replaceChildren(); say('せいかい！', 'ok'); onSolved();
  }
  if (q.reasons){
    runTwoStep(answers, q, { H, say, talk: () => {}, onStep: record, onDone: done });
  } else {
    const judge = (ok, index, button) => {
      if (!active || settled) return;
      tries++;
      if (record({ correct: ok, tries }) === false) return;
      if (ok) return done();
      if (button) button.disabled = true;
      say('ヒント：' + (q.hints?.[index] || q.hint || 'もういちど かんがえよう。'));
    };
    if (q.type === 'number'){
      answers.className = 'pad';
      const out = document.createElement('output'), keys = document.createElement('div'); keys.className = 'keys';
      let value = '';
      const refresh = () => { out.textContent = `${value || '0'} ${q.unitLabel || ''}`.replace(/\{([^|}]+)\|[^}]+\}/g, '$1'); };
      for (const key of ['1','2','3','4','5','6','7','8','9','.','0','けす','こたえる']){
        const b = document.createElement('button'); b.textContent = key;
        if (key === 'こたえる') b.className = 'submit';
        b.onclick = () => {
          if (!active || settled) return;
          if (key === 'こたえる') { if (value) judge(Math.abs(Number(value) - q.answer) <= (q.tolerance ?? 1e-9)); else say('数字を入れてから「こたえる」を押してね。'); return; }
          if (key === 'けす') value = value.slice(0, -1);
          else if (key === '.') { if (!value.includes('.') && value.length < 9) value += value ? '.' : '0.'; }
          else if (value.length < 9) value += key;
          refresh();
        }; keys.append(b);
      }
      answers.append(out, keys); refresh();
    } else {
      for (const i of shuffle(q.choices.map((_, i) => i))){
        const b = document.createElement('button'); b.className = 'ansBtn'; b.innerHTML = H(q.choices[i]);
        b.onclick = () => judge(i === q.answer, i, b); answers.append(b);
      }
    }
  }
  return () => { active = false; stopSpeak(); };
}
