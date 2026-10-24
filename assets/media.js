/* Embedded media that should cost nothing until it is wanted:
 *   [data-spline-frame]  a hosted Spline scene (my.spline.design), as an iframe
 *   [data-spline-code]   a Spline scene file, in Spline's own <spline-viewer>
 *   [data-tour]          tabs that swap one stage between several scenes
 *   [data-yt]            a YouTube thumbnail that becomes the player when pressed
 * Scenes load when they come within a screen of the viewport, and only the visible tab's scene loads.
 */
const VIEWER = 'https://unpkg.com/@splinetool/viewer@2.0.64/build/spline-viewer.js'
let viewerLoading = null
const loadViewer = () => (viewerLoading ??= import(VIEWER))

function start(box) {
  if (box.dataset.loaded) return
  box.dataset.loaded = '1'
  const done = () => { box.dataset.state = 'ready' }
  if (box.dataset.splineFrame) {
    const f = document.createElement('iframe')
    f.src = box.dataset.splineFrame
    f.title = box.getAttribute('aria-label') || 'Spline scene'
    f.loading = 'lazy'
    f.allow = 'fullscreen'
    f.addEventListener('load', () => setTimeout(done, 600))
    box.append(f)
  } else if (box.dataset.splineCode) {
    loadViewer().then(() => {
      const v = document.createElement('spline-viewer')
      v.setAttribute('url', box.dataset.splineCode)
      v.setAttribute('loading-anim-type', 'none')
      v.addEventListener('load-complete', done)
      setTimeout(done, 6000) // the event is not fired by every viewer build
      box.append(v)
    }).catch(() => { box.dataset.state = 'failed' })
  }
}

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting && !e.target.hidden) { io.unobserve(e.target); start(e.target) }
  }), { rootMargin: '80% 0px' })
  : null
document.querySelectorAll('[data-spline-frame], [data-spline-code]').forEach((b) => { if (!b.hidden) io ? io.observe(b) : start(b) })

/* Tabs: one scene and one paragraph at a time. */
document.querySelectorAll('[data-tour]').forEach((tour) => {
  const tabs = [...tour.querySelectorAll('[data-part]')]
  const show = (part) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.part === part)))
    tour.querySelectorAll('[data-part-scene]').forEach((s) => {
      s.hidden = s.dataset.partScene !== part
      if (!s.hidden) start(s)
    })
    tour.querySelectorAll('[data-part-copy]').forEach((c) => { c.hidden = c.dataset.partCopy !== part })
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.part)))
  tour.querySelector('[role=tablist]')?.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')
    const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1
    if (j < 0) return
    tabs[j].focus()
    show(tabs[j].dataset.part)
  })
})

/* YouTube: the player (and Google's scripts) load only when someone presses play. */
document.querySelectorAll('[data-yt]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe')
    f.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0`
    f.title = btn.getAttribute('aria-label') || 'Video'
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen'
    f.allowFullscreen = true
    f.className = 'yt-frame'
    btn.replaceWith(f)
  }, { once: true })
})

/* Bar charts fill when they come into view. */
document.querySelectorAll('.bars').forEach((b) => {
  if (!io) { b.classList.add('in'); return }
  const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { b.classList.add('in'); o.disconnect() } }, { rootMargin: '0px 0px -10% 0px' })
  o.observe(b)
})
