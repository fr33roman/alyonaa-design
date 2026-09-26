/* ============ Alyona Design v2 — скрипт ============ */

/* боковая панель меню */
const panel = document.getElementById("sidePanel");
const overlay = document.getElementById("panelOverlay");
const openPanel = () => { panel.classList.add("open"); overlay.classList.add("open"); };
const closePanel = () => { panel.classList.remove("open"); overlay.classList.remove("open"); };
document.getElementById("menuOpen").addEventListener("click", openPanel);
document.getElementById("menuClose").addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);
panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", closePanel));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

/* шапка: прозрачная на герое, сплошная после прокрутки */
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("solid", window.scrollY > window.innerHeight - 120);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* появление блоков */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* тарифы: валюта цен ₽ / $ / ₾. Цены в карточках заданы Алёной в каждой валюте (data-rub/-usd/-gel),
   это не пересчёт по курсу. Выбор посетителя запоминается; пока он не выбрал — по языку сайта:
   русский → рубли, английский → доллары. i18n.js зовёт window.adOnLang при каждой смене языка. */
const CUR_KEY = "ad_cur";
function setCur(cur, save) {
  document.querySelectorAll("[data-rub]").forEach((el) => {
    const v = el.getAttribute("data-" + cur);
    if (v) el.textContent = v;
  });
  document.querySelectorAll(".cur-b").forEach((b) =>
    b.setAttribute("aria-pressed", b.getAttribute("data-cur") === cur ? "true" : "false")
  );
  if (save) { try { localStorage.setItem(CUR_KEY, cur); } catch (_) {} }
}
document.querySelectorAll(".cur-b").forEach((b) =>
  b.addEventListener("click", () => setCur(b.getAttribute("data-cur"), true))
);
/* тарифы в объёме: под курсором карточка поворачивается к человеку, по ней скользит блик.
   Только мышь на широком экране и только без «уменьшить движение» в системе */
if (matchMedia("(hover: hover) and (pointer: fine) and (min-width: 961px)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".plan").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ty", ((u - 0.5) * 8).toFixed(2) + "deg");
      card.style.setProperty("--tx", ((0.5 - v) * 6).toFixed(2) + "deg");
      card.style.setProperty("--gx", (u * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (v * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--tx");
      card.style.removeProperty("--ty");
    });
  });
}

window.adOnLang = function (lang) {
  let saved = null;
  try { saved = localStorage.getItem(CUR_KEY); } catch (_) {}
  setCur(saved || (lang === "en" ? "usd" : "rub"), false);
};

/* карусель проектов */
const track = document.getElementById("projTrack");
if (track) {
  const slides = track.children.length;
  const dotsBox = document.getElementById("projDots");
  let idx = 0;

  for (let i = 0; i < slides; i++) {
    const d = document.createElement("button");
    d.className = "proj-dot";
    d.setAttribute("aria-label", "Проект " + (i + 1));
    d.addEventListener("click", () => go(i));
    dotsBox.appendChild(d);
  }
  const dots = dotsBox.children;

  function go(i) {
    idx = (i + slides) % slides;
    track.style.transform = `translateX(-${idx * 100}%)`;
    [...dots].forEach((d, n) => d.classList.toggle("on", n === idx));
  }
  document.getElementById("projPrev").addEventListener("click", () => go(idx - 1));
  document.getElementById("projNext").addEventListener("click", () => go(idx + 1));

  /* свайп на телефоне */
  let x0 = null;
  track.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  track.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });

  go(0);
}
