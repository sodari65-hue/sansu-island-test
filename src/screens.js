// いろいろな画面 ― 称号の一覧／持ち物の一覧／きろく（全クリアの進み具合・バックアップ）／
// 着せかえ（キャラ選択）／称号をもらったときのポップアップ
// （出題・称号・報酬 実装計画書 8.6・9章、キャラ生成・選択画面 設計書 10章）

import { toHTML, speak } from './furigana.js';
import { paintPattern } from './items.js';
import { createCharacter } from './character.js';

const $ = id => document.getElementById(id);

export function createScreens({ THREE, getFurigana, getGrade, getSpeech, titles, unlocks, species, grades, charCfg, makeItem }){
  const H = t => toHTML(t, getFurigana());
  const talk = t => { if (getSpeech() && t) speak(t, getGrade()); };
  const GR = new Map(grades.map(g => [g.grade, g]));

  // ================= 称号・持ち物・きろく（1つのパネルでタブ切りかえ） =================

  const scr = $('scr'), body = $('scrBody');
  let tab = 'titles', gradeTab = 5, ctx = null;

  $('scrClose').addEventListener('click', () => { scr.classList.add('hide'); ctx?.onClose?.(); ctx = null; });
  scr.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));

  function open(which, c){
    ctx = c; tab = which; gradeTab = c.state.grade;
    scr.classList.remove('hide');
    render();
  }

  function gradeTabs(){
    return `<div class="gTabs">${grades.map(g => `
      <button class="gTab${g.grade === gradeTab ? ' on' : ''}" data-g="${g.grade}" style="--c:${g.color}">${g.grade}${H('{年|ねん}')}</button>`).join('')}</div>`;
  }
  function bindGradeTabs(){
    body.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { gradeTab = Number(b.dataset.g); render(); }));
  }

  function render(){
    scr.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'titles') renderTitles();
    else if (tab === 'items') renderItems();
    else renderRecords();
  }

  function renderTitles(){
    const st = ctx.state;
    const rows = titles.list(st, gradeTab);
    const g = GR.get(gradeTab);
    const earned = titles.earned(st);
    body.innerHTML = `
      <p class="scrNote">${H('{魔物|まもの}を たおすと {称号|しょうごう}が あがるよ。{先生|せんせい}に きかれたら この {画面|がめん}を みせてね。')}
        <b>${H('{称号|しょうごう}')} ${earned} / 240</b></p>
      ${gradeTabs()}
      <div class="tList">${rows.map(r => `
        <div class="tRow${r.met ? '' : ' unmet'}">
          <span class="tIcon" style="--c:${g.color}">${r.met ? r.enemy.slice(0, 1) : '？'}</span>
          <span class="tMain">
            <span class="tName">${r.met ? H(r.name) : '？？？'}</span>
            <span class="tSub">${r.met ? H(r.enemy) + '　' + r.count + H('{体|たい}') : H('まだ であっていない')}</span>
          </span>
          <span class="tStars">${'★'.repeat(r.level)}<span class="off">${'★'.repeat(5 - r.level)}</span></span>
          <span class="tNext">${r.level >= 5 ? H('さいこう！') : H(`つぎまで あと ${r.remain}{体|たい}`)}</span>
        </div>`).join('')}</div>`;
    bindGradeTabs();
  }

  function swatch(def, owned){
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d');
    if (owned) paintPattern(g, 48, def.pattern, def.color);
    else { g.fillStyle = '#dfe7ee'; g.fillRect(0, 0, 48, 48); g.fillStyle = '#9fb0c0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('？', 24, 33); }
    return c.toDataURL();
  }

  function renderItems(){
    const st = ctx.state;
    const own = unlocks.owned(st);
    const cat = unlocks.catalog(gradeTab);
    const cell = d => {
      const has = own.has(d.id);
      return `<div class="iCell${has ? '' : ' lock'}" title="">
        <img src="${swatch(d, has)}" alt="">
        <span>${has ? H(d.name) : '？'}</span>
        <small>${has ? '' : H(d.from || '')}</small></div>`;
    };
    body.innerHTML = `
      <p class="scrNote">${H('{称号|しょうごう}が 2・4・5だんに なると「ちしき」の もちものが、クエストを クリアすると「かんがえる」もちものが もらえるよ。')}</p>
      ${gradeTabs()}
      <div class="iCols">
        <div><h3>${H('ちしき・ぎのう')}</h3><div class="iGrid">${cat.knowledge.map(cell).join('')}</div></div>
        <div><h3>${H('かんがえる・つたえる')}</h3><div class="iGrid">${cat.thinking.length ? cat.thinking.map(cell).join('') : '<p class="scrNote">' + H('この {学年|がくねん}の クエストは まだ ないよ') + '</p>'}</div></div>
      </div>`;
    bindGradeTabs();
  }

  function renderRecords(){
    const st = ctx.state, s = ctx.summary();
    const ac = unlocks.allClear(st);
    const bar = p => `<div class="acRow"><span>${H(p.label)}</span>
      <span class="acBar"><i style="width:${Math.min(100, p.have / Math.max(1, p.need) * 100)}%"></i></span>
      <b>${p.have} / ${p.need}</b></div>`;
    body.innerHTML = `
      <div class="meName"><span class="lab">${H('あなたの なまえ')}</span><b>${esc(st.name)}</b><span class="lab">${st.grade}${H('{年|ねん}')}</span></div>
      <h3>${H('ぜんぶ クリアまで')}</h3>
      ${ac.parts.map(bar).join('')}
      <h3>${H('あそんだ きろく')}</h3>
      <dl class="mkv">
        <dt>${H('あそんだ{時間|じかん}')}</dt><dd>${s.minutes} ${H('{分|ふん}')}</dd>
        <dt>${H('といた {数|かず}')}</dt><dd>${s.total} もん（せいかい ${s.ok}）</dd>
        ${Object.entries(s.byKind).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v.n} かい（せいかい ${v.ok}）</dd>`).join('')}
      </dl>
      <h3>${H('きろくを ファイルに のこす')}</h3>
      <p class="scrNote">${H('iPad の データは きえることが あるよ。ときどき「ほぞん」しておこう。ファイルは この iPad の「ファイル」に のこります。')}</p>
      <div class="mbtns">
        <button id="bkSave">${H('きろくを ほぞん')}</button>
        <button class="sub" id="bkLoad">${H('きろくを よみこむ')}</button>
        ${ctx.hasPrev() ? `<button class="sub" id="bkPrev">${H('1つ まえの きろくに もどす')}</button>` : ''}
      </div>
      <div id="bkMsg" class="encMsg"></div>`;
    $('bkSave').onclick = () => { const f = ctx.onBackup(); $('bkMsg').className = 'encMsg ok'; $('bkMsg').innerHTML = H(`「${f}」を ほぞんしたよ。`); };
    $('bkLoad').onclick = () => ctx.onRestore(msg => { $('bkMsg').className = 'encMsg ' + (msg.ok ? 'ok' : 'ng'); $('bkMsg').innerHTML = H(msg.text); if (msg.ok) render(); });
    if ($('bkPrev')) $('bkPrev').onclick = () => ctx.onPrev(msg => { $('bkMsg').className = 'encMsg ok'; $('bkMsg').innerHTML = H(msg); render(); });
  }

  // ================= 称号・持ち物をもらったときのポップアップ =================

  const pop = $('pop');
  let popT = 0;
  const popQueue = [];
  function popup(title, sub){
    popQueue.push({ title, sub });
    if (popQueue.length === 1) showNext();
  }
  function showNext(){
    const p = popQueue[0];
    if (!p) return;
    pop.innerHTML = `<div class="popIn"><span class="popStar">★</span><b>${H(p.title)}</b><span>${H(p.sub || '')}</span></div>`;
    pop.classList.add('show');
    talk(p.title.replace(/[「」]/g, ''));
    clearTimeout(popT);
    popT = setTimeout(() => { pop.classList.remove('show'); popQueue.shift(); setTimeout(showNext, 350); }, 2600);
  }

  // ================= 着せかえ（キャラ選択） =================

  const cs = $('cs'), csCanvas = $('csCanvas');
  let cr = null, cscene, ccam, cchar, cyaw = 0.3, cdrag = null, csRAF = 0, csTab = 'hat', csState = null, csDone = null, csLast = 0;
  const draft = {};

  function ensureRenderer(){
    if (cr) return;
    cr = new THREE.WebGLRenderer({ canvas: csCanvas, antialias: true, alpha: true });
    cr.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    cscene = new THREE.Scene();
    cscene.add(new THREE.HemisphereLight(0xffffff, 0x9ab89a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(2, 4, 3); cscene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshLambertMaterial({ color: 0x9edb96 }));
    ground.rotation.x = -Math.PI / 2; cscene.add(ground);
    ccam = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    ccam.position.set(0, 1.55, 5.4); ccam.lookAt(0, 1.15, 0);
    cchar = createCharacter(THREE, { makeItem });
    cscene.add(cchar.root);
    // 指で左右になぞると回る（上下は固定）
    csCanvas.addEventListener('pointerdown', e => { cdrag = e.clientX; try { csCanvas.setPointerCapture(e.pointerId); } catch (x){} });
    csCanvas.addEventListener('pointermove', e => { if (cdrag != null){ cyaw += (e.clientX - cdrag) * 0.012; cdrag = e.clientX; } });
    const up = () => { cdrag = null; };
    csCanvas.addEventListener('pointerup', up); csCanvas.addEventListener('pointercancel', up);
  }
  function csResize(){
    const w = csCanvas.clientWidth || 360, h = csCanvas.clientHeight || 360;
    cr.setSize(w, h, false); ccam.aspect = w / h; ccam.updateProjectionMatrix();
  }
  function csFrame(now){
    csRAF = requestAnimationFrame(csFrame);
    const dt = Math.min(0.05, (now - (csLast || now)) / 1000); csLast = now;
    csStep(dt);
  }
  let csW = 0, csH = 0;
  function csStep(dt){
    // 画面が開いた直後は大きさが決まっていないことがあるので、描くたびに確かめる
    if (csCanvas.clientWidth !== csW || csCanvas.clientHeight !== csH){
      csW = csCanvas.clientWidth; csH = csCanvas.clientHeight;
      if (csW && csH) csResize();
    }
    cchar.update(dt);
    cchar.root.rotation.y = cyaw;
    cr.render(cscene, ccam);
  }

  /**
   * @param state 保存データ（costume を書きかえる）
   * @param onDone (costume) => void
   */
  function openCharSelect(state, onDone){
    ensureRenderer();
    csState = state; csDone = onDone;
    Object.assign(draft, state.costume);
    cchar.setHatColor(draft.hatColor); cchar.setFace(draft.face); cchar.setItem(draft.item);
    cs.classList.remove('hide');
    csResize();
    csTab = 'hat';
    renderCs();
    cancelAnimationFrame(csRAF); csLast = 0; csRAF = requestAnimationFrame(csFrame);
    csStep(0.016);
  }
  function closeCs(){ cs.classList.add('hide'); cancelAnimationFrame(csRAF); }

  cs.querySelectorAll('[data-cstab]').forEach(b => b.addEventListener('click', () => { csTab = b.dataset.cstab; renderCs(); }));
  $('csOk').addEventListener('click', () => {
    csState.costume = { ...draft };
    closeCs();
    csDone?.(csState.costume);
  });
  $('csCancel').addEventListener('click', () => closeCs());

  function choose(kind, id, name){
    draft[kind] = id;
    if (kind === 'hatColor') cchar.setHatColor(id);
    if (kind === 'face') cchar.setFace(id);
    if (kind === 'item') cchar.setItem(id);
    cchar.play('cheer');                           // えらぶと よろこぶ
    if (name) talk(name);
    renderCs();
  }

  function renderCs(){
    cs.querySelectorAll('[data-cstab]').forEach(b => b.classList.toggle('on', b.dataset.cstab === csTab));
    const box = $('csOpts');
    if (csTab === 'hat'){
      box.innerHTML = `<div class="csGrid">${charCfg.hatColors.map(h => `
        <button class="csOpt${draft.hatColor === h.id ? ' on' : ''}" data-id="${h.id}">
          <span class="csSw" style="background:${h.color}"></span><span class="csLab">${H(h.name)}</span></button>`).join('')}</div>`;
      box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const h = charCfg.hatColors.find(x => x.id === b.dataset.id); choose('hatColor', h.id, h.name); });
    } else if (csTab === 'face'){
      box.innerHTML = `<p class="scrNote">${H('えらんだ かおが「いつもの かお」に なるよ。うごくと かおが かわることも あるよ。')}</p>
        <div class="csGrid">${charCfg.faces.map((f, i) => `
        <button class="csOpt${draft.face === f.id ? ' on' : ''}" data-id="${f.id}">
          <span class="csFace" style="background-position:${-i * 100}% 0"></span><span class="csLab">${H(f.name)}</span></button>`).join('')}</div>`;
      box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const f = charCfg.faces.find(x => x.id === b.dataset.id); choose('face', f.id, f.name); });
    } else {
      const own = unlocks.owned(csState);
      const cat = unlocks.catalog(csState.grade);
      const list = [unlocks.itemDef('item_acorn'), ...cat.knowledge, ...cat.thinking];
      if (own.has('item_allclear')) list.push(unlocks.itemDef('item_allclear'));
      box.innerHTML = `<div class="csGrid items">${list.map(d => {
        const has = own.has(d.id);
        return `<button class="csOpt${draft.item === d.id ? ' on' : ''}${has ? '' : ' lock'}" data-id="${d.id}">
          <img class="csItem" src="${swatch(d, has)}" alt=""><span class="csLab">${has ? H(d.name) : '🔒'}</span></button>`;
      }).join('')}</div>`;
      box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
        const d = unlocks.itemDef(b.dataset.id);
        if (!own.has(d.id)){ $('csMsg').innerHTML = H('まだ ひみつ。' + (d.from ? `「${d.from}」で もらえるよ。` : '')); talk('まだ ひみつ'); return; }
        $('csMsg').innerHTML = '';
        choose('item', d.id, d.name);
      });
    }
  }

  return {
    openTitles: c => open('titles', c),
    openItems:  c => open('items', c),
    openRecords: c => open('records', c),
    isOpen: () => !scr.classList.contains('hide') || !cs.classList.contains('hide'),
    closeAll(){ scr.classList.add('hide'); closeCs(); },
    popup, openCharSelect,
    csStep: dt => cr && csStep(dt),       // 動作確認用
  };
}

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
