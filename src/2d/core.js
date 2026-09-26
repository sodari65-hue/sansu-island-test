// The comparison build owns its saves. Never import the 3D save/backup modules here.
import { NAME_PARTS } from '../config.js';
import { regionOf, DOMAINS } from './regions.js';
export const REGION_SIZE = { width:72, height:44 };
export const FIELD = { width:216, height:88, spawn:{x:12.5,y:28.5} };
export const regionOrigin = grade => ({x:((grade-1)%3)*REGION_SIZE.width,y:Math.floor((grade-1)/3)*REGION_SIZE.height});
export const worldPoint = (point,grade) => {const o=regionOrigin(grade);return {...point,x:point.x+o.x,y:point.y+o.y};};
export const gradeAt = (x,y) => 1+Math.max(0,Math.min(2,Math.floor(x/REGION_SIZE.width)))+3*Math.max(0,Math.min(1,Math.floor(y/REGION_SIZE.height)));
export const villagePoint = grade => worldPoint(FIELD.spawn,grade);
export const ITEM_IDS = ['lantern','wand','flower','leaf','shell','crystal','flame','star'];
export const HOUSE_ROOM = {width:15,height:13,spawn:{x:7.5,y:9.5},exit:{x:7.5,y:11.2},host:{x:7.5,y:5.5}};
export const CAVE = { width: 23, height: 65, spawn: { x: 11.5, y: 59.5 } };
export const GATES = [52, 42, 32, 22, 12];
export const ENTRANCE = { x: 55.5, y: 11.5 };
export const TREASURE = { x: 11.5, y: 7.5 };
export const DUNGEON_SPOTS = [
  {domain:'A',...ENTRANCE},{domain:'B',x:35.5,y:11.5},{domain:'C',x:58.5,y:34.5},{domain:'D',x:31.5,y:35.5},
];
export const BOSS_SPOTS = [
  {domain:'A',x:61.5,y:14.5},{domain:'B',x:40.5,y:14.5},{domain:'C',x:64.5,y:35.5},{domain:'D',x:37.5,y:37.5},
];
export const PORTAL = {x:21.5,y:28.5};
export const QUEST_NPC = {x:10.5,y:29.5};
export const HOUSES = [{ id:'guide',x:8,y:23,w:4,h:3 },{id:'guild',x:16,y:24,w:4,h:3},{id:'workshop',x:9,y:31,w:4,h:3}];
export const houseDoor = (house,grade) => worldPoint({x:house.x+house.w/2,y:house.y+house.h+.2},grade);
export const FOES = [
  ['A1', 25.5, 26.5], ['A2', 30.5, 30.5], ['B1', 36.5, 26.5], ['B2', 39.5, 32.5],
  ['C1', 45.5, 23.5], ['C2', 50.5, 20.5], ['D1', 55.5, 27.5], ['D2', 60.5, 22.5],
].map(([sid, x, y]) => ({ sid, x, y }));
export const NPC = { x: 16.5, y: 29.5 };
export const hash = (x, y) => ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0) / 4294967296;
export const onPath = (x, y) => Math.abs(y - 28) < 2 || ((x >= 33 && x <= 37 || x >= 53 && x <= 58) && y >= 10 && y <= 38) || (y>=34 && y<=37 && x>=29 && x<=65) || (y>=12 && y<=15 && x>=33 && x<=63);
export function tile(map, x, y, doors = 0, grade = 5){
  x = Math.floor(x); y = Math.floor(y);
  if(map==='house'){
    if(x<1||x>=HOUSE_ROOM.width-1||y<1||y>=HOUSE_ROOM.height-1)return 'wall';
    if((y===2&&x>=3&&x<=11)||(x===2&&y>=4&&y<=6)||(x===12&&y>=4&&y<=6))return 'furniture';
    return 'floor';
  }
  if (map === 'cave'){
    if (x < 0 || x >= CAVE.width || y < 0 || y >= CAVE.height) return 'wall';
    if (x === Math.floor(TREASURE.x) && y === Math.floor(TREASURE.y)) return 'chest';
    const gate = GATES.indexOf(y);
    if (gate >= 0 && x >= 10 && x <= 12) return gate < doors ? 'floor' : 'gate';
    const room = y >= 4 && y <= 62 && ((y % 10 >= 4) || y % 10 === 0 || y % 10 === 1);
    return (x >= 10 && x <= 12 && y >= 4 && y <= 62) || (room && x >= 4 && x <= 18) ? 'floor' : 'wall';
  }
  if (x < 3 || y < 3 || x >= FIELD.width - 3 || y >= FIELD.height - 3) return 'water';
  grade=gradeAt(x,y);const origin=regionOrigin(grade);x-=origin.x;y-=origin.y;
  if (HOUSES.some(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h)) return 'house';
  if (DUNGEON_SPOTS.some(p=>x>=p.x-3 && x<=p.x+3 && y>=p.y-5 && y<=p.y-1.5)) return 'cliff';
  // Continuous east/west road and north/south lanes cross every regional seam.
  if (onPath(x, y) || (x>=13&&x<=15) || (x >= 7 && x <= 21 && y >= 27 && y <= 30)) return 'path';
  if(HOUSES.some(h=>Math.abs(x+.5-(h.x+h.w/2))<1.3&&y>=h.y+h.h&&y<=h.y+h.h+2))return 'path';
  const near = [...FOES, NPC, PORTAL, QUEST_NPC, ...DUNGEON_SPOTS, ...BOSS_SPOTS, FIELD.spawn].some(p => Math.hypot(p.x - x - .5, p.y - y - .5) < 2.5);
  const landmark = regionOf(grade).landmark;
  if (!near && x>=24 && x<=29 && y>=17 && y<=21 && landmark!=='flowers') return landmark;
  if (!near && x > 5 && y > 5 && x < 67 && y < 38 && hash(x, y) < (grade===2?.14:.075)) return 'tree';
  return 'grass';
}
export function canStand(map, x, y, doors = 0, grade = 5){
  return [-.23, .23].every(dx => [-.23, .23].every(dy => ['grass', 'path', 'floor'].includes(tile(map, x + dx, y + dy, doors, grade))));
}
export function move(state, dx, dy, dt){
  const length = Math.max(1, Math.hypot(dx, dy)), amount = Math.min(.05, Math.max(0, dt)) * 4.5;
  const nx = state.x + dx / length * amount, ny = state.y + dy / length * amount;
  if (canStand(state.map, nx, state.y, state.doors, state.regionGrade)) state.x = nx;
  if (canStand(state.map, state.x, ny, state.doors, state.regionGrade)) state.y = ny;
  if (dx || dy) state.facing = dx < 0 ? -1 : dx > 0 ? 1 : state.facing;
  if(state.map==='field')syncRegion(state);
}
export function syncRegion(state){
  const grade=gradeAt(state.x,state.y);
  if(grade===state.regionGrade)return false;
  rememberDungeon(state);state.regionGrade=grade;state.activeDungeon='A';
  const progress=state.dungeonProgress[dungeonId(state)]||{doors:0,cleared:false};
  state.doors=progress.doors;state.cleared=progress.cleared;return true;
}
export const dungeonId = (state, domain = state.activeDungeon || 'A') => `dungeon-g${state.regionGrade || 5}-${domain}`;
export function rememberDungeon(state){
  state.dungeonProgress ||= {};
  state.dungeonProgress[dungeonId(state)] = {doors:state.doors,cleared:state.cleared};
}
export function enterCave(state, domain = 'A'){
  rememberDungeon(state); state.activeDungeon = DOMAINS.includes(domain) ? domain : 'A';
  const p = state.dungeonProgress[dungeonId(state)] || {doors:0,cleared:false};
  state.doors=p.doors;state.cleared=p.cleared;state.map = 'cave'; Object.assign(state, CAVE.spawn);
}
export function leaveCave(state){ rememberDungeon(state);const spot=worldPoint(DUNGEON_SPOTS.find(p=>p.domain===state.activeDungeon)||ENTRANCE,state.regionGrade);state.map='field';state.x=spot.x;state.y=spot.y+2; }
export function enterHouse(state,id){
  if(!HOUSES.some(h=>h.id===id))return false;
  state.houseId=id;state.map='house';Object.assign(state,HOUSE_ROOM.spawn);return true;
}
export function leaveHouse(state){
  const h=HOUSES.find(h=>h.id===state.houseId)||HOUSES[0],door=houseDoor(h,state.regionGrade);
  state.map='field';state.houseId=null;state.x=door.x;state.y=door.y+1.3;
}
export function changeRegion(state, grade){
  if (!Number.isInteger(grade) || grade<1 || grade>6) return false;
  rememberDungeon(state); state.regionGrade=grade; state.activeDungeon='A';
  const p=state.dungeonProgress[dungeonId(state)]||{doors:0,cleared:false};state.doors=p.doors;state.cleared=p.cleared;returnVillage(state);return true;
}
export function returnVillage(state){ rememberDungeon(state);state.map='field';state.houseId=null;Object.assign(state,villagePoint(state.regionGrade)); }
export function openGate(state, index){
  if (state.map !== 'cave' || index !== state.doors || index >= GATES.length) return false;
  state.doors++; rememberDungeon(state); return true;
}
export function claimTreasure(state){
  if (state.map !== 'cave' || state.doors !== 5 || state.cleared) return false;
  state.cleared = true; state.coins += 50; rememberDungeon(state); return true;
}
export function bossRequirements(state, domain, need=15){
  const grade=state.regionGrade||5;
  const counts=[1,2].map(i=>state.defeatCounts?.[`g${grade}_${domain}${i}`]||0);
  const cleared=!!state.dungeonProgress?.[`dungeon-g${grade}-${domain}`]?.cleared;
  return {ok:cleared&&counts.every(n=>n>=need),counts,cleared,need};
}
export const usable = (data, allowDraft, checked) => !!data && (checked(data) || (allowDraft && data.status === 'draft'));
export const storagePrefix = trial => `sansu-island-2d${trial ? '-playtest' : ''}:v1:`;
export const validName = name => NAME_PARTS.a.some(a => NAME_PARTS.b.some(b => NAME_PARTS.c.some(c => a + b + c === name)));
export function freshState(name, grade = 5){
  if (!validName(name)) throw new Error('ことばを組み合わせたなまえを選んでください。');
  return { version:1,worldVersion:2,name,grade,regionGrade:grade,activeDungeon:'A',dungeonProgress:{},defeatedBosses:[],clearedQuests:[],map:'field',...villagePoint(grade),facing:1,doors:0,cleared:false,houseId:null,houseGifts:[],unlockedItems:['lantern','wand'],
    coins: 0, item: 'lantern', hat: '#eb8368', questionDecks: {}, defeatCounts: {}, titleLevels: {},
    logs: [], playSec: 0, ruby: grade <= 3, savedAt: null };
}
function validSave(s, name){
  if (!s || s.version !== 1 || s.name !== name || !validName(name)) return false;
  if(s.worldVersion!==2)return false;
  if (!Number.isInteger(s.grade) || s.grade < 1 || s.grade > 6 || !['field', 'cave','house'].includes(s.map)) return false;
  if (![s.x, s.y, s.coins, s.playSec].every(n => Number.isFinite(n) && n >= 0)) return false;
  if (!Number.isInteger(s.doors) || s.doors < 0 || s.doors > 5 || typeof s.cleared !== 'boolean' || (s.cleared && s.doors !== 5)) return false;
  if (!ITEM_IDS.includes(s.item) || !/^#[\da-f]{6}$/i.test(s.hat) || typeof s.ruby !== 'boolean') return false;
  if(!Array.isArray(s.unlockedItems)||!s.unlockedItems.every(id=>ITEM_IDS.includes(id))||!s.unlockedItems.includes(s.item))return false;
  if(!Array.isArray(s.houseGifts)||!s.houseGifts.every(id=>/^g[1-6]$/.test(id)))return false;
  if(s.houseId!==null&&!HOUSES.some(h=>h.id===s.houseId))return false;
  if(s.map==='house'&&!s.houseId)return false;
  if (!Array.isArray(s.logs) || s.logs.length > 1000) return false;
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  if (![s.questionDecks, s.defeatCounts, s.titleLevels].every(object)) return false;
  if (!Object.values(s.defeatCounts).every(v => Number.isInteger(v) && v >= 0) || !Object.values(s.titleLevels).every(v => Number.isInteger(v) && v >= 0 && v <= 5)) return false;
  if (!Object.values(s.questionDecks).every(d => object(d) && typeof d.poolVersion === 'string' && [d.remaining, d.recent].every(a => Array.isArray(a) && a.every(v => typeof v === 'string')))) return false;
  if (!Number.isInteger(s.regionGrade)||s.regionGrade<1||s.regionGrade>6||!DOMAINS.includes(s.activeDungeon)||!object(s.dungeonProgress)) return false;
  if (!Object.entries(s.dungeonProgress).every(([id,p])=>/^dungeon-g[1-6]-[ABCD]$/.test(id)&&object(p)&&Number.isInteger(p.doors)&&p.doors>=0&&p.doors<=5&&typeof p.cleared==='boolean'&&(!p.cleared||p.doors===5))) return false;
  if (!Array.isArray(s.defeatedBosses)||!s.defeatedBosses.every(id=>/^boss-g[1-6]-[ABCD]$/.test(id))||!Array.isArray(s.clearedQuests)||!s.clearedQuests.every(id=>/^q[1-6]-\d+$/.test(id))) return false;
  return true;
}
export function loadState(storage, trial, name){
  const raw = storage.getItem(storagePrefix(trial) + name);
  if (raw === null) return null;
  let s; try { s = JSON.parse(raw); } catch { throw new Error('2Dの保存が読めません。上書きせず、先生に見せてください。'); }
  if (s && typeof s==='object' && !Array.isArray(s)){
    // First 2D prototype had only the grade-5/A cave. Do not reset its progress.
    s.regionGrade ??= 5;s.activeDungeon ??= 'A';s.dungeonProgress ??= {};s.defeatedBosses ??= [];s.clearedQuests ??= [];
    s.houseId??=null;s.houseGifts??=[];s.unlockedItems??=['lantern','wand'];
    if(s.worldVersion===undefined){
      if(s.map==='field'&&Number.isFinite(s.x)&&Number.isFinite(s.y))Object.assign(s,worldPoint({x:s.x,y:s.y},s.regionGrade));
      s.worldVersion=2;
    }
  }
  if (!validSave(s, name)) throw new Error('2Dの保存形式を確認できません。上書きせず、先生に見せてください。');
  rememberDungeon(s);
  if(s.map==='field'&&canStand(s.map,s.x,s.y,s.doors,s.regionGrade))syncRegion(s);
  if (!canStand(s.map, s.x, s.y, s.doors, s.regionGrade)){
    // Old builds allowed standing on the chest. Recover beside it, keeping progress.
    const besideChest = s.map === 'cave' && Math.hypot(s.x-TREASURE.x,s.y-TREASURE.y) < 2;
    Object.assign(s, besideChest ? {x:TREASURE.x,y:TREASURE.y+1} : s.map === 'cave' ? CAVE.spawn : s.map==='house'?HOUSE_ROOM.spawn:villagePoint(s.regionGrade));
  }
  return s;
}
export function saveState(storage, trial, state){
  if (!validSave(state, state.name)) throw new Error('2Dの記録を保存できませんでした。');
  rememberDungeon(state);
  state.savedAt = new Date().toISOString();
  storage.setItem(storagePrefix(trial) + state.name, JSON.stringify(state));
}
export function profiles(storage, trial){
  const prefix = storagePrefix(trial), names = [];
  for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(prefix) && validName(key.slice(prefix.length))) names.push(key.slice(prefix.length)); }
  return names.sort();
}
export function logAttempt(state, kind, entry){
  state.logs.push({ at: new Date().toISOString(), region: `g${state.regionGrade}:${state.map}`, kind, ...entry });
  if (state.logs.length > 1000) state.logs.splice(0, state.logs.length - 1000);
}
