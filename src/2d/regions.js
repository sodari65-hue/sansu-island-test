export const DOMAINS = ['A', 'B', 'C', 'D'];
export const REGIONS = [
  { grade:1, name:'はなさく草原', ruby:'はなさく{草原|そうげん}', theme:'meadow', ground:[149,185,106], water:'#80bbae', tree:'#629451', accent:'#d4879e', landmark:'flowers' },
  { grade:2, name:'こもれびの森', ruby:'こもれびの{森|もり}', theme:'forest', ground:[103,156,108], water:'#74aaa4', tree:'#336b52', accent:'#d69b5b', landmark:'pond' },
  { grade:3, name:'しおかぜの海辺', ruby:'しおかぜの{海辺|うみべ}', theme:'coast', ground:[210,203,145], water:'#74b9c5', tree:'#669c69', accent:'#b1a256', landmark:'pond' },
  { grade:4, name:'こだまの山', ruby:'こだまの{山|やま}', theme:'mountain', ground:[155,174,131], water:'#89adb8', tree:'#486e60', accent:'#69946b', landmark:'rock' },
  { grade:5, name:'ほのおの火山', ruby:'ほのおの{火山|かざん}', theme:'volcano', ground:[157,158,111], water:'#78b4ad', tree:'#8a7e61', accent:'#729fbf', landmark:'lava' },
  { grade:6, name:'ほしあかりの雪原', ruby:'ほしあかりの{雪原|せつげん}', theme:'snow', ground:[219,230,222], water:'#8faec4', tree:'#91b5ad', accent:'#ad90bd', landmark:'ice' },
];
export const regionOf = grade => REGIONS.find(r=>r.grade === grade) || REGIONS[4];
export const DOMAIN_NAMES = {A:'数と計算',B:'図形',C:'くらべ方',D:'データ'};
export const domainName = (grade, domain) => domain === 'C' && grade <= 3 ? 'はかる' : DOMAIN_NAMES[domain];
