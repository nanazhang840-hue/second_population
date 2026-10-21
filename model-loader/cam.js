/* cam.js — 相机与投影（通用物体模型引擎用）
   提供 window.Cam：
     rotate(p, yaw, pitch)          绕 Y 轴 + 俯仰旋转（点与法线通用）
     project(p, yaw, pitch, ...)     透视投影到画布坐标
   与 handoff-v7 的投影数学保持同一套语言。
*/
(function () {
  "use strict";
  const TAU = Math.PI * 2;

  function rotate(p, yaw, pitch) {
    pitch = pitch || 0;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x = p[0] * cy + p[2] * sy;
    const z = -p[0] * sy + p[2] * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
  }

  function project(p, yaw, pitch, scale, cx, cy, dist) {
    const q = rotate(p, yaw, pitch);
    const f = dist / (dist - q[2]);
    return [cx + q[0] * scale * f, cy - q[1] * scale * f, q[2]];
  }

  /* 面片排序用的深度（相机空间 z，越大越靠近观察者） */
  function depth(p, yaw, pitch) {
    return rotate(p, yaw, pitch)[2];
  }

  window.Cam = { rotate, project, depth, TAU };
})();
