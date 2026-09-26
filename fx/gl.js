// WebGL-часть общего кода: холст Three.js, загрузка фото как текстуры, освобождение холста.
// Нужна только эффектам на Three.js; лёгкие (CSS, 2D-холст) обходятся core.js и библиотеку не тянут.
import * as THREE from 'three';
import { IS_MOBILE } from './core.js';

/** WebGL-холст на всю сцену. Плотность пикселей ограничена: на телефоне 1.5, иначе 2 */
export function makeRenderer(stage, { alpha = false, antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const c = renderer.domElement;
  c.className = 'fx__gl';
  stage.prepend(c);
  return renderer;
}

/** Отпустить WebGL сразу: браузер держит около 16 живых контекстов и молча гасит старые */
export function release(renderer) {
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}

/** Загрузка фото как текстуры (Unsplash отдаёт картинки с CORS) */
export function texture(url, onLoad) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const tex = loader.load(url, (t) => onLoad && onLoad(t));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}
