/* A model on a sticky stage, choreographed by the panels scrolling past it. The same idea as the
 * landing "spine" I built for frc5805.com, rewritten small and framework-free for this site.
 *
 * Markup:
 *   <section class="scrolly" data-scrolly="numbers">
 *     <div class="scrolly-stage"><canvas></canvas><div class="scrolly-labels"></div></div>
 *     <div class="scrolly-panel" data-shot="title">…copy…</div>
 *     …
 *   </section>
 *
 * Each panel names a shot. A shot says what the camera looks at and how big it is, never where the
 * camera is: distance is solved from the screen, so a laptop and a big monitor get the same
 * composition. Between two panels the shot is interpolated by scroll position, then eased toward
 * every frame, so the model never jumps. `explode` takes the robot apart in the order the bolts come
 * out (top first), with the assembly offsets from the team site's teardown.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { studioEnvironment, blob, restyleRobot, restyleBoard } from './viewer.js'

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smooth = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

/* Robot frame: x forward, y up, z right, metres, the floor under the swerve modules at the origin. */
const SCENES = {
  /* O0X, both boards together. KiCad's GLB keeps the layout's millimetres (x right, z down the
     board, y up), so a part's position is its footprint's (at x y) from the .kicad_pcb divided by
     1000, then shifted so the main board's centre (70, 60) sits at the origin. The sensor card
     stands on the main board's +X edge, where its right-angle header plugs into J6. */
  o0x: {
    kind: 'board',
    parts: [
      { url: '/models/o0x-m.glb', pos: [-0.07, 0, -0.06] },
      { url: '/models/o0x-s.glb', pivot: [0.04, 0, 0.06], rot: [0, 0, -Math.PI / 2], pos: [0.0485, 0.0175, 0], explode: [0.03, 0.035, 0] },
    ],
    shots: {
      whole: { side: 1, yaw: -0.55, el: 0.62, look: [0.004, 0.006, 0], R: 0.07 },
      soc: { side: -1, yaw: 0.3, el: 1.0, look: [0.0, 0.002, 0.004], R: 0.042 },
      cameras: { side: 1, yaw: Math.PI + 0.5, el: 0.7, look: [-0.012, 0.003, -0.026], R: 0.04 },
      power: { side: -1, yaw: 0.25, el: 0.5, look: [-0.008, 0.003, 0.028], R: 0.036 },
      card: { side: 1, yaw: -1.25, el: 0.22, look: [0.045, 0.016, 0], R: 0.046 },
      apart: { side: -1, yaw: -0.75, el: 0.45, look: [0.02, 0.016, 0], R: 0.08, explode: 1 },
    },
    /* [null, point] is a fixed point in the scene; mm → m from the footprints. */
    anchors: {
      u1: [null, [-0.011, 0.0025, -0.011]],
      u2: [null, [0.015, 0.0025, 0.023]],
      j4: [null, [-0.025, 0.004, -0.031]],
      j5: [null, [0.005, 0.004, -0.031]],
      sd: [null, [-0.036, 0.003, -0.017]],
      usb: [null, [-0.015, 0.004, 0.032]],
      pwr: [null, [-0.031, 0.006, 0.03]],
      servo: [null, [0.0035, 0.006, 0.031]],
    },
  },
  numbers: {
    url: '/models/numbers.glb',
    shots: {
      title: { side: 1, yaw: -0.7, el: 0.22, look: [0, 0.3, 0], R: 0.6 },
      shooter: { side: -1, yaw: 2.3, el: 0.26, look: [-0.16, 0.34, 0], R: 0.52 },
      apart: { side: 1, yaw: -0.5, el: 0.24, look: [0.12, 0.72, 0], R: 1.05, explode: 1 },
      intake: { side: -1, yaw: -1.25, el: 0.3, look: [0.12, 0.3, 0], R: 0.58, intake: 1 },
      drive: { side: 1, yaw: 0.2, el: 0.95, look: [0, 0.1, 0], R: 0.55, explode: 1, lift: 1 },
      code: { side: -1, yaw: 0.55, el: 0.2, look: [0, 0.3, 0], R: 0.62 },
    },
    /* Each assembly leaves along `dir` by `d` metres; `at` staggers the start so a layer is always
       above the one it sat on (frc5805.com, components/spine/shots.js, LAYERS). */
    layers: {
      hood: { dir: [0, 1, 0], d: 1.08, at: 0.0 },
      'assembly-shooter': { dir: [0, 1, 0], d: 0.8, at: 0.12 },
      intake: { dir: [1, 0, 0], d: 0.52, at: 0.14 },
      'assembly-intake': { dir: [1, 0, 0], d: 0.34, at: 0.2 },
      'assembly-hopper': { dir: [0, 1, 0], d: 0.5, at: 0.24 },
      'assembly-floor': { dir: [0, 1, 0], d: 0.24, at: 0.36 },
    },
    /* `lift` raises everything above the drive base clean out of frame, for the top-down shot. */
    lift: ['hood', 'assembly-shooter', 'intake', 'assembly-intake', 'assembly-hopper', 'assembly-floor'],
    /* The intake rides out on the hopper's slide, 300 mm (robot.json, `hopper`). */
    intake: { nodes: ['intake', 'assembly-intake', 'assembly-hopper'], dir: [1, 0, 0], d: 0.3 },
    /* Callout anchors: a node and a point on it, in the robot frame at rest. */
    anchors: {
      flywheel: ['assembly-shooter', [-0.3, 0.53, 0.22]],
      hood: ['hood', [-0.1, 0.555, -0.22]],
      feeder: ['assembly-shooter', [-0.1, 0.37, 0.22]],
      intake: ['intake', [0.31, 0.395, 0.22]],
      hopper: ['assembly-hopper', [0.16, 0.42, 0.368]],
      swerve: ['module-fl', [0.279, 0.01, -0.298]],
      battery: ['assembly-drive', [0.22, 0.108, 0.05]],
      pdp: ['assembly-drive', [-0.195, 0.069, 0.07]],
    },
  },
}

