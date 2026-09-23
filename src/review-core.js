// ブラウザと開発ツールで共用する、内容の確認・レビュー管理。
// 自動検査は先生の承認ではない。署名は編集の検出用で、改ざん防止ではない。
(function(){
'use strict';
const plain = value => String(value ?? '').replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1');
const normalize = value => plain(value).normalize('NFKC').replace(/\s+/g, '');
const OMIT = new Set(['status', 'reviewHash', 'kind', 'domainName']);
function stable(value){
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function contentHash(item){
  const body = Object.fromEntries(Object.entries(item).filter(([k]) => !OMIT.has(k) && !k.startsWith('_')));
  // kind は画面用だが、ステップ内の kind は問題内容なので残す。
  const text = JSON.stringify(stable(body));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++){
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${text.length}`;
}
function isChecked(item){
  return item.status === 'checked' && (!item.reviewHash || item.reviewHash === contentHash(item));
}
function reviewState(item, record){
  if (record?.verdict){
    if (record.contentHash !== contentHash(item)) return 'stale';
    return record.verdict;
  }
  if (item.status === 'checked') return isChecked(item) ? 'ok' : 'stale';
  return 'none';
}
function reviewItems(data){
  if (Array.isArray(data.stages)) return [{ ...data, kind: 'boss' }];
  if (Array.isArray(data.sequence)) return [{ ...data, kind: 'dungeon' }];
  if (Array.isArray(data.quests)) return data.quests.map(q => ({ grade: data.grade, ...q, kind: 'quest' }));
  return (data.questions || []).map(q => ({ grade: data.grade, domain: data.domain, ...q, kind: 'q' }));
}
function parseReview(data){
  const records = data?.review ?? data;
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('判定の形式が違います。');
  for (const [id, r] of Object.entries(records)){
    if (!r || typeof r !== 'object' || Array.isArray(r) ||
        (r.verdict !== undefined && !['ok', 'ng'].includes(r.verdict)) ||
        (r.note !== undefined && typeof r.note !== 'string') ||
        (r.contentHash !== undefined && typeof r.contentHash !== 'string')) throw new Error(`${id}: 判定の形式が違います。`);
  }
  return records;
}

const numeric = text => {
  const s = normalize(text);
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const f = /^(\d+)分の(\d+)$/.exec(s);
  return f && Number(f[1]) !== 0 ? Number(f[2]) / Number(f[1]) : null;
};
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
// 文脈推測はしない。「数 演算子 数 は？」の形だけ再計算する。
function calculation(text){
  const n = '(?:\\d+分の\\d+|\\d+(?:\\.\\d+)?)';
  const m = new RegExp(`^(${n})([+＋−ー－×÷*\\/\\-])(${n})(?:は|=|＝)?[?？。]*$`).exec(normalize(text));
  if (!m) return null;
  const a = numeric(m[1]), b = numeric(m[3]);
  if (a === null || b === null) return null;
  const op = m[2];
  const value = /[+＋]/.test(op) ? a + b : /[−ー－\-]/.test(op) ? a - b : /[×*]/.test(op) ? a * b : b === 0 ? NaN : a / b;
  return { expression: `${m[1]} ${op} ${m[3]}`, value };
}

function auditItems(items){
  const results = new Map(items.map(q => [q.id, { issues: [], calculations: [], score: 0 }]));
  const texts = new Map();
  for (const item of items){
    const result = results.get(item.id);
    const add = (severity, code, message) => result.issues.push({ severity, code, message });
    if (item.status === 'checked' && !isChecked(item)) add('error', 'stale', '承認後に内容が変更されています。再確認が必要です。');
    const nodes = item.kind === 'q' ? [item] : item.steps || item.stages || item.thinking || [];
    nodes.forEach((q, index) => {
      const prefix = nodes.length > 1 ? `${index + 1}段階目：` : '';
      const text = q.text || q.prompt || '';
      if (plain(text).length > 110) add('notice', 'long', prefix + '文が長めです。画面での読みやすさを確認してください。');
      for (const [field, label] of [['choices', '答え'], ['reasons', '理由']]){
        if (!Array.isArray(q[field])) continue;
        const values = q[field].map(normalize);
        if (new Set(values).size !== values.length) add('error', 'duplicate-choice', prefix + `${label}に、空白・ふりがなを除くと同じ選択肢があります。`);
        const nums = q[field].map(numeric).filter(v => v !== null);
        if (nums.some((v, i) => nums.slice(i + 1).some(w => close(v, w))))
          add('notice', 'equivalent-choice', prefix + `${label}に同じ値の選択肢があります。約分などの指定で区別できるか確認してください。`);
      }
      const calc = calculation(text);
      if (calc){
        const answer = q.type === 'number' || q.kind === 'input' ? q.answer : numeric(q.choices?.[q.answer]);
        if (Number.isFinite(calc.value) && typeof answer === 'number'){
          const matches = close(answer, calc.value);
          result.calculations.push({ ...calc, answer, matches, stage: index + 1 });
          if (!matches) add('error', 'calculation', prefix + `再計算は ${Number(calc.value.toPrecision(12))}、登録された正答は ${answer} です。`);
          if (q.choices?.filter(c => { const v = numeric(c); return v !== null && close(v, calc.value); }).length > 1)
            add('error', 'multiple-answers', prefix + 'この計算の正答と同じ値になる選択肢が複数あります。');
        }
      }
      const answerText = q.type === 'number' || q.kind === 'input' ? String(q.answer) : plain(q.choices?.[q.answer]);
      if (answerText && normalize(q.hint).includes('答えは' + normalize(answerText)))
        add('notice', 'answer-in-hint', prefix + 'ヒントに「答えは…」が含まれます。手がかりと解説の使い分けを確認してください。');
    });
    if (item.kind === 'q'){
      const key = normalize(item.text);
      if (!texts.has(key)) texts.set(key, []);
      texts.get(key).push(item);
    } else add('notice', 'reasoning', '文章の条件、誤答の理由、ヒント・解説のつながりを先生が確認してください。');
  }
  for (const group of texts.values()) if (group.length > 1) for (const q of group){
    results.get(q.id).issues.push({ severity: 'notice', code: 'duplicate-text', message: `同じ問題文：${group.filter(x => x !== q).map(x => x.id).join('、')}。復習として必要か確認してください。` });
  }
  for (const r of results.values()) r.score = r.issues.reduce((n, x) => n + (x.severity === 'error' ? 100 : 10), 0);
  return results;
}
globalThis.SansuReview = Object.freeze({ plain, normalize, contentHash, isChecked, reviewState, reviewItems, parseReview, auditItems });
})();
