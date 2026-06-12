/* ======================================================================
 *  SITE.JS — Liquid Engine wiring, content, Bilibili live data, settings
 * ====================================================================== */
(function () {
  "use strict";
  document.getElementById("yr").textContent = "2026";

  /* ---------------- Liquid Engine ---------------- */
  const BASE = { bend: 30, frost: 2.0, bezel: 0.6, saturate: 1.7, tint: "#8fd6ff", tintStrength: 0.05 };
  Liquid.init({ tone: "dark" });
  Liquid.upgrade(document.body);
  Liquid.configure(BASE);
  Liquid.Light.lights[0].color = [150, 245, 230];
  Liquid.Light.lights[0].radius = 1100;
  Liquid.Light.add({ x: 0.92, y: 0.08, intensity: 0.5, radius: 1600, fixed: true, color: [120, 180, 255] });
  Liquid.Light.add({ x: 0.05, y: 0.95, intensity: 0.45, radius: 1700, fixed: true, color: [185, 140, 255] });

  /* ---------------- real links ---------------- */
  const URL = {
    github: "https://github.com/TomAs-1226",
    hf: "https://huggingface.co/Ornimetrics/ornimetrics-edge",
    site: "https://sites.google.com/view/ornimetrics/home",
    paper: "https://csitcp.org/abstract/16/164csit17",
    paperPdf: "https://aircconline.com/csit/papers/vol16/csit160417.pdf",
    bilibili: "https://space.bilibili.com/1983280115",
    catalystRepo: "https://github.com/TomAs-1226/FrcCatalyst",
    catalystDocs: "https://tomas-1226.github.io/FrcCatalyst/",
    email: "mailto:yu_thomas1226@outlook.com",
  };

  function glassLink(label, href, opts) {
    const b = Liquid.button(label, opts || {});
    b.addEventListener("click", () => {
      if (href.startsWith("#")) { const el = document.querySelector(href); if (el) el.scrollIntoView({ behavior: "smooth" }); }
      else if (href.startsWith("/") || href.startsWith("mailto")) window.location.href = href; // internal / mail: same tab
      else window.open(href, "_blank", "noopener");
    });
    return b;
  }

  document.getElementById("nav-cta").append(glassLink("Contact", "#contact", { tint: "blue", size: "small" }));
  document.getElementById("hero-actions").append(
    glassLink("View research", "#ornimetrics"),
    glassLink("FRC Catalyst", URL.catalystDocs, { tint: "green" }),
    glassLink("Bilibili", URL.bilibili, { tint: "blue" })
  );
  document.getElementById("ornimetrics-links").append(
    glassLink("Deep-dive site", URL.site, { tint: "green" }),
    glassLink("Model on Hugging Face", URL.hf),
    glassLink("Read the paper", URL.paper, { tint: "blue" }),
    glassLink("GitHub", URL.github)
  );
  document.getElementById("paper-links").append(
    glassLink("Abstract", URL.paper, { size: "small", tint: "blue" }),
    glassLink("Full PDF", URL.paperPdf, { size: "small" })
  );
  document.getElementById("release-links").append(
    glassLink("Open on Hugging Face", URL.hf, { size: "small", tint: "green" }),
    glassLink("GitHub", URL.github, { size: "small" })
  );
  document.getElementById("catalyst-links").append(
    glassLink("GitHub repo", URL.catalystRepo, { tint: "blue" }),
    glassLink("Docs & tools", URL.catalystDocs, { tint: "green" })
  );
  document.getElementById("contact-actions").append(
    glassLink("Email", URL.email, { tint: "green" }),
    glassLink("GitHub", URL.github),
    glassLink("Hugging Face", URL.hf),
    glassLink("Bilibili", URL.bilibili, { tint: "blue" })
  );

  /* ---------------- projects ---------------- */
  const projects = [
    { ic: "🦅", tag: "AI · Conservation", status: ["ok", "In development"],
      title: "WWCC Wildlife AI",
      body: "An AI triage assistant for a wildlife-rescue nonprofit — it helps callers identify injured animals and get the right next step quickly, delivered as an embeddable chat widget.",
      chips: ["Computer vision", "LLM triage", "Web widget"] },
    { ic: "⚡", tag: "EdTech", status: ["ok", "Active"],
      title: "SparkHub",
      body: "A student learning platform built by students, for students — peer tutoring and teaching on a custom web-based LMS so learners can run courses and track progress in one place.",
      chips: ["Web LMS", "Peer tutoring", "Founder"] },
    { ic: "🤖", tag: "AI · Edge", status: ["ok", "Running 24/7"],
      title: "Thomas-Agent",
      body: "A self-hosted AI agent on an Orange Pi 5 — a Discord bot with persistent multi-user memory, web search and tool use, tuned to run on RK3588 edge silicon.",
      chips: ["Python", "OpenAI", "RK3588", "Edge"] },
    { ic: "🖥️", tag: "Infrastructure", status: ["ok", "Hosting this site"],
      title: "Self-hosted homelab",
      body: "A single small server running 12+ services — GPU video rendering, automation pipelines, network monitoring, and the web server delivering this very page.",
      chips: ["Linux", "Docker", "nginx", "systemd"] },
  ];
  const grid = document.getElementById("projects-grid");
  projects.forEach((p, i) => {
    const chips = p.chips.map((c) => `<span class="chip">${c}</span>`).join("");
    const card = Liquid.card(`
      <div class="proj-top"><span class="proj-ic">${p.ic}</span><span class="proj-tag">${p.tag}</span></div>
      <h3>${p.title}</h3><p>${p.body}</p>
      <div class="proj-meta">${chips}</div>
      <div class="proj-status"><span class="dot ${p.status[0]}"></span>${p.status[1]}</div>`);
    card.classList.add("proj", "reveal");
    card.style.setProperty("--d", (i * 0.06) + "s");
    grid.append(card);
  });

  /* ---------------- tech marquee ---------------- */
  const stack = ["Python","PyTorch","YOLOv11","EfficientNetV2","OpenCV","ArcFace","Java","WPILib",
    "Phoenix 6","React","Three.js","Node","nginx","Docker","systemd","Raspberry Pi","Hailo-8",
    "OpenAI","Linux","Cloudflare","Git"];
  const mtrack = document.getElementById("marquee-track");
  if (mtrack) { const h = stack.map((s) => `<span class="m-item">${s}</span>`).join(""); mtrack.innerHTML = h + h; }

  /* ---------------- scroll progress ---------------- */
  const prog = document.getElementById("scroll-progress");
  addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
  }, { passive: true });

  /* ---------------- floating glass dock ---------------- */
  const dockWrap = document.getElementById("dock-wrap");
  if (dockWrap && Liquid.dock) {
    dockWrap.append(Liquid.dock([
      { icon: "🐙", label: "GitHub", onclick: () => window.open(URL.github, "_blank", "noopener") },
      { icon: "🤗", label: "Hugging Face", onclick: () => window.open(URL.hf, "_blank", "noopener") },
      { icon: "🪶", label: "Ornimetrics", onclick: () => window.open(URL.site, "_blank", "noopener") },
      { icon: "🤖", label: "FRC Catalyst", onclick: () => window.open(URL.catalystDocs, "_blank", "noopener") },
      { icon: "📺", label: "Bilibili", onclick: () => window.open(URL.bilibili, "_blank", "noopener") },
      { icon: "✉️", label: "Email", onclick: () => window.open(URL.email, "_self") },
    ]));
  }

  /* ---------------- Bilibili live ---------------- */
  function esc(s) { return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function nViews(n) { n = +n || 0; return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "万" : n.toLocaleString(); }
  function ago(ts) {
    if (!ts) return ""; const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function renderBili(d) {
    const el = document.getElementById("bili");
    if (!el) return;
    const vids = (d.videos || []).slice(0, 6).map((v) => `
      <a class="vid" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="vid-thumb"><img src="${esc(v.pic)}" loading="lazy" referrerpolicy="no-referrer" alt="" />
          ${v.length ? `<span class="vid-len">${esc(v.length)}</span>` : ""}</div>
        <div class="vid-body"><div class="vid-title">${esc(v.title)}</div>
          <div class="vid-meta">▶ ${nViews(v.views)} · ${ago(v.date)}</div></div>
      </a>`).join("");
    el.innerHTML = `
      <div class="bili-profile" data-lg="card"><span class="lg-rim"></span><div class="lg-content">
        <img class="bili-ava" src="${esc(d.face)}" referrerpolicy="no-referrer" alt="${esc(d.name)}" />
        <div class="bili-name">${esc(d.name)} ${d.level ? `<span class="bili-lv">LV${d.level}</span>` : ""}</div>
        <div class="bili-sign">${esc(d.sign)}</div>
        <div class="bili-follow">
          <div><b>${(+d.follower || 0).toLocaleString()}</b><span>Followers</span></div>
          <div><b>${(+d.following || 0).toLocaleString()}</b><span>Following</span></div>
        </div>
        <div class="bili-visit"></div>
      </div></div>
      <div class="bili-vids">${vids || '<div class="bili-loading">No videos found</div>'}</div>
      <div class="bili-update">${d.updated ? "synced " + ago(d.updated) : ""} · live from space ${d.mid || ""}</div>`;
    Liquid.upgrade(el); // glaze the .bili-profile card
    const visit = el.querySelector(".bili-visit");
    if (visit) visit.append(glassLink("Visit channel", URL.bilibili, { tint: "blue", size: "small" }));
    const cta = document.getElementById("channel-cta");
    if (cta && !cta.childElementCount) cta.append(glassLink("Open the full channel site →", "/channel/", { tint: "green" }));
  }
  fetch("bili.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then(renderBili)
    .catch(() => {
      const el = document.getElementById("bili");
      if (el) el.innerHTML = `<div class="bili-loading">Couldn't load live stats — <a href="${URL.bilibili}" target="_blank" rel="noopener" style="color:var(--cyan)">visit TomAs测评 on Bilibili →</a></div>`;
    });

  /* ---------------- settings panel (the glass playground) ---------------- */
  let curBend = 30, curFrost = 2.0, curTone = "dark";
  let pendingCfg = null, cfgQueued = false;
  function applyConfig(patch) {
    pendingCfg = Object.assign(pendingCfg || {}, patch);
    if (cfgQueued) return; cfgQueued = true;
    requestAnimationFrame(() => { Liquid.configure(pendingCfg); pendingCfg = null; cfgQueued = false; });
  }
  function setTone(t) {
    curTone = t; document.documentElement.dataset.siteTone = t;
    Liquid.setTone(t, { bend: curBend, frost: curFrost, tint: BASE.tint, tintStrength: BASE.tintStrength });
  }

  const panel = document.getElementById("settings-panel");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("settings-close");
  const togglePanel = (open) => { panel.classList.toggle("open", open); panel.setAttribute("aria-hidden", String(!open)); };
  openBtn.addEventListener("click", () => togglePanel(!panel.classList.contains("open")));
  closeBtn.addEventListener("click", () => togglePanel(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape") togglePanel(false); });

  // theme
  const themeSeg = Liquid.segmented(["Dark", "Light"], { active: 0, onchange: (i) => setTone(i ? "light" : "dark") });
  document.getElementById("set-theme").append(themeSeg);
  // background motion
  document.getElementById("set-motion").append(
    Liquid.toggle({ on: true, onchange: (on) => { window.__bgPaused = !on; } })
  );
  // glass refraction + frost
  const bendSlider = Liquid.slider({ value: (30 - 8) / 52, oninput: (v) => { curBend = 8 + v * 52; applyConfig({ bend: curBend }); } });
  const frostSlider = Liquid.slider({ value: (2 - 0.5) / 4.5, oninput: (v) => { curFrost = 0.5 + v * 4.5; applyConfig({ frost: curFrost }); } });
  document.getElementById("set-bend").append(bendSlider);
  document.getElementById("set-frost").append(frostSlider);
  // light colour
  const lightCols = { Teal: [150, 245, 230], Blue: [120, 180, 255], Violet: [185, 140, 255], Pink: [255, 150, 210] };
  const lnames = Object.keys(lightCols);
  document.getElementById("set-light").append(
    Liquid.segmented(lnames, { active: 0, onchange: (i) => { Liquid.Light.lights[0].color = lightCols[lnames[i]]; } })
  );
  // reset
  const resetBtn = Liquid.button("Reset to defaults", { size: "small" });
  resetBtn.addEventListener("click", () => {
    curBend = 30; curFrost = 2.0;
    bendSlider.set((30 - 8) / 52, false); frostSlider.set((2 - 0.5) / 4.5, false);
    setTone("dark"); applyConfig(BASE);
    Liquid.Light.lights[0].color = [150, 245, 230];
  });
  document.getElementById("set-reset").append(resetBtn);

  /* ---------------- scroll reveal ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------------- count-up stats ---------------- */
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, dur = 1400, t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(end * eased).toLocaleString();
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick); cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((c) => cio.observe(c));

  /* ---------------- nav shadow on scroll ---------------- */
  const nav = document.getElementById("nav");
  addEventListener("scroll", () => { nav.style.scale = window.scrollY > 40 ? "0.985" : "1"; }, { passive: true });
})();
