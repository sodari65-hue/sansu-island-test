// 明示的な試遊URLだけで有効。本番の承認状態や保存領域は変更しない。
export const isPlaytest = search => new URLSearchParams(search).get('playtest') === '1';
export const PLAYTEST = isPlaytest(globalThis.location?.search || '');
export const ISSUE_KEY = 'sansu-island:playtest-issues';
export function readIssues(storage){
  try { storage ??= globalThis.localStorage; const list=JSON.parse(storage.getItem(ISSUE_KEY)||'[]');return Array.isArray(list)?list.filter(x=>typeof x?.id==='string').slice(-100):[]; }
  catch { return []; }
}
export function rememberIssue(id, storage = localStorage){
  const list=readIssues(storage).filter(x=>x.id!==id);
  list.push({id,at:new Date().toISOString()});
  storage.setItem(ISSUE_KEY,JSON.stringify(list.slice(-100)));
}
export function showQuestionRef(anchorId, id){
  if(!PLAYTEST)return;
  const anchor=document.getElementById(anchorId);if(!anchor)return;
  let box=document.getElementById(anchorId+'Ref');
  if(!box){box=document.createElement('div');box.id=anchorId+'Ref';box.className='playtestRef';anchor.before(box);}
  box.replaceChildren();
  const label=document.createElement('span');label.textContent=`試遊・問題ID：${id}`;
  const button=document.createElement('button');button.type='button';button.textContent='この問題を メモ';
  const status=document.createElement('span');status.setAttribute('role','status');
  button.addEventListener('click',()=>{
    try{rememberIssue(id);status.textContent='この端末にメモしました。先生に、この画面と気づいたことを見せてね。';button.disabled=true;}
    catch{status.textContent='保存できません。先生に問題IDを見せてね。';}
  });
  box.append(label,button,status);
}
export function mountPlaytestNotice(){
  if(!PLAYTEST)return;
  const badge=document.createElement('div');badge.id='playtestNotice';badge.textContent='テストプレイ中・問題は未確認です。おかしいと思ったら先生に見せてね。';document.body.append(badge);
  const login=document.querySelector('#login h1');
  if(login){const p=document.createElement('p');p.className='playtestRef';p.textContent='先生とためす試遊版です。答えにまちがいがあるかもしれません。成績には使いません。記録は通常版と別に保存します。';login.after(p);}
}
