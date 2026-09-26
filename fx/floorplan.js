// «Планировка в 3D» — чертёж квартиры при прокрутке встаёт в объём: растут стены, полы получают паркет и плитку,
// в комнаты встаёт мебель, в конце — облёт. Планировка задана данными (стены, проёмы, мебель); Three.js, подписи — HTML.
// Копия эффекта № 40 с полки lab/effects для сайта Alyonaa Design (26.09): подписи на русском и английском —
// следуют языку сайта (атрибут lang у <html>), итоговая карточка — шрифтом сайта (Spectral).
import * as THREE from 'three';
import { loop, watchSize, pointer, damp, css, IS_MOBILE } from './core.js';
import { makeRenderer, release } from './gl.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// квартира в метрах: x — на восток, y — на север; море — на юге, за балконом
const WALL_H = 2.5;
const BOX = [-0.25, -1.29, 9.57, 6.77];                              // вся квартира с балконом
const OUTLINE = [[-0.25, -1.29], [9.57, -1.29], [9.57, 4.25], [7.77, 4.25], [7.77, 6.77], [-0.25, 6.77]];   // без лестничного узла
const WALLS = [
  // наружные: юг (к морю) — панорамная дверь гостиной и окно спальни, запад — окно кухни, север — вход, восток — окно спальни
  { r: [-0.25, -0.25, 9.57, 0], ops: [[0.6, 5.0, 'win', 0], [6.3, 8.8, 'win', 0.6]] },
  { r: [-0.25, 0, 0, 6.77], ops: [[0.9, 2.4, 'win', 0.9]] },
  { r: [0, 6.52, 7.77, 6.77], ops: [[3.4, 4.3, 'door']] },
  { r: [9.32, 0, 9.57, 4.25], ops: [[1.1, 2.9, 'win', 0.9]] },
  { r: [7.64, 4.0, 9.32, 4.25], ops: [] },
  { r: [7.52, 4.0, 7.77, 6.52], ops: [] },
  // перегородки
  { r: [5.6, 0, 5.72, 4.0], ops: [[2.9, 3.7, 'door']] },
  { r: [0, 4.0, 7.52, 4.12], ops: [[3.0, 4.6, 'open'], [6.0, 6.8, 'door']] },
  { r: [2.2, 4.12, 2.32, 6.52], ops: [[4.6, 5.3, 'door']] },
  { r: [5.6, 4.12, 5.72, 6.52], ops: [] },
];
// двери: петля, направление закрытой створки, направление открытой (внутрь комнаты), ширина
const DOORS = [[3.4, 6.52, 1, 0, 0, -1, 0.9], [5.72, 3.7, 0, -1, 1, 0, 0.8], [6.0, 4.12, 1, 0, 0, 1, 0.8], [2.2, 4.6, 0, 1, -1, 0, 0.7]];
// комнаты: название, площадь (посчитана по размерам ниже: в сумме 64,0 м²), центр подписи
const ROOMS = [
  [{ ru: 'Кухня-гостиная', en: 'Kitchen-living room' }, 5.6 * 4.0, 2.8, 1.25], [{ ru: 'Спальня', en: 'Bedroom' }, 3.6 * 4.0, 7.52, 1.1],
  [{ ru: 'Прихожая', en: 'Hall' }, 3.28 * 2.4, 3.96, 5.32], [{ ru: 'Ванная', en: 'Bathroom' }, 2.2 * 2.4, 1.1, 5.0],
  [{ ru: 'Гардероб', en: 'Wardrobe' }, 1.8 * 2.4, 6.62, 5.32], [{ ru: 'Балкон', en: 'Balcony' }, 9.32 * 1.04, 4.66, -0.77],
];
// размерные линии: откуда, куда, длина в метрах (подпись собирается на языке сайта)
const DIMS = [[0, -1.9, 5.6, -1.9, 5.6], [5.72, -1.9, 9.32, -1.9, 3.6], [-1.05, 0, -1.05, 4.0, 4.0], [-1.05, 4.12, -1.05, 6.52, 2.4]];
// итоговая карточка в конце облёта
const SUM = {
  ru: '<b>2 комнаты · <i>64 м²</i></b>Планировка и 3D-визуализация',
  en: '<b>2 rooms · <i>64 m²</i></b>Layout plan and 3D visualisation',
};
const ACCENT = '#c8643b';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const lang = () => ((document.documentElement.lang || 'ru').slice(0, 2) === 'en' ? 'en' : 'ru');
const num = (v, lg) => (lg === 'en' ? v.toFixed(1) : v.toFixed(1).replace('.', ','));
const area = (a, lg) => num(a, lg) + (lg === 'en' ? ' m²' : ' м²');

