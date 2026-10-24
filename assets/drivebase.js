/* Copied from frc5805.com (src/components/robot/drivebase.js), which I wrote for the team site. */
import * as THREE from 'three'

/* Catalyst X1, drawn the way Catalyst Console draws a drivebase (CatalystConsole src/robot3d.js,
 * buildRobot with no superstructure): a 2 × 1 frame, a belly pan, bumpers, four swerve modules, the
 * controller, power hub and battery, all to scale. X1 has no CAD of its own; Console builds it from
 * what the robot publishes, and so does this.
 *
 * The numbers are X1's own, as it published them on 17 September 2026 (CatalystConsole
 * src/fixtures/x1-2026-09-17.json): /Catalyst/Robot/Chassis/* and Drivetrain/ModuleLocations.
 *
 * Coordinates as everywhere else on the site: x is the robot's front, y up, z its right, so a WPILib
 * (x, y) lands at (x, -y). Origin on the floor under the centre of the modules. */

export const X1 = {
  frameLength: 0.7112, // 28 in
  frameWidth: 0.6604, // 26 in
  bumperLength: 0.889,
  bumperWidth: 0.8382,
  modules: [
    [0.288925, 0.263525],
    [0.288925, -0.263525],
    [-0.288925, 0.263525],
    [-0.288925, -0.263525],
  ],
}

/* Heights in metres above the floor: a real swerve robot's, as Console has them. */
const FRAME_BOTTOM = 0.028
const RAIL = 0.0254
const RAIL_HEIGHT = 0.0508
const FRAME_TOP = FRAME_BOTTOM + RAIL_HEIGHT
const BUMPER_BOTTOM = 0.04
const BUMPER_HEIGHT = 0.127
const WHEEL_RADIUS = 0.0508
const WHEEL_WIDTH = 0.038
const BATTERY = { length: 0.181, width: 0.077, height: 0.167 }

function roundedRect(w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2
  const y = cy - h / 2
  r = Math.max(1e-4, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5))
  const s = new THREE.Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function ring(outerW, outerD, outerR, innerW, innerD, innerR) {
  const s = roundedRect(outerW, outerD, outerR)
  s.holes.push(roundedRect(innerW, innerD, innerR))
  return s
}

/* Smooth across rounded edges, sharp across real corners: per-face normals on a bevel show every facet
   as a stripe of light, which is what makes brushed metal look cheap. */
