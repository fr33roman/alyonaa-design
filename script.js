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

/* мобильные тарифы: табы, собираются из таблицы (один источник данных) */
const ptable = document.querySelector(".ptable");
if (ptable) {
  const names = [...ptable.querySelectorAll("thead th")].slice(1).map((th) => th.textContent.trim());
  const featRows = [...ptable.querySelectorAll("tbody tr:not(.price-row)")].map((tr) => {
    const tds = [...tr.querySelectorAll("td")];
    return { feat: tds[0].textContent.trim(), inc: tds.slice(1).map((td) => td.classList.contains("star")) };
  });
  const prices = [...ptable.querySelectorAll(".price-row .pcell")].map((td) =>
    [...td.querySelectorAll(".pc")].map((s) => s.textContent.trim()).join(" · ")
  );

  const box = document.createElement("div");
  box.className = "ttabs";
  box.innerHTML =
    '<div class="ttabs-bar">' +
    names.map((n, i) => `<button type="button" class="ttab${i === 0 ? " on" : ""}" data-i="${i}">${n}</button>`).join("") +
    '</div><div class="ttabs-card"><div class="ttabs-price" id="ttPrice"></div><ul class="ttabs-list" id="ttList"></ul><p class="ttabs-more" id="ttMore"></p></div>';
  document.querySelector(".ptable-scroll").after(box);

  function renderTab(i) {
    box.querySelectorAll(".ttab").forEach((b, n) => b.classList.toggle("on", n === i));
    document.getElementById("ttPrice").innerHTML = prices[i] + ' <span>за м²</span>';
    const included = featRows.filter((r) => r.inc[i]);
    document.getElementById("ttList").innerHTML = included.map((r) => `<li>${r.feat}</li>`).join("");
    const rest = featRows.length - included.length;
    document.getElementById("ttMore").textContent = rest > 0 ? `Ещё ${rest} позиций — в старших тарифах` : "Максимальная комплектация проекта";
  }
  box.querySelectorAll(".ttab").forEach((b) => b.addEventListener("click", () => renderTab(+b.dataset.i)));
  renderTab(0);
}

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
