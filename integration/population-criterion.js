/* 第二人口判据：只提供文案映射，不改动任何识别数据、类别 id 或配色。 */
(function () {
  'use strict';
  const definition = '第二人口：城市里承担了一件原本由人承担的事的人造物。';
  const criterion = '判据：它替人做了一件具体的事——走、看、指路、维持秩序、划线。';

  const groups = {
    vehicles: { id: 'vehicles', role: '替人走', human: '位移', text: '把人和货从一处送到另一处。' },
    signage: { id: 'signage', role: '替人指路', human: '指引', text: '告诉人往哪走、哪里可停。' },
    lighting: { id: 'lighting', role: '替人看', human: '守夜', text: '在没有人的时段看着街道。' },
    'street-equipment': { id: 'street-equipment', role: '替人维持秩序', human: '秩序', text: '拦住、隔开、看管停放。' },
    ground: { id: 'ground', role: '替人划线', human: '边界', text: '标出哪里能走、哪里不能走。' },
    unknown: { id: 'unknown', role: '待判据核验', human: '—', text: '原始标签没有说明它替人做什么。' }
  };

  const person = { id: 'person', role: '人本人', human: '驾驶', text: '人在这里操作车辆，不属于第二人口。' };
  const manhole = { id: 'ground', role: '替人封口', human: '封护', text: '封住地下的入口，替人看守。' };
  const rules = [
    { test: /MANHOLE|COVER|GRATE/, item: manhole },
    { test: /KERB|LANE MARK|ARROW|MARKING/, item: groups.ground },
    { test: /METRO SIGN|GANTRY SIGN|SIGN|BANNER|ARROW SIGN/, item: groups.signage },
    { test: /CAMERA POLE|LUMINAIRE|STREETLIGHT|LAMP|LIGHT/, item: groups.lighting },
    { test: /BARRIER|GUARDRAIL|FENCE|BIKE RACK|BOLLARD/, item: groups['street-equipment'] }
  ];

  function upper(value) { return String(value || '').toUpperCase(); }

  function categoryId(record) {
    if (!record) return 'unknown';
    if (record.universeCategoryId) return record.universeCategoryId;
    if (record.category === 'person') return 'person';
    if (record.category === 'vehicle') return 'vehicles';
    const label = upper(record.labelEn || record.label);
    for (const rule of rules) if (rule.test.test(label)) return rule.item.id;
    return 'unknown';
  }

  function of(record) {
    if (!record) return null;
    if (record.category === 'person') return person;
    const label = upper(record.labelEn || record.label);
    for (const rule of rules) if (rule.test.test(label)) return rule.item;
    return groups[categoryId(record)] || groups.unknown;
  }

  function group(id) { return groups[id] || groups.unknown; }

  window.PopulationCriterion = { definition, criterion, groups, of, group };
})();
