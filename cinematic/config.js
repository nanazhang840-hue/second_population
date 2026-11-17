/* 第二人口 · 电影展示模式 · 统一设计变量
   所有颜色 / 间距 / 镜头 / 时间参数只在这里与 universe-structure.js 定义，
   其余模块一律读取，不在绘制代码里散落硬编码。 */
import { universeCategories, universeCategory } from '../integration/universe-structure.js';

export const DESIGN = Object.freeze({
  bg: '#080B0E',
  bgSecondary: '#10161B',
  panel: '#151D23',
  text: '#E8EEF1',
  textSecondary: '#AAB6BD',
  textDim: '#6C7A82',
  line: 'rgba(170,182,189,0.22)',
  accent: '#9FC6CC',
  /* 监控取证层：黑白 + 极淡冷调 */
  cctvTint: '#B9C4C9',
  boxHero: '#D8E2E6',
  boxContext: 'rgba(170,182,189,0.42)',
});

/* 类别与配色唯一来源：integration/universe-structure.js（展示层派生，不改原始 category） */
export const CATEGORIES = universeCategories.filter(c => c.id !== 'unknown');
export const categoryOf = universeCategory;
export const categoryById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

/* 画布：固定 1920×1080 内部分辨率，CSS 缩放适配视口，保证 16:9 无内黑边 */
export const FRAME = Object.freeze({ w: 1920, h: 1080, aspect: 16 / 9 });

/* 90 秒主线 · 八章 */
export const CHAPTERS = Object.freeze([
  { id: 1, key: 'discovery',      en: 'DISCOVERY',      cn: '发现', start: 0,  end: 10, sub: '从一段城市影像开始。' },
  { id: 2, key: 'extraction',     en: 'EXTRACTION',     cn: '提取', start: 10, end: 22, sub: '让原本作为背景的物体，成为观察对象。' },
  { id: 3, key: 'transition',     en: 'TRANSITION',     cn: '进入', start: 22, end: 32, sub: '一个物体，进入新的观察视角。' },
  { id: 4, key: 'expansion',      en: 'EXPANSION',      cn: '扩展', start: 32, end: 48, sub: '它并不是一个孤立的对象。' },
  { id: 5, key: 'population',     en: 'POPULATION',     cn: '群体', start: 48, end: 64, sub: '它们共同构成一个庞大的工业物群体。' },
  { id: 6, key: 'classification', en: 'CLASSIFICATION', cn: '类别', start: 64, end: 74, sub: '不同类别，共同构成第二人口。' },
  { id: 7, key: 'individual',     en: 'INDIVIDUAL',     cn: '个体', start: 74, end: 83, sub: '每一个对象，都有自己的身份。' },
  { id: 8, key: 'archive',        en: 'ARCHIVE',        cn: '档案', start: 83, end: 90, sub: '' },
]);
export const DURATION = 90;

/* 主角：与开场监控证据、取证缩略图、能耗档案同一身份 */
export const HERO_ID = 'SP-ST4-0012';
export const HERO_SCENE = 'street4';
export const HERO_TRACK = 17;           // data/detections/match-v2.json 绑定 trackId
export const HERO_VIDEO = 'street_census/site/street_04.mp4';
export const HERO_DETECTIONS = 'data/detections/street_04.json';

/* 监控源时间映射（timeline 秒 → 视频秒）。确定性、可 seek、可重播。 */
export const SOURCE_TIME_KEYS = Object.freeze([
  [0, 1.6], [3, 3.2], [7, 5.2], [10, 6.0], [13, 6.5], [22, 6.5],
]);
export const FREEZE_T = 13;             // 此后画面冻结，进入遮罩提取
/* 匹配转场改为“压黑衔接”：取证板先淡出至黑（18.5–20.6），三维主角再从黑中浮现
   （20.4–23.2），避免照片与模型半透明叠影造成的双重曝光伪影。 */
export const PLATE_FADE = [18.5, 20.6];

/* 空间布局：类别区域倾向 + 前中远三层；真实物理尺度，不复制对象 */
export const FIELD = Object.freeze({
  vehicles:           { center: [0, 0.6, -10],  radii: [38, 7.5, 22] },
  signage:            { center: [30, 2.0, -16], radii: [6.5, 4.0, 5.5] },
  lighting:           { center: [-34, 6.0, -18], radii: [7, 5, 6] },
  'street-equipment': { center: [-27, -4.0, 6], radii: [9, 4, 6] },
  ground:             { center: [25, -6.0, 6],  radii: [12, 4, 8] },
});
export const FIELD_CENTER = [-3, 0.6, -9];

/* 雾：近景浓、远景薄，随镜头距离确定性变化 */
export const FOG = Object.freeze({ color: '#080B0E', close: 0.0105, wide: 0.0042 });

/* 群体显现：按与主角的距离分带，逐层从黑暗中浮现（亮度渐变，非透明排序） */
export const REVEAL = Object.freeze({ start: 32, bandStep: 3.0, jitter: 1.4, dur: 3.6, heroIn: [20.4, 23.2] });

/* 类别观察窗（CH06）：每次只突出一个类别，其余降亮但不隐藏 */
export const CLASS_WINDOW = Object.freeze({ start: 64, each: 2.0, dim: 0.26, fade: 0.45 });

export const SUBTITLE_STYLE = Object.freeze({ in: 0.7, out: 0.7 });