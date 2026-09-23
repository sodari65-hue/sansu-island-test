// 分数・角の操作。画像や外部ライブラリを使わず、同じ長さ／角度を保って描く。
const COLORS = ['#df695c', '#438db8', '#dfb52e'];
const rad = deg => deg * Math.PI / 180;
export function trianglePoints(angles){
  const side = 200 * Math.sin(rad(angles[1])) / Math.sin(rad(angles[2]));
  const raw = [[0, 0], [200, 0], [side * Math.cos(rad(angles[0])), -side * Math.sin(rad(angles[0]))]];
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const scale = Math.min(210 / (Math.max(...xs) - minX), 115 / (Math.max(...ys) - minY));
  return raw.map(([x,y]) => [25 + (x-minX)*scale, 20 + (y-minY)*scale]);
}
function sector(cx, cy, r, start, extent, color){
  const point = a => `${cx+r*Math.cos(rad(a))},${cy+r*Math.sin(rad(a))}`;
  return `<path d="M${cx},${cy} L${point(start)} A${r},${r} 0 ${extent>180?1:0} 1 ${point(start+extent)} Z" fill="${color}" stroke="white" stroke-width="2"/>`;
}
const button = (label, fn, cls='ansBtn') => {
  const b = document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label;
  b.addEventListener('click', fn); return b;
};

export function fractionWidget(box, st, onSubmit){
  box.className='encAns mathWidget'; box.innerHTML='';
  const label=document.createElement('div'); label.textContent='どちらも テープぜんぶで 1'; box.append(label);
  const source=document.createElement('div'); source.className='fractionStrip';
  source.setAttribute('role','img'); source.setAttribute('aria-label',`${st.denominator}分の${st.numerator}`);
  for(let i=0;i<st.denominator;i++){
    const cell=document.createElement('span'); cell.className=i<st.numerator?'filled':''; source.append(cell);
  }
  box.append(source);
  const read=document.createElement('div'); read.setAttribute('aria-live','polite');
  const target=document.createElement('div'); target.className='fractionStrip';
  let value=0; const cells=[];
  const set=n=>{value=n; cells.forEach((b,i)=>{b.classList.toggle('filled',i<n);b.setAttribute('aria-pressed',String(i<n));});read.textContent=`${st.denominator}分の${st.numerator} と ${st.targetDenominator}分の${n}`;};
  for(let i=0;i<st.targetDenominator;i++){
    const b=button(String(i+1),()=>set(i+1),'fractionCell');
    b.setAttribute('aria-label',`${st.targetDenominator}分の${i+1}まで ぬる`);cells.push(b);target.append(b);
  }
  box.append(target,read,button('ぬりなおす',()=>set(0)),button('これで いく',()=>onSubmit(value),'ansBtn ok'));
  set(0);
}

export function anglesWidget(box, st, onSubmit){
  box.className='encAns mathWidget'; box.innerHTML='';
  const points=trianglePoints(st.angles), picked=[];
  const diagram=document.createElement('div'); diagram.className='angleDiagram';
  const controls=document.createElement('div'); controls.className='angleControls';
  const read=document.createElement('div'); read.setAttribute('aria-live','polite');
  const submit=button('これで いく',()=>{if(picked.length===3)onSubmit(picked.reduce((n,i)=>n+st.angles[i],0));},'ansBtn ok');
  const buttons=st.angles.map((a,i)=>{
    const b=button(`${'ABC'[i]} ${a}°を あつめる`,()=>{if(!picked.includes(i)){picked.push(i);render();}});
    b.style.borderColor=COLORS[i]; controls.append(b);return b;
  });
  function render(){
    const corners=points.map(([x,y],i)=>{
      const directions=points.filter((_,j)=>i!==j).map(([px,py])=>Math.atan2(py-y,px-x)*180/Math.PI);
      let start=directions[0]; if((directions[1]-start+360)%360>180)start=directions[1];
      return sector(x,y,26,start,st.angles[i],COLORS[i])+`<text x="${x}" y="${y+18}" text-anchor="middle">${'ABC'[i]}</text>`;
    }).join('');
    let start=180;
    const collected=picked.map(i=>{const path=sector(130,112,83,start,st.angles[i],COLORS[i]);start+=st.angles[i];return path;}).join('');
    diagram.innerHTML=`<svg viewBox="0 0 260 160" role="img" aria-label="A ${st.angles[0]}度、B ${st.angles[1]}度、C ${st.angles[2]}度の三角形"><polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="#edf1f5" stroke="#35495e" stroke-width="3"/>${corners}</svg><svg viewBox="0 0 260 160" role="img" aria-label="集めた角 ${start-180}度"><path d="M30 112 H230" stroke="#35495e" stroke-width="3"/>${collected}<text x="130" y="145" text-anchor="middle">${start-180}° / 180°</text></svg>`;
    buttons.forEach((b,i)=>{b.disabled=picked.includes(i);});submit.disabled=picked.length!==3;
    read.textContent=picked.length?picked.map(i=>`${st.angles[i]}°`).join(' ＋ ')+` ＝ ${start-180}°`:'3つの角を 1つずつ あつめよう';
  }
  box.append(diagram,controls,read,button('はじめから',()=>{picked.length=0;render();}),submit);render();
}
