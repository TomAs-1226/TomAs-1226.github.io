/* A model on a turntable. Ported from frc5805.com (src/components/robot/viewer.js and robotRig.js),
 * which I wrote for the team site, minus React: the page hands it a canvas and gets back dispose().
 *
 * Every model here is real CAD. The robots are the team's display bakes of their Onshape assemblies;
 * the boards are kicad-cli's own GLB export of the layout, baked by tools/bake-board.mjs. Nothing is
 * modelled by hand.
 *
 * It turns slowly on its own. Drag sideways and it follows the pointer one to one, keeps the flick's
 * momentum when let go, and picks its slow turn back up a moment later; drag up or down and it tilts,
 * then settles back. Vertical swipes on a phone still scroll the page (touch-action: pan-y). It renders
 * only while on screen, and not at all once it has stopped moving.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { buildDrivebase, X1 } from './drivebase.js'

const SPIN = 0.16 // rad/s, the idle turn
const RESUME_S = 2.2 // after a drag, how long before the idle turn comes back
const DRAG = 0.0085 // rad per px
const EL_MIN = -1.45 // a model can be turned all the way over and seen from below
const EL_MAX = 1.45
const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.2

/* Per material class, how much of the studio a surface reflects (the robot bakes name materials by
   class). Polycarbonate is about a third of metal: clear plastic is mostly what is behind it. */
const REFLECT = { aluminium: 1.0, steel: 0.95, motor: 0.8, poly: 0.35, print: 0.35, belt: 0.3, tread: 0.3, electronics: 0.55, black: 0.4, other: 0.5 }

/* A studio to reflect: raw CAD under plain lights looks like grey plastic, because metal is only ever
   the room it reflects. Softboxes over a graded shell, baked once into an environment map. */
export function studioEnvironment(renderer) {
  const room = new THREE.Scene()
  const spent = []
  const add = (g, m) => { spent.push(g, m); const x = new THREE.Mesh(g, m); room.add(x); return x }
  const shell = new THREE.SphereGeometry(10, 48, 24)
  const pos = shell.getAttribute('position')
  const tone = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10
    const v = y < 0 ? 0.03 + 0.27 * Math.pow(Math.max(0, 1 + y / 0.7), 1.6) : 0.2 + 0.25 * Math.pow(y, 0.8)
    tone[i * 3] = tone[i * 3 + 1] = tone[i * 3 + 2] = v
  }
  shell.setAttribute('color', new THREE.BufferAttribute(tone, 3))
  add(shell, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }))
  const sb = (w, h, i, hex, x, y, z) => {
    const pl = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(i), side: THREE.DoubleSide }))
    pl.position.set(x, y, z)
    pl.lookAt(0, 0.4, 0)
  }
  sb(5, 2.5, 5.0, 0xffffff, -1, 7, 2)
  sb(9, 1.2, 2.6, 0xffffff, 0, 2.0, 8)
  sb(1.4, 6, 3.2, 0xf0f3f9, -8, 3, 0.5)
  sb(1.4, 6, 1.6, 0xf0f3f9, 8, 3, -1.5)
  sb(8, 1.2, 2.4, 0xe0e7f4, 0, 3.4, -8)
  const pm = new THREE.PMREMGenerator(renderer)
  const t = pm.fromScene(room, 0.04)
  pm.dispose()
  spent.forEach((s) => s.dispose())
  return t.texture
}

