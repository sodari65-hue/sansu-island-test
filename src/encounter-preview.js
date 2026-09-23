import * as THREE from '../vendor/three.module.js';
import { buildWorld } from './world.js';
import { createBattle } from './battle.js';
import { createDungeon } from './dungeon.js';
import { createQuestionManager } from './questions.js';
import { PLAYTEST } from './playtest.js';

const $=id=>document.getElementById(id);
async function main(){
  if(PLAYTEST) document.querySelector('a[href="index.html"]').href='index.html?playtest=1';
  // 本編と同じ画面・CSS・コントローラを使い、保存機能は読み込まない。
  const markup=new DOMParser().parseFromString(await (await fetch('index.html')).text(),'text/html');
  for(const style of markup.querySelectorAll('style'))document.head.append(style.cloneNode(true));
  for(const id of ['enc','dgn'])document.body.append(markup.getElementById(id).cloneNode(true));
  const style=document.createElement('style');
  style.textContent=`#previewBar{position:fixed;z-index:60;top:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 14px;background:#fff;color:#203344;font-size:14px}#previewBar button,#previewBar select{min-height:44px;font:inherit;padding:8px}#previewResult{font-weight:700}#previewInfo{position:fixed;bottom:20px;left:20px;z-index:1;max-width:38vw;padding:14px;background:#ffffffde;border-radius:12px;font-size:14px;line-height:1.8}.encWrap{top:80px!important}.encCard{max-height:calc(100dvh - 110px)!important;overflow:auto}#previewCanvas{position:fixed;inset:0;width:100%;height:100%}`;
  document.head.append(style);
  const json=async p=>{const r=await fetch(p);if(!r.ok)throw Error(p+'を読み込めません');return r.json();};
  const manifest=(await json('data/bosses.json')).bosses.filter(b=>b.grade===5&&b.file);
  const bosses=await Promise.all(manifest.map(b=>json('data/'+b.file)));
  const dungeons=await Promise.all(['A','B','C','D'].map(d=>json(`data/dungeons/dungeon-g5-${d}.json`)));
  const state={questionDecks:{}};
  const qm=createQuestionManager({getState:()=>state,allowDraft:()=>true});await qm.load(5);
  const options={getFurigana:()=>true,getGrade:()=>5,getSpeech:()=>false};
  const battle=createBattle(options),dungeon=createDungeon(options);
  const choices=[...bosses,...dungeons];
  choices.forEach(d=>{const opt=document.createElement('option');opt.value=d.id;opt.textContent=`${d.domain} ${d.name}`;$('previewSelect').append(opt);});
  let focus=()=>{};
  try{
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.domElement.id='previewCanvas';document.body.prepend(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#aecbda');scene.add(new THREE.HemisphereLight(0xffffff,0x746b60,2));
    const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(15,30,20);scene.add(light);
    const world=buildWorld(THREE,scene,{bosses:manifest,dungeons});
    // 試遊では選んだ相手だけ表示。本編のモデルをそのまま取り出す。
    scene.remove(world.group);
    const camera=new THREE.PerspectiveCamera(42,1,.1,100);
    let current=null;
    focus=d=>{
      if(current)scene.remove(current);
      const source=world.bossModels[d.id]?.obj || world.interactables.find(x=>x.action==='dungeon:'+d.id)?.obj;
      current=source?source.clone(true):new THREE.Group();current.position.set(-2,0,0);current.rotation.y=.2;scene.add(current);
      camera.position.set(7,6,15);camera.lookAt(1.5,2,0);
    };
    const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};resize();window.addEventListener('resize',resize);
    renderer.setAnimationLoop(t=>{if(current)current.position.y=Math.sin(t*.0015)*.08;renderer.render(scene,camera);});
  }catch(error){$('previewInfo').textContent='3D表示は利用できません。問題操作は試せます。';console.warn(error);}
  function start(){
    battle.close();dungeon.close();
    const d=choices.find(x=>x.id===$('previewSelect').value);focus(d);
    let attempts=0;
    const hooks={draw:(key,b)=>qm.draw(key,b),onAnswer:()=>{attempts++;},onEnd:r=>{$('previewResult').textContent=`${r.result==='win'?'ボス撃破':r.result==='clear'?'ダンジョンクリア':'試遊終了'}／回答 ${attempts}回（保存なし）`;}};
    $('previewResult').textContent='試遊中（保存なし）';
    if(d.stages)battle.startBoss(d,hooks);else dungeon.start(d,hooks);
  }
  $('previewStart').disabled=false;$('previewStart').addEventListener('click',start);$('previewResult').textContent='相手を選んで「ためす」';focus(bosses[0]);
}
main().catch(e=>{$('previewResult').textContent='準備に失敗：'+e.message;console.error(e);});
