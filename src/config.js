// さんすうアイランド ― 世界のきまった数値
// ここを変えると島の大きさや地方の位置が変わる。

export const ISLAND_R  = 210;  // 島の半径
export const BEACH_W   = 24;   // 砂浜のはば（島のふちから内側へ）
export const VILLAGE_R = 24;   // はじまりの村の半径
export const REGION_D  = 130;  // 島の中心から地方の中心までの距離
export const REGION_R  = 52;   // 地方の半径
export const GATE_R    = 78;   // 門を置く位置（島の中心からの距離）＝ REGION_D - REGION_R

export const SEA_Y     = -2.2; // 海面の高さ

// 地形は四角いかたまり（チャンク）に分けて作る。
// 画面の外のかたまりは描かれないので、島を広げても軽いまま。
export const CHUNKS    = 8;    // 1辺あたりのかたまりの数（8×8＝64）
export const CHUNK_DIV = 18;   // かたまり1つの分割数

// 6つの地方。第1段階では 5年（火山）だけ open。
export const REGIONS = [
  { id:'g1', grade:1, name:'草原', yomi:'そうげん', deg:150, open:false },
  { id:'g2', grade:2, name:'森',   yomi:'もり',     deg:210, open:false },
  { id:'g3', grade:3, name:'海辺', yomi:'うみべ',   deg:270, open:false },
  { id:'g4', grade:4, name:'山',   yomi:'やま',     deg:330, open:false },
  { id:'g5', grade:5, name:'火山', yomi:'かざん',   deg:30,  open:true  },
  { id:'g6', grade:6, name:'雪原', yomi:'せつげん', deg:90,  open:false },
];

export function regionCenter(r){
  const a = r.deg * Math.PI / 180;
  return { x: Math.cos(a) * REGION_D, z: Math.sin(a) * REGION_D };
}

export const G5  = REGIONS.find(r => r.id === 'g5');
export const G5C = regionCenter(G5);

// 火山
export const VOLCANO_H = 34;   // 火口のふちの高さ

// 温泉（火山のふもと）。G5C からの向きときょり。地面は terrain.js が平らにする。
export const ONSEN_SPEC = [
  { deg: 120, dist: 40, r: 8.0 },
  { deg: 325, dist: 38, r: 7.2 },
];

// ---- 地方の「らしさ」（気候） -------------------------------------------
// 地方に近づくほどこの色・木・天気に寄っていく。境目をつくらず、じわっと変える。
export const BIOMES = {
  g1: { ground:[0.56,0.83,0.43], sky:0xbfeaff, trees:'meadow', density:0.55, flowers:2.4, rocks:0.5 },
  g2: { ground:[0.24,0.52,0.28], sky:0xa8dcc4, trees:'forest', density:2.6, flowers:0.5, rocks:0.7 },
  g3: { ground:[0.86,0.80,0.56], sky:0xa9e8ff, trees:'palm',   density:0.5, flowers:0.3, rocks:0.6 },
  g4: { ground:[0.47,0.52,0.42], sky:0xc3d8e8, trees:'alpine', density:0.9, flowers:0.4, rocks:2.2 },
  g5: { ground:[0.44,0.34,0.31], sky:0xe6c7a4, trees:'dead',   density:0.3, flowers:0.0, rocks:1.8 },
  g6: { ground:[0.93,0.95,0.99], sky:0xdfeaf5, trees:'snowy',  density:1.2, flowers:0.1, rocks:0.8 },
};
// はじまりの村のまわり（どの地方にも寄っていないところ）
export const BIOME_CENTER =
  { ground:[0.42,0.74,0.40], sky:0x9fe0ff, trees:'meadow', density:0.9, flowers:1.5, rocks:0.8 };

/** 気候がとどく範囲。地方の半径の何倍まで影響するか（1.0 だと境目が出る） */
export const BIOME_REACH = 1.9;

// 天気（地方の影響がこの値をこえると降りはじめる）
export const WEATHER_START = 0.10;

// プレイヤー
export const WALK_SPEED = 11.5; // 1秒に進むきょり（島が広いので速め）
export const JUMP_TIME  = 0.55;

// カメラ
export const CAM = {
  yaw: 0,             // はじめの向き（0 ＝ 南から北を見る）
  pitch: 0.60,        // 見おろす角度（ラジアン）
  pitchMin: 0.18,
  pitchMax: 1.18,
  dist: 19,           // プレイヤーまでのきょり
  distMin: 10,
  distMax: 55,
  turnSpeed: 0.0055,  // 指1本のドラッグで回る量
};

// ---- 第2段階：たたかい（敵8種・ボスの中身は data/ と config/ にある） ----

export const PLAYER_HP     = 3;
export const RESPAWN_SEC   = 45;   // 倒した敵がもどってくるまで
export const ENCOUNTER_R   = 5.5;  // これより近づくと「ちかくに いる」と出る（たたかうボタンでも はじめられる）
export const CONTACT_R     = 2.6;  // これより近づく（ぶつかる）と、自動で たたかいが はじまる
export const CONTACT_GRACE = 1.5;  // たたかいが おわってから、つぎに ぶつかって はじまるまでの 秒数

// 保存
import { PLAYTEST } from './playtest.js';
export const SAVE_PREFIX  = PLAYTEST ? 'sansu-island-playtest' : 'sansu-island';
export const SAVE_INDEX   = SAVE_PREFIX + ':index';
export const SAVE_VERSION = 2;
export const AUTOSAVE_SEC = 20;   // 区切り以外にも、これだけたったら保存する
export const LOG_MAX      = 1000; // 記録の上限（端末内）

// 画質（描画解像度の上限）。auto は fps を見て自動で上げ下げする。
export const QUALITY = { low: 1, mid: 1.5, high: 2 };

// なまえ（ハンドルネーム）
// 児童は本名・クラス・出席番号を入力しない。3つの言葉をえらんで自分のなまえを作る。
// すべてかなとカタカナだけにして、1年生でも読めるようにする。
export const NAME_PARTS = {
  a: ['あかい','あおい','きいろい','みどりの','しろい','くろい',
      'ひかる','ちいさい','おおきい','はやい','つよい','ふしぎな'],
  b: ['トラ','ネコ','イヌ','クマ','カメ','ペンギン','イルカ','クジラ',
      'ドラゴン','ユニコーン','ロボット','キョウリュウ','フクロウ','キツネ','ハリネズミ','リス'],
  c: ['けんし','まほうつかい','たんけんか','はかせ','パイロット',
      'コック','おうさま','ぼうけんしゃ','まもりびと','たびびと'],
};

export function makeName(a, b, c){ return `${a}${b}${c}`; }

/** 組み合わせの数（なまえがかぶりにくいかの目安） */
export const NAME_COMBOS =
  NAME_PARTS.a.length * NAME_PARTS.b.length * NAME_PARTS.c.length;