function smoothNormals(geometry, crease = (40 * Math.PI) / 180) {
  const pos = geometry.getAttribute('position')
  const count = pos.count
  const face = new Float32Array(count * 3)
  const unit = new Float32Array(count * 3)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    c.sub(b).cross(a.sub(b))
    const len = c.length() || 1
    for (let k = 0; k < 3; k++) {
      const o = (i + k) * 3
      face[o] = c.x; face[o + 1] = c.y; face[o + 2] = c.z
      unit[o] = c.x / len; unit[o + 1] = c.y / len; unit[o + 2] = c.z / len
    }
  }
  const shared = new Map()
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e5)}|${Math.round(pos.getY(i) * 1e5)}|${Math.round(pos.getZ(i) * 1e5)}`
    const list = shared.get(key)
    if (list) list.push(i)
    else shared.set(key, [i])
  }
  const limit = Math.cos(crease)
  const normals = new Float32Array(count * 3)
  for (const list of shared.values()) {
    for (const i of list) {
      const oi = i * 3
      let x = 0, y = 0, z = 0
      for (const j of list) {
        const oj = j * 3
        if (unit[oi] * unit[oj] + unit[oi + 1] * unit[oj + 1] + unit[oi + 2] * unit[oj + 2] < limit) continue
        x += face[oj]; y += face[oj + 1]; z += face[oj + 2]
      }
      const len = Math.hypot(x, y, z) || 1
      normals[oi] = x / len; normals[oi + 1] = y / len; normals[oi + 2] = z / len
    }
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geometry
}

function extrudeUp(shape, height, bevel, bevelSegments = 2, curveSegments = 5) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height - 2 * bevel, 1e-4),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel - height / 2, 0)
  return smoothNormals(g)
}

function roundedBox(w, h, d, r, bevel) {
  const b = Math.max(0, Math.min(bevel ?? r * 0.5, w / 2 - 1e-3, d / 2 - 1e-3, h / 2 - 1e-3))
  return extrudeUp(roundedRect(w - 2 * b, d - 2 * b, r - b), h, b)
}

function tyre(radius, width) {
  const hw = width / 2
  const e = Math.min(0.006, hw * 0.4)
  const inner = radius * 0.6
  const profile = [
    [inner, -hw], [radius - e, -hw], [radius - e * 0.3, -hw + e * 0.3], [radius, -hw + e],
    [radius, hw - e], [radius - e * 0.3, hw - e * 0.3], [radius - e, hw], [inner, hw],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(profile, 28).rotateX(Math.PI / 2)
}

const axle = (radius, length, segments) => new THREE.CylinderGeometry(radius, radius, length, segments).rotateX(Math.PI / 2)

/* The bumper fabric's plain weave as a tangent-space normal map, so the bumpers read as cloth over
   pool noodles rather than moulded rubber. Tileable by construction. */
function weave(size = 64, threads = 8) {
  const period = size / threads
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const over = (Math.floor(x / period) + Math.floor(y / period)) % 2 === 0
      const across = over ? (x % period) / period : (y % period) / period
      h[y * size + x] = Math.sin(Math.PI * across) + (random() - 0.5) * 0.25
    }
  }
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const cx = canvas.getContext('2d')
  const img = cx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5
      const len = Math.hypot(dx, dy, 1)
      const o = (y * size + x) * 4
      img.data[o] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
      img.data[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
      img.data[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      img.data[o + 3] = 255
    }
  }
  cx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / (threads * 0.005), 1 / (threads * 0.005))
  return t
}

/* The team number on all four bumper faces, as an inspector reads it. */
function bumperNumbers(text, spec, fontFamily) {
  const size = 160
  const pad = 10
  const canvas = document.createElement('canvas')
  const cx = canvas.getContext('2d')
  const font = `600 ${size}px ${fontFamily}`
  cx.font = font
  const ink = cx.measureText(text)
  const ascent = Math.ceil(ink.actualBoundingBoxAscent || size * 0.72)
  const descent = Math.ceil(ink.actualBoundingBoxDescent || 0)
  const left = Math.ceil(ink.actualBoundingBoxLeft || 0)
  const width = Math.ceil((ink.actualBoundingBoxRight || ink.width) + left)
  canvas.width = width + 2 * pad
  canvas.height = ascent + descent + 2 * pad
  cx.font = font
  cx.fillStyle = '#ffffff'
  cx.textBaseline = 'alphabetic'
  cx.fillText(text, pad + left, pad + ascent)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const metresPerPx = 0.0762 / Math.max(1, ascent + descent)
  let w = canvas.width * metresPerPx
  let h = canvas.height * metresPerPx
  const flat = Math.min(spec.bumperLength, spec.bumperWidth) - 0.24
  if (w > flat) { h *= flat / w; w = flat }
  const geometry = new THREE.PlaneGeometry(w, h)
  const material = new THREE.MeshStandardMaterial({
    map: texture, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  material.envMapIntensity = 0.25
  const y = BUMPER_BOTTOM + BUMPER_HEIGHT / 2
  const proud = 0.0015
  return [
    [spec.bumperLength / 2 + proud, 0, Math.PI / 2],
    [-spec.bumperLength / 2 - proud, 0, -Math.PI / 2],
    [0, spec.bumperWidth / 2 + proud, 0],
    [0, -spec.bumperWidth / 2 - proud, Math.PI],
  ].map(([x, z, turn]) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.rotation.y = turn
    m.renderOrder = 1
    return m
  })
}

function materials() {
  const std = (color, metalness, roughness, reflect) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, dithering: true })
    m.envMapIntensity = reflect
    return m
  }
  return {
    body: std('#c7c7cc', 1, 0.36, 1),
    pan: std('#2a2a2a', 0.3, 0.6, 0.45),
    rubber: std('#141414', 0, 0.88, 0.4),
    hub: std('#8e8e8e', 1, 0.3, 0.9),
    motor: std('#1c1c1c', 0.4, 0.38, 0.8),
    battery: std('#181818', 0, 0.45, 0.7),
    lid: std('#3a3a3a', 0, 0.5, 0.6),
    terminal: std('#a33a33', 0, 0.5, 0.6),
    bumper: new THREE.MeshPhysicalMaterial({
      color: '#173a80', metalness: 0, roughness: 0.92, sheen: 0.45, sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#6f8fd8'), normalMap: weave(), normalScale: new THREE.Vector2(0.45, 0.45),
      envMapIntensity: 0.25, dithering: true,
    }),
    lamp: new THREE.MeshBasicMaterial({ color: '#e6f0ff' }),
    light: new THREE.MeshBasicMaterial({ color: '#eef2fb', toneMapped: false }),
  }
}

/** Build the drivebase. Returns the group and its modules ({ steer, wheel, x, z }): `steer` turns about y,
    `wheel` rolls about z. */
export function buildDrivebase(spec = X1, { number = '5805', font = '"Clash Display", sans-serif' } = {}) {
  const mat = materials()
  const group = new THREE.Group()
  const L = spec.frameLength
  const W = spec.frameWidth
  const put = (geometry, material, x, y, z, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  /* The frame: a ring of 2 × 1 tube, and a darker belly pan dropped into it. */
  const rail = Math.min(RAIL, L / 4, W / 4)
  const fb = 0.003
  put(extrudeUp(ring(L - 2 * fb, W - 2 * fb, 0.02 - fb, L - 2 * rail + 2 * fb, W - 2 * rail + 2 * fb, 0.006 + fb), RAIL_HEIGHT, fb),
    mat.body, 0, FRAME_BOTTOM + RAIL_HEIGHT / 2, 0)
  const pan = put(roundedBox(L - 2 * rail - 0.004, 0.006, W - 2 * rail - 0.004, 0.008, 0.002), mat.pan, 0, FRAME_BOTTOM + 0.004, 0)
  const deck = pan.position.y + 0.003

  /* Bumpers: one continuous ring, flat face, rounded top and bottom edges. */
  const tx = (spec.bumperLength - L) / 2
  const thin = Math.min(tx, (spec.bumperWidth - W) / 2)
  const corner = 0.02 + Math.max(thin, 0) * 0.6
  const bv = Math.min(thin * 0.3, BUMPER_HEIGHT * 0.25)
  put(extrudeUp(ring(spec.bumperLength - 2 * bv, spec.bumperWidth - 2 * bv, corner - bv, L + 2 * bv, W + 2 * bv, 0.02 + bv), BUMPER_HEIGHT, bv, 4, 6),
    mat.bumper, 0, BUMPER_BOTTOM + BUMPER_HEIGHT / 2, 0)
  /* The light bar on the front bumper: the one thing that says which way is forward from any angle. */
  put(new THREE.BoxGeometry(Math.min(0.026, tx * 0.34), 0.003, Math.max(0.1, (spec.bumperWidth - 2 * corner) * 0.62)), mat.light,
    spec.bumperLength / 2 - tx / 2, BUMPER_BOTTOM + BUMPER_HEIGHT + 0.0015, 0)
  if (number) for (const m of bumperNumbers(number, spec, font)) group.add(m)

  /* Swerve modules: the wheel under the frame, the housing and its two Falcons on top. Only the wheel
     fork steers on a real module, so each wheel sits in its own `steer` node for the viewer to turn,
     and the housing stays square to the frame. */
  const housing = Math.max(0.08, Math.min(0.15, L * 0.3, W * 0.3))
  const housingH = 0.05
  const motorR = 0.029
  const motorH = 0.07
  const housingGeo = roundedBox(housing, housingH, housing, 0.022, 0.006)
  const tyreGeo = tyre(WHEEL_RADIUS, WHEEL_WIDTH)
  const hubGeo = axle(WHEEL_RADIUS * 0.6, WHEEL_WIDTH * 0.9, 20)
  const motorGeo = new THREE.CylinderGeometry(motorR, motorR, motorH, 24)
  const motorMat = [mat.motor, mat.body, mat.motor] // side, top, bottom: a machined cap on a black can
  const modules = []
  for (const [mx, my] of spec.modules) {
    const x = mx
    const z = -my
    const steer = new THREE.Group()
    steer.position.set(x, WHEEL_RADIUS, z)
    group.add(steer)
    const wheel = new THREE.Group()
    steer.add(wheel)
    put(tyreGeo, mat.rubber, 0, 0, 0, wheel)
    put(hubGeo, mat.hub, 0, 0, 0, wheel)
    put(housingGeo, mat.body, x, FRAME_TOP + housingH / 2, z)
    /* The two motors stand side by side across the module, square to the line from the robot's centre. */
    const len = Math.hypot(x, z) || 1
    const across = [-z / len, x / len]
    const inward = [(-x / len) * 0.012, (-z / len) * 0.012]
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(motorGeo, motorMat)
      m.position.set(x + across[0] * side * 0.034 + inward[0], FRAME_TOP + housingH + motorH / 2, z + across[1] * side * 0.034 + inward[1])
      group.add(m)
    }
    modules.push({ steer, wheel, x, z })
  }

  /* The electronics on the belly pan: the Systemcore with its status light, and a power hub. */
  put(roundedBox(0.13, 0.032, 0.1, 0.012, 0.004), mat.motor, L * 0.18, deck + 0.016, W * 0.03)
  put(new THREE.BoxGeometry(0.028, 0.003, 0.004), mat.lamp, L * 0.18 + 0.045, deck + 0.0335, W * 0.03 - 0.035)
  put(roundedBox(0.11, 0.03, 0.12, 0.01, 0.004), mat.motor, -L * 0.26, deck + 0.015, W * 0.16)

  /* The battery, standing on the left side between the modules. */
  const batteryX = -Math.min(0.05, L * 0.07)
  const batteryZ = -(W / 2 - rail - BATTERY.width / 2 - 0.012)
  const batteryTop = deck + BATTERY.height
  put(roundedBox(BATTERY.length, BATTERY.height - 0.012, BATTERY.width, 0.006, 0.003), mat.battery, batteryX, deck + (BATTERY.height - 0.012) / 2, batteryZ)
  put(roundedBox(BATTERY.length + 0.002, 0.012, BATTERY.width + 0.002, 0.007, 0.003), mat.lid, batteryX, batteryTop - 0.006, batteryZ)
  const post = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 14)
  put(post, mat.terminal, batteryX + BATTERY.length * 0.3, batteryTop + 0.006, batteryZ)
  put(post, mat.motor, batteryX - BATTERY.length * 0.3, batteryTop + 0.006, batteryZ)

  return { group, modules }
}
