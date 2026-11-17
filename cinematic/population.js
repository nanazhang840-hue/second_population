/* 第二人口 · 电影展示模式 · 群体对象层
   每个真实候选记录 = 一个独立物体（不复制、不虚构）。
   几何共享缓存（space/objects.js + objects-ext.js），材质逐对象克隆以支持
   确定性亮度显现 / 类别降亮 —— 用亮度而非透明度，避免 63 个透明体的排序伪影。 */
import * as THREE from '../integration/vendor/three-r170.module.js';
import { geometryFor, MATERIAL_SPEC } from '../space/objects.js';
import { extGeometryFor, EXT_KINDS } from './objects-ext.js';
import { categoryById } from './config.js';
import { revealAt, classFocusAt, individualDimAt, range, smooth, mix } from './timeline.js';

const EXT_SPEC = { van: MATERIAL_SPEC.truck, mpv: MATERIAL_SPEC.sedan, taxi: MATERIAL_SPEC.sedan, bikeRack: MATERIAL_SPEC.guardrail };
const specFor = kind => MATERIAL_SPEC[kind] || EXT_SPEC[kind] || MATERIAL_SPEC.kerb;
/* 电影深场专用材质响应：环境贴图接近纯黑，高金属度会砍掉漫反射使物体沦为剪影。
   这里仅在本展示层压低金属度、抬粗糙度与环境强度，让形体在暗场中可读；
   不改动 space/objects.js 的共享参数，监控主站不受影响。 */
const cineSpec = s => ({
  metalness: Math.min(s.metalness, 0.34),
  roughness: Math.min(0.62, Math.max(s.roughness, 0.40)),
  env: s.env * 1.35,
});

export function buildPopulation(scene, nodes, glowTexture) {
  const group = new THREE.Group();
  group.name = 'population';
  const meshes = [];
  const markerPos = [], markerCol = [];

  for (const node of nodes) {
    const geo = EXT_KINDS.includes(node.kind) ? extGeometryFor(node.kind) : geometryFor(node.kind);
    const spec = cineSpec(specFor(node.kind));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: spec.metalness,
      roughness: spec.roughness,
      envMapIntensity: spec.env,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...node.pos);
    mesh.rotation.y = node.ry;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.name = node.id;
    mesh.userData.node = node;
    group.add(mesh);
    meshes.push(mesh);
    node.mesh = mesh; node.mat = mat; node.spec = spec;

    /* 类别标记点：一对象一点，颜色来自统一类别表 */
    const c = new THREE.Color(node.color);
    const h = geo.boundingBox ? (geo.boundingBox.max.y - geo.boundingBox.min.y) : 2;
    markerPos.push(node.pos[0], node.pos[1] + h + 0.9, node.pos[2]);
    markerCol.push(c.r, c.g, c.b);
  }

  const markerGeo = new THREE.BufferGeometry();
  markerGeo.setAttribute('position', new THREE.Float32BufferAttribute(markerPos, 3));
  markerGeo.setAttribute('color', new THREE.Float32BufferAttribute(markerCol, 3));
  const markerMat = new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const markers = new THREE.Points(markerGeo, markerMat);
  markers.name = 'category-markers';
  markers.frustumCulled = false;
  group.add(markers);

  /* 主角车灯柔光晕：替代后期 bloom，仅在近景出现 */
  const hero = nodes.find(n => n.hero);
  const lamps = [];
  if (hero) {
    for (const sx of [-0.58, 0.58]) {
      const sm = new THREE.SpriteMaterial({ map: glowTexture, color: '#ffd9a4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(sm);
      sp.scale.set(1.15, 1.15, 1);
      sp.position.set(sx, 0.66, 2.34);
      hero.mesh.add(sp);
      lamps.push(sp);
    }
  }

  scene.add(group);

  function update(t) {
    const indiv = individualDimAt(t);
    const markerOpacity = 0.42 * smooth(range(t, 48, 52)) * (1 - smooth(range(t, 73, 76)));
    markerMat.opacity = markerOpacity;
    markers.visible = markerOpacity > 0.01;
    for (const node of nodes) {
      const rev = revealAt(t, node);
      const focus = classFocusAt(t, node.cat);
      const dim = node.hero ? 1 : indiv;
      const b = rev * focus * dim;
      node.mat.color.setScalar(b);
      node.mat.envMapIntensity = node.spec.env * b;
      /* 直接光高光不受 color 影响：类别降亮时同步压低 specular，
         否则被降亮类别仍会因主光镜面反射而“发亮”，削弱类别分离。 */
      node.mat.specularIntensity = b;
      node.mesh.visible = b > 0.004;
    }
    if (hero) {
      const near = 1 - smooth(range(t, 30, 36));
      const on = revealAt(t, hero) * near;
      for (const sp of lamps) sp.material.opacity = 0.5 * on;
    }
    return { markerOpacity };
  }

  function dispose() {
    for (const m of meshes) m.material.dispose();
    markerGeo.dispose(); markerMat.dispose();
    for (const sp of lamps) sp.material.dispose();
    scene.remove(group);
  }

  return { group, meshes, markers, nodes, hero, update, dispose };
}