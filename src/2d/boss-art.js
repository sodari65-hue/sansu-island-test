import { regionOf } from './regions.js';
// Four original boss families, with a regional crest/color for each of the six lands.
export function paintBossPortrait(canvas,boss){
  canvas.width=440;canvas.height=330;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${boss.name}：${boss.concept||'この地方のボス'}`);
  const c=canvas.getContext('2d'),color=regionOf(boss.grade).accent,ink='#344650';
  const oval=(x,y,rx,ry,fill,stroke=ink)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=3;c.stroke();}};
  const poly=(p,fill)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=3;c.stroke();};
  const line=(p,w=3)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=ink;c.lineWidth=w;c.stroke();};
  const sky=c.createLinearGradient(0,0,0,330);sky.addColorStop(0,'#d1dee0');sky.addColorStop(1,'#f0e3bd');c.fillStyle=sky;c.fillRect(0,0,440,330);
  c.fillStyle='#b1c3b2';c.beginPath();c.moveTo(0,250);c.quadraticCurveTo(150,210,440,240);c.lineTo(440,330);c.lineTo(0,330);c.fill();
  oval(220,283,130,21,'#526b6533',null);c.lineJoin='round';c.lineCap='round';
  if(boss.domain==='A'){
    poly([[160,201],[98,101],[100,204],[157,235]],color);poly([[278,201],[348,101],[338,211],[274,239]],color);
    line([[101,112],[140,183],[106,203]]);line([[344,111],[301,181],[334,208]]);
    oval(218,219,69,64,color);oval(215,230,40,46,'#eadcae');
    for(let i=0;i<4;i++)line([[185,212+i*12],[245,212+i*12]],2);
    oval(218,143,60,52,color);poly([[177,111],[173,74],[199,96]],'#d9bd7c');poly([[240,95],[265,74],[259,112]],'#d9bd7c');
    oval(216,171,48,26,'#d2ddbd');oval(160,268,28,15,color);oval(275,268,28,15,color);
    oval(192,141,7,10,ink,null);oval(242,141,7,10,ink,null);oval(202,172,3,3,ink,null);oval(229,172,3,3,ink,null);
  }else if(boss.domain==='B'){
    poly([[160,130],[277,127],[287,245],[153,245]],color);poly([[137,153],[104,176],[117,231],[149,225]],'#889da1');poly([[297,151],[332,174],[319,230],[289,225]],'#889da1');
    poly([[166,243],[199,243],[196,280],[153,280]],'#718992');poly([[238,243],[271,243],[284,280],[240,280]],'#718992');
    poly([[173,84],[257,78],[272,125],[160,127]],'#cad2b7');poly([[179,194],[220,146],[258,194]],'#ead2a0');
    line([[193,103],[207,103]],5);line([[230,101],[244,101]],5);line([[209,117],[229,117]],3);line([[169,218],[269,218]],2);
  }else if(boss.domain==='C'){
    oval(220,225,59,59,color);oval(189,269,24,13,'#e6ddbf');oval(254,269,24,13,'#e6ddbf');
    poly([[166,137],[155,59],[201,105]],color);poly([[238,105],[285,59],[274,139]],color);
    poly([[166,87],[171,126],[189,110]],'#e9d3bc');poly([[253,111],[269,125],[274,86]],'#e9d3bc');
    oval(220,151,66,58,color);poly([[175,160],[204,150],[220,165],[237,150],[266,160],[241,202],[198,202]],'#f1e7cc');
    oval(195,139,7,9,ink,null);oval(246,139,7,9,ink,null);poly([[207,174],[234,174],[220,185]],ink);line([[220,185],[220,195],[207,199]],2);line([[220,195],[233,199]],2);
    poly([[169,220],[150,221],[117,188],[131,258],[175,264]],color);
  }else{
    poly([[127,213],[65,158],[74,227],[105,250]],color);poly([[97,249],[56,272],[127,276]],color);
    oval(234,215,112,69,color);oval(247,244,84,33,'#e4e6cb');
    poly([[222,231],[203,265],[267,255]],color);oval(299,199,9,11,ink,null);oval(302,196,3,3,'#fff9da',null);
    line([[293,230],[309,238],[324,231]],3);line([[238,146],[239,120],[222,104]],5);line([[239,121],[254,105]],5);
    oval(220,95,7,11,'#cce7db',null);oval(260,96,6,9,'#cce7db',null);
  }
  oval(219,54,17,17,'#f5e4b4');c.font='bold 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle=ink;c.fillText(String(boss.grade),219,55);
}
