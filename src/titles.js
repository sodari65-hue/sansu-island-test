// TitleManager ― 倒した数を数えて、称号の段階を決める（出題・称号・報酬 実装計画書 6章）
//
//  ・学年×敵の種類（48種）ごとに「倒した数」を数える。キーは g{学年}_{系統}（例：g5_A1）
//  ・同じ種類でも学年（色）がちがえば別に数える
//  ・段階は 1/5/15/30/50体（config/titles.json で変えられる）
//  ・称号名は「{色名}{敵名} {段階名}」で自動で作る。特別な名前は overrides で上書き
//  ・titleLevels は保存する（段階アップの演出が二重に出ないように）

export function createTitles({ cfg, species, grades }){
  const SP = new Map(species.map(s => [s.id, s]));
  const GR = new Map(grades.map(g => [g.grade, g]));
  const th = cfg.thresholds;

  const key = (grade, sid) => `g${grade}_${sid}`;
  function parse(k){
    const m = /^g(\d)_([ABCD][12])$/.exec(k);
    return m ? { grade: Number(m[1]), sid: m[2] } : null;
  }

  /** 倒した数 → 段階（0〜5） */
  function levelOf(count){
    let lv = 0;
    for (let i = 0; i < th.length; i++) if (count >= th[i]) lv = i + 1;
    return lv;
  }
  /** 次の段階まであと何体か（もう最高なら null） */
  function nextAt(count){
    const t = th.find(v => v > count);
    return t == null ? null : t;
  }

  function nameOf(k, level){
    if (level < 1) return '';
    const ov = cfg.overrides?.[`${k}:${level}`];
    if (ov) return ov;
    const p = parse(k);
    const g = GR.get(p?.grade), s = SP.get(p?.sid);
    return cfg.template
      .replace('{color}', g?.colorName ?? '')
      .replace('{enemy}', s?.name ?? '')
      .replace('{stage}', cfg.stageNames[level - 1] ?? '');
  }

  /**
   * 1体たおした。段階が上がったら up:true（演出はこのときだけ出す）。
   */
  function addKill(state, k){
    state.defeatCounts ||= {};
    state.titleLevels  ||= {};
    const count = (state.defeatCounts[k] || 0) + 1;
    state.defeatCounts[k] = count;
    const prev = state.titleLevels[k] || 0;
    const level = levelOf(count);
    const up = level > prev;
    if (up) state.titleLevels[k] = level;
    return { key: k, count, level, prev, up, name: nameOf(k, level) };
  }

  /** 称号一覧の1学年ぶん（8種） */
  function list(state, grade){
    return species.map(s => {
      const k = key(grade, s.id);
      const count = state.defeatCounts?.[k] || 0;
      const level = levelOf(count);
      const nx = nextAt(count);
      return {
        key: k, sid: s.id, domain: s.domain, enemy: s.name,
        count, level, met: count > 0,
        name: nameOf(k, level),
        nextName: level < 5 ? nameOf(k, level + 1) : null,
        next: nx, remain: nx == null ? 0 : nx - count,
      };
    });
  }

  /** 手に入れた称号の数（段階ごとに1つと数える。最大 48×5＝240） */
  function earned(state){
    return Object.values(state.titleLevels || {}).reduce((a, v) => a + v, 0);
  }

  return { key, parse, levelOf, nextAt, nameOf, addKill, list, earned, thresholds: th, stageNames: cfg.stageNames };
}
