import { toHTML } from '../furigana.js';
import { regionOf } from './regions.js';

export const HOUSE_INFO = Object.freeze({
  guide: Object.freeze({ name: 'あんないの家', description: 'この地方のヒントを きいてみよう。' }),
  guild: Object.freeze({ name: 'おねがいの家', description: 'この地方の依頼と 称号を みられるよ。' }),
  workshop: Object.freeze({ name: 'プレゼント工房', description: '地方ごとの おまもりを うけとろう。' }),
});

export const GIFT_ITEMS = Object.freeze([
  { grade: 1, id: 'flower', name: 'はなのおまもり', description: 'はなさく草原の プレゼント' },
  { grade: 2, id: 'leaf', name: 'はっぱのおまもり', description: 'こもれびの森の プレゼント' },
  { grade: 3, id: 'shell', name: 'かいがらのおまもり', description: 'しおかぜの海辺の プレゼント' },
  { grade: 4, id: 'crystal', name: 'すいしょうのおまもり', description: 'こだまの山の プレゼント' },
  { grade: 5, id: 'flame', name: 'ほのおのおまもり', description: 'ほのおの火山の プレゼント' },
  { grade: 6, id: 'star', name: 'ほしのおまもり', description: 'ほしあかりの雪原の プレゼント' },
].map(item => Object.freeze(item)));

const giftFor = grade => {
  const item = GIFT_ITEMS.find(gift => gift.grade === Number(grade));
  if (!item) throw new RangeError('学年は1〜6を指定してください。');
  return item;
};
const giftKey = grade => `g${grade}`;
const owned = (state, item) => Array.isArray(state.houseGifts) && state.houseGifts.includes(giftKey(item.grade));

/** Parent saves state after this synchronous change. A second call is read-only. */
export function grantHouseGift(state, grade){
  const item = giftFor(grade);
  if (owned(state, item)) return { first: false, item };
  if (!Array.isArray(state.houseGifts)) state.houseGifts = [];
  state.houseGifts.push(giftKey(item.grade));
  state.coins = (Number.isFinite(state.coins) ? state.coins : 0) + 25;
  if (!Array.isArray(state.unlockedItems)) state.unlockedItems = ['lantern', 'wand'];
  if (!state.unlockedItems.includes(item.id)) state.unlockedItems.push(item.id);
  state.item = item.id;
  return { first: true, item };
}

