/* Alyona Design — v3 «Вечерняя галерея». Сигнатура: «Свет в галерее» — пятно света за курсором (на телефоне за прокруткой),
   обводки рядом с ним вспыхивают. Остальное: слова из-под черты, проекты вкладками, обводки рисуют себя. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var vw = innerWidth, vh = innerHeight;

  /* ---------- Б1: слова из-под черты ---------- */
  function splitNode(node, counter) {
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(" ")); return; }
          var w = doc.createElement("span"), wi = doc.createElement("span");
          w.className = "w"; wi.className = "wi"; wi.textContent = part; wi.style.setProperty("--i", counter.i++);
          w.appendChild(wi); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== "BR") splitNode(n, counter);
    });
  }
  $$("[data-split]").forEach(function (el) { el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim()); splitNode(el, { i: 0 }); $$(".w", el).forEach(function (w) { w.setAttribute("aria-hidden", "true"); }); });

  /* ---------- уровни появления ---------- */
  $$(".rv-up").forEach(function (el) {
    var sib = $$(".rv-up", el.parentNode).filter(function (x) { return x.parentNode === el.parentNode; });
    el.style.setProperty("--d", (Math.max(0, sib.indexOf(el)) * 0.09 + 0.1) + "s");
  });
  $$(".stars").forEach(function (st) { $$("i", st).forEach(function (i, k) { i.style.setProperty("--k", k); }); });
  $$("#fword span").forEach(function (s, i) { s.style.setProperty("--i", i); });

  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); } });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  var revealSel = ".rv-up, [data-split], .plan, .fr, #fword, [data-draw]";
  $$(revealSel).forEach(function (el) { if (reduce) el.classList.add("in"); else revealIO.observe(el); });

  /* ---------- А5: обводка рисует себя (путь считается по размеру блока) ---------- */
  var NS = "http://www.w3.org/2000/svg";
  var GRADS = ["gA", "gB", "gC"], gi = 0;
  function pathD(x, y, w, h, rt, rb) {
    rt = Math.min(rt, w / 2, h / 2); rb = Math.min(rb, w / 2, h / 2);
    return "M" + (x + rt) + " " + y + "H" + (x + w - rt) + "A" + rt + " " + rt + " 0 0 1 " + (x + w) + " " + (y + rt) +
      "V" + (y + h - rb) + "A" + rb + " " + rb + " 0 0 1 " + (x + w - rb) + " " + (y + h) + "H" + (x + rb) +
      "A" + rb + " " + rb + " 0 0 1 " + x + " " + (y + h - rb) + "V" + (y + rt) + "A" + rt + " " + rt + " 0 0 1 " + (x + rt) + " " + y + "Z";
  }
  function buildDraw(host) {
    var svg = host.__svg, r = host.getBoundingClientRect(), w = host.offsetWidth, h = host.offsetHeight;
    if (!w || !h) return;
    var cs = getComputedStyle(host), rt = parseFloat(cs.borderTopLeftRadius) || 0, rb = parseFloat(cs.borderBottomLeftRadius) || 0;
    var g = "url(#" + host.__grad + ")";
    var d = pathD(.8, .8, w - 1.6, h - 1.6, rt, rb);
    var html = '<path pathLength="100" stroke="' + g + '" d="' + d + '"/>';
    if (host.hasAttribute("data-echo")) {
      var o = 15;
      html += '<path class="e" pathLength="100" stroke="' + g + '" d="' + pathD(-o, -o, w + 2 * o, h + 2 * o, rt + o, rb + o) + '"/>';
    }
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = html;
  }
  var drawHosts = $$("[data-draw]");
  drawHosts.forEach(function (host) {
    var svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("class", "draw"); svg.setAttribute("aria-hidden", "true");
    host.appendChild(svg); host.__svg = svg; host.__grad = GRADS[gi++ % GRADS.length];
    buildDraw(host);
  });
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function (es) { es.forEach(function (e) { if (e.target.__svg) buildDraw(e.target); }); });
    drawHosts.forEach(function (h) { ro.observe(h); });
  }

  /* ---------- анимация обводок только на экране ---------- */
  var visible = new Set();
  var liveIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      e.target.classList.toggle("live", e.isIntersecting);
      if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
    });
    dirty = true; kick();
  }, { rootMargin: "80px" });
  $$(".ring, .xcard, .plan").forEach(function (el) { liveIO.observe(el); });
  var glowHosts = $$(".glow-host");

  /* ---------- Г2: свет в галерее ---------- */
  var lamp = $("#lamp");
  var tx = vw * 0.7, ty = vh * 0.4, lx = tx, ly = ty, dirty = true, running = false;
  function lampTarget() {
    if (finePointer) return;
    tx = vw * (0.5 + Math.sin(scrollY / 650) * 0.28); ty = vh * 0.5;
  }
  if (finePointer) addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; dirty = true; kick(); }, { passive: true });
  lampTarget();

  /* ---------- проекты: точки, свайп, стрелки ---------- */
  var tabs = $$(".pj-dot"), panels = $$(".pj"), stage = $("#pjStage"), curPj = 0, swapTok = 0;
  function showPanel(p, dir) {
    p.hidden = false; p.style.setProperty("--dx", dir);
    var fs = $$(".fr", p); fs.forEach(function (f, i) { f.style.setProperty("--i", i); if (!reduce) f.classList.remove("in"); });
    p.classList.remove("go-out"); void p.offsetWidth; if (!reduce) p.classList.add("go-in");
    requestAnimationFrame(function () { fs.forEach(function (f) { f.classList.add("in"); }); });
    setTimeout(function () { p.classList.remove("go-in"); }, 700);
  }
  function pickTab(k, dir) {
    k = (k + tabs.length) % tabs.length; if (k === curPj) return;
    dir = dir || (k > curPj ? 1 : -1);
    var old = panels[curPj], nu = panels[k], tok = ++swapTok; curPj = k;
    tabs.forEach(function (b, i) { b.setAttribute("aria-selected", String(i === k)); b.tabIndex = i === k ? 0 : -1; });
    panels.forEach(function (p) { if (p !== old && p !== nu) { p.hidden = true; p.classList.remove("go-in", "go-out"); } });
    function swap() { if (tok !== swapTok) return; old.hidden = true; old.classList.remove("go-out"); showPanel(nu, dir); dirty = true; kick(); }
    if (reduce) swap(); else { old.style.setProperty("--dx", dir); old.classList.remove("go-in"); old.classList.add("go-out"); setTimeout(swap, 200); }
  }
  tabs.forEach(function (t, k) {
    t.tabIndex = k ? -1 : 0;
    t.addEventListener("click", function () { pickTab(k); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
      pickTab(k + d, d); tabs[curPj].focus(); e.preventDefault();
    });
  });
  $$(".pj").forEach(function (p) { $$(".fr", p).forEach(function (f, i) { f.style.setProperty("--i", i); }); });
  // свайп пальцем / мышью / тачпадом
  var sw = { id: null, x: 0, y: 0, on: false, moved: false };
  stage.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    sw.id = e.pointerId; sw.x = e.clientX; sw.y = e.clientY; sw.on = true; sw.moved = false;
  });
  stage.addEventListener("pointermove", function (e) {
    if (!sw.on || e.pointerId !== sw.id) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { sw.moved = true; stage.classList.add("drag"); try { stage.setPointerCapture(e.pointerId); } catch (x) {} }
  });
  function endSwipe(e, cancel) {
    if (!sw.on || e.pointerId !== sw.id) return;
    var dx = e.clientX - sw.x; sw.on = false; stage.classList.remove("drag");
    if (sw.moved && !cancel && Math.abs(dx) > 50) pickTab(curPj + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    setTimeout(function () { sw.moved = false; }, 60);
  }
  stage.addEventListener("pointerup", function (e) { endSwipe(e, false); });
  stage.addEventListener("pointercancel", function (e) { endSwipe(e, true); });
  stage.addEventListener("click", function (e) { if (sw.moved) { e.stopPropagation(); e.preventDefault(); sw.moved = false; } }, true);
  stage.addEventListener("dragstart", function (e) { e.preventDefault(); });
  var wheelAcc = 0, wheelT = 0;
  stage.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
    e.preventDefault(); var now = Date.now();
    if (now - wheelT > 160) wheelAcc = 0; wheelT = now; wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 90 && now - (stage.__wl || 0) > 650) { stage.__wl = now; pickTab(curPj + (wheelAcc > 0 ? 1 : -1), wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  }, { passive: false });
  // стрелки клавиатуры, пока блок проектов на экране
  addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!$("#lb").hidden || /^(INPUT|TEXTAREA|SELECT)$/.test((doc.activeElement || {}).tagName || "")) return;
    var r = stage.getBoundingClientRect(); if (r.bottom < vh * 0.15 || r.top > vh * 0.85) return;
    if (doc.activeElement && doc.activeElement.classList && doc.activeElement.classList.contains("pj-dot")) return;
    var d = e.key === "ArrowRight" ? 1 : -1; pickTab(curPj + d, d);
  });

  /* ---------- фон первого экрана: слайд-шоу ---------- */
  (function () {
    var bg = $("#heroBg"), first = $("img", bg); if (!bg || !first) return;
    var srcs = (bg.getAttribute("data-slides") || "").split(",").filter(Boolean), slides = [first], idx = 0, timer = 0, heroVis = true;
    if (reduce || !srcs.length) return;
    var STEP = 3000;
    function go() {
      if (slides.length < 2) return;
      var prev = slides[idx]; idx = (idx + 1) % slides.length; var nx = slides[idx];
      slides.forEach(function (s) { if (s !== prev && s !== nx) s.classList.remove("out", "on"); });
      prev.classList.remove("on"); prev.classList.add("out");
      nx.classList.remove("out"); void nx.offsetWidth; nx.classList.add("on");
      setTimeout(function () { if (prev !== slides[idx]) prev.classList.remove("out"); }, 1500);
    }
    function sync() {
      var run = heroVis && !doc.hidden;
      bg.classList.toggle("paused", !run);
      if (run && !timer && slides.length > 1) timer = setInterval(go, STEP);
      if (!run && timer) { clearInterval(timer); timer = 0; }
    }
    function load() {
      var left = srcs.length;
      srcs.forEach(function (src) {
        var im = new Image(); im.alt = ""; im.decoding = "async"; im.className = "hs";
        im.onload = function () { bg.appendChild(im); slides.push(im); if (--left === 0) sync(); };
        im.onerror = function () { if (--left === 0) sync(); };
        im.src = src;
      });
    }
    if (doc.readyState === "complete") setTimeout(load, 300); else addEventListener("load", function () { setTimeout(load, 300); });
    new IntersectionObserver(function (es) { heroVis = es[0].isIntersecting; sync(); }).observe(bg);
    doc.addEventListener("visibilitychange", sync);
  })();

  /* разные фазы вращения обводок, чтобы не крутились хором */
  $$(".ring, .xcard").forEach(function (el, i) { el.style.setProperty("--dl", "-" + ((i * 2.7) % 9).toFixed(1) + "s"); });

  /* ---------- общий цикл ---------- */
  var quoteWords = [], quoteEl = $("#qtext");
  (function () {
    var t = quoteEl.textContent.trim(); quoteEl.textContent = "";
    t.split(/\s+/).forEach(function (w, i, a) {
      var s = doc.createElement("span"); s.className = "qw" + (/^фотографировать/i.test(w) ? " acc" : ""); s.textContent = w; quoteEl.appendChild(s);
      if (i < a.length - 1) quoteEl.appendChild(doc.createTextNode(" ")); quoteWords.push(s);
    });
    quoteEl.setAttribute("aria-label", t);
  })();
  var quoteSec = $("#quote"), nav = $("#nav"), line = $("#scrollLine");

  function frame() {
    running = false;
    var y = scrollY, moving = false;
    // шапка, полоса прокрутки
    nav.classList.toggle("scrolled", y > 30);
    line.style.transform = "scaleX(" + clamp(y / Math.max(1, doc.body.scrollHeight - innerHeight), 0, 1).toFixed(4) + ")";
    // цитата: слова загораются по прокрутке
    var qr = quoteSec.getBoundingClientRect();
    var qp = reduce ? 1 : clamp((vh * 0.82 - qr.top) / (vh * 0.5 + qr.height * 0.35), 0, 1);
    var n = Math.round(qp * quoteWords.length);
    for (var i = 0; i < quoteWords.length; i++) quoteWords[i].classList.toggle("on", i < n);
    // свет
    lampTarget();
    var dx = tx - lx, dy = ty - ly;
    if (reduce || (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4)) { lx = tx; ly = ty; } else { lx += dx * 0.13; ly += dy * 0.13; moving = true; }
    lamp.style.transform = "translate3d(" + lx.toFixed(1) + "px," + ly.toFixed(1) + "px,0)";
    // обводки рядом со светом вспыхивают
    for (var k = 0; k < glowHosts.length; k++) {
      var h = glowHosts[k], r = h.getBoundingClientRect();
      if (r.bottom < -400 || r.top > vh + 400 || r.right < -400 || r.left > vw + 400) { if (h.__g) { h.style.setProperty("--glow", 0); h.__g = 0; } continue; }
      var cx = clamp(lx, r.left, r.right), cy = clamp(ly, r.top, r.bottom);
      var d = Math.hypot(lx - cx, ly - cy), g = Math.pow(Math.max(0, 1 - d / 400), 1.5);
      g = Math.round(g * 100) / 100;
      if (g !== h.__g) { h.style.setProperty("--glow", g); h.__g = g; }
    }
    if (moving || dirty) { dirty = false; if (moving) kick(); }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
  addEventListener("scroll", function () { dirty = true; kick(); }, { passive: true });
  addEventListener("resize", function () { vw = innerWidth; vh = innerHeight; drawHosts.forEach(buildDraw); dirty = true; kick(); });
  addEventListener("load", function () { drawHosts.forEach(buildDraw); dirty = true; kick(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { drawHosts.forEach(buildDraw); dirty = true; kick(); });
  kick();

  /* ---------- А4: свет обводки за курсором на сетке тарифов ---------- */
  var grid = $("#plansGrid");
  if (finePointer && grid) {
    var plans = $$(".plan", grid);
    grid.addEventListener("pointermove", function (e) {
      grid.classList.add("hov");
      plans.forEach(function (p) { var r = p.getBoundingClientRect(); p.style.setProperty("--mx", (e.clientX - r.left) + "px"); p.style.setProperty("--my", (e.clientY - r.top) + "px"); });
    });
    grid.addEventListener("pointerleave", function () { grid.classList.remove("hov"); });
  }

  /* ---------- валюта цен ---------- */
  var curBtns = $$(".cur-b");
  function setCur(c) {
    curBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cur === c)); });
    $$("[data-rub]").forEach(function (el) { el.textContent = el.getAttribute("data-" + c); });
    try { localStorage.setItem("ad-cur", c); } catch (e) {}
  }
  curBtns.forEach(function (b) { b.addEventListener("click", function () { setCur(b.dataset.cur); }); });
  try { var sc = localStorage.getItem("ad-cur"); if (sc && sc !== "rub") setCur(sc); } catch (e) {}

  /* ---------- Б6: магнитные кнопки ---------- */
  if (finePointer && !reduce) {
    $$(".mag").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transition = "filter .3s, box-shadow .3s";
        b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * 0.4).toFixed(1) + "px)";
      });
      b.addEventListener("pointerleave", function () {
        b.style.transition = "transform .6s cubic-bezier(.2,1.7,.3,1), filter .3s, box-shadow .3s"; b.style.transform = "";
      });
    });
  }

  /* ---------- фото на весь экран ---------- */
  var items = $$("[data-lb]"), lb = $("#lb"), lbImg = $("#lbImg"), lbCount = $("#lbCount"), cur = 0, lastFocus = null;
  function show(i) {
    cur = (i + items.length) % items.length;
    var it = items[cur]; lbImg.src = it.dataset.full; lbImg.alt = $("img", it).alt;
    lbCount.textContent = (cur + 1) + " / " + items.length;
    [items[(cur + 1) % items.length], items[(cur + items.length - 1) % items.length]].forEach(function (n) { new Image().src = n.dataset.full; });
  }
  function openLb(i) { lastFocus = doc.activeElement; show(i); lb.hidden = false; doc.body.style.overflow = "hidden"; $("#lbClose").focus(); }
  function closeLb() { lb.hidden = true; doc.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  items.forEach(function (it, i) {
    it.tabIndex = 0; it.setAttribute("role", "button");
    it.addEventListener("click", function () { openLb(i); });
    it.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLb(i); } });
  });
  $("#lbClose").addEventListener("click", closeLb);
  $("#lbPrev").addEventListener("click", function () { show(cur - 1); });
  $("#lbNext").addEventListener("click", function () { show(cur + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
  addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb(); else if (e.key === "ArrowLeft") show(cur - 1); else if (e.key === "ArrowRight") show(cur + 1);
  });
  var sx = null;
  lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) { if (sx === null) return; var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(cur + (d < 0 ? 1 : -1)); sx = null; }, { passive: true });
})();
