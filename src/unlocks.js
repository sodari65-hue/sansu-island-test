// UnlockManager ― ボス挑戦権・持ち物・全クリアを計算する（出題・称号・報酬 実装計画書 7・8章）
//
// これらは保存しない。称号の段階・クリアしたダンジョン／クエスト・倒したボスから毎回計算する
// （保存すると、データが食いちがったときに直せなくなるため）。

export function createUnlocks({ cfg, itemsCfg, species, grades, bosses, titles, quests, dungeons }){
  const SP = new Map(species.map(s => [s.id, s]));
  const GR = new Map(grades.map(g => [g.grade, g]));
  const BO = new Map(bosses.map(b => [b.id, b]));
  const DU = new Map(dungeons.map(d => [d.id, d]));
  const REWARD_LV = cfg.titleRewardLevels;               // [2,4,5]

  // ---- 持ち物の定義 ----------------------------------------------------

  const defs = new Map();
  const add = d => { defs.set(d.id, d); return d; };

  for (const it of itemsCfg.initial){
    add({ id: it.id, kind: 'initial', model: it.model, name: it.name, color: '#a8743f', pattern: 'plain' });
  }

  // 称号報酬（知識・技能型）：形＝領域、色＝学年、柄＝敵の種類×段階
  for (const g of grades){
    for (const s of species){
      const set = s.id.endsWith('1') ? itemsCfg.patterns.first : itemsCfg.patterns.second;
      REWARD_LV.forEach((lv, i) => {
        const model = itemsCfg.models.knowledge[s.domain];
        const pattern = set[i];
        add({
          id: `item_t_g${g.grade}_${s.id}_${lv}`, kind: 'knowledge',
          grade: g.grade, domain: s.domain, sid: s.id, level: lv,
          model, color: g.color, pattern,
          name: `${g.colorName}の ${itemsCfg.modelNames[model]}（${itemsCfg.patternNames[pattern]}）`,
          from: `${titles.nameOf(titles.key(g.grade, s.id), lv)}`,
        });
      });
    }
  }

  // クエスト報酬（思考・判断・表現型）：形＝領域、色＝学年、柄＝クエストの番号
  const questNo = new Map();
  for (const q of quests){
    const k = `${q.grade}-${q.domain}`;
    const n = (questNo.get(k) || 0);
    questNo.set(k, n + 1);
    const g = GR.get(q.grade);
    const model = itemsCfg.models.thinking[q.domain];
    const pattern = itemsCfg.questPatterns[n % itemsCfg.questPatterns.length];
    add({
      id: `item_q_${q.id}`, kind: 'thinking',
      grade: q.grade, domain: q.domain, questId: q.id,
      model, color: g?.color ?? '#999999', pattern,
      name: `${g?.colorName ?? ''}の ${itemsCfg.modelNames[model]}（${itemsCfg.patternNames[pattern]}）`,
      from: 'クエスト',
    });
  }

  add({ id: 'item_allclear', kind: 'allclear', model: itemsCfg.models.allClear, color: '#f2c94c', pattern: 'sparkle',
        name: itemsCfg.modelNames[itemsCfg.models.allClear], from: 'ぜんぶ クリア' });

  const itemDef = id => defs.get(id);

  /** 持っている持ち物の id */
  function owned(state){
    const out = new Set(['item_acorn']);
    for (const [k, lv] of Object.entries(state.titleLevels || {})){
      for (const r of REWARD_LV) if (lv >= r){
        const p = titles.parse(k);
        if (p) out.add(`item_t_g${p.grade}_${p.sid}_${r}`);
      }
    }
    for (const q of state.clearedQuests || []) if (defs.has(`item_q_${q}`)) out.add(`item_q_${q}`);
    if (allClear(state).ok) out.add('item_allclear');
    return out;
  }

  /** 持ち物一覧の1学年ぶん（知識・技能／思考・判断・表現に分ける） */
  function catalog(grade){
    const all = [...defs.values()].filter(d => d.grade === grade);
    return {
      knowledge: all.filter(d => d.kind === 'knowledge'),
      thinking:  all.filter(d => d.kind === 'thinking'),
    };
  }

  // ---- ボス挑戦権 ------------------------------------------------------

  /** ボスに挑めるか。足りないものも いっしょに返す（入口に出す） */
  function bossStatus(state, bossId){
    const rule = cfg.bossUnlock[bossId];
    const boss = BO.get(bossId);
    const implemented = !!boss?.file;
    if (!rule) return { ok: false, implemented, reqs: [] };
    const reqs = [];
    for (const r of rule.requireTitles){
      const count = state.defeatCounts?.[r.enemy] || 0;
      const need = titles.thresholds[r.minLevel - 1];
      const p = titles.parse(r.enemy);
      reqs.push({
        kind: 'title', key: r.enemy,
        label: titles.nameOf(r.enemy, r.minLevel),
        enemy: SP.get(p?.sid)?.name ?? r.enemy,
        have: Math.min(count, need), need,
        done: (state.titleLevels?.[r.enemy] || 0) >= r.minLevel,
      });
    }
    if (rule.requireDungeon){
      const d = DU.get(rule.requireDungeon);
      reqs.push({
        kind: 'dungeon', id: rule.requireDungeon,
        label: (d?.name ?? 'この 地方の ダンジョン') + ' クリア',
        exists: !!d,
        done: (state.clearedDungeons || []).includes(rule.requireDungeon),
      });
    }
    return { ok: implemented && reqs.every(r => r.done), implemented, reqs };
  }

  // ---- 全クリア --------------------------------------------------------

  function allClear(state){
    const parts = [
      { key: 'titles',   label: '{称号|しょうごう}',  have: titles.earned(state),                       need: cfg.allClear.titles },
      { key: 'bosses',   label: 'ボス',              have: (state.defeatedBosses || []).length,          need: cfg.allClear.bosses },
      { key: 'quests',   label: 'クエスト',          have: (state.clearedQuests || []).length,           need: quests.length },
      { key: 'dungeons', label: 'ダンジョン',        have: (state.clearedDungeons || []).length,         need: dungeons.length },
    ];
    // 4つの条件が そろったときだけ全クリア（1つでも欠けたら×）
    const ok = parts.every(p => p.need > 0 && p.have >= p.need);
    return { ok, parts };
  }

  return { itemDef, owned, catalog, bossStatus, allClear, defs };
}