const HINTS = {
  calculation: [
    '10に なる くみあわせを さがすと、たしざんが しやすいよ。',
    'かけざんは、{同|おな}じ {数|かず}を いくつぶんか {集|あつ}める ことだよ。',
    'わりざんは、{同|おな}じ {数|かず}ずつ {分|わ}けると {考|かんが}えよう。',
    '{筆算|ひっさん}では {位|くらい}を そろえて、1けたずつ {確|たし}かめよう。',
    '{分数|ぶんすう}を {比|くら}べるときは、{全体|ぜんたい}を {同|おな}じ 1 と みよう。',
    '{分数|ぶんすう}の {計算|けいさん}は、1 あたりの {大|おお}きさに {注目|ちゅうもく}しよう。',
  ],
  geometry: [
    '{形|かたち}は {向|む}きを {変|か}えても {同|おな}じ。{辺|へん}や {角|かど}を {見|み}よう。',
    '{三角形|さんかくけい}と {四角形|しかくけい}は、まっすぐな {辺|へん}の {数|かず}で {見分|みわ}けよう。',
    '{円|えん}は {中心|ちゅうしん}から ふちまでの {長|なが}さが {同|おな}じだよ。',
    '{角度|かくど}は {辺|へん}の {長|なが}さでなく、{開|ひら}き{方|かた}を {見|み}よう。',
    '{三角形|さんかくけい}の 3つの {角|かく}を {集|あつ}めると 180°だよ。',
    '{対称|たいしょう}な {形|かたち}は、{折|お}ったとき {重|かさ}なるところを {探|さが}そう。',
  ],
  comparison: [
    '{長|なが}さや {時刻|じこく}を {比|くら}べるときは、{同|おな}じ {単位|たんい}で {考|かんが}えよう。',
    '{長|なが}さや かさは、{同|おな}じ {単位|たんい}に そろえてから {比|くら}べよう。',
    '{時間|じかん}や {重|おも}さを {比|くら}べるときは、{単位|たんい}を {先|さき}に そろえよう。',
    '{変|か}わり{方|かた}を {見|み}るときは、2つの {量|りょう}を {表|ひょう}に {並|なら}べよう。',
    '{割合|わりあい}は、もとにする {量|りょう}を 1 と {決|き}めて {考|かんが}えよう。',
    '{比|ひ}を {比|くら}べるときは、{同|おな}じ {量|りょう}を もとにして {考|かんが}えよう。',
  ],
  data: [
    '{数|かず}を {調|しら}べるときは、1つずつ しるしを つけると {数|かぞ}えやすいよ。',
    '{表|ひょう}や グラフは、{何|なに}を 1つと {数|かぞ}えたか {確|たし}かめよう。',
    '{棒|ぼう}グラフは、{目盛|めも}りが いくつずつ ふえるか {見|み}よう。',
    '{折|お}れ{線|せん}グラフでは、{線|せん}の {上|あ}がり{下|さ}がりを {見|み}よう。',
    '{平均|へいきん}は、でこぼこを ならして {同|おな}じに した {量|りょう}だよ。',
    '{資料|しりょう}を {比|くら}べるときは、{何|なに}を {代表|だいひょう}に するか {考|かんが}えよう。',
  ],
};

const TOPICS = [
  ['calculation', '計算'], ['geometry', '図形'], ['comparison', '比べ方'], ['data', 'データ'],
  ['challenge', '挑戦条件'], ['contact', '接触操作'],
];
const BASE_ITEMS = [{ id: 'lantern', name: 'ランタン' }, { id: 'wand', name: '星のつえ' }];

