/* Starts a 3D stage for every [data-model] on the page, but only when it comes within a screen of the
 * viewport: three.js and the model cost nothing until you scroll to them. If WebGL or the model fails,
 * the stage's own fallback image (an <img> inside it) stays.
 *
 *   <div class="stage" data-model="/models/o0x-m.glb" data-kind="board" data-az="0.6">
 *     <canvas aria-label="..."></canvas>
 *   </div>
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const phone = matchMedia('(max-width: 760px)').matches

function start(el) {
  const canvas = el.querySelector('canvas')
  if (!canvas) return
  el.dataset.state = 'loading'
  let bar = el.querySelector('.stage-load span')
  if (!bar) {
    const load = document.createElement('span')
    load.className = 'stage-load'
    load.setAttribute('aria-hidden', 'true')
    bar = document.createElement('span')
    load.append(bar)
    el.append(load)
  }
  import('./viewer.js')
    .then(({ createViewer }) => {
      createViewer({
        canvas,
        url: el.dataset.model,
        kind: el.dataset.kind || 'robot',
        az: el.dataset.az ? Number(el.dataset.az) : undefined,
        el: el.dataset.el ? Number(el.dataset.el) : undefined,
        zoom: el.dataset.zoom ? Number(el.dataset.zoom) : undefined,
        reduced,
        glassy: false, // transmission draws the scene twice; the faint sheet reads the same at this size
        onProgress: (p) => { bar.style.transform = `scaleX(${Math.max(0.04, p)})` },
        onReady: () => { el.dataset.state = 'ready' },
        onError: () => { el.dataset.state = 'failed' },
      })
    })
    .catch((e) => { console.warn('stage: no 3D', e); el.dataset.state = 'failed' })
}

const stages = document.querySelectorAll('[data-model]')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); start(e.target) } })
  }, { rootMargin: '100% 0px' })
  stages.forEach((s) => io.observe(s))
} else stages.forEach(start)
