/* "Lately on GitHub": my most recently pushed public repositories, straight from GitHub's API
   (unauthenticated: 60 requests an hour per visitor, plenty). If it fails, the section hides. */
(function () {
  "use strict";
  const box = document.getElementById("gh-feed");
  if (!box) return;
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 30) return Math.round(s / 86400) + " d ago";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  fetch("https://api.github.com/users/TomAs-1226/repos?sort=pushed&per_page=30", { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((repos) => {
      const list = repos.filter((r) => !r.fork && !r.archived && !["TomAs-1226", "TEST1", "TomAs-1226.github.io"].includes(r.name)).slice(0, 6);
      if (!list.length) throw new Error("empty");
      box.innerHTML = list.map((r) => `
        <li><a href="${esc(r.html_url)}" target="_blank" rel="noopener">
          <b>${esc(r.name)}</b>
          <span>${esc(r.description || "")}</span>
          <small>${r.language ? esc(r.language) + " · " : ""}pushed ${ago(r.pushed_at)}${r.stargazers_count ? " · ★ " + r.stargazers_count : ""}</small>
        </a></li>`).join("");
    })
    .catch(() => { document.getElementById("github")?.setAttribute("hidden", ""); });
})();
