/* Motion for every page, all of it skipped under prefers-reduced-motion:
 *   - headings rise in word by word as they come into view (the home name letter by letter)
 *   - cards lean toward the pointer, with a soft light where it is
 *   - a section rail on wide screens: one mark per section, the current one lit, the label on hover
 * Scroll-linked image drift is pure CSS (animation-timeline: view(), see site.css).
 */
(function () {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ── headings ─────────────────────────────────────────────────────── */
  const split = (el, byLetter) => {
    if (el.dataset.split) return;
    el.dataset.split = "1";
    const text = el.textContent;
    el.setAttribute("aria-label", text.trim());
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    let i = 0;
    const piece = (t) => `<span class="w" aria-hidden="true"><span style="--i:${i++}">${esc(t)}</span></span>`;
    /* By letter, each word's letters stay in one unbreakable group, so a word never splits across lines. */
    el.innerHTML = text.split(/(\s+)/).map((word) => {
      if (/^\s+$/.test(word)) return word;
      return byLetter ? `<span class="wd">${[...word].map(piece).join("")}</span>` : piece(word);
    }).join("");
  };
  const name = document.querySelector(".hero-name");
  if (name) { split(name, true); requestAnimationFrame(() => name.classList.add("in")); }
  const heads = document.querySelectorAll(".page-title, .sec h2, .next-page b");
  heads.forEach((h) => split(h, false));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    heads.forEach((h) => io.observe(h));
  } else heads.forEach((h) => h.classList.add("in"));
  /* Belt and braces: a heading must never stay hidden, whatever the observer did. */
  const sweep = () => heads.forEach((h) => { if (!h.classList.contains("in") && h.getBoundingClientRect().top < innerHeight) h.classList.add("in"); });
  let sweepT = 0;
  addEventListener("scroll", () => { clearTimeout(sweepT); sweepT = setTimeout(sweep, 160); }, { passive: true });
  setTimeout(sweep, 1800);

  /* ── cards lean toward the pointer ───────────────────────────────── */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".card, .gh a, .work-card").forEach((c) => {
      let raf = 0;
      c.addEventListener("pointermove", (e) => {
        if (e.target.closest("canvas")) { c.style.transform = ""; return; } // dragging a model: hold still
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          c.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
          c.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 3.2).toFixed(2)}deg) rotateY(${((x - 0.5) * 4).toFixed(2)}deg) translateY(-2px)`;
        });
      });
      c.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); c.style.transform = ""; });
    });
  }

  /* ── section rail (subpages, wide screens) ───────────────────────── */
  const secs = [...document.querySelectorAll("main > section.sec, main > section.scrolly")].filter((s) => s.querySelector(".sec-label"));
  secs.forEach((s) => {
    if (!s.id) s.id = s.querySelector(".sec-label").textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  });
  if (secs.length >= 3 && document.querySelector(".page-hero")) {
    const rail = document.createElement("nav");
    rail.className = "rail";
    rail.setAttribute("aria-label", "On this page");
    rail.innerHTML = secs.map((s) => {
      const label = (s.querySelector(".sec-label")?.textContent || s.id).trim();
      return `<a href="#${s.id}"><span>${label}</span></a>`;
    }).join("");
    document.body.append(rail);
    const links = [...rail.querySelectorAll("a")];
    const spy = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = secs.indexOf(e.target);
      links.forEach((l, j) => l.classList.toggle("on", j === i));
    }), { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach((s) => spy.observe(s));
    const show = () => rail.classList.toggle("shown", scrollY > innerHeight * 0.6);
    addEventListener("scroll", show, { passive: true });
    show();
  }
})();
