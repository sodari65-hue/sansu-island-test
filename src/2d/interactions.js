import {GATES,TREASURE,HOUSE_ROOM,HOUSES,houseDoor,worldPoint,DUNGEON_SPOTS,BOSS_SPOTS,NPC,QUEST_NPC,PORTAL} from './core.js';
import {dungeonName} from './landmarks.js';
import {domainName} from './regions.js';
import {HOUSE_INFO} from './houses.js';

export function interactions(state,foes=[],species=[]){
  if(!state)return [];
  const result=[],grade=state.regionGrade;
  function add(kind,p,label,manual=1.8,touch=.85,extra={}){
    const distance=Math.hypot(state.x-p.x,state.y-p.y);
    result.push({kind,label,...extra,key:`${state.map}:g${grade}:${kind}:${extra.domain||extra.id||extra.foe?.sid||''}`,manual:distance<manual,near:distance<Math.max(manual,touch+1),touching:touch>0&&distance<touch});
  }
  if(state.map==='house'){
    add('houseExit',HOUSE_ROOM.exit,'そとへ もどる',1.2,.7);
    add('houseService',HOUSE_ROOM.host,'いえの人と はなす',1.8,1.15);
  }else if(state.map==='cave'){
    add('exit',{x:11.5,y:61.3},'外へ もどる',1.3,.8);
    if(state.doors<5)add('gate',{x:11.5,y:GATES[state.doors]+1.25},`とびら ${state.doors+1}に ふれる`,2,1,{id:String(state.doors)});
    if(state.doors===5)add('treasure',TREASURE,'たからばこを あける',2,1.15);
  }else{
    for(const h of HOUSES)add('house',houseDoor(h,grade),`${HOUSE_INFO[h.id].name}へ はいる`,1.8,.85,{id:h.id});
    for(const p of DUNGEON_SPOTS)add('cave',worldPoint(p,grade),`${dungeonName(grade,p.domain)}へ はいる`,2.4,.9,{domain:p.domain});
    for(const p of BOSS_SPOTS)add('boss',worldPoint(p,grade),`${domainName(grade,p.domain)}の ボスに あう`,2,1,{domain:p.domain});
    add('travel',worldPoint(PORTAL,grade),'世界地図を ひらく',1.8,0);
    add('quest',worldPoint(QUEST_NPC,grade),'おねがいごとを きく',1.7,.8);
    add('npc',worldPoint(NPC,grade),'あんないにんと はなす',2,.85);
    for(const foe of foes)if(!foe.cooldown&&foe.grade===grade)add('enemy',foe,`${species.find(s=>s.id===foe.sid)?.name||'まもの'}と たたかう`,1.8,.8,{foe});
  }
  return result;
}
