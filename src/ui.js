// 画面まわり ― ログイン、HUD、メッセージ窓、メニュー。
// 文字はすべて {漢字|よみ} 記法で書き、設定に合わせてふりがなを出し分ける。

import { toHTML, speak, stopSpeak, canSpeak } from './furigana.js';
import { NAME_PARTS, makeName } from './config.js';
import { PLAYTEST } from './playtest.js';

const $ = id => document.getElementById(id);

export function createUI(){
  const el = {
    login:     $('login'),
    loginPick: $('loginPick'),
    resume:    $('resumeBox'),
    resumeList:$('resumeList'),
    gradeRow:  $('gradeRow'),
    partA:     $('partA'),
    partB:     $('partB'),
    partC:     $('partC'),
    namePreview: $('namePreview'),
    randomBtn: $('randomBtn'),
    startBtn:  $('startBtn'),
    pickInfo:  $('pickInfo'),
    hud:       $('hud'),
    hudWho:    $('hudWho'),
    hudPlace:  $('hudPlace'),
    hudCoins:  $('hudCoins'),
    controls:  $('controls'),
    talkHint:  $('talkHint'),
    msg:       $('msg'),
    msgName:   $('msgName'),
    msgText:   $('msgText'),
    msgNext:   $('msgNext'),
    msgSpeak:  $('msgSpeak'),
    banner:    $('banner'),
    toast:     $('toast'),
    menu:      $('menu'),
    menuBody:  $('menuBody'),
    fps:       $('fpsTag'),
  };

  let furigana = true;   // 表示のたびに setFurigana で合わせる
  let quizInfo = null;   // { checked, draft, total }
  let grade = 5;
  let speechOn = true;

  const H = t => toHTML(t, furigana);

  // ---- ログイン ----------------------------------------------------------

  function showLogin(profiles, { onStart, onResume, onDelete, exists }){
    el.login.classList.remove('hide');
    el.hud.classList.add('hide');
    el.controls.classList.add('hide');

    let g = null, a = null, b = null, c = null;

    // つづきから（この端末で作ったなまえ）
    if (profiles.length){
      el.resume.classList.remove('hide');
      el.resumeList.innerHTML = '';
      for (const p of profiles){
        const row = document.createElement('div');
        row.className = 'resumeRow';
        const btn = document.createElement('button');
        btn.className = 'big';
        const d = p.lastAt ? new Date(p.lastAt) : null;
        btn.innerHTML = `<span class="who">${escapeHTML(p.name)}</span>` +
          `<span class="when">${p.grade ? p.grade + '年' : ''}` +
          (d ? `　さいごに あそんだ日：${d.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}` : '') +
          `</span>`;
        btn.addEventListener('click', () => onResume(p));
        const del = document.createElement('button');
        del.className = 'sub del';
        del.textContent = 'けす';
        del.addEventListener('click', () => {
          if (confirm(`「${p.name}」の データを けしますか？\nもとに もどせません。`)) onDelete(p);
        });
        row.append(btn, del);
        el.resumeList.append(row);
      }
    } else {
      el.resume.classList.add('hide');
    }

    // えらぶ
    function build(row, items, onPick){
      row.innerHTML = '';
      for (const it of items){
        const btn = document.createElement('button');
        btn.className = 'pick';
        btn.textContent = it.label;
        btn.dataset.v = it.v;
        btn.addEventListener('click', () => {
          [...row.children].forEach(x => x.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          onPick(it.v);
          refresh();
        });
        row.append(btn);
      }
    }
    const words = list => list.map(w => ({ v: w, label: w }));

    build(el.gradeRow, [1,2,3,4,5,6].map(v => ({ v, label: `${v}年` })), v => { g = v; });
    build(el.partA, words(NAME_PARTS.a), v => { a = v; });
    build(el.partB, words(NAME_PARTS.b), v => { b = v; });
    build(el.partC, words(NAME_PARTS.c), v => { c = v; });

    function currentName(){ return (a && b && c) ? makeName(a, b, c) : ''; }

    function refresh(){
      const name = currentName();
      el.namePreview.textContent = name || '？？？';
      el.namePreview.classList.toggle('ready', !!name);
      const ok = !!(g && name);
      el.startBtn.disabled = !ok;
      if (!ok){
        el.startBtn.textContent = 'はじめる';
        el.pickInfo.textContent = '学年と、3つの ことばを えらんでね';
      } else if (exists?.(name)){
        el.startBtn.textContent = 'つづきから';
        el.pickInfo.textContent = 'この なまえは もう あるよ。おなじ なまえで つづけます。';
      } else {
        el.startBtn.textContent = 'はじめる';
        el.pickInfo.textContent = `「${name}」で はじめます`;
      }
    }
    refresh();

    // おまかせ（さいころ）
    el.randomBtn.onclick = () => {
      for (const row of [el.partA, el.partB, el.partC]){
        const kids = [...row.children];
        kids[Math.floor(Math.random() * kids.length)].click();
      }
      el.namePreview.classList.remove('pop');
      void el.namePreview.offsetWidth;          // アニメをやり直す
      el.namePreview.classList.add('pop');
    };

    el.startBtn.onclick = () => {
      const name = currentName();
      if (g && name) onStart({ name, grade: g });
    };

    el.loginPick.classList.toggle('hide', profiles.length > 0);
    $('newBtn').onclick = () => {
      el.loginPick.classList.remove('hide');
      el.loginPick.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function hideLogin(){
    el.login.classList.add('hide');
    el.hud.classList.remove('hide');
    el.controls.classList.remove('hide');
  }

  // ---- HUD ---------------------------------------------------------------

  function setFurigana(on, g){ furigana = !!on; if (g) grade = g; }
  function setSpeech(on){ speechOn = !!on; }

  function setHud({ name, coins }){
    el.hudWho.textContent = name;
    el.hudCoins.textContent = coins;
  }
  function setPlace(markup){ el.hudPlace.innerHTML = H(markup); }

  let bannerT = 0;
  function showBanner(markup){
    el.banner.innerHTML = H(markup);
    el.banner.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => el.banner.classList.remove('show'), 2200);
  }

  let toastT = 0;
  function toast(markup, ms = 1800){
    el.toast.innerHTML = H(markup);
    el.toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setTalkHint(on, label){
    el.talkHint.classList.toggle('show', !!on);
    if (on) el.talkHint.innerHTML = H(label);
  }

  function setQuizInfo(info){ quizInfo = info; }
  function setFps(txt){ el.fps.textContent = txt; }
  function showFps(on){ el.fps.classList.toggle('hide', !on); }

  // ---- メッセージ窓 ------------------------------------------------------

  let msgState = null;

  function openMessage({ name, lines, onClose }){
    msgState = { lines: lines.slice(), i: 0, onClose };
    el.msg.classList.remove('hide');
    el.msgName.innerHTML = H(name || '');
    el.msgSpeak.classList.toggle('hide', !canSpeak());
    render();
  }
  function render(){
    const s = msgState;
    if (!s) return;
    const line = s.lines[s.i];
    el.msgText.innerHTML = H(line);
    el.msgNext.textContent = s.i >= s.lines.length - 1 ? 'とじる' : 'つぎへ';
    if (speechOn) speak(line, grade);
  }
  function nextMessage(){
    const s = msgState;
    if (!s) return;
    s.i++;
    if (s.i >= s.lines.length) closeMessage();
    else render();
  }
  function closeMessage(){
    const s = msgState;
    msgState = null;
    stopSpeak();
    el.msg.classList.add('hide');
    s?.onClose?.();
  }
  const isMessageOpen = () => !!msgState;

  el.msgNext.addEventListener('click', nextMessage);
  el.msgSpeak.addEventListener('click', () => {
    if (msgState) speak(msgState.lines[msgState.i], grade);
  });

  // ---- メニュー ----------------------------------------------------------

  let menuOpen = false;
  const isMenuOpen = () => menuOpen;

  function openMenu(state, sum, h){
    menuOpen = true;
    el.menu.classList.remove('hide');
    const q = quizInfo;
    const draftNote = PLAYTEST ? '試遊版：未確認の問題も出ます。正誤や記録は成績に使わず、おかしい問題は先生に見せてください。通常版とは別の保存です。' : q
      ? (q.checked > 0
          ? `いま ${state.grade}年の 出せる問題：かくにんずみ ${q.checked}問／したがき ${q.draft}問`
          : `<b>${state.grade}年の「かくにんずみ」の問題は まだ 0問です。</b>` +
            `先生が check.html で 確認するまでは「したがきも 出す」に すると ためせます（したがき ${q.draft}問）。` +
            `児童に わたす前に かならず もどしてください。`)
      : '問題データを よみこみ中…';

    el.menuBody.innerHTML = `
      <div class="meName">
        <span class="lab">${H('あなたの なまえ')}</span>
        <b>${escapeHTML(state.name)}</b>
        <span class="lab">${state.grade}${H('{年|ねん}')}</span>
      </div>

      <div class="hubGrid">
        <button class="hub" id="mTitles"><span class="hubIco">🏅</span>${H('{称号|しょうごう}')}<small>${H('せんせいに みせる')}</small></button>
        <button class="hub" id="mItems"><span class="hubIco">🎒</span>${H('もちもの')}</button>
        <button class="hub" id="mDress"><span class="hubIco">👕</span>${H('きがえる')}</button>
        <button class="hub" id="mRecords"><span class="hubIco">📒</span>${H('きろく・ほぞん')}</button>
      </div>
      ${PLAYTEST ? '<p class="playtestRef">テストプレイ中・問題は未確認です。問題のメモは試遊の入口で確認できます。</p>' : ''}

      <div class="mrow">
        <span class="mlab">${H('ふりがな')}</span>
        <span class="seg" id="segFuri">
          <button data-v="1" aria-pressed="${state.settings.furigana}">出す</button>
          <button data-v="0" aria-pressed="${!state.settings.furigana}">出さない</button>
        </span>
      </div>
      <div class="mrow">
        <span class="mlab">${H('よみあげ')}</span>
        <span class="seg" id="segSpeech">
          <button data-v="1" aria-pressed="${state.settings.speech}">する</button>
          <button data-v="0" aria-pressed="${!state.settings.speech}">しない</button>
        </span>
      </div>
      <div class="mrow">
        <span class="mlab">${H('{画質|がしつ}')}</span>
        <span class="seg" id="segQ">
          ${['auto','low','mid','high'].map(q2 => `<button data-v="${q2}" aria-pressed="${state.settings.quality === q2}">${({auto:'じどう',low:'低',mid:'中',high:'高'})[q2]}</button>`).join('')}
        </span>
      </div>

      <div class="teacher">
        <button class="tLock" id="tLock">せんせい用（ながおし）</button>
        <div class="tPanel hide" id="tPanel">
          <div class="mrow">
            <span class="mlab">もんだい</span>
            <span class="seg" id="segDraft">
              <button data-v="0" ${PLAYTEST ? 'disabled' : ''} aria-pressed="${!PLAYTEST && !state.settings.draft}">かくにんずみ だけ</button>
              <button data-v="1" ${PLAYTEST ? 'disabled' : ''} aria-pressed="${PLAYTEST || !!state.settings.draft}">したがきも 出す</button>
            </span>
          </div>
          <p class="mnote draftNote">${draftNote}</p>
          <div class="mrow">
            <span class="mlab">ボスの条件</span>
            <span class="seg" id="segSkip">
              <button data-v="0" aria-pressed="${!state.settings.skipBossLock}">ふつう</button>
              <button data-v="1" aria-pressed="${!!state.settings.skipBossLock}">とばして ためす</button>
            </span>
          </div>
          <p class="mnote draftNote">ボスは「その地方の 敵2種の 称号が3だん以上」＋「ダンジョン クリア」で ひらきます。先生が すぐ ためしたいときだけ「とばして ためす」に してください。</p>
        </div>
      </div>

      <div class="mbtns">
        <button class="sub" id="mVillage">${H('{村|むら}に もどる')}</button>
        <button class="sub" id="mLogout">${H('べつの なまえに かわる')}</button>
        <button class="no"  id="mDelete">${H('この iPad から けす')}</button>
      </div>`;

    const seg = (id, cb) => {
      const box = $(id);
      box.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        [...box.children].forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        cb(b.dataset.v);
      });
    };
    seg('segFuri',   v => h.onFurigana(v === '1'));
    seg('segSpeech', v => h.onSpeech(v === '1'));
    seg('segQ',      v => h.onQuality(v));
    seg('segDraft',  v => h.onDraft(v === '1'));
    seg('segSkip',   v => h.onSkipBoss(v === '1'));

    // 先生用：1.2秒ながおしで ひらく（児童が うっかり さわらないように）
    const lock = $('tLock');
    let lt = 0;
    const openT = () => { $('tPanel').classList.remove('hide'); lock.classList.add('hide'); };
    lock.addEventListener('pointerdown', () => { lock.classList.add('holding'); lt = setTimeout(openT, 1200); });
    const cancel = () => { clearTimeout(lt); lock.classList.remove('holding'); };
    lock.addEventListener('pointerup', cancel); lock.addEventListener('pointerleave', cancel); lock.addEventListener('pointercancel', cancel);
    if (state.settings.draft || state.settings.skipBossLock) openT();   // オンのものがあるときは見せておく

    $('mTitles').onclick  = () => h.onTitles();
    $('mItems').onclick   = () => h.onItems();
    $('mDress').onclick   = () => h.onDress();
    $('mRecords').onclick = () => h.onRecords();
    $('mVillage').onclick = () => { closeMenu(); h.onVillage(); };
    $('mLogout').onclick  = () => { closeMenu(); h.onLogout(); };
    $('mDelete').onclick  = () => {
      if (confirm(`「${state.name}」の データを この iPad から けしますか？\nもとに もどせません。`)){ closeMenu(); h.onDelete(); }
    };
  }
  function closeMenu(){ menuOpen = false; el.menu.classList.add('hide'); }

  $('menuClose').addEventListener('click', closeMenu);

  return {
    el, showLogin, hideLogin, setHud, setPlace, showBanner, toast,
    setTalkHint, setFurigana, setSpeech, setFps, showFps, setQuizInfo,
    openMessage, closeMessage, nextMessage, isMessageOpen,
    openMenu, closeMenu, isMenuOpen,
  };
}

function escapeHTML(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}
