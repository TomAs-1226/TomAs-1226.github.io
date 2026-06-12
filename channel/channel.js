/* ======================================================================
 *  TomAs测评 channel site — reads the live bili.json the box keeps fresh.
 * ====================================================================== */
(function () {
  "use strict";
  const SPACE = "https://space.bilibili.com/1983280115";

  Liquid.init({ tone: "dark" });
  Liquid.upgrade(document.body);
  Liquid.configure({ bend: 26, frost: 2.0, bezel: 0.6, saturate: 1.7, tint: "#fb7299", tintStrength: 0.05 });
  // pink + blue light rig to match the channel identity
  Liquid.Light.lights[0].color = [255, 150, 190];
  Liquid.Light.add({ x: 0.9, y: 0.1, intensity: 0.5, radius: 1600, fixed: true, color: [90, 214, 255] });

  function glassLink(label, href, opts) {
    const b = Liquid.button(label, opts || {});
    b.addEventListener("click", () => {
      if (href.startsWith("#")) { const el = document.querySelector(href); if (el) el.scrollIntoView({ behavior: "smooth" }); }
      else if (href.startsWith("mailto") || href.startsWith("/")) window.location.href = href;
      else window.open(href, "_blank", "noopener");
    });
    return b;
  }
  document.getElementById("cnav-cta").append(glassLink("Bilibili ↗", SPACE, { tint: "blue", size: "small" }));

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nViews = (n) => { n = +n || 0; return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "万" : n.toLocaleString(); };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fdate(ts) { if (!ts) return ""; const d = new Date(ts * 1000); return MON[d.getMonth()] + " " + d.getFullYear(); }
  function countUp(el, end) {
    const dur = 1300, t0 = performance.now();
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * e).toLocaleString();
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- render ---------- */
  let allVideos = [], sortMode = "new", query = "", catFilter = "all";
  const category = (v) => (/速报|快报|新闻|资讯/.test(v.title || "") ? "news" : "review");

  function renderHero(d) {
    const card = document.getElementById("chero-card");
    card.innerHTML = `
      <span class="lg-rim"></span>
      <div class="chero-inner">
        <img class="chero-ava" src="${esc(d.face)}" referrerpolicy="no-referrer" alt="${esc(d.name)}" />
        <div class="chero-body">
          <div class="chero-name"><h1>${esc(d.name)}</h1>${d.level ? `<span class="chero-lv">LV ${d.level}</span>` : ""}</div>
          <p class="chero-sign">${esc(d.sign)}</p>
          <div class="chero-tags"><span class="chero-tag">美高科技区</span><span class="chero-tag">Tech reviews</span><span class="chero-tag">每日科技速报</span></div>
          <div class="chero-actions" id="chero-actions"></div>
        </div>
      </div>`;
    card.setAttribute("data-lg", "card");
    Liquid.glaze(card, { bendMul: 0.8, tint: "#fb7299", tintStrength: 0.06 });
    document.getElementById("chero-actions").append(
      glassLink("Visit on Bilibili", SPACE, { tint: "blue" }),
      glassLink("Latest videos", "#videos")
    );
  }

  function renderStats(d) {
    const t = d.totals || {};
    const el = document.getElementById("cstats");
    el.innerHTML = `
      <div class="cstat" data-lg="card"><span class="lg-rim"></span><div class="lg-content"><b data-c="${d.follower || 0}">0</b><span>Followers</span></div></div>
      <div class="cstat blue" data-lg="card"><span class="lg-rim"></span><div class="lg-content"><b data-c="${t.videos || allVideos.length}">0</b><span>Videos</span></div></div>
      <div class="cstat" data-lg="card"><span class="lg-rim"></span><div class="lg-content"><b data-c="${t.views || 0}">0</b><span>Total views</span></div></div>
      <div class="cstat blue" data-lg="card"><span class="lg-rim"></span><div class="lg-content"><b data-c="${t.collections || 0}">0</b><span>Collections</span></div></div>`;
    Liquid.upgrade(el);
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { countUp(e.target, +e.target.dataset.c); io.unobserve(e.target); }
    }), { threshold: 0.2 });
    el.querySelectorAll("[data-c]").forEach((b) => io.observe(b));
  }

  function videoCard(v, rank) {
    return `
      <a class="cvid" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="cvid-thumb">
          <img src="${esc(v.pic)}" loading="lazy" referrerpolicy="no-referrer" alt="" />
          ${rank ? `<span class="cvid-rank">#${rank}</span>` : ""}
          ${v.length ? `<span class="cvid-len">${esc(v.length)}</span>` : ""}
        </div>
        <div class="cvid-body">
          <div class="cvid-title">${esc(v.title)}</div>
          <div class="cvid-meta"><span class="v">▶ ${nViews(v.views)}</span><span>${fdate(v.date)}</span></div>
        </div>
      </a>`;
  }

  function renderVideos() {
    const grid = document.getElementById("cvideos");
    const empty = document.getElementById("cvideos-empty");
    let list = allVideos.slice();
    if (catFilter !== "all") list = list.filter((v) => category(v) === catFilter);
    if (query) list = list.filter((v) => (v.title || "").toLowerCase().includes(query));
    if (sortMode === "views") list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sortMode === "old") list.sort((a, b) => (a.date || 0) - (b.date || 0));
    else list.sort((a, b) => (b.date || 0) - (a.date || 0));
    empty.hidden = list.length > 0;
    grid.innerHTML = list.map((v, i) => videoCard(v, sortMode === "views" ? i + 1 : 0)).join("");
  }

  function renderCollections(d) {
    const el = document.getElementById("ccollections");
    const cols = d.collections || [];
    if (!cols.length) { document.getElementById("collections").hidden = true; return; }
    el.innerHTML = cols.map((c) => `
      <a class="ccoll" href="${esc(c.url)}" target="_blank" rel="noopener">
        ${c.cover ? `<img class="ccoll-cover" src="${esc(c.cover)}" referrerpolicy="no-referrer" loading="lazy" alt="" />` : ""}
        <div class="ccoll-body">
          <div class="ccoll-title">${esc(c.title)}</div>
          <div class="ccoll-count">${c.count} video${c.count === 1 ? "" : "s"} →</div>
        </div>
      </a>`).join("");
  }

  function buildControls() {
    const cat = Liquid.segmented(["All", "Reviews", "速报"], {
      active: 0, onchange: (i) => { catFilter = ["all", "review", "news"][i]; renderVideos(); },
    });
    document.getElementById("cv-cat").append(cat);
    const search = Liquid.input({ placeholder: "Search videos…" });
    const input = search.querySelector("input");
    input.addEventListener("input", () => { query = input.value.trim().toLowerCase(); renderVideos(); });
    document.getElementById("cv-search").append(search);
    const seg = Liquid.segmented(["Newest", "Most viewed", "Oldest"], {
      active: 0, onchange: (i) => { sortMode = ["new", "views", "old"][i]; renderVideos(); },
    });
    document.getElementById("cv-sort").append(seg);
  }

  function renderFeatured(d) {
    const vids = (d.videos || []).filter((v) => v.bvid);
    if (!vids.length) return;
    const f = vids.slice().sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    document.getElementById("featured").hidden = false;
    const el = document.getElementById("cfeatured");
    el.innerHTML = `
      <div class="cfeat-player">
        <iframe src="https://player.bilibili.com/player.html?bvid=${encodeURIComponent(f.bvid)}&autoplay=0&danmaku=0&high_quality=1" allowfullscreen scrolling="no" loading="lazy"></iframe>
      </div>
      <div class="cfeat-info" data-lg="card"><span class="lg-rim"></span><div class="lg-content">
        <span class="cfeat-badge">▶ Most watched</span>
        <h3>${esc(f.title)}</h3>
        <div class="cfeat-meta"><span class="v">${nViews(f.views)} views</span><span>${fdate(f.date)}</span>${f.length ? `<span>${esc(f.length)}</span>` : ""}</div>
        <div class="cfeat-actions" id="cfeat-actions"></div>
      </div></div>`;
    Liquid.upgrade(el);
    document.getElementById("cfeat-actions").append(glassLink("Watch on Bilibili", f.url, { tint: "blue" }));
  }

  function renderNumbers(d) {
    const vids = (d.videos || []).filter((v) => v.bvid);
    if (vids.length < 2) return;
    document.getElementById("numbers").hidden = false;
    const byViews = vids.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
    const most = byViews[0];
    const avg = Math.round(vids.reduce((s, v) => s + (v.views || 0), 0) / vids.length);
    const dates = vids.map((v) => v.date || 0).filter(Boolean);
    const span = dates.length ? (Math.max(...dates) - Math.min(...dates)) / (365.25 * 86400) : 0;
    const totalViews = (d.totals && d.totals.views) || vids.reduce((s, v) => s + (v.views || 0), 0);
    const figs = [
      [nViews(most.views), "Most viewed"],
      [nViews(avg), "Avg views / video"],
      [nViews(totalViews), "Total views"],
      [span >= 1 ? span.toFixed(1) + " yrs" : Math.max(1, Math.round(span * 12)) + " mo", "Active span"],
    ];
    const top = byViews.slice(0, 6), max = top[0].views || 1;
    const el = document.getElementById("cnumbers");
    el.innerHTML = `
      <div class="cana-figs">${figs.map((f) => `<div class="cfig" data-lg="card"><span class="lg-rim"></span><div class="lg-content"><b>${f[0]}</b><span>${f[1]}</span></div></div>`).join("")}</div>
      <div class="cana-bars">${top.map((v) => `<div class="cbar"><span class="cbar-label">${esc(v.title)}</span><span class="cbar-val">${nViews(v.views)}</span><div class="cbar-track"><div class="cbar-fill" data-w="${Math.round((v.views / max) * 100)}"></div></div></div>`).join("")}</div>`;
    Liquid.upgrade(el.querySelector(".cana-figs"));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { el.querySelectorAll(".cbar-fill").forEach((b) => { b.style.width = b.dataset.w + "%"; }); io.disconnect(); }
    }), { threshold: 0.2 });
    io.observe(el);
  }

  /* ---------- load ---------- */
  fetch("/bili.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then((d) => {
      allVideos = d.videos || [];
      renderHero(d);
      renderStats(d);
      renderFeatured(d);
      buildControls();
      renderVideos();
      renderNumbers(d);
      renderCollections(d);
      const u = document.getElementById("cupdated");
      if (u && d.updated) {
        const mins = Math.max(0, Math.floor(Date.now() / 1000 - d.updated) / 60);
        u.textContent = "synced " + (mins < 60 ? Math.floor(mins) + "m" : Math.floor(mins / 60) + "h") + " ago";
      }
    })
    .catch(() => {
      document.getElementById("chero-card").innerHTML =
        `<div class="chero-loading">Couldn't load live data — <a href="${SPACE}" target="_blank" rel="noopener" style="color:var(--blue)">visit TomAs测评 on Bilibili →</a></div>`;
    });

  /* ---------- editable content (about / upcoming / membership / sponsors / collab) ---------- */
  function renderContent(c) {
    const email = (c.collab && c.collab.email) || "yu_thomas1226@outlook.com";

    // ABOUT
    if (c.about) {
      const el = document.getElementById("cabout");
      el.innerHTML = `
        <div class="cabout-main">
          <span class="ckicker">About the channel</span>
          <h2>${esc(c.about.headline)}</h2>
          ${(c.about.body || []).map((p) => `<p>${esc(p)}</p>`).join("")}
        </div>
        <div class="cabout-creator" data-lg="card"><span class="lg-rim"></span><div class="lg-content">
          <span class="ck">The creator</span><p>${esc(c.about.creator)}</p></div></div>`;
      Liquid.upgrade(el);
    }

    // UPCOMING
    if (c.upcoming && c.upcoming.length) {
      document.getElementById("upcoming").hidden = false;
      document.getElementById("cupcoming").innerHTML = c.upcoming.map((u) => `
        <div class="cup"><div class="cup-inner">
          ${u.tag ? `<span class="cup-tag">${esc(u.tag)}</span>` : ""}
          <span class="cup-eta">${esc(u.eta || "Soon")}</span>
          <h3>${esc(u.title)}</h3>
          ${u.note ? `<p>${esc(u.note)}</p>` : ""}
        </div></div>`).join("");
      document.getElementById("cup-suggest").append(
        glassLink("Suggest a topic", "mailto:" + email + "?subject=Video%20idea%20for%20TomAs测评", { size: "small", tint: "blue" })
      );
    }

    // MEMBERSHIP
    if (c.membership && c.membership.tiers && c.membership.tiers.length) {
      document.getElementById("membership").hidden = false;
      document.getElementById("cmember-note").textContent = c.membership.note || "";
      const tiers = document.getElementById("cmember-tiers");
      tiers.innerHTML = c.membership.tiers.map((t) => `
        <div class="ctier ${t.featured ? "featured" : ""}" data-lg="card">
          <span class="lg-rim"></span>
          ${t.featured ? '<span class="ctier-badge">Most popular</span>' : ""}
          <div class="lg-content">
            <div class="ctier-name">${esc(t.name)}</div>
            ${t.price ? `<div class="ctier-price">${esc(t.price)}</div>` : ""}
            <ul>${(t.perks || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          </div></div>`).join("");
      Liquid.upgrade(tiers);
      document.getElementById("cmember-cta").append(
        glassLink(c.membership.cta || "Support on Bilibili", SPACE, { tint: "blue" })
      );
    }

    // SPONSORS
    if (c.sponsors && c.sponsors.list && c.sponsors.list.length) {
      document.getElementById("sponsors").hidden = false;
      document.getElementById("cspon-note").textContent = c.sponsors.note || "";
      document.getElementById("csponsors").innerHTML = c.sponsors.list.map((s) => {
        const href = s.url || ("mailto:" + email);
        const ext = s.url && !s.url.startsWith("mailto") ? ' target="_blank" rel="noopener"' : "";
        return `<a class="cspon" href="${esc(href)}"${ext}><div class="cspon-inner">
          <div class="cspon-name">${esc(s.name)}</div>
          <div class="cspon-blurb">${esc(s.blurb || "")}</div>
          <div class="cspon-go">Get in touch →</div></div></a>`;
      }).join("");
    }

    // COLLAB (card already glazed at init)
    document.getElementById("ccollab-note").textContent =
      (c.collab && c.collab.note) || "For sponsorships, reviews, and collaborations.";
    document.getElementById("ccollab-actions").append(
      glassLink("Email me", "mailto:" + email, { tint: "green" }),
      glassLink("Bilibili", SPACE, { tint: "blue" })
    );
  }

  fetch("channel-content.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then(renderContent)
    .catch(() => {
      // minimum viable: still show the collab card with the default email
      renderContent({ collab: { email: "yu_thomas1226@outlook.com", note: "For sponsorships, reviews, and collaborations." } });
    });
})();
