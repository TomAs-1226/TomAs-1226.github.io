/* ======================================================================
 *  THREE-FIELD — the live 3D world the glass refracts.
 *  · a murmuration of ~7000 particles that drift like a flock and react
 *    to the pointer (Ornimetrics — the sky made of data)
 *  · three transmissive glass crystals slowly tumbling
 *  · UnrealBloom for the glow
 *  · a second tiny scene mounted inside the Ornimetrics feature card
 * ====================================================================== */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ----------------------------------------------------------------------
 *  MAIN BACKGROUND SCENE
 * -------------------------------------------------------------------- */
(function main() {
  const canvas = document.getElementById("bg3d");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 34);

  // environment for the transmissive glass to refract
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // lights pulling out the crystal edges (kept gentle so the field stays calm)
  scene.add(new THREE.AmbientLight(0x223355, 0.55));
  const key = new THREE.PointLight(0x66f0ff, 150, 120); key.position.set(18, 14, 22); scene.add(key);
  const rim = new THREE.PointLight(0xb37bff, 110, 120); rim.position.set(-22, -10, 14); scene.add(rim);
  const warm = new THREE.PointLight(0xff8bd0, 70, 120); warm.position.set(0, 20, -10); scene.add(warm);

  /* ---------- the murmuration ---------- */
  const COUNT = reduced ? 1400 : 2000;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 3); // per-particle phase / radius / speed
  const home = new Float32Array(COUNT * 3); // base anchor

  const palette = [
    new THREE.Color(0x5ff0d8), new THREE.Color(0x57b8ff),
    new THREE.Color(0xb388ff), new THREE.Color(0xff8bd0),
  ];

  for (let i = 0; i < COUNT; i++) {
    // distribute on a wide, slightly flattened shell — a "sky band"
    const r = 12 + Math.random() * 13;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = (r * Math.cos(phi)) * 0.62;
    const z = r * Math.sin(phi) * Math.sin(theta);
    home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = z;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;

    const c = palette[(Math.random() * palette.length) | 0].clone();
    c.multiplyScalar(0.22 + Math.random() * 0.3);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;

    seed[i * 3] = Math.random() * Math.PI * 2;          // phase
    seed[i * 3 + 1] = 0.4 + Math.random() * 1.6;        // amplitude
    seed[i * 3 + 2] = 0.3 + Math.random() * 0.9;        // speed
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // soft round sprite
  const sprite = (() => {
    const s = 64, cv = document.createElement("canvas"); cv.width = cv.height = s;
    const g = cv.getContext("2d");
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.75)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  const mat = new THREE.PointsMaterial({
    size: 0.2, map: sprite, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* ---------- glass crystals ---------- */
  const glassMat = new THREE.MeshPhysicalMaterial({
    transmission: 1, thickness: 2.2, roughness: 0.06, metalness: 0,
    ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.1,
    attenuationColor: new THREE.Color(0x88e0ff), attenuationDistance: 6,
    iridescence: 0.4, iridescenceIOR: 1.4, envMapIntensity: 0.9,
    transparent: true,
  });
  const crystals = [];
  const shapes = [
    new THREE.IcosahedronGeometry(3.2, 0),
    new THREE.DodecahedronGeometry(2.1, 0),
  ];
  const places = [ [15, 7, -6], [-16, -6, -4] ];
  shapes.forEach((g, i) => {
    const m = new THREE.Mesh(g, glassMat);
    m.position.set(...places[i]);
    m.userData.spin = new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
    scene.add(m);
    crystals.push(m);
    // faint wireframe twin for edge definition (subtle)
    const wf = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.07 }));
    m.add(wf);
  });

  /* ---------- post: bloom ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5), 0.3, 0.5, 0.08);
  composer.addPass(bloom);

  /* ---------- interaction ---------- */
  const pointer = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  addEventListener("pointermove", (e) => {
    target.x = (e.clientX / innerWidth) * 2 - 1;
    target.y = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let scrollY = 0;
  addEventListener("scroll", () => { scrollY = scrollY + (window.scrollY - scrollY); }, { passive: true });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  const pos = geo.attributes.position.array;

  function frame() {
    if (window.__bgPaused) { requestAnimationFrame(frame); return; }
    const t = clock.getElapsedTime();
    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    // flock breathing: each point drifts around its home with its own phase
    const swirl = t * 0.035;
    const mx = pointer.x * 14, my = pointer.y * 9; // pointer attractor in world space
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const ph = seed[i3], amp = seed[i3 + 1], sp = seed[i3 + 2];
      const hx = home[i3], hy = home[i3 + 1], hz = home[i3 + 2];
      // base orbital drift
      let x = hx + Math.sin(t * sp + ph) * amp;
      let y = hy + Math.cos(t * sp * 0.8 + ph) * amp * 0.7;
      let z = hz + Math.sin(t * sp * 0.6 + ph * 1.3) * amp;
      // gentle global swirl around Y
      const cs = Math.cos(swirl), sn = Math.sin(swirl);
      const rx = x * cs - z * sn, rz = x * sn + z * cs;
      x = rx; z = rz;
      // soft pointer repulsion in screen-ish plane (gentle)
      const dx = x - mx, dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 36) { const f = (36 - d2) / 36 * 1.1; const inv = 1 / Math.sqrt(d2 + 0.001); x += dx * inv * f; y += dy * inv * f; }
      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;

    points.rotation.y = pointer.x * 0.06;
    points.rotation.x = -pointer.y * 0.04;

    crystals.forEach((m) => {
      m.rotation.x += m.userData.spin.x * 0.01 + 0.0008;
      m.rotation.y += m.userData.spin.y * 0.01 + 0.0011;
      m.position.y += Math.sin(t * 0.5 + m.position.x) * 0.004;
    });

    // camera parallax + slow scroll dolly (subtle)
    camera.position.x += (pointer.x * 2.6 - camera.position.x) * 0.03;
    camera.position.y += (pointer.y * 1.6 - camera.position.y) * 0.03;
    camera.position.z = 34 + Math.min(window.scrollY, 2000) * 0.004;
    camera.lookAt(0, 0, 0);

    composer.render();
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ----------------------------------------------------------------------
 *  MINI SCENE — a single hero crystal inside the Ornimetrics card
 * -------------------------------------------------------------------- */
(function inventionMesh() {
  const host = document.getElementById("inv-hero");
  if (!host) return;

  // build the card shell
  host.innerHTML = `
    <div class="iv-mesh"><canvas></canvas></div>
    <div class="iv-content">
      <span class="badge">◈ Peer-reviewed · published</span>
      <h3>The sky, turned into data.</h3>
      <p>Ornimetrics turns a backyard feeder into an AI field station — YOLOv11 vision identifies
      species, screens for welfare, and re-identifies individual birds over time. Published
      research, running fully on-device at the edge.</p>
    </div>`;

  const canvas = host.querySelector("canvas");
  const wrap = host.querySelector(".iv-mesh");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0x335577, 0.7));
  const l1 = new THREE.PointLight(0x5ff0d8, 60, 40); l1.position.set(6, 6, 8); scene.add(l1);
  const l2 = new THREE.PointLight(0xb388ff, 50, 40); l2.position.set(-6, -4, 6); scene.add(l2);

  const geo = new THREE.IcosahedronGeometry(2.6, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    transmission: 1, thickness: 2.4, roughness: 0.04, ior: 1.55,
    iridescence: 1, iridescenceIOR: 1.5, clearcoat: 1,
    attenuationColor: new THREE.Color(0x7fe9d8), attenuationDistance: 4, envMapIntensity: 1.5, transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xaef0ff, transparent: true, opacity: 0.4 })));

  // orbiting particles around the crystal
  const N = 360, p = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, rr = 3 + Math.random() * 2.4, yy = (Math.random() - 0.5) * 5;
    p[i * 3] = Math.cos(a) * rr; p[i * 3 + 1] = yy; p[i * 3 + 2] = Math.sin(a) * rr;
    const c = new THREE.Color().setHSL(0.45 + Math.random() * 0.25, 0.8, 0.7);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(p, 3));
  pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const orbit = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(orbit);

  function size() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(wrap);

  let mx = 0, my = 0;
  host.addEventListener("pointermove", (e) => {
    const r = host.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    my = -(((e.clientY - r.top) / r.height) * 2 - 1);
  });

  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime();
    mesh.rotation.y = t * 0.3 + mx * 0.6;
    mesh.rotation.x = Math.sin(t * 0.4) * 0.2 + my * 0.4;
    orbit.rotation.y = -t * 0.12;
    orbit.rotation.x = t * 0.05;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
})();
