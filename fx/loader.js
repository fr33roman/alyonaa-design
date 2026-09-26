// Эффекты на странице (сокращённый lab.js с полки lab/effects): секция [data-fx] подгружает свой эффект,
// когда подходит к экрану, рисует, пока видна, и выгружается, когда ушла далеко. Высокие секции
// (data-scroll) получают прогресс прокрутки 0…1 — от него живёт «Планировка в 3D».
const sections = [...document.querySelectorAll('[data-fx]')];

async function ensure(sec) {
  if (sec._fx || sec._loading) return sec._fx;
  sec._loading = true;
  try {
    const mod = await import(`./${sec.dataset.fx}.js`);
    sec._fx = mod.mount(sec.querySelector('.fx__stage'), { ...sec.dataset });
    sec.classList.add('is-ready');
    progress();
    // пока грузился, человек мог уйти далеко вниз — тогда сразу выгружаем
    if (sec._near === false) { unload(sec); return null; }
  } catch (e) {
    console.error('эффект не загрузился:', sec.dataset.fx, e);
    sec.classList.add('is-broken');   // CSS сворачивает секцию до одного экрана с подписью
  }
  return sec._fx;
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const sec = e.target;
    if (e.isIntersecting) ensure(sec).then((fx) => fx && sec._visible && fx.start());
    else if (sec._fx) sec._fx.stop();
    sec._visible = e.isIntersecting;
  }
}, { rootMargin: '250px 0px' });
sections.forEach((s) => io.observe(s));

// ушёл дальше полутора экранов — выгружаем целиком: телефону не держать 3D-сцену, которую не видно
function unload(sec) {
  if (!sec._fx) return;
  try { sec._fx.destroy(); } catch (e) { console.error('эффект не выгрузился:', sec.dataset.fx, e); }
  sec._fx = null;
  sec._loading = false;
  sec.classList.remove('is-ready');
}
const far = new IntersectionObserver((entries) => {
  for (const e of entries) {
    e.target._near = e.isIntersecting;
    if (!e.isIntersecting) unload(e.target);
  }
}, { rootMargin: '150% 0px' });
sections.forEach((s) => far.observe(s));

// подпись видна в начале и в конце, пока идёт сама история — растворяется
const capOpacity = (p) => Math.max(1 - Math.min(1, Math.max(0, (p - 0.04) / 0.08)), Math.min(1, Math.max(0, (p - 0.92) / 0.06)));

function progress() {
  const vh = window.innerHeight;
  for (const s of sections) {
    if (!s.hasAttribute('data-scroll')) continue;
    const r = s.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
    const capo = capOpacity(p);
    s.style.setProperty('--capo', capo.toFixed(3));
    s.classList.toggle('cap-on', capo > 0.5);   // кнопка в подписи нажимается, только пока подпись видна
    if (s._fx && s._fx.setProgress) s._fx.setProgress(p);
  }
}
let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; progress(); });
}, { passive: true });
addEventListener('resize', progress);
progress();
