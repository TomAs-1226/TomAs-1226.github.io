/* Thomas Yu — what every page needs: the nav's states, the phone menu, and a fade-up on scroll. */
(function () {
  "use strict";

  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Phone and tablet: a full-screen sheet over a blurred page. Built here from the nav, so every
       page gets the same one. */
    const btn = nav.querySelector(".menu-btn");
    const sheet = nav.querySelector(".nav-sheet");
    if (btn && sheet) {
      const BLURB = {
        "/ornimetrics/": "The bird feeder", "/comu/": "AI for wildlife rescue", "/catalyst/": "The robotics library",
        "/robotics/": "FRC Team 5805", "/hardware/": "Boards I designed", "/channel/": "TomAs测评 on Bilibili", "/#contact": "Say hello",
      };
      const links = [...nav.querySelectorAll(".nav-links a")];
      sheet.innerHTML = `<div class="sheet-in">
        <a class="sheet-home" href="/">Home</a>
        ${links.map((a, i) => `<a class="sheet-link" href="${a.getAttribute("href")}" style="--i:${i + 1}"><b>${a.textContent}</b><small>${BLURB[a.getAttribute("href")] || ""}</small></a>`).join("")}
        <div class="sheet-foot" style="--i:${links.length + 1}">
          <a href="mailto:yu_thomas1226@outlook.com">Email</a>
          <a href="https://github.com/TomAs-1226" target="_blank" rel="noopener">GitHub</a>
          <a href="https://space.bilibili.com/1983280115" target="_blank" rel="noopener">Bilibili</a>
          <button type="button" data-kbar>Search</button>
        </div>
      </div>`;
      btn.innerHTML = '<span class="burger" aria-hidden="true"><i></i><i></i></span><span class="menu-label">Menu</span>';
      const set = (open) => {
        nav.classList.toggle("open", open);
        document.documentElement.classList.toggle("menu-open", open);
        btn.setAttribute("aria-expanded", String(open));
        btn.querySelector(".menu-label").textContent = open ? "Close" : "Menu";
      };
      btn.addEventListener("click", () => set(!nav.classList.contains("open")));
      sheet.addEventListener("click", (e) => { if (e.target.closest("a, button")) set(false); });
      addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    }

    /* The page you are on, marked in both link lists. */
    const here = location.pathname.replace(/index\.html$/, "");
    nav.querySelectorAll(".nav-links a, .nav-sheet .sheet-link").forEach((a) => {
      const p = new URL(a.href, location.href).pathname;
      if (p !== "/" && here.startsWith(p)) a.setAttribute("aria-current", "page");
    });
  }

  /* Fade up once, as each block comes into view. */
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const els = document.querySelectorAll(".sec-head, .sec-body, .bleed, .split, .robot, .gallery");
    const rv = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rv.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => {
      /* Anything already on screen at load is shown at once, so a reload never blinks. */
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add("rv");
      rv.observe(el);
    });
    /* and a fallback, so nothing on screen can stay faded */
    let t = 0;
    const sweep = () => els.forEach((el) => { if (el.classList.contains("rv") && !el.classList.contains("in") && el.getBoundingClientRect().top < innerHeight) el.classList.add("in"); });
    addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(sweep, 160); }, { passive: true });
  }
})();

/* Search palette: ⌘K / Ctrl+K or "/" opens it anywhere on the site. Everything it finds is listed
   here, so it works offline and with no index file to keep in step. */