/** Мебель: [комната, x, y, ширина по x, глубина по y, высота, низ, цвет, скругление] — позиции в плане */
function furniture() {
  const L = [], add = (room, x, y, w, d, h, y0, c, r = 0.04) => L.push({ room, x, y, w, d, h, y0, c, r });
  // кухня-гостиная: диван-акцент, столик на ковре, обеденный стол со стульями, кухня углом, растение
  add(0, 4.25, 1.8, 2.6, 1.9, 0.015, 0, '#e4dccd', 0.005);
  add(0, 4.25, 2.78, 2.1, 0.86, 0.36, 0.06, ACCENT, 0.06); add(0, 4.25, 3.12, 2.1, 0.2, 0.46, 0.34, ACCENT, 0.07);
  add(0, 3.3, 2.72, 0.2, 0.9, 0.24, 0.36, ACCENT, 0.07); add(0, 5.2, 2.72, 0.2, 0.9, 0.24, 0.36, ACCENT, 0.07);
  add(0, 3.78, 2.66, 0.9, 0.66, 0.1, 0.42, '#d77552', 0.05); add(0, 4.72, 2.66, 0.9, 0.66, 0.1, 0.42, '#d77552', 0.05);
  add(0, 4.25, 1.55, 1.0, 0.55, 0.06, 0.34, '#b98a5e', 0.02); add(0, 4.25, 1.55, 0.9, 0.45, 0.34, 0, '#8f6a48', 0.02);
  add(0, 1.6, 1.95, 1.4, 0.8, 0.04, 0.72, '#c29467', 0.015);
  for (const [dx, dy] of [[-0.45, -0.56], [0.45, -0.56], [-0.45, 0.56], [0.45, 0.56]]) {
    add(0, 1.6 + dx, 1.95 + dy, 0.44, 0.42, 0.06, 0.44, '#d6cfc3', 0.03);
    add(0, 1.6 + dx, 1.95 + dy + (dy > 0 ? 0.19 : -0.19), 0.44, 0.05, 0.42, 0.48, '#d6cfc3', 0.02);
  }
  add(0, 1.6, 1.95, 1.2, 0.6, 0.72, 0, '#a47c56', 0.02);
  add(0, 1.4, 3.68, 2.7, 0.6, 0.86, 0, '#efebe4', 0.02); add(0, 1.4, 3.68, 2.74, 0.64, 0.04, 0.86, '#3e3c3e', 0.01);
  add(0, 0.35, 3.0, 0.6, 0.62, 2.1, 0, '#e9e5dd', 0.02);
  add(0, 5.1, 0.7, 0.8, 0.8, 0.42, 0.04, '#a9b39e', 0.1); add(0, 5.1, 0.98, 0.8, 0.22, 0.4, 0.4, '#a9b39e', 0.08);
  // спальня: кровать с одеялом и подушками, тумбы, банкетка
  add(1, 7.8, 2.95, 1.64, 2.04, 0.3, 0, '#d4cabd', 0.05); add(1, 7.8, 2.95, 1.58, 1.98, 0.18, 0.3, '#f7f5f1', 0.06);
  add(1, 7.8, 2.45, 1.66, 1.2, 0.07, 0.46, '#9fb0bb', 0.03);
  add(1, 7.42, 3.62, 0.62, 0.36, 0.13, 0.46, '#fbfaf8', 0.06); add(1, 8.18, 3.62, 0.62, 0.36, 0.13, 0.46, '#fbfaf8', 0.06);
  add(1, 7.8, 3.95, 1.74, 0.08, 1.0, 0, '#c7bcac', 0.03);
  add(1, 6.72, 3.7, 0.46, 0.4, 0.5, 0, '#b98a5e', 0.03); add(1, 8.88, 3.7, 0.46, 0.4, 0.5, 0, '#b98a5e', 0.03);
  add(1, 7.8, 1.55, 1.3, 0.4, 0.42, 0.04, '#a9b39e', 0.06);
  // ванная: ванна, тумба с раковиной, унитаз
  add(3, 0.92, 6.12, 1.7, 0.72, 0.56, 0, '#fbfbfa', 0.08); add(3, 0.92, 6.12, 1.5, 0.52, 0.02, 0.555, '#dce9ee', 0.1);
  add(3, 0.3, 4.75, 0.5, 0.9, 0.8, 0, '#b98a5e', 0.02); add(3, 0.3, 4.75, 0.42, 0.6, 0.06, 0.8, '#fbfbfa', 0.03);
  add(3, 1.92, 5.35, 0.52, 0.38, 0.4, 0, '#fbfbfa', 0.12);
  // прихожая и гардероб
  add(2, 5.38, 5.2, 0.38, 1.4, 0.9, 0, '#efebe4', 0.02); add(2, 2.85, 6.25, 0.9, 0.36, 0.44, 0, '#b98a5e', 0.03);
  add(4, 6.62, 6.26, 1.74, 0.48, 2.0, 0, '#e6e1d8', 0.02); add(4, 7.26, 5.07, 0.48, 1.7, 2.0, 0, '#e6e1d8', 0.02);
  // балкон: два кресла и столик
  add(5, 1.9, -0.8, 0.62, 0.62, 0.4, 0, '#d6cfc3', 0.1); add(5, 3.3, -0.8, 0.62, 0.62, 0.4, 0, '#d6cfc3', 0.1);
  add(5, 2.6, -0.8, 0.46, 0.46, 0.45, 0, '#b98a5e', 0.2);
  return L;
}
const PLANTS = [[0, 0.45, 0.45, 1.0], [1, 9.0, 0.4, 0.8], [5, 8.9, -0.8, 0.9], [5, 0.3, -0.8, 0.7]];

