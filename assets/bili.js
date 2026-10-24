/* TomAs测评 numbers and latest videos. A server refreshes bili.json on the bilidata branch; the copy
   in the repo is the fallback. The figures written into the HTML are the last known values, so the
   page reads right even when both fetches fail.

   Fills, when present: #bili-stats (dl.figures), #bili-videos (count from data-count, default 6),
   #bili-collections, #bili-updated. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const compact = (n) => {
    n = +n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "k";
    return n.toLocaleString("en-US");
  };
  const https = (u) => String(u || "").replace(/^http:\/\//, "https://").replace(/^\/\//, "https://");
  const thumb = (u) => esc(https(u)) + "@480w_300h_1c.webp";
  const month = (ts) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  function render(d) {
    const t = d.totals || {};
    const face = document.getElementById("bili-face");
    if (face && d.face) { const local = face.src; face.referrerPolicy = "no-referrer"; face.onerror = () => { face.onerror = null; face.src = local; }; face.src = https(d.face) + "@400w_400h_1c.webp"; }
    const lv = document.getElementById("bili-level");
    if (lv && d.level) lv.textContent = "LV" + d.level;
    const sign = document.getElementById("bili-sign");
    if (sign && d.sign) sign.textContent = d.sign;
    const stats = document.getElementById("bili-stats");
    if (stats && d.follower) {
      stats.innerHTML =
        `<div><dt>${compact(d.follower)}</dt><dd>followers</dd></div>` +
        (t.views ? `<div><dt>${compact(t.views)}</dt><dd>views</dd></div>` : "") +
        (t.videos ? `<div><dt>${t.videos}</dt><dd>videos</dd></div>` : "");
    }
    const box = document.getElementById("bili-videos");
    if (box && d.videos?.length) {
      const n = Number(box.dataset.count || 6);
      box.innerHTML = d.videos.slice(0, n).map((v) => `
        <a class="vid" href="${esc(https(v.url))}" target="_blank" rel="noopener">
          <div class="vid-thumb"><img src="${thumb(v.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
            ${v.length ? `<span class="vid-len">${esc(v.length)}</span>` : ""}</div>
          <div class="vid-title">${esc(v.title)}</div>
          <div class="vid-meta">${compact(v.views)} views${v.date ? " · " + month(v.date) : ""}</div>
        </a>`).join("");
    }
    const cols = document.getElementById("bili-collections");
    if (cols && d.collections?.length) {
      cols.innerHTML = d.collections.map((c) => `
        <a class="vid" href="${esc(https(c.url))}" target="_blank" rel="noopener">
          <div class="vid-thumb"><img src="${thumb(c.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
            <span class="vid-len">${c.count} videos</span></div>
          <div class="vid-title">${esc(String(c.title).replace(/^合集·/, ""))}</div>
          ${c.desc ? `<div class="vid-meta">${esc(c.desc)}</div>` : ""}
        </a>`).join("");
    }
    const up = document.getElementById("bili-updated");
    if (up && d.updated) {
      up.textContent = "Figures from Bilibili, " + new Date(d.updated * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + ".";
    }
  }

  (async function load() {
    for (const src of ["https://raw.githubusercontent.com/TomAs-1226/TomAs-1226.github.io/bilidata/bili.json", "/bili.json"]) {
      try {
        const r = await fetch(src, { cache: "no-store" });
        if (r.ok) { render(await r.json()); return; }
      } catch (e) { /* try the next source */ }
    }
  })();
})();
