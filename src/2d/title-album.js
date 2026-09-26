// 2D版の称号アルバム。保存値は読取り専用で、倒した数から毎回組み立てる。
import { paintEnemyPortrait } from './enemy-art.js';

const GRADES = [1, 2, 3, 4, 5, 6];

/** 1学年ぶんの称号40枚。過去の段階も、最高段階とは別に並べる。 */
export function buildAlbumEntries(state, titles, grade){
  return titles.list(state || {}, grade).flatMap(enemy => {
    const level = titles.levelOf(enemy.count);
    return titles.thresholds.map((need, index) => {
      const stage = index + 1;
      return {
        ...enemy,
        stage,
        need,
        name: titles.nameOf(enemy.key, stage),
        earned: stage <= level,
        remain: Math.max(0, need - enemy.count),
      };
    });
  });
}

/** titleLevels ではなく defeatCounts から、全240枚中の取得数を数える。 */
export function countEarnedTitles(state, titles){
  return GRADES.reduce((sum, grade) => sum + buildAlbumEntries(state, titles, grade)
    .filter(entry => entry.earned).length, 0);
}

function button(label, className = ''){
  const el = document.createElement('button');
  el.type = 'button'; el.className = className; el.textContent = label;
  return el;
}

function setDetail(detail, entry){
  detail.replaceChildren();
  const name = document.createElement('strong');
  name.textContent = entry.name;
  const condition = document.createElement('span');
  condition.textContent = entry.earned
    ? `${entry.need}体 たおして かくとくずみ（いま ${entry.count}体）`
    : `${entry.need}体 たおすと もらえる（いま ${entry.count}体・あと ${entry.remain}体）`;
  detail.append(name, condition);
}

function makeCard(entry, detail){
  const card = button('', `titleAlbum-card${entry.earned ? ' is-earned' : ' is-locked'}`);
  card.setAttribute('aria-label', `${entry.name}。${entry.earned ? 'かくとくずみ' : `あと${entry.remain}体`}`);
  const medal = document.createElement('span');
  medal.className = 'titleAlbum-medal'; medal.setAttribute('aria-hidden', 'true');
  medal.textContent = entry.earned ? ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][entry.stage-1] : '★';
  card.dataset.stage=String(entry.stage);
  const stage = document.createElement('span');
  stage.className = 'titleAlbum-stage'; stage.textContent = `${entry.stage}だん`;
  const name = document.createElement('strong');
  name.textContent = entry.name;
  const condition = document.createElement('small');
  condition.textContent = entry.earned ? `${entry.need}体 たおした` : `あと ${entry.remain}体`;
  card.append(medal, stage, name, condition);
  card.addEventListener('click', () => setDetail(detail, entry));
  return card;
}

/**
 * 称号アルバムを表示する。
 * @returns {() => void} 表示を片づける関数
 */
export function mountTitleAlbum(container, { state, titles, onBack = () => {} }){
  let active=true;
  let grade = GRADES.includes(state?.regionGrade)?state.regionGrade:1;
  let filter = 'all';
  const root = document.createElement('section');
  root.className = 'titleAlbum'; root.setAttribute('aria-label', '称号アルバム');
  const head = document.createElement('header'); head.className = 'titleAlbum-head';
  const back = button('← もどる', 'titleAlbum-back');
  back.addEventListener('click',()=>{if(active)onBack();});
  const heading = document.createElement('h2'); heading.textContent = 'しょうごう アルバム';
  const total = document.createElement('output'); total.className = 'titleAlbum-total';
  total.setAttribute('aria-live', 'polite');
  head.append(back, heading, total);

  const tabs = document.createElement('div');
  tabs.className = 'titleAlbum-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '学年をえらぶ');
  const tabButtons = new Map();
  for (const g of GRADES){
    const tab = button(`${g}年`, 'titleAlbum-tab');
    tab.id = `title-album-tab-${g}`; tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'title-album-panel');
    tab.addEventListener('click', () => { grade = g; render(); });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = GRADES.indexOf(grade);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? GRADES.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : GRADES.length - 1)) % GRADES.length;
      grade = GRADES[next]; render(); tabButtons.get(grade).focus();
    });
    tabButtons.set(g, tab); tabs.append(tab);
  }

  const filters = document.createElement('div'); filters.className = 'titleAlbum-filters';
  const earnedFilter = button('かくとくずみ', 'titleAlbum-filter');
  const allFilter = button('すべて', 'titleAlbum-filter');
  earnedFilter.addEventListener('click', () => { filter = 'earned'; render(); });
  allFilter.addEventListener('click', () => { filter = 'all'; render(); });
  filters.append(earnedFilter, allFilter);
  const gradeTotal=document.createElement('p');gradeTotal.className='titleAlbum-gradeTotal';

  const detail = document.createElement('aside'); detail.className = 'titleAlbum-detail';
  detail.setAttribute('aria-live', 'polite'); detail.textContent = 'カードを えらぶと、しょうごうの くわしい じょうけんが 見られるよ。';
  const body = document.createElement('div'); body.className = 'titleAlbum-body';
  body.id = 'title-album-panel'; body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-labelledby', 'title-album-tab-1');
  root.append(head, tabs, filters, gradeTotal, detail, body);

  function render(){
    if(!active)return;
    const entries = buildAlbumEntries(state, titles, grade);
    total.textContent = `かくとく ${countEarnedTitles(state, titles)} / 240`;
    gradeTotal.textContent=`${grade}年のコレクション ${entries.filter(e=>e.earned).length} / 40`;
    for (const [g, tab] of tabButtons){
      const selected = g === grade;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-selected', selected);
    }
    earnedFilter.setAttribute('aria-pressed', String(filter === 'earned'));
    allFilter.setAttribute('aria-pressed', String(filter === 'all'));
    body.setAttribute('aria-labelledby', `title-album-tab-${grade}`);
    detail.textContent='カードを えらぶと、しょうごうの くわしい じょうけんが 見られるよ。';
    body.replaceChildren();
    for (const enemy of titles.list(state || {}, grade)){
      const group = document.createElement('section'); group.className = 'titleAlbum-enemy';
      const enemyHead = document.createElement('header'); enemyHead.className = 'titleAlbum-enemyHead';
      const canvas = document.createElement('canvas'); canvas.className = 'titleAlbum-portrait';
      paintEnemyPortrait(canvas, enemy.sid, enemy.enemy, grade);
      const copy = document.createElement('div');
      const name = document.createElement('h3'); name.textContent = enemy.enemy;
      const count = document.createElement('p'); count.textContent = `${enemy.count}体 たおした`;
      copy.append(name, count); enemyHead.append(canvas, copy);
      const cards = document.createElement('div'); cards.className = 'titleAlbum-cards';
      const cardsForEnemy = entries.filter(entry => entry.sid === enemy.sid && (filter === 'all' || entry.earned));
      if (cardsForEnemy.length) cardsForEnemy.forEach(entry => cards.append(makeCard(entry, detail)));
      else {
        const empty = document.createElement('p'); empty.className = 'titleAlbum-empty';
        empty.textContent = 'まだ かくとくしていないよ。'; cards.append(empty);
      }
      group.append(enemyHead, cards); body.append(group);
    }
  }

  container.replaceChildren(root); render();
  return () => { active=false;if(root.parentNode===container)container.replaceChildren(); };
}