export function createScrolly(root) {
  const def = SCENES[root.dataset.scrolly]
  if (!def) return () => {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const narrow = () => matchMedia('(max-width: 860px)').matches
  const canvas = root.querySelector('.scrolly-stage canvas')
  const labelBox = root.querySelector('.scrolly-labels')
  const panels = [...root.querySelectorAll('[data-shot]')].map((el) => ({
    el,
    shot: def.shots[el.dataset.shot],
    labels: [...el.querySelectorAll('[data-anchor]')].map((li) => ({ anchor: li.dataset.anchor, text: li.dataset.label || li.querySelector('b')?.textContent || '' })),
  }))

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  const scene = new THREE.Scene()
  scene.environment = studioEnvironment(renderer)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 60)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b0b0c, 0.15))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(-2.2, 5, 3.4)
  const rim = new THREE.DirectionalLight(0xdae3f4, 2.2)
  rim.position.set(2.4, 3.2, -5)
  scene.add(key, rim)
  const rig = new THREE.Group()
  scene.add(rig)

  let model = null
  const nodes = {}
  const home = {}
  let disposed = false
  /* Loop state first: fit() and the loader wake the loop before the rest of this has run. */
  let raf = 0
  let prev = 0
  let visible = false

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const parts = []
  const loadModel = def.parts
    ? Promise.all(def.parts.map((p) => loader.loadAsync(p.url))).then((gs) => {
      const group = new THREE.Group()
      gs.forEach((g, i) => {
        const p = def.parts[i]
        restyleBoard(g.scene)
        /* turn about the part's own pivot, then place it */
        if (p.pivot) g.scene.position.set(-p.pivot[0], -p.pivot[1], -p.pivot[2])
        const holder = new THREE.Group()
        holder.add(g.scene)
        if (p.rot) holder.rotation.set(...p.rot)
        holder.position.set(...p.pos)
        group.add(holder)
        parts.push({ holder, home: holder.position.clone(), explode: p.explode })
      })
      return { scene: group }
    })
    : loader.loadAsync(def.url)
  loadModel.then((g) => {
    if (disposed) return
    model = g.scene
    if (!def.parts) restyleRobot(model, false)
    rig.add(model)
    const names = new Set([...Object.keys(def.layers || {}), ...(def.lift || []), ...(def.intake?.nodes || []), ...Object.values(def.anchors || {}).map((a) => a[0]).filter(Boolean)])
    names.forEach((n) => { const o = model.getObjectByName(n); if (o) { nodes[n] = o; home[n] = o.position.clone() } })
    const box = new THREE.Box3().setFromObject(model)
    blob(scene, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.9, 0.7)
    renderer.compile(scene, camera)
    root.dataset.state = 'ready'
    wake()
  }).catch((e) => { console.warn('scrolly: no model', e); root.dataset.state = 'failed' })

  /* Labels: one element per anchor, positioned every frame. */
  const labelEls = {}
  for (const p of panels) for (const l of p.labels) {
    if (labelEls[l.anchor]) continue
    const el = document.createElement('div')
    el.className = 'scrolly-label'
    el.setAttribute('aria-hidden', 'true')
    el.innerHTML = '<i></i><span></span>'
    el.lastChild.textContent = l.text
    labelBox.append(el)
    labelEls[l.anchor] = el
  }

  /* ── where we are in the scroll ─────────────────────────────────────── */
  function target() {
    const mid = innerHeight / 2
    const centres = panels.map((p) => { const r = p.el.getBoundingClientRect(); return r.top + r.height / 2 })
    let i = 0
    while (i < panels.length - 1 && centres[i + 1] <= mid) i++
    const a = panels[i]
    const b = panels[Math.min(i + 1, panels.length - 1)]
    const t = a === b ? 0 : smooth(clamp01((mid - centres[i]) / (centres[i + 1] - centres[i])))
    const mix = (k, d = 0) => lerp(a.shot[k] ?? d, b.shot[k] ?? d, t)
    const look = a.shot.look.map((v, j) => lerp(v, b.shot.look[j], t))
    /* Labels belong to whichever panel is nearer the middle. */
    const near = t < 0.5 ? a : b
    const fade = 1 - Math.abs(t - (t < 0.5 ? 0 : 1)) * 2
    return { yaw: mix('yaw'), el: mix('el'), R: mix('R'), side: mix('side'), explode: mix('explode'), lift: mix('lift'), intake: mix('intake'), look, labels: near.labels, fade }
  }

  const cur = { ...target() }
  const k = (dt, tau) => (reduced ? 1 : 1 - Math.exp(-dt / tau))

  /* ── sizing ─────────────────────────────────────────────────────────── */
  let W = 1
  let H = 1
  function fit() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, Math.round(r.width))
    H = Math.max(1, Math.round(r.height))
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    wake()
  }
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)
  fit()

  const tmp = new THREE.Vector3()
  function apply() {
    /* Teardown, slide-out and lift, on the nodes' own rest positions. */
    for (const n in home) nodes[n].position.copy(home[n])
    if (def.layers) for (const [n, L] of Object.entries(def.layers)) {
      const o = nodes[n]
      if (!o) continue
      const u = smooth(clamp01((cur.explode - L.at) / (1 - L.at)))
      o.position.addScaledVector(tmp.set(...L.dir), L.d * u)
    }
    for (const p of parts) {
      p.holder.position.copy(p.home)
      if (p.explode) p.holder.position.addScaledVector(tmp.set(...p.explode), smooth(clamp01(cur.explode)))
    }
    if (def.intake) for (const n of def.intake.nodes) nodes[n]?.position.addScaledVector(tmp.set(...def.intake.dir), def.intake.d * cur.intake)
    if (def.lift) for (const n of def.lift) nodes[n]?.position.addScaledVector(tmp.set(0, 1, 0), 3 * smooth(cur.lift))
    rig.rotation.y = cur.yaw

    /* Camera: distance from the subject's size and the screen; on a wide screen the subject sits in
       the column beside the copy, on a phone it takes the top band and is centred. */
    const phone = narrow()
    const tan = Math.tan((camera.fov * Math.PI) / 360)
    const fill = phone ? 0.86 : 0.62
    const d = Math.max(cur.R / (tan * fill), cur.R / (tan * camera.aspect * fill))
    const c = tmp.set(...cur.look)
    camera.position.set(c.x, c.y + d * Math.sin(cur.el), c.z + d * Math.cos(cur.el))
    camera.lookAt(c)
    camera.near = Math.max(0.0005, d / 150)
    camera.far = d * 40
    if (phone) camera.clearViewOffset()
    else camera.setViewOffset(W, H, -cur.side * W * 0.22, 0, W, H)
    camera.updateMatrixWorld()

    /* Labels: project each anchor; show only the current panel's, faded through the hand-over. */
    const show = new Set(cur.labels.map((l) => l.anchor))
    rig.updateMatrixWorld(true)
    for (const [a, el] of Object.entries(labelEls)) {
      const def2 = def.anchors[a]
      const node = def2 && def2[0] && nodes[def2[0]]
      if (!def2 || (def2[0] && !node) || !show.has(a) || phone) { el.style.opacity = 0; continue }
      /* The anchor is given in the model frame at rest; move it with its node, if it has one. */
      const p = new THREE.Vector3(...def2[1])
      if (node) p.sub(home[def2[0]]).add(node.position)
      p.applyMatrix4(rig.matrixWorld).project(camera)
      const x = (p.x * 0.5 + 0.5) * W
      const y = (-p.y * 0.5 + 0.5) * H
      el.style.opacity = Math.max(0, cur.fade * 1.4 - 0.2)
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.classList.toggle('left', x > W * 0.5)
    }
  }

  /* ── the loop: runs while on screen and something is still settling ── */
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake() })
  io.observe(root)
  function wake() {
    if (!raf && visible && !disposed) { prev = performance.now(); raf = requestAnimationFrame(tick) }
  }
  function tick(now) {
    raf = 0
    if (disposed || !visible) return
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    const t = target()
    let moving = false
    for (const key2 of ['yaw', 'el', 'R', 'side', 'explode', 'lift', 'intake']) {
      const v = cur[key2] + (t[key2] - cur[key2]) * k(dt, key2 === 'explode' || key2 === 'lift' ? 0.22 : 0.16)
      if (Math.abs(v - t[key2]) > 1e-4) moving = true
      cur[key2] = v
    }
    cur.look = cur.look.map((v, j) => { const n = v + (t.look[j] - v) * k(dt, 0.16); if (Math.abs(n - t.look[j]) > 1e-4) moving = true; return n })
    cur.labels = t.labels
    cur.fade = t.fade
    if (model) { apply(); renderer.render(scene, camera) }
    if (moving || !model) raf = requestAnimationFrame(tick)
  }
  addEventListener('scroll', wake, { passive: true })
  addEventListener('resize', wake)

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    io.disconnect()
    ro.disconnect()
    removeEventListener('scroll', wake)
    renderer.dispose()
  }
}

document.querySelectorAll('[data-scrolly]').forEach((root) => {
  /* Start when the section is a screen away; three.js and the model cost nothing until then. */
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    io.disconnect()
    try { createScrolly(root) } catch (err) { console.warn('scrolly: no 3D', err); root.dataset.state = 'failed' }
  }, { rootMargin: '100% 0px' })
  io.observe(root)
})
