// Original Canvas2D art, shared by the field and the encounter window.
// Internal species IDs select drawings; they are never printed on the characters.
export const ENEMY_ART = {
  A1: '数の粒をまとった、青いしずくのかずっこ',
  A2: '計算記号の羽としま模様のけいさんバチ',
  B1: '三角形・四角形・円でできたかたちブロック',
  B2: '面積のマス目がこうらに並ぶますますガメ',
  C1: '目盛りのくちばしと百分率のバッジのはかりドリ',
  C2: '速さをはかる時計をかぶったとけいモグラ',
  D1: '円グラフのかさと帯グラフの体のグラフンボ',
  D2: '高さをならす図を持った、めがねのヨミトリフクロウ',
};

export function paintEnemy(ctx, sid, x, y, time = 0, scale = 1, grade = 5){
  const ink = '#32454b';
  const path = (draw, fill, stroke = ink, width = 2.2) => {
    ctx.beginPath(); draw(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  };
  const oval = (x,y,rx,ry,fill,stroke=ink) => path(()=>ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2),fill,stroke);
  const poly = (points,fill,stroke=ink) => path(()=>{points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();},fill,stroke);
  const line = (points,color=ink,width=2.2) => path(()=>points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),null,color,width);
  const box = (x,y,w,h,fill,stroke=ink,r=3) => path(()=>{
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  },fill,stroke);
  const glyph = (text,x,y,size=14,color=ink) => {ctx.font=`bold ${size}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);};
  const eyes = (x=0,y=-25,gap=9) => {
    for(const side of [-1,1]){oval(x+side*gap,y,3.2,4.6,ink,null);oval(x+side*gap-1,y-2,1,1.3,'#fffbed',null);}
  };
  const smile = (x=0,y=-13) => path(()=>{ctx.moveTo(x-4,y);ctx.quadraticCurveTo(x,y+5,x+4,y);},null,ink,1.6);
  const sheen = (x,y,rx,ry) => oval(x,y,rx,ry,'#ffffff70',null);
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineJoin='round';ctx.lineCap='round';
  oval(0,3,25,7,'#183f332b',null);
  ctx.translate(0,Math.sin(time*3+(sid.charCodeAt(0)))*1.5);
  switch(sid){
    case 'A1': {
      path(()=>{ctx.moveTo(-27,-7);ctx.bezierCurveTo(-35,-25,-17,-44,-5,-49);ctx.quadraticCurveTo(1,-57,3,-62);ctx.bezierCurveTo(8,-44,31,-34,29,-13);ctx.quadraticCurveTo(29,5,0,3);ctx.quadraticCurveTo(-20,4,-27,-7);},'#70bdce');
      path(()=>{ctx.moveTo(-21,-7);ctx.quadraticCurveTo(1,7,23,-8);ctx.quadraticCurveTo(11,1,-21,-7);},'#4c95b1',null);
      sheen(-12,-35,6,10);eyes(1,-25,9);smile(1,-13);
      oval(-23,-55,10,10,'#e5e5ad');glyph('2',-23,-55,13,'#607a58');
      oval(27,-46,8,8,'#edf2d5');glyph('3',27,-46,11,'#607a58');
      break;
    }
    case 'A2': {
      oval(-20,-40,15,21,'#ecf5e9');oval(20,-40,15,21,'#ecf5e9');
      glyph('+',-22,-44,17,'#618c95');glyph(grade===1?'−':grade===2?'×':'÷',22,-44,17,'#618c95');
      poly([[23,-15],[37,-12],[25,-6]],'#776453');
      oval(0,-21,25,22,'#edc36b');
      ctx.save();ctx.beginPath();ctx.ellipse(0,-21,25,22,0,0,Math.PI*2);ctx.clip();
      box(-27,-30,54,8,'#85704a',null,0);box(-27,-12,54,7,'#85704a',null,0);ctx.restore();
      oval(0,-37,19,16,'#fae5a3');line([[-10,-49],[-15,-61]]);line([[10,-49],[15,-61]]);
      oval(-15,-62,3,3,'#ca8460');oval(15,-62,3,3,'#ca8460');eyes(0,-39,7);smile(0,-30);
      oval(-13,1,6,3,'#79654e');oval(13,1,6,3,'#79654e');sheen(-9,-45,4,3);
      break;
    }
    case 'B1': {
      box(-22,-2,15,8,'#537888');box(7,-2,15,8,'#537888');
      line([[-24,-23],[-32,-16]],ink,4);line([[24,-23],[32,-16]],ink,4);
      oval(-34,-14,6,6,'#e1b56b');oval(34,-14,6,6,'#e1b56b');
      poly([[-24,-34],[16,-34],[25,-41],[-15,-41]],'#aed3d5');
      poly([[16,-34],[25,-41],[25,-9],[16,-2]],'#51829a');
      box(-24,-34,40,33,'#82b7c2',ink,2);eyes(-4,-23,8);smile(-4,-11);
      poly([[-22,-43],[-2,-67],[18,-43]],'#e9bb65');poly([[-2,-67],[6,-47],[18,-43]],'#d59b55',null);
      oval(26,-57,8,8,'#d78e80');sheen(24,-59,2,2);
      break;
    }
    case 'B2': {
      for(const [x,y] of [[-19,-2],[12,1],[-19,-24],[11,-27]]) oval(x,y,7,5,'#c8bc7f');
      poly([[-27,-15],[-38,-9],[-27,-6]],'#95b78a');
      oval(0,-20,28,23,'#6eaa96');
      ctx.save();ctx.beginPath();ctx.ellipse(0,-20,25,20,0,0,Math.PI*2);ctx.clip();
      for(let row=0;row<4;row++)for(let col=0;col<5;col++) box(-26+col*11,-43+row*12,11,12,(row+col)%2?'#83b5a0':'#afd0a2','#527f73',0);
      ctx.restore();oval(0,-20,28,23,null);
      oval(28,-9,13,12,'#d5db9e');eyes(29,-12,5);smile(30,-4);sheen(-13,-34,8,4);
      break;
    }
    case 'C1': {
      line([[-9,-3],[-11,6],[-17,7]],'#967449',3);line([[8,-3],[10,6],[16,7]],'#967449',3);
      poly([[-19,-21],[-37,-31],[-30,-10],[-15,-6]],'#4f829f');
      oval(0,-24,23,26,'#6caec3');oval(0,-13,15,14,'#e4edcf');glyph(grade===1?'↔':grade<=3?'cm':'%',0,-14,16,'#477883');
      oval(6,-43,18,17,'#8fc8d1');poly([[-5,-57],[-3,-66],[3,-59],[8,-67],[12,-56]],'#daac62');
      poly([[21,-47],[44,-41],[21,-34]],'#edcd7a');
      for(let i=0;i<4;i++)line([[25+i*4,-43],[25+i*4,-38]],'#a7864f',1.3);
      eyes(8,-46,6);oval(-13,-25,7,16,'#528aab');sheen(1,-53,5,3);
      break;
    }
    case 'C2': {
      oval(-14,1,9,5,'#785d52');oval(14,1,9,5,'#785d52');
      oval(-24,-14,9,7,'#d3b493');oval(24,-14,9,7,'#d3b493');
      for(const side of [-1,1])for(let i=0;i<3;i++)line([[side*(22+i*3),-16],[side*(23+i*3),-10]],'#f8edcc',1.5);
      oval(0,-21,22,26,'#a98b7d');oval(0,-16,15,17,'#ddc5a6');
      oval(0,-43,24,24,'#85abb3');box(-5,-72,10,7,'#d8b65e');
      oval(0,-43,19,19,'#fbefd0');
      for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[Math.sin(a)*15,-43-Math.cos(a)*15],[Math.sin(a)*17,-43-Math.cos(a)*17]],'#8f997f',1.4);}
      line([[0,-54],[0,-43],[9,-38]],'#547684',2.8);oval(0,-43,2,2,'#d78665',null);
      eyes(0,-19,8);oval(0,-11,5,3,'#b87676');
      break;
    }
    case 'D1': {
      oval(-11,2,7,4,'#7c6b66');oval(11,2,7,4,'#7c6b66');
      box(-16,-35,32,36,'#f3e4b3',ink,8);eyes(0,-24,7);smile(0,-15);
      box(-13,-9,26,7,'#7db4c1',null,1);box(-13,-9,9,7,'#d99179',null,1);box(-4,-9,8,7,'#e5c267',null,0);
      oval(0,-38,33,10,'#847d81');
      ctx.save();ctx.translate(0,-43);ctx.scale(1,.63);
      const colors=['#79b5be','#e4bd66','#bc91b6','#d99179'];
      if(grade>=5)colors.forEach((color,i)=>path(()=>{ctx.moveTo(0,0);ctx.arc(0,0,33,-Math.PI/2+i*Math.PI/2,-Math.PI/2+(i+1)*Math.PI/2);ctx.closePath();},color,'#fcf0cf',1.7));
      else {oval(0,0,33,33,'#79b5be',null);for(let i=0;i<3;i++)oval(-17+i*17,0,5,8,'#f8e5b3',null);}
      oval(0,0,33,33,null);ctx.restore();sheen(-16,-51,8,3);
      break;
    }
    case 'D2': {
      oval(-10,2,7,4,'#d4ae61');oval(10,2,7,4,'#d4ae61');
      oval(0,-27,25,31,'#9b8270');poly([[-24,-45],[-23,-66],[-7,-52]],'#9b8270');poly([[24,-45],[23,-66],[7,-52]],'#9b8270');
      oval(-10,-39,12,15,'#f1e2ba');oval(10,-39,12,15,'#f1e2ba');
      for(const side of [-1,1]){oval(side*10,-39,10,10,null,'#4e7585');oval(side*10,-40,3,4,ink,null);sheen(side*10-1,-42,1,1);}
      line([[-1,-39],[1,-39]],'#4e7585',2);poly([[-4,-28],[4,-28],[0,-22]],'#dbad57');
      box(-20,-20,40,22,'#edf0d6','#5d817b',3);
      for(const [i,h] of [[0,6],[1,15],[2,9]])box(-14+i*11,-2-h,7,h,'#7aa5af',null,1);
      if(grade>=5)line([[-17,-12],[18,-12]],'#cb8c65',1.5);
      oval(-24,-15,6,12,'#876e61');oval(24,-15,6,12,'#876e61');
      break;
    }
    default: oval(0,-22,22,24,'#83b8bd');eyes();smile();
  }
  ctx.restore();
}

export function paintEnemyPortrait(canvas, sid, name, grade = 5){
  canvas.width = 440; canvas.height = 330;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${name}：${ENEMY_ART[sid] || 'まもの'}`);
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0,0,0,330);sky.addColorStop(0,'#dce9d6');sky.addColorStop(.7,'#f5e9c9');sky.addColorStop(1,'#c6d3aa');
  ctx.fillStyle=sky;ctx.fillRect(0,0,440,330);
  ctx.fillStyle='#a9c1a477';ctx.beginPath();ctx.moveTo(0,218);ctx.quadraticCurveTo(85,157,200,212);ctx.quadraticCurveTo(315,156,440,206);ctx.lineTo(440,330);ctx.lineTo(0,330);ctx.fill();
  ctx.fillStyle='#dee2b9';ctx.beginPath();ctx.ellipse(220,286,144,28,0,0,Math.PI*2);ctx.fill();
  paintEnemy(ctx,sid,220,272,0,2.8,grade);
}
