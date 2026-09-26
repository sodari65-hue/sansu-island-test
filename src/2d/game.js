import { NAME_PARTS } from '../config.js';
import { PLAYTEST } from '../playtest.js';
import { createQuestionManager } from '../questions.js';
import { createTitles } from '../titles.js';
import { isChecked } from '../review.js';
import { stopSpeak, toPlain } from '../furigana.js';
import { GATES, TREASURE, FOES, NPC, PORTAL, QUEST_NPC, DUNGEON_SPOTS, BOSS_SPOTS, move, enterCave, leaveCave, returnVillage,
  openGate, claimTreasure, usable, freshState, loadState, saveState, profiles, logAttempt, dungeonId, bossRequirements,worldPoint,regionOrigin,FIELD,enterHouse,leaveHouse } from './core.js';
import { createRenderer } from './render.js';
import { mountQuestion } from './question-ui.js';
import { paintEnemyPortrait } from './enemy-art.js';
import { paintBossPortrait } from './boss-art.js';
import { REGIONS, DOMAINS, regionOf, domainName } from './regions.js';
import { mountBoss, mountQuest } from './encounters.js';
import { createContactLatch } from './contacts.js';
import { interactions } from './interactions.js';
import { mountTitleAlbum } from './title-album.js';
import { HOUSE_INFO,GIFT_ITEMS,grantHouseGift,mountHousePanel } from './houses.js';
import { dungeonName } from './landmarks.js';