/** Паркет, плитка, доска на балконе и мягкое затемнение у стен — одна текстура на всю квартиру */
function floorCanvas(px) {
  const [x0, y0, x1, y1] = BOX, W = Math.round((x1 - x0) * px), Hh = Math.round((y1 - y0) * px);
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  const X = (x) => (x - x0) * px, Y = (y) => (y1 - y) * px;
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rect = (a, b, c2, d) => [X(a), Y(d), (c2 - a) * px, (d - b) * px];
  // дубовые доски вдоль комнаты
  const oak = (a, b, c2, d) => {
    g.save(); g.beginPath(); g.rect(...rect(a, b, c2, d)); g.clip();
    const bw = 0.19 * px;
    for (let yy = Y(d); yy < Y(b); yy += bw) {
      let xx = X(a) - rnd() * 1.4 * px;
      while (xx < X(c2)) {
        const len = (1.1 + rnd() * 0.9) * px, tone = 0.86 + rnd() * 0.14;
        g.fillStyle = `rgb(${Math.round(205 * tone)},${Math.round(166 * tone)},${Math.round(122 * tone)})`;
        g.fillRect(xx, yy, len, bw);
        g.strokeStyle = 'rgba(110,80,50,.10)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { const gy = yy + bw * (0.15 + rnd() * 0.7); g.beginPath(); g.moveTo(xx, gy); g.bezierCurveTo(xx + len * 0.3, gy + (rnd() - 0.5) * 4, xx + len * 0.7, gy + (rnd() - 0.5) * 4, xx + len, gy); g.stroke(); }
        g.strokeStyle = 'rgba(90,62,38,.35)'; g.strokeRect(xx + 0.5, yy + 0.5, len - 1, bw - 1);
        xx += len;
      }
    }
    g.restore();
  };
  const tiles = (a, b, c2, d, tw, th, col, grout) => {
    g.save(); g.beginPath(); g.rect(...rect(a, b, c2, d)); g.clip();
    g.fillStyle = col; g.fillRect(...rect(a, b, c2, d));
    g.strokeStyle = grout; g.lineWidth = Math.max(1, px * 0.006);
    for (let x = a; x < c2 + tw; x += tw) { g.beginPath(); g.moveTo(X(x), Y(d)); g.lineTo(X(x), Y(b)); g.stroke(); }
    for (let y = b; y < d + th; y += th) { g.beginPath(); g.moveTo(X(a), Y(y)); g.lineTo(X(c2), Y(y)); g.stroke(); }
    g.restore();
  };
  g.fillStyle = '#e9e4dc'; g.fillRect(0, 0, W, Hh);
  oak(0, 0, 9.32, 4.0); oak(2.32, 4.12, 7.52, 6.52); oak(2.9, 3.9, 4.8, 4.2);
  tiles(0, 4.12, 2.2, 6.52, 0.3, 0.6, '#dedcd6', 'rgba(150,146,138,.6)');
  tiles(-0.25, -1.29, 9.57, -0.25, 0.14, 2, '#b3a595', 'rgba(90,76,62,.45)');
  // тень у стен: стены чёрным на отдельном холсте, размыть, наложить умножением
  const m = document.createElement('canvas');
  m.width = W; m.height = Hh;
  const mg = m.getContext('2d');
  mg.fillStyle = '#fff'; mg.fillRect(0, 0, W, Hh);
  mg.filter = `blur(${Math.round(px * 0.09)}px)`;
  mg.fillStyle = '#000';
  for (const w of WALLS) mg.fillRect(...rect(...w.r));
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.45;
  g.drawImage(m, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return c;
}

/** Чертёж: стены заливкой, окна тремя линиями, двери дугами, размерные линии — на прозрачном холсте побольше квартиры */
const PLAN = [-2.2, -3.0, 11.2, 8.0];
function planCanvas(px) {
  const [x0, y0, x1, y1] = PLAN, W = Math.round((x1 - x0) * px), Hh = Math.round((y1 - y0) * px);
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  const X = (x) => (x - x0) * px, Y = (y) => (y1 - y) * px;
  const ink = '#26252b', lw = Math.max(1, px * 0.012);
  g.lineCap = 'round';
  // стены: тёмная заливка, в проёмах окон — тонкие линии стекла
  for (const w of WALLS) {
    const [a, b, c2, d] = w.r, hor = c2 - a > d - b;
    const cuts = w.ops.map(([f, t]) => [f, t]).sort((p, q) => p[0] - q[0]);
    let from = hor ? a : b;
    const piece = (f, t) => { if (t - f < 1e-3) return; g.fillStyle = ink; if (hor) g.fillRect(X(f), Y(d), (t - f) * px, (d - b) * px); else g.fillRect(X(a), Y(t), (c2 - a) * px, (t - f) * px); };
    for (const [f, t] of cuts) { piece(from, f); from = t; }
    piece(from, hor ? c2 : d);
    for (const [f, t, type] of w.ops) {
      if (type !== 'win') continue;
      g.strokeStyle = ink; g.lineWidth = lw * 0.7;
      for (const k of [0, 0.5, 1]) {
        g.beginPath();
        if (hor) { const yy = Y(b + (d - b) * k); g.moveTo(X(f), yy); g.lineTo(X(t), yy); } else { const xx = X(a + (c2 - a) * k); g.moveTo(xx, Y(f)); g.lineTo(xx, Y(t)); }
        g.stroke();
      }
    }
  }
  // двери: створка и дуга открывания
  g.lineWidth = lw * 0.8;
  for (const [hx, hy, cx, cy, ox, oy, w] of DOORS) {
    g.strokeStyle = ink;
    g.beginPath(); g.moveTo(X(hx), Y(hy)); g.lineTo(X(hx + ox * w), Y(hy + oy * w)); g.stroke();
    const a0 = Math.atan2(-cy, cx), a1 = Math.atan2(-oy, ox);
    let d = a1 - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    g.setLineDash([px * 0.05, px * 0.04]);
    g.beginPath(); g.arc(X(hx), Y(hy), w * px, a0, a1, d < 0); g.stroke();
    g.setLineDash([]);
  }
  // балкон: стеклянное ограждение
  g.strokeStyle = ink; g.lineWidth = lw * 0.7;
  g.strokeRect(X(-0.25), Y(-0.25), 9.82 * px, 1.04 * px);
  // размерные линии с засечками и выносными линиями
  g.lineWidth = lw * 0.6;
  for (const [a, b, c2, d] of DIMS) {
    g.strokeStyle = 'rgba(38,37,43,.8)';
    g.beginPath(); g.moveTo(X(a), Y(b)); g.lineTo(X(c2), Y(d)); g.stroke();
    for (const [px2, py2] of [[a, b], [c2, d]]) {
      g.beginPath(); g.moveTo(X(px2) - 6, Y(py2) + 6); g.lineTo(X(px2) + 6, Y(py2) - 6); g.stroke();
      g.strokeStyle = 'rgba(38,37,43,.35)';
      g.beginPath();
      if (b === d) { g.moveTo(X(px2), Y(py2) - 10); g.lineTo(X(px2), Y(py2 > -0.5 ? 0 : -0.25) + 2); } else { g.moveTo(X(px2) + 10, Y(py2)); g.lineTo(X(-0.25) - 2, Y(py2)); }
      g.stroke();
      g.strokeStyle = 'rgba(38,37,43,.8)';
    }
  }
  return c;
}

/** Бумага с сеткой и море за балконом — земля под макетом */
function groundCanvas() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f1ede6'; g.fillRect(0, 0, S, S);
  const m = S / 40;                                                  // холст — 40 × 40 м, центр — центр квартиры
  for (let i = 0; i <= 40; i++) {
    g.strokeStyle = i % 5 ? 'rgba(90,80,70,.06)' : 'rgba(90,80,70,.12)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(i * m, 0); g.lineTo(i * m, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * m); g.lineTo(S, i * m); g.stroke();
  }
  // море: от 6 м к югу от балкона, акварельная полоса и тонкие волны
  const top = S / 2 + (2.74 + 1.29 + 3.2) * m;
  const grd = g.createLinearGradient(0, top, 0, S);
  grd.addColorStop(0, 'rgba(126,178,196,.0)'); grd.addColorStop(0.08, 'rgba(126,178,196,.35)'); grd.addColorStop(1, 'rgba(96,158,184,.55)');
  g.fillStyle = grd; g.fillRect(0, top, S, S - top);
  g.strokeStyle = 'rgba(70,128,152,.35)'; g.lineWidth = 1.2;
  for (let r = 0; r < 9; r++) {
    const yy = top + 24 + r * 22;
    g.beginPath();
    for (let x = 0; x <= S; x += 8) g.lineTo(x, yy + Math.sin(x * 0.03 + r * 1.7) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function mount(stage, opts = {}) {
  if (!document.querySelector('link[data-fx-font="plex-mono"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap';
    l.dataset.fxFont = 'plex-mono';
    document.head.appendChild(l);
  }
  css('floorplan', `
    .fp-room,.fp-dim{position:absolute;left:0;top:0;z-index:6;pointer-events:none;white-space:nowrap;text-align:center;will-change:transform,opacity;
      font:500 12.5px/1.25 'IBM Plex Mono',ui-monospace,monospace;color:#26252b;letter-spacing:.01em}
    .fp-room b{display:block;font-weight:600;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6c6874;margin-bottom:2px}
    .fp-dim{font-size:12px;padding:1px 5px;background:#f1ede6;color:#3d3b42}
    .fp-sum{position:absolute;z-index:6;pointer-events:none;top:clamp(80px,12vh,120px);right:clamp(16px,5vw,64px);max-width:420px;
      padding:16px 20px 15px;border-radius:14px;background:rgba(251,250,247,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      box-shadow:0 18px 40px rgba(60,50,40,.14),0 0 0 1px rgba(38,37,43,.07);font:500 12.5px/1.4 'IBM Plex Mono',ui-monospace,monospace;color:#5c5862;
      opacity:0;translate:0 10px;transition:opacity .5s,translate .5s}
    .fp-sum.on{opacity:1;translate:0 0}
    .fp-sum b{display:block;font:600 22px/1.25 Spectral,Georgia,serif;color:#1d1c21;letter-spacing:0;margin-bottom:5px;white-space:nowrap}
    .fp-sum b i{font-style:normal;color:${ACCENT}}
    @media (max-width:760px){
      .fp-room{font-size:10.5px}.fp-room b{font-size:9.5px}.fp-dim{font-size:10.5px}
      .fp-sum{top:84px;left:16px;right:16px;max-width:none;padding:13px 16px 12px}.fp-sum b{font-size:17px;white-space:normal}
    }`);
  const PAPER = new THREE.Color('#f1ede6');
  stage.style.background = '#f1ede6';
  stage.style.touchAction = 'pan-y';

  const renderer = makeRenderer(stage, { antialias: true });
  renderer.setClearColor(PAPER, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 34, 80);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.3, 200);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // квартира в мире: центр плана — в нуле, север — в сторону −z
  const cx = (BOX[0] + BOX[2]) / 2, cy = (BOX[1] + BOX[3]) / 2;
  const model = new THREE.Group();
  scene.add(model);
  const P = (x, y, h = 0) => new THREE.Vector3(x - cx, h, -(y - cy));

  // свет: мягкое небо и солнце с юго-запада, со стороны моря — сквозь окна на полу лежат светлые пятна
  scene.add(new THREE.HemisphereLight('#ffffff', '#e6ddd0', 1.55));
  const sun = new THREE.DirectionalLight('#fff3e4', 2.4);
  sun.position.set(-5.5, 8.5, 9);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40;
  sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // земля-бумага с сеткой и морем
  const groundTex = keep(groundCanvas());
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 40)), keep(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  model.add(ground);
  // плита перекрытия — основание макета
  const [bx0, by0, bx1, by1] = BOX;
  const outline = new THREE.Shape(OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)));
  const flat = (g) => g.rotateX(-Math.PI / 2).translate(-cx, 0, cy);   // план (x, y) → мир (x, 0, −y) с центром в нуле
  const slab = new THREE.Mesh(keep(flat(new THREE.ExtrudeGeometry(outline, { depth: 0.2, bevelEnabled: false })).translate(0, -0.2, 0)),
    keep(new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.95 })));
  slab.castShadow = slab.receiveShadow = true;
  model.add(slab);

  // пол: сначала белый лист, по прокрутке проступают паркет и плитка
  const floorTex = keep(new THREE.CanvasTexture(floorCanvas(IS_MOBILE ? 110 : 190)));
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.anisotropy = 8;
  const uMix = { value: 0 };
  const floorMat = keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.78 }));
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uMix = uMix;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uMix;\nvoid main() {')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(vec3(0.975, 0.968, 0.955), diffuseColor.rgb, uMix);');
  };
  const floorGeo = new THREE.ShapeGeometry(outline);
  const fuv = floorGeo.attributes.uv, fpos = floorGeo.attributes.position;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fpos.getX(i) - bx0) / (bx1 - bx0), (fpos.getY(i) - by0) / (by1 - by0));
  const floor = new THREE.Mesh(keep(flat(floorGeo)), floorMat);
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  model.add(floor);

  // чертёж поверх пола
  const planTex = keep(new THREE.CanvasTexture(planCanvas(IS_MOBILE ? 90 : 150)));
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = 8;
  const planMat = keep(new THREE.MeshBasicMaterial({ map: planTex, transparent: true, depthWrite: false, fog: false }));
  const plan = new THREE.Mesh(keep(new THREE.PlaneGeometry(PLAN[2] - PLAN[0], PLAN[3] - PLAN[1])), planMat);
  plan.rotation.x = -Math.PI / 2;
  plan.position.copy(P((PLAN[0] + PLAN[2]) / 2, (PLAN[1] + PLAN[3]) / 2, 0.006));
  plan.renderOrder = 2;
  model.add(plan);

  // стены: куски между проёмами; над дверями и окнами — перемычки, под окнами — подоконная часть, в окнах — стекло
  const wallMat = keep(new THREE.MeshStandardMaterial({ color: '#f6f4f0', roughness: 0.92 }));
  const cutMat = keep(new THREE.MeshStandardMaterial({ color: '#34333a', roughness: 0.9 }));
  const sillMat = keep(new THREE.MeshStandardMaterial({ color: '#e9e5de', roughness: 0.7 }));
  const glassMat = keep(new THREE.MeshStandardMaterial({ color: '#cfe4ec', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }));
  const unit = keep(new THREE.BoxGeometry(1, 1, 1));
  const pieces = [];
  const addPiece = (x0, y0, x1, y1, h0, h1, kind) => {
    const mats = kind === 'glass' ? glassMat : [wallMat, wallMat, cutMat, wallMat, wallMat, wallMat];
    const m = new THREE.Mesh(unit, Array.isArray(mats) ? mats.slice() : mats);
    const c = P((x0 + x1) / 2, (y0 + y1) / 2);
    m.position.set(c.x, 0, c.z);
    m.userData = { w: x1 - x0, d: y1 - y0, h0, h1, kind };
    m.castShadow = kind !== 'glass';
    m.receiveShadow = true;
    m.visible = false;
    model.add(m);
    pieces.push(m);
  };
  for (const w of WALLS) {
    const [a, b, c2, d] = w.r, hor = c2 - a > d - b;
    const seg = (f, t, h0, h1, kind) => { if (t - f < 1e-3) return; if (hor) addPiece(f, b, t, d, h0, h1, kind); else addPiece(a, f, c2, t, h0, h1, kind); };
    let from = hor ? a : b;
    for (const [f, t, type, sill] of [...w.ops].sort((p, q) => p[0] - q[0])) {
      seg(from, f, 0, WALL_H, 'wall');
      if (type === 'door' || type === 'open') seg(f, t, 2.15, WALL_H, 'wall');
      if (type === 'win') {
        if (sill > 0) seg(f, t, 0, sill, 'sill');
        seg(f, t, 2.2, WALL_H, 'wall');
        if (hor) addPiece(f, b + (d - b) * 0.42, t, b + (d - b) * 0.58, sill, 2.2, 'glass'); else addPiece(a + (c2 - a) * 0.42, f, a + (c2 - a) * 0.58, t, sill, 2.2, 'glass');
      }
      from = t;
    }
    seg(from, hor ? c2 : d, 0, WALL_H, 'wall');
  }
  // стеклянное ограждение балкона
  addPiece(-0.25, -1.29, 9.57, -1.25, 0, 1.0, 'glass');
  addPiece(-0.25, -1.25, -0.21, -0.25, 0, 1.0, 'glass');
  addPiece(9.53, -1.25, 9.57, -0.25, 0, 1.0, 'glass');

  // двери в объёме: створки приоткрыты
  const doorMat = keep(new THREE.MeshStandardMaterial({ color: '#f3f0ea', roughness: 0.6 }));
  const doors = DOORS.map(([hx, hy, cx2, cy2, ox, oy, w], i) => {
    const g = new THREE.Group();
    g.position.copy(P(hx, hy));
    const leaf = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 2.05, 0.04)), i === 0 ? keep(new THREE.MeshStandardMaterial({ color: '#6b6158', roughness: 0.55 })) : doorMat);
    leaf.position.set(w / 2, 1.025, 0);
    leaf.castShadow = leaf.receiveShadow = true;
    g.add(leaf);
    // створка смотрит в сторону открывания, чуть не до конца
    const aOpen = Math.atan2(-(-oy), ox), aClosed = Math.atan2(-(-cy2), cx2);
    let dd = aOpen - aClosed; if (dd > Math.PI) dd -= Math.PI * 2; if (dd < -Math.PI) dd += Math.PI * 2;
    g.rotation.y = aClosed + dd * 0.8;
    g.scale.setScalar(0.001);
    model.add(g);
    return g;
  });

  // мебель: скруглённые блоки в приглушённых тонах, один акцент — диван терракотового цвета
  const matCache = new Map();
  const matFor = (c) => { if (!matCache.has(c)) matCache.set(c, keep(new THREE.MeshStandardMaterial({ color: c, roughness: c === ACCENT ? 0.85 : 0.8 }))); return matCache.get(c); };
  const ROOM_T = [0.29, 0.37, 0.43, 0.46, 0.49, 0.53];
  const items = [];
  const seen = [0, 0, 0, 0, 0, 0];
  for (const f of furniture()) {
    const seg = IS_MOBILE ? 2 : 3;
    const r = Math.min(f.r, f.w / 2 - 0.001, f.d / 2 - 0.001, f.h / 2 - 0.001);
    const geo = keep(new RoundedBoxGeometry(f.w, f.h, f.d, seg, Math.max(0.001, r)));
    const m = new THREE.Mesh(geo, matFor(f.c));
    m.castShadow = f.h > 0.05; m.receiveShadow = true;
    const g = new THREE.Group();
    g.position.copy(P(f.x, f.y, f.y0));
    m.position.y = f.h / 2;
    g.add(m);
    model.add(g);
    items.push({ g, y: g.position.y, t0: ROOM_T[f.room] + (seen[f.room]++) * 0.006 });
  }
  const potMat = matFor('#ebe7e0'), leafMat = keep(new THREE.MeshStandardMaterial({ color: '#8fa889', roughness: 0.85, flatShading: true }));
  for (const [room, x, y, s] of PLANTS) {
    const g = new THREE.Group();
    g.position.copy(P(x, y));
    const pot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.34 * s, 20)), potMat);
    pot.position.y = 0.17 * s;
    const bush = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.3 * s, 1)), leafMat);
    bush.position.y = 0.55 * s;
    bush.scale.set(1, 1.25, 1);
    for (const m of [pot, bush]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    model.add(g);
    items.push({ g, y: g.position.y, t0: ROOM_T[room] + 0.04 });
  }

  // подписи комнат и размеров — HTML поверх; итог — в конце. Тексты — на языке сайта
  const roomEls = ROOMS.map(([name, a, x, y]) => {
    const el = document.createElement('div');
    el.className = 'fp-room';
    stage.appendChild(el);
    return { el, p: P(x, y, 0.02), name, a };
  });
  const dimEls = DIMS.map(([a, b, c2, d, len]) => {
    const el = document.createElement('div');
    el.className = 'fp-dim';
    stage.appendChild(el);
    return { el, p: P((a + c2) / 2, (b + d) / 2, 0.02), len };
  });
  const sum = document.createElement('div');
  sum.className = 'fp-sum';
  stage.appendChild(sum);
  const texts = () => {
    const lg = lang();
    roomEls.forEach((r) => { r.el.innerHTML = `<b>${r.name[lg]}</b>${area(r.a, lg)}`; });
    dimEls.forEach((r) => { r.el.textContent = num(r.len, lg) + (lg === 'en' ? ' m' : ' м'); });
    sum.innerHTML = SUM[lg];
  };
  texts();
  const langWatch = new MutationObserver(texts);
  langWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const ptr = pointer(stage);
  let W = 1, H = 1, narrow = false, dTop = 22, d34 = 20;
  const unwatch = watchSize(stage, (w, h) => {
    W = w; H = h;
    narrow = w / h < 0.8;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = narrow ? 40 : 35;
    camera.updateProjectionMatrix();
    // план целиком: на компьютере — в правых двух третях, на телефоне — по ширине экрана (план повёрнут вдоль экрана)
    const t2 = 2 * Math.tan(camera.fov * Math.PI / 360);
    const pw = narrow ? 10.4 : 13.6, ph = narrow ? 13.2 : 11.4;
    dTop = Math.max(pw / (t2 * camera.aspect * (narrow ? 0.94 : 0.66)), ph / (t2 * (narrow ? 0.58 : 0.84)));
    d34 = dTop * (narrow ? 1.12 : 0.82);
    model.rotation.y = narrow ? Math.PI / 2 : 0;
    roomEls.forEach((r) => { r.w = 0; });
  });

  let target = null, shown = 0, px = 0, py = 0;
  const v = new THREE.Vector3(), look = new THREE.Vector3();
  const easeBack = (x) => { const k = 1.6; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
  const place = (el, p, dx = 0, dy = 0) => { v.copy(p).applyMatrix4(model.matrixWorld).project(camera); el.style.transform = `translate(${((v.x + 1) / 2 * W + dx).toFixed(1)}px, ${((1 - v.y) / 2 * H + dy).toFixed(1)}px) translate(-50%, -50%)`; };

  const lp = loop((t, dt) => {
    const k = dt || 0.016;
    shown = damp(shown, target ?? 0, 4, k);
    const p = shown;
    const tilt = sm(0.06, 0.34, p), grow = sm(0.12, 0.34, p), orbit = sm(0.7, 1, p);
    uMix.value = sm(0.2, 0.42, p);
    planMat.opacity = 1 - sm(0.1, 0.26, p);
    plan.visible = planMat.opacity > 0.01;

    // стены растут; срез по высоте роста — тёмный, как на чертеже
    const hc = grow * WALL_H;
    for (const m of pieces) {
      const { w, d, h0, h1, kind } = m.userData;
      const top = Math.min(h1, hc);
      m.visible = top > h0 + 0.004;
      if (!m.visible) continue;
      m.scale.set(w, top - h0, d);
      m.position.y = h0 + (top - h0) / 2;
      if (kind !== 'glass') m.material[2] = kind === 'sill' ? sillMat : (h1 > hc + 0.001 || h1 >= WALL_H - 0.001 ? cutMat : wallMat);
    }
    const dg = sm(0.3, 0.4, p);
    doors.forEach((g) => { g.scale.setScalar(Math.max(0.001, dg)); });
    // мебель встаёт по комнатам: опускается сверху и чуть пружинит
    for (const it of items) {
      const a = sm(it.t0, it.t0 + 0.07, p);
      it.g.visible = a > 0.001;
      if (!it.g.visible) continue;
      const e = easeBack(a);
      it.g.scale.set(e, e, e);
      it.g.position.y = it.y + (1 - a) * 0.7;
    }

    // камера: вид сверху → три четверти → медленный облёт; курсор поворачивает на ±10°
    px = damp(px, ptr.active ? ptr.x : 0, 3, k);
    py = damp(py, ptr.active ? ptr.y : 0, 3, k);
    const theta = mix(0.0012, narrow ? 0.6 : 0.64, tilt) - py * 0.05 * tilt;
    const phi = mix(0, narrow ? -0.5 : -0.42, tilt) + orbit * 0.95 + Math.sin(t * 0.16) * (0.03 + 0.1 * orbit) * tilt + px * 0.17;   // в конце облёт продолжается сам
    const D = mix(dTop, d34, tilt) * (1 + (narrow ? 0.1 : 0.22) * orbit);
    camera.position.set(Math.sin(theta) * Math.sin(phi) * D, Math.cos(theta) * D, Math.sin(theta) * Math.cos(phi) * D);
    look.set(0, mix(0, 0.6, tilt), 0);
    camera.position.add(look);
    camera.lookAt(look);
    // смещение кадра: на компьютере макет правее (слева подпись), на телефоне — выше (снизу подпись)
    const mid = sm(0.1, 0.28, p) * (1 - sm(0.84, 0.95, p));
    if (narrow) camera.setViewOffset(W, H, 0, H * mix(0.19, 0.1, mid), W, H);
    else camera.setViewOffset(W, H, -W * mix(0.16, 0.02, mid) * (1 - 0.1 * orbit), H * (0.02 - 0.07 * orbit), W, H);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);

    // подписи: комнаты — пока мебель не встала, размеры — пока виден чертёж
    const ro = 1 - sm(0.17, 0.27, p), dop = 1 - sm(0.08, 0.2, p);
    roomEls.forEach((r) => { place(r.el, r.p); r.el.style.opacity = ro.toFixed(3); });
    dimEls.forEach((r) => { place(r.el, r.p); r.el.style.opacity = dop.toFixed(3); });
    sum.classList.toggle('on', p > 0.86);
  });

  return {
    start: lp.start, stop: lp.stop,
    setProgress(p) { if (target === null) shown = p; target = p; },
    destroy() {
      lp.stop(); unwatch(); langWatch.disconnect();
      roomEls.forEach((r) => r.el.remove()); dimEls.forEach((r) => r.el.remove()); sum.remove();
      disposables.forEach((d) => d.dispose());
      sun.shadow.dispose();
      release(renderer);
    },
  };
}
