// Общее для эффектов полки: цикл кадров, размер, указатель, стили, шум. Без Three.js: лёгкие эффекты
// (CSS, 2D-холст) берут только этот файл и 3D-библиотеку не грузят. WebGL-часть — в gl.js.
// Каждый эффект — модуль с mount(stage) → { start, stop, setProgress?, destroy }.
export const IS_MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Цикл кадров. При «уменьшить движение» время стоит — кадр рисуется, но не двигается сам */
export function loop(draw) {
  let raf = 0, last = 0, t = 0, running = false;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!REDUCED) t += dt;
    draw(t, dt);
    if (running) raf = requestAnimationFrame(frame);
  };
  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    once() { draw(t, 0); },
    get time() { return t; },
  };
}

/** Следить за размером сцены */
export function watchSize(stage, cb) {
  const ro = new ResizeObserver(() => cb(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)));
  ro.observe(stage);
  cb(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
  return () => ro.disconnect();
}

/** Указатель над сценой: x, y от −1 до 1 (y вверх), u, v от 0 до 1; active — пока внутри.
 *  Один на сцену: эффект, выгруженный и загруженный заново, не навешивает слушателей второй раз */
export function pointer(stage) {
  if (stage.__ptr) return stage.__ptr;
  const p = { x: 0, y: 0, u: 0.5, v: 0.5, active: false, moved: 0 };
  stage.__ptr = p;
  const set = (e) => {
    const r = stage.getBoundingClientRect();
    p.u = (e.clientX - r.left) / r.width;
    p.v = 1 - (e.clientY - r.top) / r.height;
    p.x = p.u * 2 - 1;
    p.y = p.v * 2 - 1;
    p.active = true;
    p.moved = performance.now();
  };
  const host = stage.closest('.fx') || stage;
  host.addEventListener('pointermove', set, { passive: true });
  host.addEventListener('pointerdown', set, { passive: true });
  host.addEventListener('pointerleave', () => { p.active = false; });
  return p;
}

/** Мягкое приближение к цели: одинаково на любой частоте кадров */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Стили эффекта кладутся самим эффектом — один раз на страницу: файл эффекта переносится на сайт целиком */
export function css(id, text) {
  if (document.querySelector('style[data-fx-css="' + id + '"]')) return;
  const s = document.createElement('style');
  s.dataset.fxCss = id;
  s.textContent = text;
  document.head.appendChild(s);
}

// Симплекс-шум 3D (Ian McEwan, Ashima Arts, лицензия MIT) — ветер, жидкость, металл
export const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const unsplash = (id, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