const $ = id => document.getElementById(id);
let state = null, titles, renderer, species = [], grades = [], bosses = [], ready = false, storage = null, disposeQuestion = null;
let modalOpen = false, toastUntil = 0, sinceSave = 0, loadMs = 0, fps = 0, fpsTime = 0, fpsFrames = 0;
let dungeon = null, entering = false;
const contacts=createContactLatch(),readyGrades=new Set();
const dungeonTasks=new Map(), regionTasks=new Map(), regionQuests=new Map(), bossTasks=new Map();
const keys = new Set(), stick = { x: 0, y: 0, pointer: null };
const foes=REGIONS.flatMap(r=>FOES.map(f=>({...worldPoint(f,r.grade),grade:r.grade,cooldown:0})));
const qm = createQuestionManager({ getState: () => state, allowDraft: () => PLAYTEST });
const background=freshState(NAME_PARTS.a[0]+NAME_PARTS.b[0]+NAME_PARTS.c[0],1);
function button(label, fn, className = ''){ const b = document.createElement('button'); b.textContent = label; b.className = className; b.onclick = fn; return b; }
function paragraph(text, cls = ''){ const p = document.createElement('p'); p.textContent = text; p.className = cls; return p; }
function toast(text){ $('toast').textContent = text; toastUntil = performance.now() + 3800; }
function resetControls(){ keys.clear(); stick.x = 0; stick.y = 0; stick.pointer = null; $('knob').style.transform = ''; }
function save(){
  if (!state) return false;
  let ok = true;
  try { if (!storage) throw new Error(); saveState(storage, PLAYTEST, state); }
  catch { ok = false; $('modeNotice').textContent = '保存できません。このページを閉じると今回の続きが失われる可能性があります。先生に見せてね。'; }
  sinceSave = 0;
  return ok;
}
function showModal(title){
  resetControls(); disposeQuestion?.(); disposeQuestion = null; stopSpeak();
  $('toast').textContent = ''; toastUntil = 0;
  modalOpen = true; $('modalTitle').textContent = title; $('modalBody').replaceChildren();
  $('modal').querySelector('.modalCard').classList.remove('battleCard');
  $('modal').hidden = false; $('controls').hidden = true; $('closeModal').focus();
  return $('modalBody');
}
function closeModal(){
  disposeQuestion?.(); disposeQuestion = null; stopSpeak(); modalOpen = false;
  $('modal').hidden = true; $('controls').hidden = !state; resetControls(); save(); $('action').focus();
}
$('closeModal').onclick = closeModal;
$('modal').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  if (e.key !== 'Tab') return;
  const list = [...$('modal').querySelectorAll('button:not(:disabled),select,a')].filter(x => x.getClientRects().length);
  const index = list.indexOf(document.activeElement);
  if ((e.shiftKey && index <= 0) || (!e.shiftKey && index === list.length - 1)) { e.preventDefault(); list[e.shiftKey ? list.length - 1 : 0]?.focus(); }
});
function message(title, text){ const box = showModal(title); box.append(paragraph(text), button('ぼうけんに もどる', closeModal, 'primary')); }
async function json(path){ const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(`読み込めません：${path}`); return r.json(); }
async function ensureRegion(grade){
  if(!regionTasks.has(grade))regionTasks.set(grade,(async()=>{
    const [,quests]=await Promise.all([qm.load(grade),json(`./data/quests/g${grade}.json`)]);
    if(species.some(s=>qm.rawCount(`g${grade}_${s.id}`)===0))throw new Error(`${grade}年の問題を読み込めません。通信を確認して再読み込みしてください。`);
    regionQuests.set(grade,quests.quests);readyGrades.add(grade);
  })().catch(e=>{regionTasks.delete(grade);throw e;}));
  return regionTasks.get(grade);
}
function preloadNeighbours(grade){
  const col=(grade-1)%3;
  const neighbours=[grade<=3?grade+3:grade-3,...(col>0?[grade-1]:[]),...(col<2?[grade+1]:[])];
  for(const g of [grade,...neighbours])ensureRegion(g).catch(()=>{});
}
async function loadDungeon(grade=state?.regionGrade||5, domain=state?.activeDungeon||'A'){
  const id=`dungeon-g${grade}-${domain}`;
  if (!dungeonTasks.has(id)) dungeonTasks.set(id,json(`./data/dungeons/${id}.json`).catch(e=>{dungeonTasks.delete(id);throw e;}));
  dungeon = await dungeonTasks.get(id); return dungeon;
}
async function loadBoss(id){
  if(!bossTasks.has(id))bossTasks.set(id,json(`./data/bosses/${id}.json`).catch(e=>{bossTasks.delete(id);throw e;}));
  return bossTasks.get(id);
}
function renderResume(){
  $('resume').replaceChildren();
  if (!storage) return;
  for (const name of profiles(storage, PLAYTEST)) $('resume').append(button(`${name}：つづきから`, () => begin(name)));
}
async function begin(name){
  if (!ready || entering) return;
  entering = true; $('start').disabled = true; $('loadStatus').textContent = 'ぼうけんの じゅんび中…';
  try {
    const next = (storage && loadState(storage, PLAYTEST, name)) || freshState(name, Number($('grade').value));
    await ensureRegion(next.regionGrade);
    if (next.map === 'cave') await loadDungeon(next.regionGrade,next.activeDungeon);
    state=next;foes.forEach(f=>{f.cooldown=0;});contacts.clear();
    for(const t of interactions(state,foes,species))if(t.touching)contacts.block(t.key);
    $('login').hidden = true; $('hud').hidden = false; $('controls').hidden = false;
    resetControls();save();preloadNeighbours(state.regionGrade);
    toast(state.map==='cave'?'どうくつの 続きから。とびらに ふれてみよう。':state.map==='house'?'家の続きから。奥の人に はなしかけよう。':`${regionOf(state.regionGrade).name}へ ようこそ！ 道を歩くと、ほかの地方にも行けるよ。`);
  } catch (e) { $('loadStatus').textContent = e.message; }
  finally { entering = false; $('start').disabled = false; }
}
for (const [key, id] of [['a', 'nameA'], ['b', 'nameB'], ['c', 'nameC']]){
  for (const word of NAME_PARTS[key]) { const opt = document.createElement('option'); opt.textContent = word; $(id).append(opt); }
}
$('randomName').onclick = () => { for (const id of ['nameA','nameB','nameC']) $(id).selectedIndex = Math.floor(Math.random() * $(id).options.length); };
$('randomName').click();
$('start').onclick = () => begin($('nameA').value + $('nameB').value + $('nameC').value);
$('threeLink').href = PLAYTEST ? 'index.html?playtest=1' : 'index.html';
$('modeNotice').textContent = PLAYTEST ? '2D試遊 · 問題は未確認です。気づいたら先生へ。成績には使いません。' : '2D開発版 · 確認済みの問題だけを出します';
if (PLAYTEST) { $('loginNote').textContent = '先生と試す版です。未レビュー問題を含み、答えに誤りがあるかもしれません。成績には使いません。3D版とは別の記録です。'; $('loginNote').className = 'warning'; }