export function mountHousePanel(container, { state, houseId, onQuests, onAlbum, onExit, onGift, onEquip }){
  if (!HOUSE_INFO[houseId]) throw new RangeError(`家が見つかりません: ${houseId}`);
  let active = true, generation = 0, selectedHint = 'calculation', busy = false, notice = '';
  const root = document.createElement('section'); root.className = 'si-house';
  container.replaceChildren(root);
  const grade = () => {
    const value = Number(state.regionGrade || state.grade || 5);
    return value >= 1 && value <= 6 ? value : 5;
  };
  const H = text => toHTML(text, !!state.ruby);
  function dispose(){ if (!active) return; active = false; generation++; root.remove(); }
  function button(label, fn, cls = ''){
    const born = generation, el = document.createElement('button');
    el.type = 'button'; el.textContent = label; el.className = cls;
    el.addEventListener('click', () => { if (active && !busy && generation === born) fn(); });
    return el;
  }
  function paragraph(text, cls = ''){
    const p = document.createElement('p'); p.className = cls; p.innerHTML = H(text); return p;
  }
  function action(label, fn, cls = ''){
    return button(label, () => { dispose(); fn?.(); }, cls);
  }
  function updateAfter(callback){
    if (busy) return;
    busy = true;
    try {
      const value = callback();
      if (value && typeof value.then === 'function'){
        value.then(() => { if(active){ busy = false; render(); } }, () => { if(active){ busy = false; notice = 'もう いちど ためしてね。'; render(); } });
      } else { busy = false; render(); }
    } catch { busy = false; notice = 'もう いちど ためしてね。'; render(); }
  }
  function renderGuide(body){
    const region = regionOf(grade());
    body.append(paragraph(`${grade()}年の ${region.ruby || region.name}。ききたい ことを えらんでね。`, 'si-house-lead'));
    const topics = document.createElement('div'); topics.className = 'si-house-topics';
    for (const [id, label] of TOPICS){
      const b = button(label, () => { selectedHint = id; render(); }, selectedHint === id ? 'is-selected' : '');
      b.setAttribute('aria-pressed', String(selectedHint === id)); topics.append(b);
    }
    body.append(topics);
    let hint = HINTS[selectedHint]?.[grade()-1];
    if (selectedHint === 'challenge') hint = 'ボスに {挑戦|ちょうせん}するには、その {分野|ぶんや}の {敵|てき}2{種類|しゅるい}を それぞれ15{体|たい}たおし、{同|おな}じ {分野|ぶんや}の どうくつを クリアしよう。';
    if (selectedHint === 'contact') hint = '{家|いえ}や どうくつの {入口|いりぐち}に ふれると {入|はい}れるよ。とびらや {敵|てき}に ふれると {問題|もんだい}が {出|で}るよ。とじたら、いちど はなれて もういちど ふれてね。「しらべる」でも ためせるよ。';
    body.append(paragraph(hint, 'si-house-hint'));
  }
  function renderGuild(body){
    body.append(paragraph(`${grade()}年・${regionOf(grade()).ruby}の おねがいごとを みよう。`, 'si-house-lead'));
    const actions = document.createElement('div'); actions.className = 'si-house-actions';
    actions.append(action('この地方の 依頼', onQuests, 'si-house-primary'));
    actions.append(action('称号アルバム', onAlbum)); body.append(actions);
  }
  function renderWorkshop(body){
    const item = giftFor(grade()), hasGift = owned(state, item);
    const gift = document.createElement('div'); gift.className = 'si-house-gift';
    gift.append(paragraph(item.name, 'si-house-gift-name'), paragraph(item.description));
    if (hasGift) gift.append(paragraph('うけとりずみ。ありがとう！', 'si-house-owned'));
    else {
      gift.append(paragraph('この地方の プレゼント。はじめて うけとると 25コインも もらえるよ。'));
      gift.append(button('プレゼントを うけとる', () => updateAfter(() => onGift?.(item.grade)), 'si-house-primary'));
    }
    body.append(gift);
    const heading = document.createElement('h4'); heading.textContent = 'もちものを えらぶ'; body.append(heading);
    const available = [...BASE_ITEMS, ...GIFT_ITEMS.filter(gift => owned(state, gift) && Array.isArray(state.unlockedItems) && state.unlockedItems.includes(gift.id))];
    const list = document.createElement('div'); list.className = 'si-house-items';
    for (const choice of available){
      const equipped = state.item === choice.id;
      const b = button(`${choice.name}${equipped ? '（そうび中）' : ''}`, () => updateAfter(() => onEquip?.(choice.id)), equipped ? 'is-equipped' : '');
      b.setAttribute('aria-pressed', String(equipped)); list.append(b);
    }
    body.append(list);
  }
  function render(){
    if (!active) return;
    generation++; root.replaceChildren();
    const header = document.createElement('header'); header.className = 'si-house-header';
    const title = document.createElement('h3'); title.textContent = HOUSE_INFO[houseId].name;
    const badge = document.createElement('span'); badge.className = 'si-house-grade'; badge.textContent = `${grade()}年`; header.append(title, badge);
    const body = document.createElement('div'); body.className = 'si-house-body';
    body.append(paragraph(HOUSE_INFO[houseId].description));
    if (houseId === 'guide') renderGuide(body);
    else if (houseId === 'guild') renderGuild(body);
    else renderWorkshop(body);
    const status = document.createElement('div'); status.className = 'si-house-status'; status.setAttribute('role', 'status'); status.textContent = notice;
    const footer = document.createElement('footer'); footer.className = 'si-house-footer'; footer.append(action('家から でる', onExit));
    root.append(header, body, status, footer);
  }
  render();
  return dispose;
}
