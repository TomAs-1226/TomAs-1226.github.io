/* ============================================================
 *  LIQUID ENGINE v1 — a dependency-free Liquid Glass UI engine
 *
 *  Real lensing, not opacity: every glass surface refracts the
 *  content behind it through a generated displacement map
 *  (backdrop-filter: url(#...)), with a frost pass, saturation
 *  lift, and a motion-reactive specular rim driven by a single
 *  global light. No element ever fakes it with opacity.
 *
 *  Usage:
 *    Liquid.init();                          // once
 *    Liquid.upgrade(document.body);          // upgrades [data-lg] elements
 *    const btn = Liquid.button('Save');      // or build directly
 *
 *  Components: button, toggle, slider, segmented, card, input,
 *  progress, checkbox, dock, modal.
 * ============================================================ */
(function (global) {
  'use strict';

  const cfg = {
    bend: 26,          // refraction strength (displacement scale)
    bezel: 0.5,        // edge band width as a fraction of corner radius
    frost: 1.6,        // pre-displacement blur (px) — material layer
    saturate: 1.5,     // color lift behind glass
    gain: 1.0,         // backdrop luminance gain  (tone-adaptive)
    lift: 0.0,         // backdrop luminance lift  (tone-adaptive)
    tint: null,        // material tint color, e.g. '#8ec9ff' (null = clear)
    tintStrength: 0.12,
    pressBend: 1.55,   // bend multiplier while pressed
    margin: 36,        // filter-region expansion: backdrop data beyond the edge
  };
  // tone presets: dark glass needs lift + hotter rims to stay present
  const TONES = {
    dark:  { gain: 1.10, lift: 0.055, saturate: 1.6, frost: 1.8 },
    light: { gain: 0.985, lift: 0.0, saturate: 1.45, frost: 1.5 },
  };

  const svgNS = 'http://www.w3.org/2000/svg';
  let svgRoot = null;
  let filterSeq = 0;
  const liveGlass = new Set();      // every mounted glass surface
  const mapCache = new Map();       // size+radius -> dataURL

  const supportsLensing = (() => {
    try { return CSS.supports('backdrop-filter', 'url(#x)') || CSS.supports('-webkit-backdrop-filter', 'url(#x)'); }
    catch (e) { return false; }
  })();

  /* ---------------- displacement map generation ----------------
   * Encodes, per pixel, where the backdrop should be sampled FROM:
   * R = x shift, G = y shift, 127 = neutral. A convex bezel profile
   * concentrated at the rounded-rect edge = Apple's "lensing". */
  function roundedSDF(px, py, w, h, r) {
    const qx = Math.abs(px - w / 2) - (w / 2 - r);
    const qy = Math.abs(py - h / 2) - (h / 2 - r);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function makeMap(w, h, r) {
    const key = `${w}x${h}x${r}`;
    if (mapCache.has(key)) return mapCache.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const d = img.data;
    const band = Math.max(8, Math.min(r * (1 + cfg.bezel) + 6, Math.min(w, h) * 0.5));
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const sd = roundedSDF(px + 0.5, py + 0.5, w, h, r);
        let dx = 0, dy = 0;
        if (sd > -band && sd < 1) {
          const e = 1;
          const nx = roundedSDF(px + e, py, w, h, r) - roundedSDF(px - e, py, w, h, r);
          const ny = roundedSDF(px, py + e, w, h, r) - roundedSDF(px, py - e, w, h, r);
          const nl = Math.hypot(nx, ny) || 1;
          // smooth convex profile: zero at inner edge AND smooth into it
          const t = Math.min(Math.max(1 + sd / band, 0), 1);   // 0 inner .. 1 rim
          const prof = t * t * (3 - 2 * t);                     // hermite, seamless
          // INWARD: lens pulls content from toward the center,
          // so it can never sample past the element's backdrop.
          dx = -(nx / nl) * prof;
          dy = -(ny / nl) * prof;
        }
        d[i] = 127 + dx * 110;
        d[i + 1] = 127 + dy * 110;
        d[i + 2] = 127;
        d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    const url = c.toDataURL();
    mapCache.set(key, url);
    return url;
  }

  function ensureSVG() {
    if (svgRoot) return;
    svgRoot = document.createElementNS(svgNS, 'svg');
    svgRoot.setAttribute('aria-hidden', 'true');
    svgRoot.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none';
    document.body.appendChild(svgRoot);
  }

  /* attach real lensing to an element; returns a handle */
  function glaze(el, opts = {}) {
    el.classList.add('lg-glass');
    const handle = { el, filter: null, dispNode: null, blurNode: null, w: 0, h: 0, bendMul: opts.bendMul ?? 1 };
    if (!supportsLensing) {
      el.classList.add('lg-frost-fallback');
      liveGlass.add(handle);
      return handle;
    }
    ensureSVG();
    const id = `lgf${filterSeq++}`;
    const f = document.createElementNS(svgNS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('x', String(-cfg.margin)); f.setAttribute('y', String(-cfg.margin));
    const feImg = document.createElementNS(svgNS, 'feImage');
    feImg.setAttribute('result', 'map');
    feImg.setAttribute('x', '0'); feImg.setAttribute('y', '0');
    const feBlur = document.createElementNS(svgNS, 'feGaussianBlur');
    feBlur.setAttribute('in', 'SourceGraphic');
    feBlur.setAttribute('stdDeviation', String(cfg.frost));
    feBlur.setAttribute('result', 'frost');
    const feDisp = document.createElementNS(svgNS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'frost');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    feDisp.setAttribute('scale', String(cfg.bend * handle.bendMul));   // refined on first refresh
    const feSat = document.createElementNS(svgNS, 'feColorMatrix');
    feSat.setAttribute('type', 'saturate');
    feSat.setAttribute('values', String(cfg.saturate));
    feSat.setAttribute('result', 'satd');
    // tone-adaptive luminance: dark mode lifts the glass so it never goes muddy
    const feLum = document.createElementNS(svgNS, 'feComponentTransfer');
    feLum.setAttribute('result', 'lum');
    for (const ch of ['feFuncR', 'feFuncG', 'feFuncB']) {
      const fn = document.createElementNS(svgNS, ch);
      fn.setAttribute('type', 'linear');
      fn.setAttribute('slope', String(cfg.gain));
      fn.setAttribute('intercept', String(cfg.lift));
      feLum.appendChild(fn);
    }
    // material tint (Apple's tinted glass variant)
    const feTint = document.createElementNS(svgNS, 'feFlood');
    const tintCol = opts.tint ?? cfg.tint;
    feTint.setAttribute('flood-color', tintCol || '#ffffff');
    feTint.setAttribute('flood-opacity', tintCol ? String(opts.tintStrength ?? cfg.tintStrength) : '0');
    feTint.setAttribute('result', 'tintc');
    const feMix = document.createElementNS(svgNS, 'feComposite');
    feMix.setAttribute('in', 'tintc');
    feMix.setAttribute('in2', 'lum');
    feMix.setAttribute('operator', 'atop');
    f.append(feImg, feBlur, feDisp, feSat, feLum, feTint, feMix);
    handle.lumFns = Array.from(feLum.children);
    handle.tintNode = feTint;
    handle.ownTint = opts.tint !== undefined;
    svgRoot.appendChild(f);
    handle.filter = f; handle.feImg = feImg; handle.dispNode = feDisp; handle.blurNode = feBlur; handle.satNode = feSat;
    el.style.backdropFilter = `url(#${id})`;
    el.style.webkitBackdropFilter = `url(#${id})`;

    const refresh = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
      if (w === handle.w && h === handle.h) return;
      handle.w = w; handle.h = h;
      // small elements bend gently; big panels bend more
      handle.sizeScale = Math.min(1, Math.min(w, h) / 110) * (0.45 + 0.55 * Math.min(1, Math.min(w, h) / 40));
      setBend(handle, 1);
      const rad = Math.min(parseFloat(getComputedStyle(el).borderRadius) || 12, w / 2, h / 2);
      f.setAttribute('width', String(w + cfg.margin * 2)); f.setAttribute('height', String(h + cfg.margin * 2));
      feImg.setAttribute('width', String(w)); feImg.setAttribute('height', String(h));
      feImg.setAttribute('href', makeMap(w, h, Math.round(rad)));
      feImg.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', makeMap(w, h, Math.round(rad)));
    };
    handle.refresh = refresh;
    new ResizeObserver(refresh).observe(el);
    requestAnimationFrame(refresh);
    liveGlass.add(handle);

    // press squish: glass momentarily bends harder (interactive material)
    el.addEventListener('pointerdown', () => setBend(handle, cfg.pressBend));
    el.addEventListener('pointerup', () => setBend(handle, 1));
    el.addEventListener('pointerleave', () => setBend(handle, 1));
    return handle;
  }
  function setBend(handle, mul) {
    if (handle.dispNode) handle.dispNode.setAttribute('scale', String(cfg.bend * handle.bendMul * (handle.sizeScale ?? 1) * mul));
  }

  /* ================ LIGHT ENGINE ================
   * Real per-element lighting. Any number of lights; each glass
   * surface gets its OWN rim angle, hotspot position and intensity
   * from the nearest/strongest light — so glass near the pointer
   * glows harder and rims genuinely point at their light source. */
  const Light = {
    lights: [
      { x: 0.5, y: 0.5, intensity: 1.0, radius: 900, pointer: true, color: [255, 255, 255] },
      { x: 0.2, y: -0.15, intensity: 0.5, radius: 4000, fixed: true, color: [255, 250, 240] },
    ],
    add(l) { Light.lights.push(l); return l; },
    clear() { Light.lights.length = 0; },
  };
  let rectsDirty = true;
  function initLight() {
    let px2 = innerWidth / 2, py2 = innerHeight / 3;
    window.addEventListener('pointermove', (e) => { px2 = e.clientX; py2 = e.clientY; }, { passive: true });
    window.addEventListener('scroll', () => { rectsDirty = true; }, { passive: true, capture: true });
    window.addEventListener('resize', () => { rectsDirty = true; });
    setInterval(() => { rectsDirty = true; }, 400);   // layout drift safety
    const tick = () => {
      for (const l of Light.lights) {
        if (l.pointer) { l.px = (l.px ?? px2) + (px2 - (l.px ?? px2)) * 0.18; l.py = (l.py ?? py2) + (py2 - (l.py ?? py2)) * 0.18; }
        else { l.px = l.x * innerWidth; l.py = l.y * innerHeight; }
      }
      for (const g of liveGlass) {
        if (!g.el.isConnected) { liveGlass.delete(g); continue; }
        if (rectsDirty || !g.rect) g.rect = g.el.getBoundingClientRect();
        const r = g.rect;
        if (r.width === 0) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        // accumulate lights: direction weighted by attenuated intensity
        let ax = 0, ay = 0, amp = 0, hx = 0, hy = 0, cr = 0, cg = 0, cb = 0;
        for (const l of Light.lights) {
          const dx = l.px - cx, dy = l.py - cy;
          const dist = Math.hypot(dx, dy);
          const att = l.intensity / (1 + (dist / l.radius) * (dist / l.radius) * 3);
          ax += (dx / (dist || 1)) * att;
          ay += (dy / (dist || 1)) * att;
          amp += att;
          hx += (l.px - r.left) * att;
          hy += (l.py - r.top) * att;
          const col = l.color || [255, 255, 255];
          cr += col[0] * att; cg += col[1] * att; cb += col[2] * att;
        }
        const ang = Math.atan2(ay, ax) * 180 / Math.PI + 90;
        const li = Math.min(1.25, 0.35 + amp * 0.9);
        const st = g.el.style;
        st.setProperty('--ang', ang.toFixed(1) + 'deg');
        st.setProperty('--li', li.toFixed(3));
        st.setProperty('--hx', Math.max(-40, Math.min(140, (hx / (amp || 1) / r.width) * 100)).toFixed(1) + '%');
        st.setProperty('--hy', Math.max(-40, Math.min(140, (hy / (amp || 1) / r.height) * 100)).toFixed(1) + '%');
        const ia = amp || 1;
        st.setProperty('--lc', `${(cr / ia) | 0} ${(cg / ia) | 0} ${(cb / ia) | 0}`);
      }
      rectsDirty = false;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------------- components ---------------- */
  const h = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  function button(label, opts = {}) {
    const b = h('button', 'lg-btn' + (opts.tint ? ' lg-tint-' + opts.tint : '') + (opts.size ? ' lg-' + opts.size : ''));
    b.append(h('span', 'lg-rim'), h('span', 'lg-content', label));
    glaze(b);
    return b;
  }

  function toggle(opts = {}) {
    const t = h('button', 'lg-toggle' + (opts.on ? ' on' : ''));
    t.setAttribute('role', 'switch');
    t.setAttribute('aria-checked', String(!!opts.on));
    const knob = h('span', 'lg-knob');
    knob.append(h('span', 'lg-rim'));
    t.append(h('span', 'lg-rim'), knob);
    glaze(t, { bendMul: 0.7 });
    glaze(knob, { bendMul: 1.4 });
    t.addEventListener('click', () => {
      const on = t.classList.toggle('on');
      t.setAttribute('aria-checked', String(on));
      knob.classList.add('stretch');
      setTimeout(() => knob.classList.remove('stretch'), 260);
      if (opts.onchange) opts.onchange(on);
    });
    return t;
  }

  function slider(opts = {}) {
    const wrap = h('div', 'lg-slider');
    const track = h('div', 'lg-track');
    const fill = h('div', 'lg-fill');
    const thumb = h('div', 'lg-thumb');
    thumb.append(h('span', 'lg-rim'));
    track.append(fill);
    wrap.append(track, thumb);
    glaze(track, { bendMul: 0.5 });
    glaze(thumb, { bendMul: 1.6 });           // the thumb is a LENS over the track
    let v = opts.value ?? 0.5;
    const set = (nv, fire = true) => {
      v = Math.min(1, Math.max(0, nv));
      wrap.style.setProperty('--v', v);
      if (fire && opts.oninput) opts.oninput(v);
    };
    const fromEvent = (e) => {
      const r = track.getBoundingClientRect();
      set((e.clientX - r.left) / r.width);
    };
    let drag = false, lastX = 0, lastT = 0, settleTimer = 0;
    const setStretch = (st) => thumb.style.setProperty('--stretch', st.toFixed(3));
    const settle = () => { wrap.classList.add('settle'); setStretch(1); };
    wrap.addEventListener('pointerdown', (e) => {
      drag = true; wrap.classList.add('drag'); wrap.classList.remove('settle');
      lastX = e.clientX; lastT = performance.now();
      wrap.setPointerCapture(e.pointerId); fromEvent(e);
      setStretch(1.12);                                   // gentle grab swell (width only)
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 140);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      fromEvent(e);
      const now = performance.now();
      const vx = Math.abs(e.clientX - lastX) / Math.max(now - lastT, 1);   // px per ms
      lastX = e.clientX; lastT = now;
      wrap.classList.remove('settle');
      setStretch(Math.min(1.65, 1.08 + vx * 0.5));        // faster drag = longer pill
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 110);              // stationary -> spring back
    });
    wrap.addEventListener('pointerup', () => {
      drag = false; wrap.classList.remove('drag');
      clearTimeout(settleTimer); settle();
    });
    set(v, false);
    wrap.value = () => v;
    wrap.set = set;
    return wrap;
  }

  function segmented(items, opts = {}) {
    const seg = h('div', 'lg-seg');
    const pill = h('div', 'lg-pill');
    pill.append(h('span', 'lg-rim'));
    seg.append(pill);
    glaze(seg, { bendMul: 0.55 });
    glaze(pill, { bendMul: 1.1 });
    let active = opts.active ?? 0;
    const btns = items.map((label, i) => {
      const b = h('button', 'lg-seg-item', label);
      b.addEventListener('click', () => select(i));
      seg.append(b);
      return b;
    });
    function select(i) {
      active = i;
      btns.forEach((b, j) => b.classList.toggle('on', j === i));
      const r = btns[i].getBoundingClientRect(), sr = seg.getBoundingClientRect();
      pill.style.transform = `translateX(${r.left - sr.left - 4}px)`;
      pill.style.width = r.width + 'px';
      if (opts.onchange) opts.onchange(i);
    }
    requestAnimationFrame(() => select(active));
    new ResizeObserver(() => select(active)).observe(seg);
    return seg;
  }

  function card(content, opts = {}) {
    const c = h('div', 'lg-card' + (opts.cls ? ' ' + opts.cls : ''));
    c.append(h('span', 'lg-rim'));
    const inner = h('div', 'lg-content');
    if (typeof content === 'string') inner.innerHTML = content;
    else inner.append(content);
    c.append(inner);
    glaze(c, { bendMul: 0.8 });
    return c;
  }

  function input(opts = {}) {
    const wrap = h('div', 'lg-input');
    wrap.append(h('span', 'lg-rim'));
    const i = h('input');
    i.type = opts.type || 'text';
    i.placeholder = opts.placeholder || '';
    wrap.append(i);
    glaze(wrap, { bendMul: 0.6 });
    return wrap;
  }

  function progress(opts = {}) {
    const p = h('div', 'lg-progress');
    p.append(h('span', 'lg-rim'));
    const bar = h('div', 'lg-bar');
    bar.append(h('span', 'lg-rim'));
    p.append(bar);
    glaze(p, { bendMul: 0.5 });
    p.set = (v) => p.style.setProperty('--v', Math.min(1, Math.max(0, v)));
    p.set(opts.value ?? 0.4);
    return p;
  }

  function checkbox(label, opts = {}) {
    const c = h('label', 'lg-check' + (opts.on ? ' on' : ''));
    const box = h('span', 'lg-box');
    box.append(h('span', 'lg-rim'), h('span', 'lg-tick', '✓'));
    c.append(box, h('span', 'lg-check-label', label));
    glaze(box, { bendMul: 0.9 });
    c.addEventListener('click', () => {
      const on = c.classList.toggle('on');
      if (opts.onchange) opts.onchange(on);
    });
    return c;
  }

  function dock(items) {
    const d = h('div', 'lg-dock');
    d.append(h('span', 'lg-rim'));
    const icons = items.map((it) => {
      const ic = h('button', 'lg-dock-item', `<span class="lg-dock-emoji">${it.icon}</span><span class="lg-dock-label">${it.label}</span>`);
      if (it.onclick) ic.addEventListener('click', it.onclick);
      d.append(ic);
      return ic;
    });
    glaze(d, { bendMul: 0.85 });
    d.addEventListener('pointermove', (e) => {
      for (const ic of icons) {
        const r = ic.getBoundingClientRect();
        const dist = Math.abs(e.clientX - (r.left + r.width / 2));
        const s = Math.max(0, 1 - dist / 150);
        ic.style.setProperty('--mag', (1 + s * s * 0.55).toFixed(3));
      }
    });
    d.addEventListener('pointerleave', () => icons.forEach((ic) => ic.style.setProperty('--mag', '1')));
    return d;
  }

  function modal(title, content) {
    const ov = h('div', 'lg-modal-overlay');
    const m = h('div', 'lg-modal');
    m.append(h('span', 'lg-rim'));
    const inner = h('div', 'lg-content');
    inner.append(h('h3', null, title));
    if (typeof content === 'string') inner.append(h('p', null, content));
    else inner.append(content);
    const close = button('Done');
    close.addEventListener('click', () => ov.remove());
    inner.append(close);
    m.append(inner);
    ov.append(m);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.body.append(ov);
    glaze(m, { bendMul: 0.9 });
    requestAnimationFrame(() => ov.classList.add('show'));
    return ov;
  }

  /* upgrade pass: <button data-lg="button">, <div data-lg="card">… */
  function upgrade(root) {
    root.querySelectorAll('[data-lg]').forEach((el) => {
      if (el.dataset.lgDone) return;
      el.dataset.lgDone = '1';
      if (!el.querySelector(':scope > .lg-rim')) el.prepend(h('span', 'lg-rim'));
      el.classList.add('lg-' + (el.dataset.lg === 'button' ? 'btn' : el.dataset.lg));
      glaze(el);
    });
  }

  /* live-retune every mounted surface (playground hooks) */
  function configure(patch) {
    Object.assign(cfg, patch);
    mapCache.clear();
    for (const g of liveGlass) {
      if (g.dispNode) setBend(g, 1);
      if (g.blurNode) g.blurNode.setAttribute('stdDeviation', String(cfg.frost));
      if (g.satNode) g.satNode.setAttribute('values', String(cfg.saturate));
      if (g.lumFns) for (const fn of g.lumFns) { fn.setAttribute('slope', String(cfg.gain)); fn.setAttribute('intercept', String(cfg.lift)); }
      if (g.tintNode && !g.ownTint) {
        g.tintNode.setAttribute('flood-color', cfg.tint || '#ffffff');
        g.tintNode.setAttribute('flood-opacity', cfg.tint ? String(cfg.tintStrength) : '0');
      }
      if (g.refresh) { g.w = 0; g.refresh(); }
    }
  }

  function setTone(tone, overrides = {}) {
    const t = tone === 'auto'
      ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : tone;
    document.documentElement.dataset.tone = t;
    configure(Object.assign({}, TONES[t] || {}, overrides));
    return t;
  }

  function init(opts = {}) {
    initLight();
    document.documentElement.classList.toggle('lg-no-lensing', !supportsLensing);
    setTone(opts.tone || 'dark');
  }

  global.Liquid = { init, upgrade, configure, setTone, glaze, button, toggle, slider, segmented, card, input, progress, checkbox, dock, modal, cfg, Light, supportsLensing };
})(window);
