/* Fondo de relojitos en las secciones deep blue (idea de event.osapiens.com/agenda).
   Cada [data-clock-field] recibe un <canvas> detrás del contenido con una cuadrícula de glifos de dos agujas
   que marcan la hora real. Con el mouse, los cercanos se acercan un poco y apuntan al cursor. */
(function () {
  "use strict";

  const fields = [...document.querySelectorAll("[data-clock-field]")];
  if (!fields.length || !document.createElement("canvas").getContext) return;

  const params = new URLSearchParams(window.location.search);
  // Igual que main.js: ?capture o reduced motion dibujan los relojitos quietos
  const skipMotion = params.has("capture") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interactive = !skipMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const COLOR = "201, 215, 233"; // Light Blue #C9D7E9
  const BASE_ALPHA = 0.14;
  const HOVER_ALPHA = 0.36; // se suma a BASE_ALPHA junto al cursor
  const RADIUS = 180; // alcance del cursor, en px
  const NEAR = 20; // a esta distancia apuntan al cursor sí o sí
  const PULL = 12; // cuánto se acercan al cursor, en px
  const IDLE_MS = 1800; // sin mover el mouse, vuelven a su sitio
  const TAU = Math.PI * 2;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  // Diferencia entre dos ángulos por el camino corto, en [-π, π]
  const angleDelta = (from, to) => {
    let delta = (to - from) % TAU;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    return delta;
  };
  const metricsFor = (small) => small
    ? { gapX: 34, gapY: 30, long: 7, short: 4.2, line: 1.5 }
    : { gapX: 48, gapY: 42, long: 9, short: 5.4, line: 1.8 };

  function handAngles() {
    const date = new Date();
    const minutes = date.getMinutes() + date.getSeconds() / 60;
    const hours = (date.getHours() % 12) + minutes / 60;
    return { minute: (minutes / 60) * TAU - Math.PI / 2, hour: (hours / 12) * TAU - Math.PI / 2 };
  }

  // Cuadrícula centrada, con las filas impares desplazadas medio hueco
  function buildClocks(width, height, m) {
    const marginX = m.gapX * 0.9;
    const marginY = m.gapY * 0.9;
    const cols = Math.max(1, Math.floor((width - marginX * 2) / m.gapX) + 1);
    const rows = Math.max(1, Math.floor((height - marginY * 2) / m.gapY) + 1);
    const startX = (width - (cols - 1) * m.gapX) / 2;
    const startY = (height - (rows - 1) * m.gapY) / 2;
    const clocks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * m.gapX + (row % 2 ? m.gapX / 2 : 0);
        if (x > width - marginX) continue;
        clocks.push({
          x, y: startY + row * m.gapY,
          longScale: 0.92 + Math.random() * 0.24,
          shortScale: 0.54 + Math.random() * 0.18,
          long: null, short: null,
        });
      }
    }
    return clocks;
  }

  const states = new Map(fields.map((el) => {
    const canvas = document.createElement("canvas");
    canvas.className = "clock-field";
    canvas.setAttribute("aria-hidden", "true");
    el.prepend(canvas);
    return [el, { el, canvas, ctx: canvas.getContext("2d"), width: 0, height: 0, dpr: 0, small: null, clocks: [], visible: false, x: 0, y: 0, magnet: 0 }];
  }));

  function fit(state) {
    const width = state.el.clientWidth;
    const height = state.el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = window.innerWidth < 768;
    if (width === state.width && height === state.height && dpr === state.dpr && small === state.small) return;
    Object.assign(state, { width, height, dpr, small, metrics: metricsFor(small) });
    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.clocks = buildClocks(width, height, state.metrics);
  }

  const pointer = { x: 0, y: 0, known: false, lastMove: -Infinity };

  function addGlyph(ctx, x, y, clock, longLength, shortLength) {
    ctx.moveTo(x + Math.cos(clock.long) * longLength, y + Math.sin(clock.long) * longLength);
    ctx.lineTo(x, y);
    ctx.lineTo(x + Math.cos(clock.short) * shortLength, y + Math.sin(clock.short) * shortLength);
  }

  // Dibuja un campo y devuelve true si aún se está moviendo
  function draw(state, now, hands) {
    fit(state);
    const { ctx, width, height, metrics: m } = state;
    const rect = state.el.getBoundingClientRect();
    const px = pointer.x - rect.left;
    const py = pointer.y - rect.top;
    const inside = interactive && pointer.known && now - pointer.lastMove < IDLE_MS && px >= 0 && py >= 0 && px <= width && py <= height;

    state.magnet += ((inside ? 1 : 0) - state.magnet) * 0.085;
    if (state.magnet < 0.01) {
      // Al entrar, el imán arranca donde está el cursor (sin barrido desde el último punto)
      state.x = px;
      state.y = py;
    } else {
      state.x += (px - state.x) * 0.16;
      state.y += (py - state.y) * 0.16;
    }
    let busy = state.magnet > 0.002;

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Los que no notan el cursor van todos en un solo trazo
    ctx.beginPath();
    const touched = [];

    state.clocks.forEach((clock) => {
      const dx = state.x - clock.x;
      const dy = state.y - clock.y;
      const distance = Math.hypot(dx, dy) || 1;
      const falloff = clamp(1 - distance / RADIUS, 0, 1);
      const influence = falloff * falloff * state.magnet;
      const near = clamp(1 - distance / NEAR, 0, 1) * state.magnet;
      const aim = clamp(influence * 1.2 + near * 0.9, 0, 1);

      const pointerAngle = Math.atan2(dy, dx);
      const longTarget = hands.minute + angleDelta(hands.minute, pointerAngle) * aim;
      const shortTarget = hands.hour + angleDelta(hands.hour, pointerAngle) * aim * 0.92;
      const turn = skipMotion ? 1 : clamp(0.12 + aim * 0.22 + near * 0.18 + state.magnet * 0.08, 0.08, 0.44);
      clock.long = clock.long === null ? longTarget : clock.long + angleDelta(clock.long, longTarget) * turn;
      clock.short = clock.short === null ? shortTarget : clock.short + angleDelta(clock.short, shortTarget) * turn * 0.92;
      if (Math.abs(angleDelta(clock.long, longTarget)) > 0.002 || Math.abs(angleDelta(clock.short, shortTarget)) > 0.002) busy = true;

      const x = clock.x + (dx / distance) * influence * PULL;
      const y = clock.y + (dy / distance) * influence * PULL;
      const longLength = m.long * clock.longScale * (1 + influence * 0.22);
      const shortLength = m.short * clock.shortScale * (1 + influence * 0.18);
      if (influence < 0.001) addGlyph(ctx, x, y, clock, longLength, shortLength);
      else touched.push([x, y, clock, longLength, shortLength, influence]);
    });

    ctx.lineWidth = m.line * 0.9;
    ctx.strokeStyle = `rgba(${COLOR}, ${BASE_ALPHA})`;
    ctx.stroke();

    touched.forEach(([x, y, clock, longLength, shortLength, influence]) => {
      ctx.beginPath();
      addGlyph(ctx, x, y, clock, longLength, shortLength);
      ctx.lineWidth = m.line * (0.9 + influence * 0.45);
      ctx.strokeStyle = `rgba(${COLOR}, ${(BASE_ALPHA + influence * HOVER_ALPHA).toFixed(3)})`;
      ctx.stroke();
    });

    return busy;
  }

  // Solo anima mientras algo se mueve; en reposo no gasta CPU
  let frame = null;
  function render() {
    const now = performance.now();
    const hands = handAngles();
    let busy = false;
    states.forEach((state) => {
      if (state.visible && draw(state, now, hands)) busy = true;
    });
    frame = busy ? window.requestAnimationFrame(render) : null;
  }
  const wake = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { states.get(entry.target).visible = entry.isIntersecting; });
      wake();
    }, { rootMargin: "100px 0px" });
    fields.forEach((el) => observer.observe(el));
  } else {
    states.forEach((state) => { state.visible = true; });
    wake();
  }

  if ("ResizeObserver" in window) {
    const resizer = new ResizeObserver(wake);
    fields.forEach((el) => resizer.observe(el));
  } else {
    window.addEventListener("resize", wake);
  }

  // Las agujas siguen la hora real
  window.setInterval(wake, 30000);

  if (interactive) {
    const onPointer = (event) => {
      if (event.pointerType === "touch") return;
      Object.assign(pointer, { x: event.clientX, y: event.clientY, known: true, lastMove: performance.now() });
      wake();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    // Con la rueda el cursor no se mueve, pero la sección pasa por debajo: cuenta como actividad
    window.addEventListener("scroll", () => {
      if (!pointer.known) return;
      pointer.lastMove = performance.now();
      wake();
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { pointer.known = false; });
  }
})();
