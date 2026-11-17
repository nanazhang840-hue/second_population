/* 深场布展（对照参考图重做）
   一条中轴、六排纵深、左右错位；体量分五级；玻璃展台只给中小件，
   大型件（车、巴士、门架、护栏）直接落在低黑台上，避免"全都装盒子"的平均感。 */

export const CLASS_META = {
  vehicles: { cn: '交通工具', en: 'VEHICLE', color: '#9db9be' },
  lighting: { cn: '照明与监测', en: 'INFRASTRUCTURE', color: '#b3aec4' },
  signage: { cn: '导向与标识', en: 'SIGNAGE', color: '#c4cbc6' },
  barriers: { cn: '围护与隔离', en: 'BARRIER', color: '#8ea3b6' },
  ground: { cn: '地表设施', en: 'SURFACE', color: '#a5baad' },
  facility: { cn: '城市设备', en: 'PUBLIC FACILITY', color: '#b9a893' }
};

/* 每类物体的占地尺寸（米），用于生成展台与接触阴影 */
export const FOOT = {
  sedan: [4.9, 2.1], suv: [4.9, 2.3], truck: [6.8, 2.6], bus: [11.4, 2.9], coach: [11.4, 2.9],
  streetlight: [1.4, 1.4], cameraPole: [1.8, 1.2],
  gantry: [10.2, 1.5], metroSign: [1.9, 1.1], banner: [3.8, 0.9], standSign: [1.2, 1.2],
  jersey: [1.0, 2.4], guardrail: [6.8, 0.9], fence: [4.9, 0.9],
  kerb: [3.9, 1.0], manhole: [2.0, 2.0], laneMark: [3.6, 1.9], arrow: [3.6, 1.9], grate: [1.5, 1.0],
  cone: [0.55, 0.55], acUnit: [0.88, 0.58], cabinet: [1.3, 0.85], vending: [1.2, 0.9], boiler: [0.9, 0.9]
};

/* plinth: 'glass' = 0.62m 玻璃展台；'low' = 0.10m 黑色台座 */
export const OBJECTS = [
  /* 第一排 · 近景被切掉一角的小件，做前景锚点 */
  { id: 'A-01', cls: 'facility', kind: 'acUnit', x: -2.6, z: -1.4, ry: 0.10, plinth: 'glass' },
  { id: 'A-02', cls: 'signage', kind: 'standSign', x: -5.0, z: -3.0, ry: 0.16, plinth: 'glass' },
  { id: 'A-03', cls: 'ground', kind: 'cone', x: 1.9, z: -1.0, ry: 0.3, plinth: 'glass' },

  /* 第二排 · 左右各一件，中间留空 */
  /* 售货机原来在 (4.6,-3.4)：相机→巴士左flank的视线正好穿过它，遮掉巴士 15% 剪影。
     按"移动遮挡物、不动被挡件"的原则把它移到 (3.4,-4.6)：屏幕矩形 1277–1454，
     整块落在巴士矩形（1463–1789）之外，且与主位轿车、护栏、锅炉的展台占地都不相交。 */
  { id: 'A-04', cls: 'facility', kind: 'vending', x: 3.4, z: -4.6, ry: -0.14, plinth: 'glass', scale: 0.85 },
  { id: 'A-05', cls: 'facility', kind: 'cabinet', x: -4.9, z: -0.2, ry: 0.05, plinth: 'glass' },

  /* 第三排 · 主位（参考图里那辆正对镜头的车） */
  { id: 'A-06', cls: 'vehicles', kind: 'sedan', x: -0.2, z: -4.6, ry: 0.02, plinth: 'low', hero: true },
  { id: 'A-07', cls: 'lighting', kind: 'cameraPole', x: -6.0, z: -4.4, ry: 0.12, plinth: 'low' },

  /* 第四排 */
  { id: 'A-08', cls: 'vehicles', kind: 'truck', x: -5.9, z: -11.4, ry: 0.06, plinth: 'low' },
  { id: 'A-09', cls: 'facility', kind: 'boiler', x: 2.5, z: -9.4, ry: 0.12, plinth: 'glass' },
  /* 原在 (5.2,-9.9)：正好压在相机→地铁牌立杆的连线上（沿线 x≈5.19），
     挡掉标识 970 px。左移到 4.0 让开这条视线，同时保住第四排右组的间距。 */
  { id: 'A-10', cls: 'facility', kind: 'acUnit', x: 4.0, z: -9.9, ry: -0.22, plinth: 'glass' },

  /* 第五排 */
  { id: 'A-11', cls: 'vehicles', kind: 'suv', x: -2.4, z: -15.4, ry: -0.05, plinth: 'low' },
  { id: 'A-12', cls: 'facility', kind: 'cabinet', x: 3.6, z: -15.8, ry: 0.18, plinth: 'glass' },
  { id: 'A-13', cls: 'lighting', kind: 'streetlight', x: -6.8, z: -15.0, ry: 0.02, plinth: 'low' },
  { id: 'A-14', cls: 'signage', kind: 'metroSign', x: 6.2, z: -14.8, ry: -0.16, plinth: 'glass' },

  /* 第六排 · 远景，靠体量独立成立 */
  { id: 'A-15', cls: 'vehicles', kind: 'bus', x: 11.2, z: -27.0, ry: 0.06, plinth: 'low' },
  { id: 'A-17', cls: 'barriers', kind: 'fence', x: 7.4, z: -21.4, ry: -0.10, plinth: 'low' },
  { id: 'A-18', cls: 'barriers', kind: 'jersey', x: -7.6, z: -21.8, ry: 0.18, plinth: 'low' },
  { id: 'A-19', cls: 'ground', kind: 'grate', x: 4.9, z: -6.6, ry: 0.10, plinth: 'glass' },
  { id: 'A-20', cls: 'barriers', kind: 'guardrail', x: 7.2, z: -9.2, ry: Math.PI / 2, plinth: 'low' },

  /* 补足的空调机组：参考图里数量最多的一种，负责把中远景的排布填密 */
  { id: 'A-21', cls: 'facility', kind: 'acUnit', x: -1.9, z: -9.2, ry: -0.08, plinth: 'glass' },
  { id: 'A-22', cls: 'facility', kind: 'acUnit', x: 7.4, z: -14.2, ry: 0.24, plinth: 'glass' },
  { id: 'A-23', cls: 'facility', kind: 'acUnit', x: -8.6, z: -9.8, ry: 0.14, plinth: 'glass' },
  { id: 'A-24', cls: 'facility', kind: 'cabinet', x: -2.2, z: -20.2, ry: -0.12, plinth: 'glass' },
  { id: 'A-25', cls: 'facility', kind: 'acUnit', x: 1.6, z: -19.6, ry: 0.06, plinth: 'glass' }
];

export const HERO_ID = 'A-06';

export const PLINTH = {
  glass: { h: 0.62, inset: 0.34, base: 0.055 },
  low: { h: 0.10, inset: 0.26, base: 0.0 }
};