(function () {
  "use strict";
  const ITEMS = [
    ["Home", "Thomas Yu", "/", "Page"],
    ["About me", "Who I am, and what I'm on right now", "/#about", "Home"],
    ["School, leadership, setup", "More about me", "/#beyond", "Home"],
    ["Timeline", "2023 to now", "/#timeline", "Home"],
    ["Ornimetrics", "The bird feeder: research, paper, patent", "/ornimetrics/", "Page"],
    ["Parts tour", "The feeder's four parts in 3D", "/ornimetrics/#tour", "Ornimetrics"],
    ["The paper", "ADCOM 2026, CS & IT Vol. 16", "/ornimetrics/#paper", "Ornimetrics"],
    ["Feeder video", "Watch it feed", "/ornimetrics/#action", "Ornimetrics"],
    ["COMU", "AI front desk for wildlife rescue", "/comu/", "Page"],
    ["COMU results", "Zero hallucinated phone numbers", "/comu/#results", "COMU"],
    ["Catalyst", "The FRC robotics library", "/catalyst/", "Page"],
    ["Catalyst versions", "1.12 on roboRIO, 2.0 on Systemcore", "/catalyst/#versions", "Catalyst"],
    ["Catalyst apps", "Console, App, Pit, Setup", "/catalyst/#suite", "Catalyst"],
    ["Robotics", "FRC Team 5805 and its robots", "/robotics/", "Page"],
    ["Numbers", "Taken apart as you scroll", "/robotics/#numbers", "Robotics"],
    ["Genesis, Exodus, Leviticus", "The robots before", "/robotics/#robots", "Robotics"],
    ["Hardware", "O0X boards in 3D", "/hardware/", "Page"],
    ["MOTE H1", "My RK3576 computer board", "/hardware/#mote", "Hardware"],
    ["TomAs测评", "The Bilibili channel", "/channel/", "Page"],
    ["Awards", "Recognition", "/#recognition", "Home"],
    ["Contact", "yu_thomas1226@outlook.com", "/#contact", "Home"],
    ["Email me", "yu_thomas1226@outlook.com", "mailto:yu_thomas1226@outlook.com", "Action"],
    ["GitHub", "github.com/TomAs-1226", "https://github.com/TomAs-1226", "Link"],
    ["Hugging Face", "Ornimetrics models", "https://huggingface.co/Ornimetrics", "Link"],
    ["Catalyst docs", "tomas-1226.github.io/FrcCatalyst", "https://tomas-1226.github.io/FrcCatalyst/", "Link"],
    ["frc5805.com", "The team site I built", "https://frc5805.com", "Link"],
    ["Websites for businesses", "What I build for local businesses", "/hire/", "Page"],
  ];
  let root, input, list, sel = 0, shown = [], lastFocus = null;

  function build() {
    root = document.createElement("div");
    root.className = "kbar";
    root.innerHTML = `<div class="kbar-panel" role="dialog" aria-modal="true" aria-label="Search the site">
      <input class="kbar-input" type="text" placeholder="Search pages, projects, links…" aria-label="Search" autocomplete="off" spellcheck="false" />
      <ul class="kbar-list" role="listbox"></ul>
      <div class="kbar-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </div>`;
    document.body.append(root);
    input = root.querySelector("input");
    list = root.querySelector("ul");
    root.addEventListener("mousedown", (e) => { if (e.target === root) close(); });
    input.addEventListener("input", () => { sel = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { sel = Math.min(shown.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && shown[sel]) { go(shown[sel][2]); e.preventDefault(); }
      else if (e.key === "Escape") close();
    });
  }
  const score = (item, q) => {
    if (!q) return 1;
    const hay = (item[0] + " " + item[1] + " " + item[3]).toLowerCase();
    if (item[0].toLowerCase().startsWith(q)) return 3;
    if (hay.includes(q)) return 2;
    let i = 0; for (const c of hay) if (c === q[i]) i++;
    return i === q.length ? 1 : 0;
  };
  function render() {
    const q = input.value.trim().toLowerCase();
    shown = ITEMS.map((it) => [it, score(it, q)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    list.innerHTML = shown.length
      ? shown.map((it, i) => `<li role="option" aria-selected="${i === sel}"><a href="${it[2]}"><b>${it[0]}</b><small>${it[1]}</small><i>${it[3]}</i></a></li>`).join("")
      : `<li class="kbar-empty">Nothing matches “${input.value.replace(/[<&]/g, "")}”.</li>`;
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
  function go(href) {
    close();
    if (/^https?:/.test(href)) window.open(href, "_blank", "noopener"); else location.href = href;
  }
  function open() {
    if (!root) build();
    lastFocus = document.activeElement;
    root.classList.add("open");
    input.value = "";
    sel = 0;
    render();
    input.focus();
  }
  function close() { root?.classList.remove("open"); lastFocus?.focus?.(); }

  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); root?.classList.contains("open") ? close() : open(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); open(); }
  });
  document.querySelectorAll("[data-kbar]").forEach((b) => b.addEventListener("click", open));
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelectorAll(".kbar-btn kbd").forEach((k) => { k.textContent = "Ctrl K"; });
})();
