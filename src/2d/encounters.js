import { toHTML, speak, stopSpeak } from '../furigana.js';
import { rememberIssue } from '../playtest.js';
import { runTwoStep } from '../twostep.js';
import { fractionWidget, anglesWidget } from '../boss-widgets.js';
import { shuffle } from '../questions.js';

// The caller owns review gating, the portrait, the outer close button and rewards.
function mount(container, data, opts, mode){
  const H = value => toHTML(value ?? '', !!opts.ruby);
  let active = true, cleared = false, stage = -1, hp = 3, foeHp = data.hp || 0;
  let tries = 0, started = 0, speakText = '', generation = 0;
  const root = document.createElement('section'); root.className = 'enc2d';
  container.replaceChildren(root);
  const head = document.createElement('div'); head.className = 'enc2d-head';
  const title = document.createElement('h3'); title.innerHTML = H(mode === 'boss' ? data.name : data.title);
  const status = document.createElement('div'); status.className = 'enc2d-status';
  head.append(title, status);
  const ref = document.createElement('div'); ref.className = 'enc2d-ref';
  const prompt = document.createElement('div'); prompt.className = 'enc2d-prompt';
  const table = document.createElement('div'); table.className = 'enc2d-table';
  const answers = document.createElement('div'); answers.className = 'encAns choices';
  const message = document.createElement('div'); message.className = 'enc2d-message'; message.setAttribute('role', 'status');
  const controls = document.createElement('div'); controls.className = 'enc2d-controls';
  root.append(head, ref, prompt, table, answers, message, controls);
  const button = (label, fn, cls = '', persistent = false) => {
    const born = generation;
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', () => { if (active && (persistent || (!cleared && born === generation))) fn(); }); return b;
  };
  const say = (value, kind = '') => { if (active) { message.innerHTML = H(value); message.className = `enc2d-message ${kind}`; } };
  const talk = value => { if (active && value) speak(value, opts.grade); };
  const drawHp = () => { status.textContent = mode === 'boss' ? `じぶん ${'♥'.repeat(hp)}${'♡'.repeat(3-hp)}　ボス ${Math.max(0,foeHp)} / ${data.hp}` : `ステップ ${Math.min(stage+1, data.steps.length)} / ${data.steps.length}`; };
  const record = (qid, correct, extra = {}) => {
    if (!active || cleared) return false;
    opts.onAttempt?.({ qid, correct, tries: extra.tries ?? ++tries, ms: Math.round(performance.now() - started), ...(extra.stage ? {stage:extra.stage} : {}) });
    return active && !cleared;
  };
  function setRef(qid, speech){
    speakText = speech || '';
    ref.replaceChildren();
    if (opts.trial){
      const label = document.createElement('span'); label.textContent = `試遊・問題ID：${qid}`;
      const memo = button('この問題を メモ', () => {
        try { rememberIssue(qid); memo.disabled = true; memo.textContent = 'メモしました'; }
        catch { memo.textContent = '保存できません。IDを先生に見せてね'; }
      });
      ref.append(label, memo);
    }
    ref.append(button('よみあげ', () => talk(speakText)));
  }
  function dispose(){
    if (!active) return;
    active = false; stopSpeak(); root.replaceChildren();
    if (root.parentNode === container) root.remove();
  }
  function clear(){
    if (!active || cleared) return;
    cleared = true; generation++; stopSpeak(); answers.replaceChildren(); controls.replaceChildren(); ref.replaceChildren();
    const ending = mode === 'boss' ? (data.defeated || data.beaten || []) : (data.outro || '');
    const lines = Array.isArray(ending) ? ending : [ending];
    prompt.innerHTML = lines.filter(Boolean).map(line => `<p>${H(line)}</p>`).join('');
    table.replaceChildren();
    const readEnding = lines.filter(Boolean).join('。');
    if (readEnding) ref.append(button('結末を よみあげ', () => talk(readEnding), '', true));
    say(mode === 'boss' ? 'ボスを たおした！' : 'クエスト クリア！', 'ok');
    exitButton.textContent = 'とじる'; controls.append(exitButton);
    opts.onClear?.({ id: data.id, coins: mode === 'boss' ? 0 : data.reward?.coins || 0 });
  }
  function exit(){ if (!active) return; dispose(); opts.onExit?.(); }
  const exitButton = button('やめて もどる', exit, 'enc2d-exit', true);
  controls.append(exitButton);
  function nextButton(label, fn){ answers.replaceChildren(button(label, fn, 'ansBtn enc2d-primary')); }
  function fail(hint){
    hp--; drawHp();
    if (hp <= 0){
      say('ちからつきた…。また ちょうせん しよう！', 'ng');
      nextButton('もういちど', () => restartBoss());
      return false;
    }
    say(`ヒント：${hint || 'もう いちど かんがえてみよう。'}`, 'ng');
    return true;
  }
  function restartBoss(){ hp = 3; foeHp = data.hp; bossStage(0); }
  function afterStage(){
    if (!active || cleared) return;
    if (foeHp <= 0 || stage + 1 >= data.stages.length) return clear();
    nextButton('つぎへ', () => bossStage(stage + 1));
  }
  function bossStage(index){
    if (!active || cleared) return;
    const st = data.stages[index];
    if (!st) return clear();
    const currentGeneration = ++generation;
    stage = index; tries = 0; started = performance.now(); drawHp(); say(''); table.replaceChildren();
    const qid = `${data.id}-${index+1}`;
    const speech = [st.say, st.text].filter(Boolean).join('。');
    setRef(qid, speech);
    prompt.innerHTML = st.say ? `${H(st.say)}<div class="enc2d-subprompt">${H(st.text)}</div>` : H(st.text);
    let settled = false;
    const live = () => active && !cleared && generation === currentGeneration && hp > 0 && !settled;
    if (st.kind === 'twoStep'){
      let expectedPart = 'answer';
      runTwoStep(answers, st, { H, say, talk: () => {},
        onStep: ({stage:part, correct, tries:partTries}) => {
          if (!live() || part !== expectedPart) return false;
          if (!record(`${qid}-${part}`, correct, { tries:partTries, stage:part })) return false;
          if (correct){ expectedPart = part === 'answer' ? 'reason' : 'done'; foeHp = Math.max(0, foeHp - 1); drawHp(); return true; }
          return fail(null);
        },
        onDone: () => { if (live()){ settled = true; say('せいかい！ りゆうも わかったね。', 'ok'); afterStage(); } },
      });
      return;
    }
    if (st.kind === 'level'){
      const cols = st.columns.slice(), goal = cols.reduce((n,x)=>n+x,0)/cols.length;
      let picked = -1;
      function draw(){
        if (!live()) return;
        answers.replaceChildren(); answers.className = 'encAns enc2d-level';
        const row = document.createElement('div'); row.className = 'enc2d-columns';
        cols.forEach((n,i) => {
          const b = button(`${i+1}ばん　${n}${st.unit || ''}`, () => {
            if (!live()) return;
            if (picked < 0) picked = i;
            else if (picked === i) picked = -1;
            else { if (cols[picked] > 0){ cols[picked]--; cols[i]++; } picked = -1; }
            if (cols.every(x => x === goal)){
              settled = true; record(qid, true, { tries:1 }); foeHp = Math.max(0, foeHp-1); drawHp(); say(st.ok, 'ok'); afterStage();
            } else draw();
          }, picked === i ? 'enc2d-picked' : '');
          const stack = document.createElement('span'); stack.className = 'enc2d-stack';
          for(let k=0;k<n;k++) stack.append(document.createElement('i'));
          b.prepend(stack); row.append(b);
        });
        answers.append(row, button('はじめから', () => { cols.splice(0,cols.length,...st.columns); picked=-1; draw(); }));
      }
      draw(); say(st.hint); return;
    }
    let value = 0;
    const submit = v => {
      if (!live()) return;
      if (!record(qid, v === st.answer)) return;
      if (v === st.answer){
        settled = true; foeHp = Math.max(0, foeHp-1); drawHp(); say(st.ok, 'ok'); afterStage();
      } else fail(st.hint);
    };
    if (st.kind === 'fraction') fractionWidget(answers, st, submit);
    else if (st.kind === 'angles') anglesWidget(answers, st, submit);
    else if (st.kind === 'bar'){
      answers.replaceChildren(); answers.className = 'encAns enc2d-bar';
      const label = document.createElement('div'); label.innerHTML = H(st.label);
      const read = document.createElement('output');
      const track = document.createElement('div'); track.className = 'enc2d-track';
      track.tabIndex = 0; track.setAttribute('role', 'slider');
      track.setAttribute('aria-label', st.label ? st.label.replace(/\{([^|}]+)\|[^}]+\}/g, '$1') : 'テープの長さ');
      track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(st.total));
      const fill = document.createElement('div'); fill.className = 'enc2d-fill'; track.append(fill);
      const set = n => { value = Math.max(0, Math.min(st.total, n)); fill.style.width = `${100*value/st.total}%`; read.textContent = `${value} / ${st.total}`; track.setAttribute('aria-valuenow', String(value)); };
      const locate = e => { const r = track.getBoundingClientRect(); if(r.width) set(Math.round((e.clientX-r.left)/r.width*st.total)); };
      track.addEventListener('pointerdown', e => { if(!live()) return; try { track.setPointerCapture(e.pointerId); } catch{} locate(e); });
      track.addEventListener('pointermove', e => { if(live() && e.buttons) locate(e); });
      track.addEventListener('keydown', e => {
        if (!live()) return;
        const delta = { ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1, PageDown:-5, PageUp:5 }[e.key];
        if (delta == null && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault(); set(e.key === 'Home' ? 0 : e.key === 'End' ? st.total : value + delta);
      });
      answers.append(label, track, read, button('これで いく', () => submit(value), 'ansBtn enc2d-primary')); set(0);
    } else { say('この問題を表示できません。先生に見せてね。', 'ng'); answers.replaceChildren(); }
  }
  function questStep(index){
    if (!active || cleared) return;
    if (index >= data.steps.length) return clear();
    const currentGeneration = ++generation;
    stage = index; tries = 0; started = performance.now(); drawHp(); say('');
    const st = data.steps[index], qid = `${data.id}-s${index+1}`;
    setRef(qid, st.prompt); prompt.innerHTML = H(st.prompt);
    table.replaceChildren();
    // Later questions often refer to the same source data (e.g. median after mean).
    const dataTable = data.steps.slice(0,index+1).reverse().find(step=>step.dataTable)?.dataTable;
    if (dataTable){
      const t = document.createElement('table');
      const thead = t.createTHead().insertRow();
      for (const cell of dataTable.head || []) { const th = document.createElement('th'); th.innerHTML = H(cell); thead.append(th); }
      const tbody = t.createTBody();
      for (const row of dataTable.rows || []) { const tr = tbody.insertRow(); for (const cell of row){ const td = tr.insertCell(); td.innerHTML = H(cell); } }
      table.append(t);
    }
    let settled = false;
    const live = () => active && !cleared && generation === currentGeneration && !settled;
    function judge(ok, part){
      if (!live()) return false;
      if (!record(qid, ok, part ? { stage:part } : {})) return false;
      if (ok){ settled = true; say(st.feedback || 'そのとおり！', 'ok'); nextButton(index + 1 === data.steps.length ? 'けっかを みる' : 'つぎへ', () => questStep(index+1)); }
      else say(`ヒント：${st.hint || 'もう いちど かんがえてみよう。'}`, 'ng');
      return true;
    }
    answers.replaceChildren(); answers.className = 'encAns choices';
    if (st.kind === 'twoStep'){
      let expectedPart = 'answer';
      runTwoStep(answers, st, { H, say, talk: () => {},
        onStep: ({stage:part,correct,tries:partTries}) => {
          if (!live() || part !== expectedPart) return false;
          if (correct) expectedPart = part === 'answer' ? 'reason' : 'done';
          return record(`${qid}-${part}`, correct, { tries:partTries, stage:part });
        },
        onDone: () => { if (live()){ settled = true; say(st.feedback || 'そのとおり！', 'ok'); nextButton(index + 1 === data.steps.length ? 'けっかを みる' : 'つぎへ', () => questStep(index+1)); } },
      }); return;
    }
    if (st.kind === 'input'){
      const display = document.createElement('output'); display.textContent = `0 ${st.unitLabel || ''}`;
      const pad = document.createElement('div'); pad.className = 'enc2d-pad';
      let value = '';
      for (const key of ['1','2','3','4','5','6','7','8','9','.','0','けす','こたえる']){
        pad.append(button(key, () => {
          if (!live()) return;
          if (key === 'こたえる'){ if(value && value !== '.') judge(Math.abs(Number(value)-st.answer) <= (st.tolerance ?? 1e-9)); else say('数字を 入れてね。'); return; }
          if (key === 'けす') value = value.slice(0,-1);
          else if (key === '.') { if(!value.includes('.') && value.length<9) value += value ? '.' : '0.'; }
          else if (value.length<9) value += key;
          display.innerHTML = H(`${value || '0'} ${st.unitLabel || ''}`);
        }, key === 'こたえる' ? 'enc2d-primary' : ''));
      }
      answers.className = 'encAns enc2d-number'; answers.append(display,pad); return;
    }
    const order = shuffle(st.choices.map((_,i)=>i));
    if (st.kind === 'multi'){
      const picked = new Set();
      for(const i of order){ const b = button('', () => { if(picked.has(i)) picked.delete(i); else picked.add(i); b.classList.toggle('enc2d-picked',picked.has(i)); }, 'ansBtn'); b.innerHTML=H(st.choices[i]); answers.append(b); }
      answers.append(button('これで こたえる', () => judge([...picked].sort().join(',') === [...st.answer].sort().join(',')), 'ansBtn enc2d-primary')); return;
    }
    if (st.kind === 'order'){
      const seq = [], buttons=[];
      for(const i of order){ const b = button('', () => {
        if(seq.includes(i)) return;
        seq.push(i); b.classList.add('enc2d-picked'); b.querySelector('span').textContent = `${seq.length}. `;
        if(seq.length === st.choices.length) judge(seq.join(',') === st.answer.join(','));
      }, 'ansBtn'); const number=document.createElement('span'); b.append(number); const label=document.createElement('span');label.innerHTML=H(st.choices[i]);b.append(label); answers.append(b); buttons.push(b); }
      answers.append(button('ならべなおす', () => { seq.length=0; for(const b of buttons){b.classList.remove('enc2d-picked');b.querySelector('span').textContent='';} })); return;
    }
    if (st.kind === 'select'){
      for(const i of order){ const b=button('', () => judge(i === st.answer), 'ansBtn');b.innerHTML=H(st.choices[i]);answers.append(b); } return;
    }
    say('この問題を表示できません。先生に見せてね。', 'ng');
  }
  if (mode === 'boss'){
    setRef(data.id, data.taunt); prompt.innerHTML=H(data.taunt); drawHp();
    nextButton('たちむかう！', () => bossStage(0));
  } else {
    const context=document.createElement('div'); context.className='enc2d-context';
    context.innerHTML=`<div>${H(data.giver || '')}</div><div>${H(data.mission || '')}</div><p>${H(data.intro || '')}</p>`;
    head.after(context); stage=0; drawHp();
    nextButton('はじめる', () => questStep(0));
  }
  return dispose;
}

export function mountBoss(container, boss, opts){ return mount(container, boss, opts, 'boss'); }
export function mountQuest(container, quest, opts){ return mount(container, quest, opts, 'quest'); }