function target(){
  return interactions(state,foes,species).find(t=>t.manual)||null;
}
async function act(t=target()){
  if (!state || modalOpen || entering) return;
  if(!t)return toast('家やどうくつの入口、とびら、人に 近づいてみよう。');
  contacts.block(t.key);
  if(t.kind==='npc')return message('あんないにん',`ここは${state.regionGrade}年の${regionOf(state.regionGrade).name}。道は6つの地方につながっているよ。家やどうくつの入口、とびらにふれると進めるよ。ボスには、その分野の敵2種類をそれぞれ15体たおし、その分野のどうくつをクリアすると挑めるよ。家の中ではヒントや依頼、プレゼントが待っているよ。`);
  if(t.kind==='house'){enterHouse(state,t.id);resetControls();save();return toast(`${HOUSE_INFO[t.id].name}。奥の人に はなしかけよう。`);}
  if(t.kind==='houseExit'){leaveHouse(state);resetControls();save();return;}
  if(t.kind==='houseService')return showHouse();
  if(t.kind==='travel')return showWorldMap();
  if(t.kind==='quest')return showQuests();
  if(t.kind==='boss')return startBoss(t.domain);
  if(t.kind==='enemy'){
    if(!readyGrades.has(state.regionGrade)){
      entering=true;resetControls();toast('この地方の問題を よみこんでいます…');
      try{await ensureRegion(state.regionGrade);}catch{message('問題を読み込めませんでした','通信を確認して、もう一度しらべてね。');return;}finally{entering=false;}
    }
    return startEnemy(t.foe);
  }
  if (t.kind === 'exit') { leaveCave(state); resetControls(); save(); return toast('外の世界に もどった！'); }
  if (t.kind === 'cave'){
    entering = true; resetControls(); toast('どうくつを よみこんでいます…');
    try {
      const [data]=await Promise.all([loadDungeon(state.regionGrade,t.domain),ensureRegion(state.regionGrade)]);
      if (!usable(data, PLAYTEST, isChecked)) return message('まだ はいれません', '先生が確認した問題がまだありません。先生と試すときは、テストプレイの入口から開いてください。');
      enterCave(state,t.domain); save(); toast(`${data.name}。奥のとびらに ふれてみよう。`);
    } catch { toast('どうくつを読み込めませんでした。通信を確認し、もう一度しらべてね。'); }
    finally { entering = false; }
    return;
  }
  if (t.kind === 'gate') return startGate();
  if (t.kind === 'treasure'){
    const first = claimTreasure(state); save();
    const box = showModal(`${dungeon?.name||'どうくつ'}・クリア！`);
    box.append(paragraph(first ? '5つのとびらを開けた！ 50コインを見つけたよ。' : 'このたからばこは、もう開けてあるよ。'), button('外へ もどる', () => { leaveCave(state); closeModal(); }, 'primary'));
  }
}
$('action').onclick=()=>act();
function showHouse(){
  const box=showModal(HOUSE_INFO[state.houseId].name);
  disposeQuestion=mountHousePanel(box,{state,houseId:state.houseId,
    onQuests:()=>showQuests(),onAlbum:showRecords,
    onExit:()=>{leaveHouse(state);closeModal();},
    onGift:grade=>{const result=grantHouseGift(state,grade);save();return result;},
    onEquip:id=>{if(state.unlockedItems.includes(id)){state.item=id;save();}},
  });
}
function startGate(){
  if (!dungeon || !usable(dungeon, PLAYTEST, isChecked)) return message('とびらの問題', '先生が確認した問題がまだありません。');
  const index = state.doors, step = dungeon.sequence[index];
  if (!step) return;
  const knowledgeIndex = dungeon.sequence.slice(0, index).filter(v => v === 'knowledge').length;
  const q = step === 'knowledge' ? qm.draw(dungeon.knowledgeFrom[knowledgeIndex % dungeon.knowledgeFrom.length]) : dungeon.thinking.find(v => v.id === step.slice(9));
  if (!q) return message('とびらの問題', '出せる問題がありません。先生に見せてね。');
  const box = showModal(`とびら ${index + 1} / 5`); save();
  disposeQuestion = mountQuestion(box, q, { ruby: state.ruby, grade: state.grade, trial: PLAYTEST,
    onAttempt: e => { logAttempt(state, 'ダンジョン', e); save(); },
    onSolved: () => {
      if (!openGate(state, index)) return;
      save(); box.append(paragraph('とびらが ひらいた！ 自分で歩いて、つぎの部屋へ進もう。'), button('部屋へ もどる', closeModal, 'primary'));
    },
  });
}
function startEnemy(foe){
  const key=`g${state.regionGrade}_${foe.sid}`;
  if (!qm.hasPool(key)) return message('まだ たたかえません', '先生が確認した問題がまだありません。先生と試すときはテストプレイの入口から開いてください。');
  const battle = { groups: new Set() }; let hp = grades.find(g=>g.grade===state.regionGrade)?.hp||3, hearts = 3;
  const name = species.find(s => s.id === foe.sid)?.name || 'まもの';
  function question(){
    const q = qm.draw(key, battle);
    if (!q) return message('問題がありません', '先生に見せてね。');
    const root = showModal(`${name}と バトル`); save();
    $('modal').querySelector('.modalCard').classList.add('battleCard');
    const layout = document.createElement('div'); layout.className = 'battleLayout';
    const portrait = document.createElement('figure'); portrait.className = 'battleFoe';
    const canvas = document.createElement('canvas'); canvas.className = 'enemyPortrait';
    paintEnemyPortrait(canvas, foe.sid, name,state.regionGrade);
    const caption = document.createElement('figcaption');
    const foeName = document.createElement('strong'); foeName.textContent = name;
    const unit = paragraph(`${state.regionGrade}年・${q.unit || ''}`, 'enemyUnit');
    const status = paragraph('', 'enemyStatus'); status.setAttribute('role','status');
    const updateStatus = () => { status.textContent = `あと ${hp}問で たおせる\nじぶんの ちから：${'♥'.repeat(hearts)}${'♡'.repeat(3-hearts)}`; };
    updateStatus(); caption.append(foeName, unit, status); portrait.append(canvas, caption);
    const box = document.createElement('div'); box.className = 'questionPanel';
    layout.append(portrait, box); root.append(layout);
    disposeQuestion = mountQuestion(box, q, { ruby: state.ruby, grade: state.grade, trial: PLAYTEST,
      onAttempt: e => {
        logAttempt(state, '敵', e);
        if (!e.correct){ hearts--; updateStatus(); }
        save();
        if (!hearts) { showModal('もう一度 ちょうせんしよう'); $('modalBody').append(paragraph('だいじょうぶ。ヒントを思い出して、またためそう。'), button('もどる', closeModal, 'primary')); }
      },
      onSolved: () => {
        hp--; updateStatus(); portrait.classList.add('enemyHit');
        if (hp){ box.append(button('つぎの問題へ', question, 'primary')); return; }
        const title = titles.addKill(state, key); state.coins += 10; foe.cooldown = 45; save();
        box.append(paragraph(`${name}を たおした！ 10コイン。${title.up ? '称号「' + title.name + '」を手に入れた！' : ''}`), button('ぼうけんに もどる', closeModal, 'primary'));
      },
    });
  }
  question();
}
function showWorldMap(){
  const box=showModal('世界地図・いまいるところ');
  box.append(paragraph('6つの地方は、ひとつの島につながっています。東西の道と南北の道を歩いて旅しよう。数字は問題の学年です。'));
  const grid=document.createElement('div');grid.className='seamlessMap';grid.setAttribute('aria-label','上段は1・2・3年、下段は4・5・6年');
  for(const region of REGIONS){
    const cleared=Object.entries(state.dungeonProgress).filter(([id,p])=>id.startsWith(`dungeon-g${region.grade}-`)&&p.cleared).length;
    const cell=document.createElement('div');cell.className='mapRegion';cell.style.background=`rgb(${region.ground.join(',')})`;
    cell.append(paragraph(`${region.grade}年 ${region.name}`),paragraph(`どうくつ ${cleared}/4`));
    if(region.grade===state.regionGrade){cell.classList.add('currentRegion');cell.append(paragraph('● いまここ','mapHere'));}
    grid.append(cell);
  }
  box.append(grid,paragraph('地図を閉じて、道を進もう。自分の学年より上の地方は、むずかしい問題が出るよ。'),button('歩いて ぼうけんを つづける',closeModal,'primary'));
}
async function showQuests(preview=false){
  if(!readyGrades.has(state.regionGrade)){
    if(entering)return;entering=true;resetControls();
    try{await ensureRegion(state.regionGrade);}catch{message('依頼を読み込めませんでした','通信を確認して、もう一度ためしてね。');return;}finally{entering=false;}
  }
  const box=showModal(`${state.regionGrade}年の おねがいごと${preview?'（保存なし）':''}`);
  for(const q of regionQuests.get(state.regionGrade)||[]){
    const label=(state.clearedQuests.includes(q.id)?'✓ ':'')+toPlain(q.title);
    box.append(button(label,()=>startQuest(q,preview),'questChoice'));
  }
  box.append(paragraph('村の人のお願いを、表や数を使って解決しよう。'));
}
function startQuest(q,preview=false){
  if(!usable(q,PLAYTEST,isChecked))return message('まだ はじめられません','先生が確認した問題がまだありません。');
  const box=showModal(toPlain(q.title)+(preview?'（先生用・保存なし）':''));
  disposeQuestion=mountQuest(box,q,{ruby:state.ruby,grade:state.grade,trial:PLAYTEST,
    onAttempt:e=>{if(!preview){logAttempt(state,'クエスト',e);save();}},
    onClear:result=>{if(!preview&&!state.clearedQuests.includes(q.id)){state.clearedQuests.push(q.id);state.coins+=result.coins||0;save();}},
    onExit:closeModal,
  });
}
function bossFrame(data,preview){
  const root=showModal(`${data.name}${preview?'（先生用・保存なし）':''}`);
  $('modal').querySelector('.modalCard').classList.add('battleCard');
  const layout=document.createElement('div');layout.className='battleLayout';
  const figure=document.createElement('figure');figure.className='battleFoe';
  const canvas=document.createElement('canvas');canvas.className='enemyPortrait';paintBossPortrait(canvas,data);
  const caption=document.createElement('figcaption');caption.append(paragraph(data.name),paragraph(`${data.grade}年・${data.concept||domainName(data.grade,data.domain)}`,'enemyUnit'));
  figure.append(canvas,caption);const box=document.createElement('div');box.className='questionPanel';layout.append(figure,box);root.append(layout);return box;
}
async function startBoss(domain,preview=false){
  if(entering)return;entering=true;resetControls();
  try{
    const id=`boss-g${state.regionGrade}-${domain}`,data=await loadBoss(id);
    if(!usable(data,PLAYTEST,isChecked))return message('まだ たたかえません','先生が確認したボスの問題がまだありません。');
    const requirements=bossRequirements(state,domain,titles.thresholds[2]);
    const box=bossFrame(data,preview);
    if(!preview&&!requirements.ok){
      box.append(paragraph('ボスに いどむには…'));
      [1,2].forEach((n,i)=>box.append(paragraph(`${requirements.counts[i]>=requirements.need?'✓':'・'} ${species.find(s=>s.id===domain+n)?.name} ${requirements.counts[i]}/${requirements.need}体`)));
      box.append(paragraph(`${requirements.cleared?'✓':'・'} ${dungeonName(state.regionGrade,domain)}をクリア`),button('ぼうけんに もどる',closeModal,'primary'));return;
    }
    disposeQuestion=mountBoss(box,data,{ruby:state.ruby,grade:state.grade,trial:PLAYTEST,
      onAttempt:e=>{if(!preview){logAttempt(state,'ボス',e);save();}},
      onClear:()=>{if(!preview&&!state.defeatedBosses.includes(id)){state.defeatedBosses.push(id);save();}},
      onExit:closeModal,
    });
  }catch(e){message('ボスを読み込めませんでした',e.message+' 通信を確認して、もう一度ためしてね。');}
  finally{entering=false;}
}
function teacherPreview(){
  if(!PLAYTEST)return;
  const box=showModal('先生用：ボスを試す（保存なし）');
  box.append(paragraph('この画面からの試遊は、挑戦条件を確認せず、クリア・報酬・解答記録を保存しません。教材の承認も行いません。','warning'));
  for(const domain of DOMAINS){const b=bosses.find(b=>b.id===`boss-g${state.regionGrade}-${domain}`);box.append(button(b?.name||`${domainName(state.regionGrade,domain)}のボス`,()=>startBoss(domain,true),'questChoice'));}
  box.append(button('おねがいごとも試す（保存なし）',()=>showQuests(true),'questChoice'));
}
function openMenu(){
  if (!state || modalOpen || entering) return;
  menuContents();
}
function menuContents(){
  const box = showModal('ぼうけんの メニュー');
  box.append(paragraph(`${state.name} · ${state.grade}年 / ${state.coins}コイン`));
  box.append(paragraph('もちもの：各地方のプレゼント工房で、おまもりを集められるよ。'));
  const items = document.createElement('div'); items.className = 'itemOptions';
  for(const [id,label] of [['lantern','ランタン'],['wand','星のつえ'],...GIFT_ITEMS.filter(i=>state.unlockedItems.includes(i.id)).map(i=>[i.id,i.name])])items.append(button(label,()=>{state.item=id;save();menuContents();},state.item===id?'selected':''));
  box.append(items);
  const grid = document.createElement('div'); grid.className = 'menuGrid';
  grid.append(button('世界地図・いまいるところ',showWorldMap),button('この地方のおねがいごと',()=>showQuests()),button('ぼうしの色を かえる', () => { const colors = ['#eb8368', '#e4b551', '#739cb6', '#9c80b2', '#80a26a', '#e6cda1']; state.hat = colors[(colors.indexOf(state.hat) + 1) % colors.length]; save(); menuContents(); }),
    button(state.ruby ? 'ふりがな：あり' : 'ふりがな：なし', () => { state.ruby = !state.ruby; save(); menuContents(); }),
    button('しょうごうアルバム',showRecords),button('村へ もどる',()=>{returnVillage(state);closeModal();}),
    button('ほぞんして 終わる', logout), button('ぼうけんに もどる', closeModal));
  box.append(grid, paragraph('カメラは自動でついてきます。回転・拡大操作はありません。洞窟のとびらごとに自動保存します。'));
  if(PLAYTEST)box.append(button('先生用：ボスを試す（保存なし）',teacherPreview));
  box.append(paragraph(`この端末の参考値：起動準備 ${(loadMs / 1000).toFixed(1)}秒 / 描画 ${fps} fps。通信と端末で変わります。`, 'metrics'));
}
$('menu').onclick = openMenu;
function showRecords(){
  const box=showModal('しょうごうアルバム');
  const album=document.createElement('div');box.append(album);
  disposeQuestion=mountTitleAlbum(album,{state,titles,onBack:menuContents});
  const record=document.createElement('details');record.className='albumRecord';
  const summary=document.createElement('summary');summary.textContent='ぼうけんの きろく（せんせいに みせる）';
  record.append(summary,paragraph('この端末だけの試遊記録です。成績には使いません。'),paragraph(`あそんだ時間：${Math.floor(state.playSec/60)}分 / 記録中の解答 ${state.logs.length}回・正解 ${state.logs.filter(e=>e.correct).length}回（最新1000件まで）`),paragraph(`全地方のクリア：ボス ${state.defeatedBosses.length}/24 ・おねがいごと ${state.clearedQuests.length}/12 ・どうくつ ${Object.values(state.dungeonProgress).filter(p=>p.cleared).length}/24`));
  box.append(record);
}
function logout(){
  if (!save()) return message('保存できませんでした', 'いまの記録は画面に残しています。ページを閉じる前に、先生に見せてください。');
  closeModal(); state = null; resetControls(); $('hud').hidden = true; $('controls').hidden = true; $('target').hidden = true;
  $('login').hidden = false; $('loadStatus').textContent = '2Dの記録を保存しました。'; renderResume();
}
function stickMove(e){
  const r = $('stick').getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const radius = 42, length = Math.hypot(dx, dy), scale = Math.max(radius, length);
  stick.x = length < 7 ? 0 : dx / scale; stick.y = length < 7 ? 0 : dy / scale;
  $('knob').style.transform = `translate(${stick.x * radius}px,${stick.y * radius}px)`;
}
$('stick').addEventListener('pointerdown', e => {
  if (modalOpen || !state || entering || stick.pointer !== null) return;
  e.preventDefault(); stick.pointer = e.pointerId;
  try { $('stick').setPointerCapture(e.pointerId); } catch { resetControls(); return; }
  stickMove(e);
});
$('stick').addEventListener('pointermove', e => { if (stick.pointer === e.pointerId) { e.preventDefault(); stickMove(e); } });
for (const type of ['pointerup','pointercancel','lostpointercapture']) $('stick').addEventListener(type, e => { if (stick.pointer === e.pointerId) resetControls(); });
document.addEventListener('keydown', e => {
  if (!state || modalOpen || entering || /SELECT|INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)) { e.preventDefault(); keys.add(key); }
  if ((key === ' ' || key === 'enter') && !e.repeat && e.target.tagName !== 'BUTTON') { e.preventDefault(); act(); }
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', resetControls);
document.addEventListener('visibilitychange', () => { resetControls(); if (document.hidden) { stopSpeak(); save(); } });
window.addEventListener('pagehide', save);
let last = performance.now();
function loop(now){
  requestAnimationFrame(loop); const rawDt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  const dt = Math.min(.05, rawDt); let moving = false;
  if (state){
    if (!modalOpen && !entering){
      const x = stick.x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      const y = stick.y + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
      const previousGrade=state.regionGrade;
      moving = !!(x || y); move(state, x, y, dt);
      if(previousGrade!==state.regionGrade){save();preloadNeighbours(state.regionGrade);toast(`${state.regionGrade}年・${regionOf(state.regionGrade).name}に 入った！`);}
      foes.forEach(e => { e.cooldown = Math.max(0, e.cooldown - dt); });
      const hit=contacts.update(interactions(state,foes,species));
      if(hit)act(hit);
    }
    state.playSec += dt; sinceSave += dt; if (sinceSave >= 20) save();
    const t = target(); $('target').hidden = modalOpen;
    $('target').textContent=t?.label||(state.map==='cave'?'北へ進み、とびらに ふれよう':state.map==='house'?'奥の人に近づくと はなせるよ':'道を歩いて、ほかの地方にも 行ってみよう');
    $('action').textContent = t?.kind === 'enemy' ? 'たたかう' : t?.kind === 'cave' ? 'はいる' : 'しらべる';
    $('place').textContent=state.map==='cave'?dungeon?.name||'どうくつ':state.map==='house'?HOUSE_INFO[state.houseId].name:`${state.regionGrade}年・${regionOf(state.regionGrade).name}${state.x-regionOrigin(state.regionGrade).x<23?'の村':''}`;
    $('progress').textContent = `${state.coins}コイン · とびら ${state.doors}/5`;
  }
  renderer.draw(state || background, foes, now / 1000, dt, moving);
  if (now > toastUntil) $('toast').textContent = '';
  fpsTime += rawDt; fpsFrames++; if (fpsTime >= 1) { fps = Math.round(fpsFrames / fpsTime); fpsTime = 0; fpsFrames = 0; }
}
async function boot(){
  try { storage = localStorage; storage.getItem('sansu-island-2d:storage-check'); } catch { storage = null; }
  try {
    renderer = createRenderer($('world')); requestAnimationFrame(loop);
    const [sp, gr, cfg, manifest] = await Promise.all([json('./data/species.json'), json('./data/grades.json'), json('./config/titles.json'),json('./data/bosses.json')]);
    species = sp.species; grades=gr.grades;bosses=manifest.bosses; titles = createTitles({ cfg, species, grades });
    ready = true; loadMs = performance.now(); $('start').disabled = false; $('start').textContent = 'ぼうけんを はじめる';
    $('loadStatus').textContent = storage ? 'じゅんびできました。同じなまえなら、続きから始まります。' : '保存が使えません。閉じると記録が失われます。'; renderResume();
  } catch (e){ $('loadStatus').textContent = e.message; $('loadStatus').append(button('もう一度 よみこむ', () => location.reload())); }
}
boot();