/* A soft contact shadow: a model with nothing under it floats. */
export function blob(scene, size, alpha, y = 0) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, `rgba(0,0,0,${alpha})`)
  gr.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.55})`)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = gr
  x.fillRect(0, 0, 128, 128)
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }),
  )
  m.rotation.x = -Math.PI / 2
  m.position.y = y
  m.renderOrder = -1
  scene.add(m)
  return m
}

/* Robot bakes: clear polycarbonate, black tread, and how much of the studio each surface reflects. */
export function restyleRobot(root, glassy) {
  const done = new Map()
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return
    const src = o.material
    if (!done.has(src.uuid)) {
      let m = src.clone()
      const name = (src.name || '').toLowerCase()
      if (name.includes('poly')) {
        m = glassy
          ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.01, transmission: 1, thickness: 0, ior: 1.585, specularIntensity: 0.55, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color: 0xeef2f8, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
        m.polygonOffset = true
        m.polygonOffsetFactor = 1
        m.polygonOffsetUnits = 1
      }
      if (name.includes('tread')) { m.color.set(0x161719); m.roughness = 0.92; m.metalness = 0 }
      m.envMapIntensity = REFLECT[name] ?? REFLECT[Object.keys(REFLECT).find((k) => name.includes(k))] ?? 0.6
      m.dithering = true
      done.set(src.uuid, m)
    }
    o.material = done.get(src.uuid)
  })
}

/* KiCad boards: tools/bake-board.mjs names each material by what it is (copper, metal, mask, silk,
   body) and fixes KiCad's everything-is-metal export; here each gets its share of the studio. */
const BOARD_REFLECT = { copper: 1.0, metal: 0.9, mask: 0.55, silk: 0.4, body: 0.5 }
export function restyleBoard(root) {
  const done = new Map()
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return
    const src = o.material
    if (!done.has(src.uuid)) {
      const m = src.clone()
      m.envMapIntensity = BOARD_REFLECT[(src.name || '').replace(/[._]\d+$/, '')] ?? 0.5
      m.dithering = true
      done.set(src.uuid, m)
    }
    o.material = done.get(src.uuid)
  })
}

export function createViewer({ canvas, url, kind = 'robot', az = 0.7, el, fov = 26, onProgress, onReady, onError, reduced = false, glassy = true, zoom = 0.95 }) {
  const restEl = el ?? (kind === 'board' ? 0.62 : 0.42)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  const scene = new THREE.Scene()
  scene.environment = studioEnvironment(renderer)
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.005, 60)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b0b0c, 0.15))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(-2.2, 5, 3.4)
  const rim = new THREE.DirectionalLight(0xdae3f4, 2.2)
  rim.position.set(2.4, 3.2, -5)
  scene.add(key, rim)

  const turntable = new THREE.Group()
  scene.add(turntable)
  let disposed = false
  let ready = false
  let visible = false
  let raf = 0
  let prev = 0
  let still = 0
  let frame = { centre: new THREE.Vector3(0, 0.4, 0), radius: 0.8 }
  const view = { yaw: az, el: restEl, vYaw: 0, vEl: 0, zoom: 1, since: 99, dragging: false, touched: false }

  function adopt(root) {
    /* Stand it on the floor, centred on the turntable's axis, whatever units and origin it came in. */
    const box0 = new THREE.Box3().setFromObject(root)
    const c0 = box0.getCenter(new THREE.Vector3())
    root.position.sub(new THREE.Vector3(c0.x, box0.min.y, c0.z))
    turntable.add(root)
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    frame = { centre: new THREE.Vector3(0, (box.min.y + box.max.y) * (kind === 'board' ? 0.5 : 0.45), 0), radius: sphere.radius }
    const foot = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
    blob(scene, foot * (kind === 'board' ? 1.5 : 1.9), kind === 'board' ? 0.55 : 0.7, box.min.y - foot * 0.002)
    renderer.compile(scene, camera)
    ready = true
    onReady?.()
    wake()
  }

  /* X1 has no CAD: it is drawn from the dimensions it publishes, the way Catalyst Console draws it,
     and its swerve modules are animated like a drivebase on a bench. */
  let modules = []
  let drive = 0
  if (kind === 'drivebase') {
    const db = buildDrivebase(X1)
    modules = db.modules
    queueMicrotask(() => adopt(db.group))
  } else new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total))
    .then((g) => {
      if (disposed) return
      const root = g.scene
      if (kind === 'board') restyleBoard(root)
      else restyleRobot(root, glassy)
      adopt(root)
    })
    .catch((e) => { console.warn('viewer: no model', url, e); onError?.(e) })

  /* ── sizing and framing ───────────────────────────────────────────── */
  function fit() {
    const r = canvas.getBoundingClientRect()
    const W = Math.max(1, Math.round(r.width))
    const H = Math.max(1, Math.round(r.height))
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    wake()
  }
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)
  fit()

  function place() {
    const tan = Math.tan((camera.fov * Math.PI) / 360)
    const d = Math.max(frame.radius / tan, frame.radius / (tan * camera.aspect)) * zoom * view.zoom
    const c = frame.centre
    camera.position.set(c.x, c.y + d * Math.sin(view.el), c.z + d * Math.cos(view.el))
    camera.near = Math.max(0.001, d / 200)
    camera.updateProjectionMatrix()
    camera.lookAt(c)
    turntable.rotation.y = view.yaw
  }

  /* ── input ─────────────────────────────────────────────────────────
     Free orbit: drag turns it any way, all the way over; a flick keeps spinning and slows. Once you
     have touched it, it stays where you left it (no idle turn, no snap back). Ctrl/⌘ + wheel or a
     trackpad pinch zooms; a plain wheel still scrolls the page. Double-click puts it back. */
  let last = null
  let samples = []
  let travel = 0 // px dragged since pointerdown: a drag inside a link card must not follow the link
  function down(e) {
    if (e.button !== undefined && e.button !== 0) return
    view.dragging = true
    view.touched = true
    view.vYaw = view.vEl = 0
    last = { x: e.clientX, y: e.clientY }
    samples = []
    travel = 0
    canvas.setPointerCapture?.(e.pointerId)
    wake()
  }
  function move(e) {
    if (!view.dragging || !last) return
    const now = performance.now()
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    travel += Math.abs(dx) + Math.abs(dy)
    view.yaw += dx * DRAG
    view.el = Math.min(EL_MAX, Math.max(EL_MIN, view.el + dy * DRAG))
    samples.push({ t: now, dx, dy })
    samples = samples.filter((s) => now - s.t < 100)
    last = { x: e.clientX, y: e.clientY }
    wake()
  }
  function up() {
    if (!view.dragging) return
    view.dragging = false
    /* The flick's speed over the last 100 ms carries on and decays. */
    const span = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0
    if (span > 8) {
      const k = DRAG / (span / 1000)
      view.vYaw = Math.max(-9, Math.min(9, samples.reduce((a, s) => a + s.dx, 0) * k))
      view.vEl = Math.max(-4, Math.min(4, samples.reduce((a, s) => a + s.dy, 0) * k))
    }
    view.since = 0
    wake()
  }
  function wheel(e) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    view.touched = true
    view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * Math.exp(e.deltaY * 0.0022)))
    wake()
  }
  function reset() {
    view.touched = false
    view.vYaw = view.vEl = 0
    view.since = 99
    view.zoom = 1
    view.el = restEl
    wake()
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('dblclick', reset)
  const swallow = (e) => { if (travel > 4) { e.preventDefault(); e.stopPropagation() } }
  canvas.addEventListener('click', swallow, true)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)

  /* ── the loop ─────────────────────────────────────────────────────── */
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake() })
  io.observe(canvas)

  function wake() {
    still = 0
    if (!raf && visible && !disposed) { prev = performance.now(); raf = requestAnimationFrame(tick) }
  }

  function tick(now) {
    raf = 0
    if (disposed || !visible) return
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    let moving = view.dragging
    if (!view.dragging) {
      view.since += dt
      /* Momentum decays over about a third of a second. */
      view.vYaw *= Math.exp(-dt / 0.32)
      view.vEl *= Math.exp(-dt / 0.32)
      const idle = reduced || view.touched ? 0 : SPIN * Math.min(1, Math.max(0, (view.since - RESUME_S) / 1.2))
      view.yaw += (view.vYaw + idle) * dt
      view.el = Math.min(EL_MAX, Math.max(EL_MIN, view.el + view.vEl * dt))
      moving = Math.abs(view.vYaw) > 0.002 || Math.abs(view.vEl) > 0.002 || idle > 0
    }
    /* X1 steers through a slow crab walk and every so often turns in place; a module never turns past 90°. */
    if (modules.length && !reduced) {
      drive += dt
      const phase = (drive % 12) / 12
      const turning = phase > 0.62 && phase < 0.9
      for (const m of modules) {
        const want = turning ? Math.atan2(-m.x, -m.z) : Math.sin(drive * 0.5) * 0.9
        let d = Math.atan2(Math.sin(want - m.steer.rotation.y), Math.cos(want - m.steer.rotation.y))
        if (Math.abs(d) > Math.PI / 2) d -= Math.sign(d) * Math.PI
        m.steer.rotation.y += d * (1 - Math.exp(-dt / 0.18))
        m.wheel.rotation.z -= dt * 7
      }
      moving = true
    }
    if (ready) { place(); renderer.render(scene, camera) }
    if (moving || !ready) still = 0
    else still += 1
    if (still < 3) raf = requestAnimationFrame(tick)
  }

  return function dispose() {
    disposed = true
    cancelAnimationFrame(raf)
    io.disconnect()
    ro.disconnect()
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('dblclick', reset)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.()
        for (const m of [].concat(o.material)) { m?.map?.dispose?.(); m?.dispose?.() }
      }
    })
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
}
