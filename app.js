/* True-scale study of the 14 November 2026 Ship 42 catch.
   Lengths in metres. Screen geometry is derived from those lengths
   and from the height typed in the header. */

const F = {
  stackH: 124,
  shipH: 52,
  boosterH: 72,
  diameter: 9,
  towerH: 146,
  raptorH: 2.9,
  raptorD: 1.3,
  raptorThrust: 250,
  boosterThrust: 8240,
  shipThrust: 1614,
  boosterProp: 3650,
  shipProp: 1600,
  tileFlat: 0.243,
  tileThick: 0.033,
  tileCount: 18000,
  saturnH: 110.6,
  saturnD: 10.1,
  libertyH: 93,
  jetL: 76.3,
  jetW: 6.5,
  jetCabin: 6.1,
  busL: 12,
  busW: 2.55,
  busH: 3.1,
  poolL: 50,
};

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = {
  mode: "stack",
  viewH: 8,
  anchorAlt: 0,
  anim: 0,
  lifted: new Set(),
  seconds: 0,
  playing: false,
  distance: 150,
  shaking: false,
};

const $ = (id) => document.getElementById(id);

function heightM() {
  const cm = Number($("heightCm").value);
  if (!Number.isFinite(cm)) return 1.75;
  return Math.min(2.2, Math.max(1, cm / 100));
}

function trim(n) {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function metres(n) {
  const cm = Math.round(n * 100);
  if (cm % 100 === 0) return String(cm / 100);
  if (cm % 10 === 0) return (cm / 100).toFixed(1);
  return (cm / 100).toFixed(2);
}

function tileFacts() {
  const flat = F.tileFlat;
  const corner = (2 * flat) / Math.sqrt(3);
  const area = (Math.sqrt(3) / 2) * flat * flat;
  const thick = F.tileThick;
  const solid = area * thick;
  return {
    flat,
    corner,
    area,
    thick,
    solid,
    count: F.tileCount,
    shield: area * F.tileCount,
  };
}

function cm1(m) {
  return (Math.round(m * 1000) / 10).toFixed(1);
}

function litres1(m3) {
  return (Math.round(m3 * 10000) / 10).toFixed(1);
}

function frameBelow() {
  return Math.min(4.6, Math.max(3.4, state.viewH * 0.18));
}

function scene() {
  const radius = F.diameter / 2;
  const rocketX = 2.4 + radius;
  let shipNose;
  let shipTail;
  let booster = false;
  if (state.mode === "stack") {
    booster = true;
    shipTail = F.boosterH;
    shipNose = F.stackH;
  } else {
    shipNose = F.towerH - 4;
    shipTail = shipNose - F.shipH;
  }
  return {
    rocketX,
    radius,
    shipNose,
    shipTail,
    booster,
    towerX: rocketX + radius + 5,
    towerW: 11,
  };
}

function prep(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, rect.width);
  const h = Math.max(2, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function label(ctx, text, x, y) {
  ctx.save();
  ctx.font = "600 12.5px Outfit, sans-serif";
  const w = ctx.measureText(text).width;
  const boxW = w + 16;
  const boxH = 22;
  roundRect(ctx, x - 2, y - 16, boxW, boxH, 7);
  ctx.fillStyle = "rgba(12, 11, 9, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "rgba(228, 194, 122, 0.9)";
  ctx.stroke();
  ctx.fillStyle = "#f6efe4";
  ctx.fillText(text, x + 6, y);
  ctx.restore();
}

function traceHex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + i * (Math.PI / 3);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHexField(ctx, cam, wx, walt, ww, wh) {
  const flat = F.tileFlat;
  if (flat * cam.ppm < 5) return;
  const r = flat / Math.sqrt(3);
  const rowStep = r * 1.5;
  const cols = Math.ceil(ww / flat) + 2;
  const rows = Math.ceil(wh / rowStep) + 2;
  if (cols * rows > 5000) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cam.sx(wx), cam.sy(walt + wh), ww * cam.ppm, wh * cam.ppm);
  ctx.clip();
  for (let row = 0; row < rows; row += 1) {
    const shift = row % 2 ? 0.5 : 0;
    for (let col = 0; col < cols; col += 1) {
      const cx = wx + (col + shift) * flat;
      const cy = walt + r + row * rowStep;
      paintHex(ctx, cam.sx(cx), cam.sy(cy), r * cam.ppm * 0.9, false, col * 3 + row * 5);
    }
  }
  ctx.restore();
}

function shipPath(ctx, cam, sc) {
  const x = cam.sx(sc.rocketX - sc.radius);
  const w = F.diameter * cam.ppm;
  const top = cam.sy(sc.shipNose);
  const bot = cam.sy(sc.shipTail);
  const nose = Math.min(Math.abs(bot - top) * 0.2, 12 * cam.ppm);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, top);
  ctx.bezierCurveTo(x + w * 0.86, top + nose * 0.15, x + w, top + nose * 0.55, x + w, top + nose);
  ctx.lineTo(x + w, bot);
  ctx.lineTo(x, bot);
  ctx.lineTo(x, top + nose);
  ctx.bezierCurveTo(x, top + nose * 0.55, x + w * 0.14, top + nose * 0.15, x + w / 2, top);
  ctx.closePath();
  return { x, w, top, bot, nose };
}

function drawShip(ctx, cam, sc) {
  const g = shipPath(ctx, cam, sc);
  ctx.save();
  ctx.fillStyle = "#c5ced4";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#5c676e";
  ctx.fillRect(g.x, g.top - 2, g.w * 0.52, g.bot - g.top + 4);
  const noseAlt = sc.shipNose - (g.nose / cam.ppm);
  drawHexField(ctx, cam, sc.rocketX - sc.radius, sc.shipTail, sc.radius, noseAlt - sc.shipTail);
  ctx.restore();
  ctx.save();
  shipPath(ctx, cam, sc);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();
  drawFlaps(ctx, cam, sc);
  if (state.mode === "catch") drawPlume(ctx, cam, sc.rocketX, sc.shipTail, sc.radius * 0.28);
  if (F.diameter * cam.ppm >= 48) {
    const mid = sc.shipTail + (sc.shipNose - sc.shipTail) * 0.58;
    label(ctx, "Tiles", cam.sx(sc.rocketX - sc.radius * 0.62), cam.sy(mid));
    label(ctx, "Steel", cam.sx(sc.rocketX + sc.radius * 0.28), cam.sy(mid));
  }
}

function drawFlaps(ctx, cam, sc) {
  const h = sc.shipNose - sc.shipTail;
  const flaps = [
    [0.78, 0.16],
    [0.16, 0.18],
  ];
  ctx.fillStyle = "#2a3036";
  flaps.forEach(([at, len]) => {
    const alt = sc.shipTail + h * at;
    const y = cam.sy(alt);
    const reach = (1.6 + len * 4) * cam.ppm;
    const thick = Math.max(3, len * h * cam.ppm);
    const left = cam.sx(sc.rocketX - sc.radius);
    const right = cam.sx(sc.rocketX + sc.radius);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left - reach, y + thick * 0.15);
    ctx.lineTo(left - reach * 0.82, y + thick);
    ctx.lineTo(left, y + thick * 0.72);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(right, y);
    ctx.lineTo(right + reach, y + thick * 0.15);
    ctx.lineTo(right + reach * 0.82, y + thick);
    ctx.lineTo(right, y + thick * 0.72);
    ctx.fill();
  });
}

function drawBooster(ctx, cam, sc) {
  const x = cam.sx(sc.rocketX - sc.radius);
  const y = cam.sy(F.boosterH);
  const w = F.diameter * cam.ppm;
  const h = F.boosterH * cam.ppm;
  const grd = ctx.createLinearGradient(x, y, x + w, y);
  grd.addColorStop(0, "#8e99a1");
  grd.addColorStop(0.45, "#e7eef2");
  grd.addColorStop(1, "#9aa6ae");
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(40, 48, 56, 0.35)";
  ctx.lineWidth = 1;
  const rings = 8;
  for (let i = 1; i < rings; i += 1) {
    const yy = y + (h * i) / rings;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
  drawEnginesSide(ctx, cam, sc.rocketX, 0, sc.radius);
  drawFins(ctx, cam, sc);
}

function drawFins(ctx, cam, sc) {
  const y = cam.sy(F.boosterH - 3);
  const left = cam.sx(sc.rocketX - sc.radius);
  const right = cam.sx(sc.rocketX + sc.radius);
  const reach = 3.2 * cam.ppm;
  const deep = 5 * cam.ppm;
  ctx.fillStyle = "#3c444c";
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left - reach, y - deep * 0.2);
  ctx.lineTo(left - reach * 0.7, y + deep);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(right, y);
  ctx.lineTo(right + reach, y - deep * 0.2);
  ctx.lineTo(right + reach * 0.7, y + deep);
  ctx.closePath();
  ctx.fill();
}

function drawEnginesSide(ctx, cam, cx, alt, radius) {
  const bells = 5;
  const y = cam.sy(alt);
  const span = radius * 1.7 * cam.ppm;
  const start = cam.sx(cx) - span / 2;
  const bw = Math.max(2, F.raptorD * cam.ppm * 0.55);
  const bh = F.raptorH * cam.ppm;
  ctx.fillStyle = "#2b3138";
  for (let i = 0; i < bells; i += 1) {
    const x = start + (span * i) / (bells - 1) - bw / 2;
    ctx.beginPath();
    ctx.moveTo(x + bw * 0.2, y);
    ctx.lineTo(x + bw * 0.8, y);
    ctx.lineTo(x + bw, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.fill();
  }
}

function drawPlume(ctx, cam, cx, alt, halfW) {
  if (cam.ppm > 22) return;
  const x = cam.sx(cx);
  const y = cam.sy(alt);
  const len = Math.min(16 * cam.ppm, cam.h * 0.42);
  if (len < 8) return;
  const grd = ctx.createLinearGradient(x, y, x, y + len);
  grd.addColorStop(0, "rgba(255, 244, 220, 0.95)");
  grd.addColorStop(0.35, "rgba(255, 120, 60, 0.8)");
  grd.addColorStop(1, "rgba(255, 80, 40, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(x - halfW * cam.ppm, y);
  ctx.lineTo(x + halfW * cam.ppm, y);
  ctx.lineTo(x + halfW * cam.ppm * 2.4, y + len);
  ctx.lineTo(x - halfW * cam.ppm * 2.4, y + len);
  ctx.fill();
}

function drawTower(ctx, cam, sc) {
  const x = cam.sx(sc.towerX);
  const w = sc.towerW * cam.ppm;
  const top = cam.sy(F.towerH);
  const bot = cam.sy(0);
  ctx.save();
  ctx.strokeStyle = "#9aa3ab";
  ctx.lineWidth = Math.max(1, 0.18 * cam.ppm);
  ctx.strokeRect(x, top, w, bot - top);
  ctx.beginPath();
  for (let alt = 0; alt <= F.towerH; alt += 8) {
    const y = cam.sy(alt);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    if (alt + 8 <= F.towerH) {
      const y2 = cam.sy(alt + 8);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y2);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y2);
    }
  }
  ctx.stroke();
  ctx.restore();
  const armAlt = state.mode === "catch"
    ? sc.shipTail + F.shipH * 0.66
    : F.boosterH - 2;
  const y = cam.sy(armAlt);
  const reach = state.mode === "catch"
    ? cam.sx(sc.rocketX + sc.radius * 0.15)
    : cam.sx(sc.rocketX + sc.radius + 1.4);
  ctx.strokeStyle = "#e4c27a";
  ctx.lineWidth = Math.max(2, 0.45 * cam.ppm);
  ctx.beginPath();
  ctx.moveTo(x, y - 0.55 * cam.ppm);
  ctx.lineTo(reach, y - 0.55 * cam.ppm);
  ctx.moveTo(x, y + 0.55 * cam.ppm);
  ctx.lineTo(reach, y + 0.55 * cam.ppm);
  ctx.stroke();
}

function drawGhosts(ctx, cam) {
  const ground = cam.sy(0);
  const sc = scene();
  const stop = cam.sx(sc.rocketX - sc.radius) - 8;
  const fit = (text, x, y) => {
    ctx.save();
    ctx.font = "500 13px Outfit, sans-serif";
    const tw = ctx.measureText(text).width;
    ctx.restore();
    label(ctx, text, Math.max(6, Math.min(x, stop - tw)), y);
  };
  const jetSpan = F.jetL / (cutoutAspect("jet747") || 3.87);
  const satSpan = F.saturnH * (cutoutAspect("saturn") || 0.096);
  const libSpan = F.libertyH * (cutoutAspect("liberty") || 0.367);
  const jetRight = -18;
  const jetCenter = jetRight - jetSpan / 2;
  const satRight = jetRight - jetSpan - 4;
  const satCenter = satRight - satSpan / 2;
  const libRight = satRight - satSpan - 4;
  const libCenter = libRight - libSpan / 2;

  if ($("ghostBus").checked) {
    const w = F.busL * cam.ppm;
    const drawn = drawCutout(ctx, "bus", cam.sx(-10), ground, w, "width");
    const h = drawn ? drawn.h : F.busH * cam.ppm;
    if (!drawn) paintBus(ctx, cam.sx(-16), ground - h, w, h, "side");
    if (h > 16) fit("City bus, 12 m", cam.sx(-16) + 8, ground - h - 8);
  }
  if ($("ghost747").checked) {
    const drawn = drawCutout(ctx, "jet747", cam.sx(jetCenter), ground, F.jetL * cam.ppm, "width", { noseUp: true });
    const top = drawn ? ground - drawn.h : cam.sy(F.jetL);
    if (!drawn) {
      paintBox(ctx, cam.sx(jetCenter - 3.25), ground - F.jetL * cam.ppm, 6.5 * cam.ppm, F.jetL * cam.ppm, {
        fill: "rgba(215, 228, 234, 0.28)",
        stroke: "#e7f2f8",
      });
    }
    if ((drawn ? drawn.h : F.jetL * cam.ppm) > 20) fit("747-8 on its tail, 76 m", cam.sx(jetCenter) + 8, top - 8);
  }
  if ($("ghostSaturn").checked) {
    const drawn = drawCutout(ctx, "saturn", cam.sx(satCenter), ground, F.saturnH * cam.ppm, "height");
    const top = drawn ? ground - drawn.h : cam.sy(F.saturnH);
    if (!drawn) {
      paintBox(ctx, cam.sx(satCenter - F.saturnD / 2), ground - F.saturnH * cam.ppm, F.saturnD * cam.ppm, F.saturnH * cam.ppm, {
        fill: "rgba(240, 210, 176, 0.28)",
        stroke: "#f0d2b0",
      });
    }
    if ((drawn ? drawn.h : 40) > 20) fit("Saturn V, 111 m", cam.sx(satCenter) + 8, top - 8);
  }
  if ($("ghostLiberty").checked) {
    const drawn = drawCutout(ctx, "liberty", cam.sx(libCenter), ground, F.libertyH * cam.ppm, "height");
    const top = drawn ? ground - drawn.h : cam.sy(F.libertyH);
    if (!drawn) {
      ctx.strokeStyle = "#c9b6e4";
      ctx.lineWidth = Math.max(3, 0.35 * cam.ppm);
      ctx.beginPath();
      ctx.moveTo(cam.sx(libCenter), ground);
      ctx.lineTo(cam.sx(libCenter), top);
      ctx.stroke();
    }
    fit("Liberty, 93 m", cam.sx(libRight) + 8, top + 18);
  }
}

function drawWorld(ctx, cam) {
  const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
  sky.addColorStop(0, "#24303a");
  sky.addColorStop(1, "#14110e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.w, cam.h);

  const ground = cam.sy(0);
  if (ground < cam.h + 20) {
    ctx.fillStyle = "#3e4a3c";
    ctx.fillRect(0, ground, cam.w, cam.h - ground + 2);
    ctx.fillStyle = "#6d8ea0";
    ctx.fillRect(0, ground + Math.max(2, 0.4 * cam.ppm), cam.w, Math.max(4, 1.2 * cam.ppm));
  }

  const sc = scene();
  drawGhosts(ctx, cam);
  drawTower(ctx, cam, sc);
  if (sc.booster) {
    drawBooster(ctx, cam, sc);
    if (state.mode === "stack") drawPlume(ctx, cam, sc.rocketX, 0, sc.radius * 0.35);
  }
  drawShip(ctx, cam, sc);

  const hPx = heightM() * cam.ppm;
  const px = cam.sx(0);
  const py = cam.sy(state.anchorAlt);
  drawPerson(ctx, px, py, hPx);
  if (hPx >= 14 && hPx < cam.h * 0.9) label(ctx, "You", px + hPx * 0.22, py - hPx - 20);
  else if (hPx >= 1.5) label(ctx, "You", px - 36, py - Math.max(16, hPx + 8));

  if (cam.ppm > 8 && cam.ppm < 80 && state.anchorAlt < 5) {
    label(ctx, "9 m diameter", cam.sx(sc.rocketX - sc.radius), cam.sy(6));
  }
}

function zoomCamera(w, h) {
  const below = frameBelow();
  const ppm = h / (state.viewH + below);
  const sc = scene();
  const besideYou = w * 0.2;
  const centered = w * 0.46 - sc.rocketX * ppm;
  const rocketPx = F.diameter * ppm;
  const close = Math.min(1, Math.max(0, (rocketPx - 70) / 240));
  const originX = centered * (1 - close) + besideYou * close;
  const originY = h - below * ppm;
  return {
    ppm,
    w,
    h,
    sx: (x) => originX + x * ppm,
    sy: (alt) => originY - (alt - state.anchorAlt) * ppm,
  };
}

function drawZoom() {
  const canvas = $("zoomCanvas");
  const { ctx, w, h } = prep(canvas);
  drawWorld(ctx, zoomCamera(w, h));
  $("zoomReadout").textContent = `${trim(state.viewH)} m above your feet`;
  $("zoomCaption").textContent = zoomCaption();
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.preset === state.preset ? "true" : "false");
  });
}

function zoomCaption() {
  const h = heightM();
  const sc = scene();
  if (state.mode === "catch" && state.anchorAlt < 5 && state.viewH < 90) {
    return "The ship is up in the arms, about 90 metres off the ground. At this zoom you are on the pad and the ship is out of frame. Zoom out to see it hanging there, or switch back to the stack that left on 13 November.";
  }
  if (state.anchorAlt > 20) {
    return `You have been lifted to ${Math.round(state.anchorAlt)} m, beside the heat shield. The colored plates are the tiles, one hexagon each, about ${cm1(F.tileFlat)} cm across the flats. The colors are a diagram so the plates stay separate. In the photographs that side is black, and the bright half is bare steel. A tile is ${Math.round((F.tileFlat / h) * 100)} percent of your height. This standing place is a sketch.`;
  }
  if (state.viewH < 12) {
    return `This frame shows ${trim(state.viewH)} m of the vehicle above your feet, and you are ${metres(h)} m. The wall beside you is the skin of a rocket 9 m across. Up close it does not look like a vehicle. It looks like a building that can fly.`;
  }
  if (state.viewH < 30) {
    return `A city bus is 12 m long and 3.1 m tall. One Raptor is ${F.raptorH} m tall, so the engine next to the bus is about as tall as the bus. There are 33 of them in the base.`;
  }
  if (state.viewH < 100) {
    return `The ship is ${F.shipH} m, two metres longer than an Olympic pool stood on end. Reaching its nose would take ${trim(F.shipH / h)} of you, one on another's shoulders.`;
  }
  const prop = F.boosterProp + F.shipProp;
  return `The stack is ${F.stackH} m, ${trim(F.stackH / h)} of you. Saturn V is 110.6 m. The Statue of Liberty, ground to torch, is 93 m. The tower is drawn at the reported 146 m. The two stages hold ${prop.toLocaleString()} tonnes of propellant, more than a whole fueled Saturn V.`;
}

const VIEW_MIN = 2.6;
const VIEW_MAX = 200;

function viewFromSlider(v) {
  return VIEW_MIN * (VIEW_MAX / VIEW_MIN) ** (v / 1000);
}

function sliderFromView(view) {
  return Math.round(1000 * Math.log(view / VIEW_MIN) / Math.log(VIEW_MAX / VIEW_MIN));
}

function syncSlider() {
  const el = $("zoomSlider");
  const next = String(Math.max(0, Math.min(1000, sliderFromView(state.viewH))));
  if (el.value !== next) el.value = next;
}

function goPreset(name) {
  const table = {
    tile: () => ({ view: 3.2, anchor: scene().shipTail + F.shipH * 0.48 }),
    engines: () => ({ view: 8, anchor: 0 }),
    bus: () => ({ view: 16, anchor: 0 }),
    ship: () => ({ view: 64, anchor: 0 }),
    stack: () => ({ view: 158, anchor: 0 }),
    tower: () => ({ view: 168, anchor: 0 }),
  };
  const target = table[name]();
  state.preset = name;
  tweenCamera(target.view, target.anchor);
}

function tweenCamera(view, anchor) {
  state.anim += 1;
  const token = state.anim;
  const fromV = state.viewH;
  const fromA = state.anchorAlt;
  if (reduced) {
    state.viewH = view;
    state.anchorAlt = anchor;
    syncSlider();
    drawZoom();
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    if (token !== state.anim) return;
    const u = Math.min(1, (now - t0) / 680);
    const e = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    state.viewH = fromV + (view - fromV) * e;
    state.anchorAlt = fromA + (anchor - fromA) * e;
    syncSlider();
    drawZoom();
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function drawAcross() {
  const canvas = $("acrossCanvas");
  const { ctx, w, h } = prep(canvas);
  ctx.fillStyle = "#10141a";
  ctx.fillRect(0, 0, w, h);
  const view = 12.5;
  const ppm = Math.min(w, h) / view;
  const cx = w * 0.56;
  const cy = h * 0.52;
  const R = (F.diameter / 2) * ppm;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  const hull = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  hull.addColorStop(0, "#243038");
  hull.addColorStop(1, "#12181c");
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.lineWidth = Math.max(4, ppm * 0.06);
  ctx.strokeStyle = "#d5dee4";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, (F.jetCabin / 2) * ppm, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(215, 228, 234, 0.16)";
  ctx.fill();
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = lookReduced ? 0 : -performance.now() / 45;
  ctx.lineWidth = 2.25;
  ctx.strokeStyle = "#e7f2f8";
  ctx.stroke();
  ctx.setLineDash([]);

  const busW = F.busW * ppm;
  const busAspect = cutoutAspect("bus-front") || (F.busW / F.busH);
  const busH = busW / busAspect;
  const gap = 0.15 * ppm;
  const total = busW * 3 + gap * 2;
  for (let i = 0; i < 3; i += 1) {
    const x = cx - total / 2 + i * (busW + gap);
    const drawn = drawCutout(ctx, "bus-front", x + busW / 2, cy + busH / 2, busW, "width");
    if (!drawn) paintBus(ctx, x, cy - busH / 2, busW, busH, "end");
  }

  const personH = heightM() * ppm;
  drawPerson(ctx, cx - R + personH * 0.35, cy + R * 0.15, personH);
  label(ctx, "9 m", cx - 16, cy - R - 10);
  label(ctx, "747 cabin, 6.1 m", cx + 8, cy - (F.jetCabin / 2) * ppm + 18);
  const across = F.diameter / heightM();
  const shoulders = Math.floor(F.diameter / 0.45);
  $("acrossCaption").textContent = `Head to toe, the diameter is ${trim(across)} of you. About ${shoulders} adults at 45 cm of shoulder fit across the inside. The dashed circle is a 747 cabin. The three buses are city buses seen end-on, 2.55 m wide and 3.1 m tall.`;
}

function enginePoints() {
  const pts = [];
  const ring = (n, r, kind, turn) => {
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / n;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, kind });
    }
  };
  ring(3, 0.78, "steer", 0);
  ring(10, 2.15, "steer", 0);
  ring(20, 3.55, "outer", Math.PI / 20);
  return pts;
}

function drawEngines() {
  const canvas = $("engineCanvas");
  const { ctx, w, h } = prep(canvas);
  ctx.fillStyle = "#10141a";
  ctx.fillRect(0, 0, w, h);
  const view = 13;
  const ppm = Math.min(w * 0.72, h * 0.86) / F.diameter;
  const cx = w * 0.58;
  const cy = h * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, (F.diameter / 2) * ppm, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(197, 206, 212, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const drawn = Math.min(F.raptorD, 1.16);
  enginePoints().forEach((p) => {
    const ex = cx + p.x * ppm;
    const ey = cy + p.y * ppm;
    const er = (drawn / 2) * ppm;
    const bell = ctx.createRadialGradient(ex - er * 0.28, ey - er * 0.32, er * 0.08, ex, ey, er);
    if (p.kind === "steer") {
      bell.addColorStop(0, "#f7fbfc");
      bell.addColorStop(0.62, "#b7c4cc");
      bell.addColorStop(1, "#2a333a");
    } else {
      bell.addColorStop(0, "#d5dde2");
      bell.addColorStop(0.6, "#6d7b84");
      bell.addColorStop(1, "#151a1e");
    }
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = bell;
    ctx.fill();
    ctx.lineWidth = Math.max(1.25, er * 0.08);
    ctx.strokeStyle = "rgba(255, 248, 236, 0.55)";
    ctx.stroke();
  });
  const personH = heightM() * ppm;
  const groundY = cy + (F.diameter / 2) * ppm;
  drawPerson(ctx, cx - (F.diameter / 2) * ppm - personH * 0.7, groundY, personH);
  label(ctx, "You, same scale", cx - (F.diameter / 2) * ppm - personH * 1.5, groundY - personH - 8);
  $("engineCaption").textContent = `SpaceX rates each Raptor at ${F.raptorD} m across and ${F.raptorH} m tall, ${F.raptorThrust} tonnes of thrust. That is about ${Math.round(F.raptorThrust / 1.6)} cars of 1.6 tonnes, from one engine. The pale 13 steer. The outer 20 do not. They are spaced here so each circle stays readable inside the 9 m base.`;
  void view;
}

function tileCamera(w, h) {
  const viewW = Math.max(4.4, Math.min(11.2, w / 88));
  const ppm = w / viewW;
  return {
    ppm,
    w,
    h,
    sx: (x) => 28 + x * ppm,
    sy: (alt) => h - 36 - alt * ppm,
  };
}

function tileCenter(col, row) {
  const flat = F.tileFlat;
  const r = flat / Math.sqrt(3);
  const shift = row % 2 ? 0.5 : 0;
  return {
    x: 1.7 + (col + shift) * flat,
    alt: 0.15 + r + row * r * 1.5,
    r,
  };
}

function drawTiles() {
  const canvas = $("tileCanvas");
  const { ctx, w, h } = prep(canvas);
  const cam = tileCamera(w, h);
  ctx.fillStyle = "#1b242c";
  ctx.fillRect(0, 0, w, h);
  const wallX = 1.7;
  const wallW = F.diameter;
  const wallH = 4.4;
  ctx.fillStyle = "#8b969e";
  ctx.fillRect(cam.sx(wallX), cam.sy(wallH), wallW * cam.ppm, wallH * cam.ppm);
  const flat = F.tileFlat;
  const r = flat / Math.sqrt(3);
  const rowStep = r * 1.5;
  const rows = Math.floor(wallH / rowStep);
  const cols = Math.floor(wallW / flat);
  for (let row = 0; row < rows; row += 1) {
    const shift = row % 2 ? 0.5 : 0;
    for (let col = 0; col < cols; col += 1) {
      if (wallX + (col + shift) * flat + r > wallX + wallW) continue;
      const c = tileCenter(col, row);
      const key = `${col},${row}`;
      const lift = state.lifted.has(key) ? -0.18 : 0;
      paintHex(ctx, cam.sx(c.x), cam.sy(c.alt + lift), r * cam.ppm * 0.9, state.lifted.has(key), col * 3 + row * 5);
    }
  }
  const hPx = heightM() * cam.ppm;
  drawPerson(ctx, cam.sx(0.42), cam.sy(0), hPx);
  label(ctx, "You", cam.sx(0.42) + 14, cam.sy(heightM()) - 22);
  const plate = 0.27;
  paintPlate(ctx, cam.sx(1.15), cam.sy(0.85), (plate / 2) * cam.ppm);
  label(ctx, "27 cm plate", cam.sx(1.32), cam.sy(1.15));
  const f = tileFacts();
  const across = Math.round(F.diameter / F.tileFlat);
  const around = Math.round((Math.PI * F.diameter) / F.tileFlat);
  const lifted = state.lifted.size
    ? `${state.lifted.size} tile${state.lifted.size === 1 ? "" : "s"} lifted. The grey underneath is the steel. `
    : "";
  $("tileCaption").textContent = `${lifted}Each colored hex is one tile, ${cm1(f.flat)} cm across the flats and ${cm1(f.corner)} cm from corner to corner, about ${Math.round(f.area * 10000)} cm². The plate is 27 cm across. About ${across} tiles span the 9 m diameter, and about ${around} would go around once. Click a tile to lift it.`;
}

function onTileClick(event) {
  const canvas = $("tileCanvas");
  const rect = canvas.getBoundingClientRect();
  const { w, h } = { w: rect.width, h: rect.height };
  const cam = tileCamera(w, h);
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const wx = (sx - 28) / cam.ppm;
  const walt = (h - 36 - sy) / cam.ppm;
  const flat = F.tileFlat;
  const r = flat / Math.sqrt(3);
  const row = Math.round((walt - 0.15 - r) / (r * 1.5));
  const shift = row % 2 ? 0.5 : 0;
  const col = Math.round((wx - 1.7) / flat - shift);
  const c = tileCenter(col, row);
  const dx = wx - c.x;
  const dy = walt - c.alt;
  if (dx * dx + dy * dy > flat * flat) return;
  const key = `${col},${row}`;
  if (state.lifted.has(key)) state.lifted.delete(key);
  else state.lifted.add(key);
  drawTiles();
}

let walkCam = null;
let walkAlt = 3;
let walkPpm = 0;

function drawWalk() {
  const canvas = $("walkCanvas");
  const ppm = 64 / heightM();
  const ppmChanged = ppm !== walkPpm;
  walkPpm = ppm;
  const worldLeft = -8;
  const sc = scene();
  const worldRight = sc.towerX + sc.towerW + 4;
  const cssW = (worldRight - worldLeft) * ppm;
  const cssH = (F.towerH + 6) * ppm;
  const dpr = 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const groundY = cssH - 28;
  walkCam = {
    ppm,
    w: cssW,
    h: cssH,
    groundY,
    worldLeft,
    sx: (x) => (x - worldLeft) * ppm,
    sy: (alt) => groundY - alt * ppm,
  };
  const previousAnchor = state.anchorAlt;
  state.anchorAlt = -10;
  const previousMode = state.mode;
  state.mode = "stack";
  drawWorld(ctx, walkCam);
  state.mode = previousMode;
  state.anchorAlt = previousAnchor;
  const personPx = 64;
  const walker = $("walker");
  paintWalker($("walkerFig"), personPx);
  walker.style.height = `${personPx}px`;
  walker.style.width = $("walkerFig").style.width;
  walker.style.top = `calc(78% - ${personPx}px)`;
  if (ppmChanged) scrollWalkTo(walkAlt, true);
  readWalk();
}

function placeWalker() {
  if (!walkCam) return;
  const scroller = $("walkScroll");
  const walker = $("walker");
  const x = walkCam.sx(0) - scroller.scrollLeft;
  walker.style.left = `${x - walker.offsetWidth / 2}px`;
}

function readWalk() {
  if (!walkCam) return;
  const scroller = $("walkScroll");
  const feetY = scroller.scrollTop + scroller.clientHeight * 0.78;
  const alt = (walkCam.groundY - feetY) / walkCam.ppm;
  const shown = Math.max(-2, alt);
  walkAlt = shown;
  $("walkAlt").textContent = `${shown < 0 ? 0 : Math.round(shown)} m`;
  const [name, text] = station(shown);
  $("walkName").textContent = name;
  $("walkText").textContent = text;
  placeWalker();
}

function station(alt) {
  const h = heightM();
  if (alt < 1) {
    return ["The ground", "You are on the pad. In the 10 November photograph, a person in a lift basket is this size against the booster’s tank wall. The marsh in the liftoff pictures is the water around your feet."];
  }
  if (alt < 12) {
    return ["The engines", `A Raptor is ${F.raptorH} m tall. The booster lights 33 of them, rated together at ${F.boosterThrust.toLocaleString()} tonnes of thrust, about 2.4 times a Saturn V. The deluge pushes water up into this flame so the steel plate survives.`];
  }
  if (alt < F.boosterH - 6) {
    const prop = F.boosterProp + F.shipProp;
    return ["Super Heavy", `Seventy-two metres of tank. It holds ${F.boosterProp.toLocaleString()} tonnes of methane and oxygen. With the ship’s ${F.shipProp.toLocaleString()} tonnes, the propellant alone is ${prop.toLocaleString()} tonnes, heavier than a fueled Saturn V at liftoff. You are ${metres(h)} m. This stage is ${trim(F.boosterH / h)} of you.`];
  }
  if (alt < F.boosterH + 2) {
    return ["Grid fins and the joint", "The booster’s catch, on the flights that caught one, closed under the grid fins up here. This flight’s booster did not come home. It was diverted into the Gulf. The ship separates here, engines already burning."];
  }
  if (alt < F.stackH - 6) {
    return ["The ship’s hull", "Black on the windward half, bare steel on the other. Only one side takes the plasma. The ship is 52 m. Caught the next day, this part of the vehicle was hanging near the top of the tower, not standing on the booster."];
  }
  if (alt < F.stackH + 1) {
    return ["The nose", `The top of the stack is 124 m, ${trim(F.stackH / h)} of you. The forward flaps are up here. An Olympic pool on end would end two metres short of this nose.`];
  }
  if (alt < F.towerH) {
    return ["The tower above the rocket", "SpaceX prints the vehicle at 124 m and does not print the tower height on that page. The tower is drawn at 146 m, the figure widely reported, so the arms have steel left above a full stack. The width of the tower in this drawing is a sketch."];
  }
  return ["Above the tower", "Open air. South Padre Island is about 8 km across the water. Cameras there still shake when the 33 engines are lit."];
}

function scrollWalkTo(alt, instant) {
  if (!walkCam) return;
  const scroller = $("walkScroll");
  const feetY = walkCam.groundY - alt * walkCam.ppm;
  const top = feetY - scroller.clientHeight * 0.78;
  const left = Math.max(0, walkCam.sx(-1) - 40);
  scroller.scrollTo({
    top: Math.max(0, top),
    left,
    behavior: instant || reduced ? "auto" : "smooth",
  });
}

const APPROACH_FRAMES = 37;

const BEATS = [
  {
    t: 0,
    title: "Three engines light",
    body: "The landing burn starts. A published timeline of this flight puts that moment at 22 hours, 32 minutes and 16 seconds after liftoff. The ship is already subsonic. The heat is behind it.",
  },
  {
    t: 2,
    title: "It flips upright",
    body: "Two seconds later the ship rotates from the belly-down fall into a vertical hover. The tower is the opening it has to fly into.",
  },
  {
    t: 10,
    title: "Down to two engines",
    body: "Ten seconds in, two engines. From the tower, the ship is no longer a speck. It is a 52 metre object coming down beside the steel you are standing on.",
  },
  {
    t: 17,
    title: "One engine",
    body: "Seventeen seconds. One engine is holding the ship in the slot between the arms.",
  },
  {
    t: 18,
    title: "The arms have it",
    body: "The arms close and the last engine shuts down. It is 14 November 2026, about 3:20 in the afternoon in Texas. The ship left the day before.",
  },
];

function approachFrame(t) {
  const i = Math.round((t / 18) * (APPROACH_FRAMES - 1));
  const n = Math.max(0, Math.min(APPROACH_FRAMES - 1, i));
  return `media/approach-frames/${String(n).padStart(2, "0")}.jpg`;
}

function beatFor(t) {
  let current = BEATS[0];
  BEATS.forEach((beat) => {
    if (t + 0.001 >= beat.t) current = beat;
  });
  return current;
}

function setSeconds(t) {
  state.seconds = Math.max(0, Math.min(18, t));
  $("secondsSlider").value = String(Math.round(state.seconds * 10));
  $("secondsTime").textContent = state.seconds.toFixed(1);
  const beat = beatFor(state.seconds);
  $("secondsBeat").textContent = beat.title;
  $("secondsBody").textContent = beat.body;
  const img = $("secondsPhoto");
  const frame = approachFrame(state.seconds);
  if (img.getAttribute("src") !== frame) {
    img.src = frame;
    img.alt = "A frame from SpaceX’s clip of Ship 42 coming in to be caught, shown in the order it was filmed.";
  }
  document.querySelectorAll("#beatList button").forEach((btn) => {
    btn.classList.toggle("is-on", Number(btn.dataset.t) === beat.t);
  });
}

function playSeconds() {
  if (state.playing) {
    state.playing = false;
    $("secondsPlay").textContent = "Play the 18 seconds";
    $("secondsPlay").classList.remove("is-on");
    return;
  }
  state.playing = true;
  $("secondsPlay").textContent = "Pause";
  $("secondsPlay").classList.add("is-on");
  const from = state.seconds >= 18 ? 0 : state.seconds;
  if (state.seconds >= 18) setSeconds(0);
  const t0 = performance.now();
  const step = (now) => {
    if (!state.playing) return;
    const t = Math.min(18, from + (now - t0) / 1000);
    setSeconds(t);
    if (t >= 18) {
      state.playing = false;
      $("secondsPlay").textContent = "Play the 18 seconds";
      $("secondsPlay").classList.remove("is-on");
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let waterToken = 0;

function drawWater(phase, u) {
  const canvas = $("waterCanvas");
  const { ctx, w, h } = prep(canvas);
  const progress = Math.max(0, Math.min(1, u || 0));
  const skirtM = 2.4;
  const bellM = F.raptorH;
  const gapM = 1.7;
  const plateM = 0.55;
  const pipeM = 0.7;
  const foundM = 0.45;
  const mechH = skirtM + bellM + gapM + plateM + pipeM + foundM;
  const side = Math.min(118, Math.max(72, w * 0.2));
  const ppm = Math.min((w - 20 - side) / F.diameter, (h - 46) / mechH);
  const boosterW = F.diameter * ppm;
  const boosterLeft = Math.max(side, (w - boosterW) / 2);
  const top = Math.max(34, (h - mechH * ppm) / 2);
  const skirtTop = top;
  const deckY = skirtTop + skirtM * ppm;
  const bellH = bellM * ppm;
  const bellExit = deckY + bellH;
  const plateTop = bellExit + gapM * ppm;
  const plateH = Math.max(22, plateM * ppm);
  const pipeH = Math.max(16, pipeM * ppm);
  const bells = 7;
  const bellW = F.raptorD * ppm;
  const centers = [];
  for (let i = 0; i < bells; i += 1) {
    centers.push(boosterLeft + boosterW * (i + 0.5) / bells);
  }

  const sky = ctx.createLinearGradient(0, 0, 0, deckY);
  sky.addColorStop(0, "#243044");
  sky.addColorStop(1, "#12161c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2a3130";
  ctx.fillRect(0, deckY, w, h - deckY);

  const pitLeft = boosterLeft - 10;
  const pitRight = boosterLeft + boosterW + 10;
  ctx.fillStyle = "#14181c";
  ctx.fillRect(pitLeft, deckY, pitRight - pitLeft, plateTop + plateH + pipeH + foundM * ppm - deckY);
  ctx.strokeStyle = "rgba(235, 228, 214, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pitLeft + 1, deckY, pitRight - pitLeft - 2, plateTop + plateH - deckY);

  const steel = ctx.createLinearGradient(boosterLeft, skirtTop, boosterLeft + boosterW, skirtTop);
  steel.addColorStop(0, "#6d767e");
  steel.addColorStop(0.18, "#d5dde2");
  steel.addColorStop(0.55, "#b7c1c8");
  steel.addColorStop(1, "#5a636b");
  ctx.fillStyle = steel;
  ctx.fillRect(boosterLeft, skirtTop, boosterW, skirtM * ppm);
  ctx.fillStyle = "rgba(20, 24, 28, 0.35)";
  for (let seam = 1; seam <= 3; seam += 1) {
    const y = skirtTop + (seam * skirtM * ppm) / 4;
    ctx.fillRect(boosterLeft, y, boosterW, 2);
  }
  ctx.fillStyle = "#3a424a";
  ctx.fillRect(boosterLeft - 4, deckY - 8, boosterW + 8, 8);

  ctx.fillStyle = "#8b939a";
  [boosterLeft - 16, boosterLeft + boosterW - 6].forEach((x) => {
    ctx.fillRect(x, deckY - skirtM * ppm * 0.55, 14, skirtM * ppm * 0.55);
    ctx.fillRect(x - 6, deckY - 8, 26, 10);
  });

  centers.forEach((cx) => {
    const lit = phase === "fire" ? progress : 0;
    const topW = bellW * 0.46;
    const botW = bellW * 0.92;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, deckY);
    ctx.quadraticCurveTo(cx - botW * 0.2, deckY + bellH * 0.45, cx - botW / 2, bellExit);
    ctx.lineTo(cx + botW / 2, bellExit);
    ctx.quadraticCurveTo(cx + botW * 0.2, deckY + bellH * 0.45, cx + topW / 2, deckY);
    ctx.closePath();
    const metal = ctx.createLinearGradient(cx - botW / 2, deckY, cx + botW / 2, deckY);
    metal.addColorStop(0, "#3e464e");
    metal.addColorStop(0.42, "#f2f6f8");
    metal.addColorStop(1, "#2a3138");
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.strokeStyle = "#1c2228";
    ctx.lineWidth = 1;
    ctx.stroke();
    const mouthY = bellExit - Math.max(5, bellH * 0.07);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, botW * 0.34, Math.max(4, bellH * 0.09), 0, 0, Math.PI * 2);
    ctx.fillStyle = lit > 0.02 ? `rgba(255, ${Math.round(220 - lit * 80)}, ${Math.round(190 - lit * 140)}, 0.95)` : "#0c1014";
    ctx.fill();
    ctx.strokeStyle = "#f7fbfc";
    ctx.lineWidth = Math.max(2, bellW * 0.055);
    ctx.stroke();
  });

  const plateGrad = ctx.createLinearGradient(0, plateTop, 0, plateTop + plateH);
  plateGrad.addColorStop(0, "#d5dbe0");
  plateGrad.addColorStop(0.25, "#8e99a2");
  plateGrad.addColorStop(1, "#3e474f");
  ctx.fillStyle = plateGrad;
  roundRect(ctx, pitLeft + 8, plateTop, pitRight - pitLeft - 16, plateH, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(228, 194, 122, 0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const pipeY = plateTop + plateH + 6;
  ctx.fillStyle = "#24343c";
  roundRect(ctx, pitLeft + 18, pipeY, pitRight - pitLeft - 36, Math.max(12, pipeH * 0.55), 8);
  ctx.fill();
  if (phase !== "idle") {
    ctx.fillStyle = phase === "deluge" ? "rgba(120, 206, 232, 0.9)" : "rgba(180, 220, 230, 0.55)";
    roundRect(ctx, pitLeft + 24, pipeY + 3, pitRight - pitLeft - 48, Math.max(6, pipeH * 0.28), 6);
    ctx.fill();
  }

  const holeR = Math.max(5, bellW * 0.16);
  centers.forEach((cx, i) => {
    const holeY = plateTop + holeR + 2;
    ctx.fillStyle = "#14181c";
    ctx.beginPath();
    ctx.arc(cx, holeY, holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6a737b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = phase === "idle" ? "#3d4c54" : "rgba(120, 206, 232, 0.85)";
    ctx.lineWidth = Math.max(3, holeR * 0.7);
    ctx.beginPath();
    ctx.moveTo(cx, holeY + holeR);
    ctx.lineTo(cx, pipeY + 2);
    ctx.stroke();

    if (phase === "deluge" || (phase === "fire" && progress < 0.85)) {
      const grow = phase === "deluge" ? progress : Math.max(0, 1 - progress * 1.25);
      const intoBell = bellExit - bellH * 0.28;
      const jetTop = holeY - grow * (holeY - intoBell);
      const width = Math.max(5, holeR * 1.7);
      const jet = ctx.createLinearGradient(cx, holeY, cx, jetTop);
      jet.addColorStop(0, "rgba(236, 252, 255, 0.98)");
      jet.addColorStop(1, "rgba(150, 214, 236, 0.95)");
      ctx.strokeStyle = jet;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, holeY);
      ctx.lineTo(cx + Math.sin(i + progress * 6) * 1.2, jetTop);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = Math.max(2, width * 0.38);
      ctx.stroke();
    }

    if (phase === "fire") {
      const start = bellExit - bellH * 0.2;
      const reach = plateTop + plateH * 0.45;
      const shown = start + (reach - start) * Math.max(0.3, progress);
      const plume = ctx.createLinearGradient(cx, start, cx, shown);
      plume.addColorStop(0, "rgba(255, 248, 236, 1)");
      plume.addColorStop(0.35, "rgba(255, 132, 48, 0.98)");
      plume.addColorStop(1, "rgba(255, 196, 120, 1)");
      ctx.fillStyle = plume;
      const half = bellW * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.7, start);
      ctx.lineTo(cx + half * 0.7, start);
      ctx.lineTo(cx + half, shown);
      ctx.lineTo(cx - half, shown);
      ctx.closePath();
      ctx.fill();
    }
  });

  if (phase === "fire" && progress > 0.25) {
    const steam = (progress - 0.25) / 0.75;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, pitLeft - 4, h);
    ctx.rect(pitRight + 4, 0, w, h);
    ctx.clip();
    [-1, 1].forEach((dir) => {
      const origin = dir < 0 ? pitLeft : pitRight;
      const cloud = ctx.createRadialGradient(origin, plateTop, 8, origin + dir * 70 * steam, plateTop - 10, 24 + 90 * steam);
      cloud.addColorStop(0, `rgba(255, 248, 240, ${0.25 + steam * 0.6})`);
      cloud.addColorStop(1, "rgba(244, 228, 210, 0)");
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(origin + dir * (28 + 56 * steam), plateTop + plateH * 0.2, 16 + 64 * steam, 12 + 26 * steam, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  const personH = heightM() * ppm;
  const personX = Math.max(28, boosterLeft * 0.42);
  drawPerson(ctx, personX, deckY, personH, true);

  function chip(text, x, y) {
    ctx.save();
    ctx.font = "600 12.5px Outfit, sans-serif";
    const boxW = ctx.measureText(text).width + 16;
    ctx.restore();
    label(ctx, text, Math.max(8, Math.min(x, w - boxW - 8)), Math.max(18, Math.min(y, h - 8)));
  }
  const phaseText = phase === "idle" ? "Before the water" : phase === "deluge" ? "Water on, T−17 s" : "Engines lit";
  chip(phaseText, 12, 22);
  chip("33 Raptors", boosterLeft + 8, skirtTop + 22);
  chip(w < 460 ? "Plate" : "Steel plate", 8, plateTop - 8);
  chip("You", personX - 18, deckY - personH - 6);
  const aria = phase === "idle"
    ? "Cutaway of the booster base held above a steel plate. Seven engine bells stand in a row. The plate has a hole under each bell."
    : phase === "deluge"
      ? "The same cutaway with water shooting up from the plate into the engine bells."
      : "The same cutaway with the engines lit. Flame comes down onto the plate and steam rolls out to both sides.";
  canvas.setAttribute("aria-label", aria);
}

function runWater() {
  if (state.shaking) {
    state.shaking = false;
    waterToken += 1;
    $("shakeFrame").classList.remove("is-shaking");
    $("waterButton").textContent = "Open the diverter, then light the engines";
    drawWater("idle", 0);
    updateShake();
    return;
  }
  state.shaking = true;
  $("waterButton").textContent = "Stop";
  const token = ++waterToken;
  if (reduced) {
    drawWater("fire", 1);
    updateShake();
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    if (token !== waterToken) return;
    const elapsed = (now - t0) / 1000;
    if (elapsed < 2.4) drawWater("deluge", elapsed / 2.4);
    else drawWater("fire", Math.min(1, (elapsed - 2.4) / 3));
    updateShake();
    if (elapsed < 8) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateShake() {
  const d = state.distance;
  const px = 10 * (150 / d) ** 1.15;
  const frame = $("shakeFrame");
  frame.style.setProperty("--sx", `${px.toFixed(2)}px`);
  frame.style.setProperty("--sy", `${(px * 0.65).toFixed(2)}px`);
  frame.classList.toggle("is-shaking", state.shaking && !reduced && px > 0.15);
  const where = d >= 7000 ? "about South Padre, five miles out" : d >= 900 ? "out on the flat" : "at the pad";
  $("distanceReadout").textContent = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
  $("shakeCaption").textContent = `You are ${where}. The illustration moves the photograph by about ${px.toFixed(1)} pixels. A timeline of Flight 15 opens the flame diverter 17 seconds before liftoff. On 20 April 2023, without this water, the first launch tore the concrete out from under the rocket. The curve is a picture of energy falling with distance, not a seismometer reading.`;
}

function renderHero() {
  const h = heightM();
  const facts = [
    ["Full stack", `${trim(F.stackH / h)} of you`],
    ["The ship", `${trim(F.shipH / h)} of you`],
    ["Across", `${trim(F.diameter / h)} of you`],
    ["Propellant", `${((F.boosterProp + F.shipProp) / 1000).toFixed(1)} thousand t`],
  ];
  $("heroFacts").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function renderBeats() {
  for (let i = 0; i < APPROACH_FRAMES; i += 1) {
    const preload = new Image();
    preload.src = `media/approach-frames/${String(i).padStart(2, "0")}.jpg`;
  }
  $("beatList").innerHTML = BEATS.map((beat) => (
    `<li><button type="button" data-t="${beat.t}"><strong>${beat.t.toFixed(0)} s</strong> · ${beat.title}</button></li>`
  )).join("");
  $("beatList").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    state.playing = false;
    $("secondsPlay").textContent = "Play the 18 seconds";
    $("secondsPlay").classList.remove("is-on");
    setSeconds(Number(btn.dataset.t));
  });
}

function paintDoor(ctx, x, ground, ppm) {
  const w = 0.9 * ppm;
  const h = 2 * ppm;
  const left = x - w / 2;
  const top = ground - h;
  ctx.save();
  ctx.fillStyle = "#1c1612";
  ctx.fillRect(left - ppm * 0.07, top - ppm * 0.05, w + ppm * 0.14, h + ppm * 0.05);
  const wood = ctx.createLinearGradient(left, top, left + w, top);
  wood.addColorStop(0, "#6a4530");
  wood.addColorStop(0.48, "#8d5c3c");
  wood.addColorStop(1, "#593724");
  ctx.fillStyle = wood;
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = "rgba(40, 22, 12, 0.55)";
  ctx.lineWidth = Math.max(1, ppm * 0.025);
  const inset = w * 0.14;
  ctx.strokeRect(left + inset, top + h * 0.08, w - inset * 2, h * 0.36);
  ctx.strokeRect(left + inset, top + h * 0.52, w - inset * 2, h * 0.36);
  ctx.fillStyle = "#e4c27a";
  ctx.beginPath();
  ctx.arc(left + w * 0.84, top + h * 0.48, Math.max(1.6, ppm * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintHoop(ctx, x, ground, ppm) {
  const rim = ground - 3.05 * ppm;
  const boardW = 1.83 * ppm;
  const boardH = 1.07 * ppm;
  const boardTop = rim - boardH * 0.62;
  ctx.save();
  ctx.strokeStyle = "#d5dee6";
  ctx.lineWidth = Math.max(2, ppm * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.lineTo(x, boardTop);
  ctx.stroke();
  ctx.fillStyle = "#f7f4ee";
  ctx.fillRect(x - boardW / 2, boardTop, boardW, boardH);
  ctx.strokeStyle = "#1a140c";
  ctx.lineWidth = Math.max(1, ppm * 0.03);
  ctx.strokeRect(x - boardW / 2, boardTop, boardW, boardH);
  ctx.strokeRect(x - boardW * 0.18, boardTop + boardH * 0.42, boardW * 0.36, boardH * 0.4);
  ctx.strokeStyle = "#e25b2a";
  ctx.lineWidth = Math.max(2, ppm * 0.045);
  ctx.beginPath();
  ctx.ellipse(x, rim, boardW * 0.16, Math.max(2, ppm * 0.07), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -3; i <= 3; i += 1) {
    ctx.moveTo(x + i * boardW * 0.045, rim);
    ctx.lineTo(x + i * boardW * 0.02, rim + ppm * 0.32);
  }
  ctx.stroke();
  ctx.restore();
}

function paintPoolSide(ctx, x, ground, ppm) {
  const w = 50 * ppm;
  const depth = 2 * ppm;
  const left = x - w / 2;
  const top = ground - depth;
  ctx.save();
  ctx.fillStyle = "#d7d0c4";
  ctx.fillRect(left - ppm * 0.6, top - ppm * 0.28, w + ppm * 1.2, ppm * 0.28);
  const water = ctx.createLinearGradient(0, top, 0, ground);
  water.addColorStop(0, "#b7e4ee");
  water.addColorStop(0.2, "#3aa3bb");
  water.addColorStop(1, "#0c4454");
  ctx.fillStyle = water;
  ctx.fillRect(left, top, w, depth);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(left, top, w, Math.max(1.5, ppm * 0.05));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  const tile = Math.max(6, 0.4 * ppm);
  for (let tx = left; tx < left + w - 1; tx += tile) {
    ctx.strokeRect(tx, top + depth * 0.45, tile, depth * 0.55);
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(left + ppm * 0.35, top - ppm * 0.62, ppm * 0.85, ppm * 0.62);
  ctx.restore();
}

function paintSteel(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, "#8e99a1");
  g.addColorStop(0.42, "#e7eef2");
  g.addColorStop(1, "#8d98a0");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#14181c";
  ctx.fillRect(x, y, w * 0.5, h);
}

function paintShipMark(ctx, x, ground, ppm, heightM) {
  const w = 9 * ppm;
  const h = heightM * ppm;
  const left = x - w / 2;
  const top = ground - h;
  const nose = Math.min(h * 0.22, w * 1.15);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, ground);
  ctx.lineTo(left, top + nose);
  ctx.quadraticCurveTo(x, top - w * 0.08, left + w, top + nose);
  ctx.lineTo(left + w, ground);
  ctx.closePath();
  const g = ctx.createLinearGradient(left, top, left + w, top);
  g.addColorStop(0, "#9aa6ae");
  g.addColorStop(0.5, "#e7eef2");
  g.addColorStop(1, "#8e99a1");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#14181c";
  ctx.fillRect(left, top, w * 0.5, h);
  ctx.restore();
  ctx.restore();
}

function paintStackMark(ctx, x, ground, ppm) {
  const w = 9 * ppm;
  const left = x - w / 2;
  const booster = 72 * ppm;
  paintSteel(ctx, left, ground - booster, w, booster);
  paintShipMark(ctx, x, ground - booster, ppm, 52);
  ctx.strokeStyle = "rgba(228, 194, 122, 0.8)";
  ctx.lineWidth = Math.max(1, ppm * 0.06);
  ctx.beginPath();
  ctx.moveTo(left, ground - booster);
  ctx.lineTo(left + w, ground - booster);
  ctx.stroke();
}

function paintTowerMark(ctx, x, ground, ppm) {
  const w = 11 * ppm;
  const h = F.towerH * ppm;
  const left = x - w / 2;
  const top = ground - h;
  ctx.save();
  ctx.strokeStyle = "#c5ced4";
  ctx.lineWidth = Math.max(1, ppm * 0.08);
  ctx.strokeRect(left, top, w, h);
  ctx.beginPath();
  const step = 8 * ppm;
  for (let y = ground - step; y > top; y -= step) {
    ctx.moveTo(left, y);
    ctx.lineTo(left + w, y);
  }
  ctx.stroke();
  ctx.restore();
}

function lineupItems() {
  const h = heightM();
  const aspect = (name, fallback) => cutoutAspect(name) || fallback;
  return [
    { kind: "person", name: "You", detail: `${metres(h)} m`, w: Math.max(0.7, h * 0.45) },
    { kind: "cutout", name: "Bicycle", detail: "about 1.8 m", key: "bicycle", mode: "width", size: 1.8, w: 1.8 },
    { kind: "door", name: "Front door", detail: "2 m", w: 0.9 },
    { kind: "hoop", name: "Basketball", detail: "rim 3.05 m", w: 1.83 },
    { kind: "cutout", name: "Family car", detail: "about 4.8 m", key: "car", mode: "width", size: 4.8, w: 4.8 },
    { kind: "cutout", name: "Giraffe", detail: "about 5.5 m", key: "giraffe", mode: "height", size: 5.5, w: 5.5 * aspect("giraffe", 0.608) },
    { kind: "cutout", name: "City bus", detail: "12 m", key: "bus", mode: "width", size: 12, w: 12 },
    { kind: "cutout", name: "Container", detail: "12.2 m", key: "container", mode: "width", size: 12.2, w: 12.2 },
    { kind: "cutout", name: "Double-decker", detail: "about 11.2 m", key: "doubledecker", mode: "width", size: 11.2, w: 11.2 },
    { kind: "cutout", name: "Blue whale", detail: "about 25 m", key: "whale", mode: "width", size: 25, w: 25 },
    { kind: "cutout", name: "737-800", detail: "39.5 m", key: "jet737", mode: "width", size: 39.5, w: 39.5 },
    { kind: "pool", name: "Olympic pool", detail: "50 m long", w: 50 },
    { kind: "ship", name: "Starship", detail: "52 m", w: 9 },
    { kind: "cutout", name: "747-8", detail: "76.3 m", key: "jet747", mode: "width", size: 76.3, w: 76.3 },
    { kind: "cutout", name: "Liberty", detail: "93 m", key: "liberty", mode: "height", size: 93, w: 93 * aspect("liberty", 0.367) },
    { kind: "cutout", name: "Saturn V", detail: "110.6 m", key: "saturn", mode: "height", size: 110.6, w: 110.6 * aspect("saturn", 0.096) },
    { kind: "stack", name: "Full stack", detail: "124 m", w: 9 },
    { kind: "tower", name: "The tower", detail: "about 146 m", w: 11 },
  ];
}

let lineupView = null;
const lineupState = { viewM: 20, pin: null, pinLeft: 0 };
const LINEUP_MAX_W = 16000;
const LINEUP_MAX_M = 160;

function lineupMetres(totalM, skyH) {
  const minM = Math.max(6, (skyH * totalM) / LINEUP_MAX_W);
  const viewM = Math.min(LINEUP_MAX_M, Math.max(minM, lineupState.viewM));
  return { viewM, minM, ppm: skyH / viewM };
}

function lineupSliderValue(viewM, minM) {
  const span = Math.log(LINEUP_MAX_M) - Math.log(minM);
  if (span <= 0) return 0;
  const t = (Math.log(viewM) - Math.log(minM)) / span;
  return Math.round(Math.min(1, Math.max(0, t)) * 1000);
}

function lineupViewFromSlider(value, minM) {
  const t = Number(value) / 1000;
  const span = Math.log(LINEUP_MAX_M) - Math.log(minM);
  return Math.exp(Math.log(minM) + t * span);
}

function drawLineup() {
  const canvas = $("lineupCanvas");
  const scroller = $("lineupScroll");
  if (!canvas || !scroller) return;
  const viewH = scroller.clientHeight;
  if (viewH < 80) return;
  lineupState.drawing = true;
  const items = lineupItems();
  const minSlot = 8.4;
  const gap = 4.5;
  let cursor = 3;
  const placed = items.map((item) => {
    const slot = Math.max(item.w, minSlot);
    const center = cursor + slot / 2;
    cursor += slot + gap;
    return { ...item, center, slot };
  });
  const totalM = cursor + 2;
  const labelBand = 72;
  const skyH = viewH - labelBand;
  const fit = lineupMetres(totalM, skyH);
  const ppm = fit.ppm;
  lineupState.viewM = fit.viewM;
  const cssW = Math.max(1, Math.round(totalM * ppm));
  const cssH = viewH;
  const ground = cssH - labelBand;
  const prev = lineupView;
  const worldLeft = prev ? scroller.scrollLeft / prev.ppm : 0;
  const anchor = !lineupView;
  const viewMid = worldLeft + scroller.clientWidth / (2 * ppm);
  let focus = 0;
  let focusD = Infinity;
  if (lineupState.pin != null && placed[lineupState.pin]) focus = lineupState.pin;
  else {
    placed.forEach((item, index) => {
      const distance = Math.abs(item.center - viewMid);
      if (distance < focusD) {
        focusD = distance;
        focus = index;
      }
    });
  }

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = cssW;
  canvas.height = cssH;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, "#1c242c");
  sky.addColorStop(1, "#14110e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#2a2620";
  ctx.fillRect(0, ground, cssW, labelBand);
  ctx.strokeStyle = "rgba(228, 194, 122, 0.55)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, ground + 0.5);
  ctx.lineTo(cssW, ground + 0.5);
  ctx.stroke();

  placed.forEach((item, index) => {
    const x = item.center * ppm;
    if (item.kind === "person") drawPerson(ctx, x, ground, heightM() * ppm, true);
    else if (item.kind === "door") paintDoor(ctx, x, ground, ppm);
    else if (item.kind === "hoop") paintHoop(ctx, x, ground, ppm);
    else if (item.kind === "pool") paintPoolSide(ctx, x, ground, ppm);
    else if (item.kind === "ship") paintShipMark(ctx, x, ground, ppm, F.shipH);
    else if (item.kind === "stack") paintStackMark(ctx, x, ground, ppm);
    else if (item.kind === "tower") paintTowerMark(ctx, x, ground, ppm);
    else drawCutout(ctx, item.key, x, ground, item.size * ppm, item.mode);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "560 16px Fraunces, serif";
    const nameFits = ctx.measureText(item.name).width + 12 <= item.slot * ppm;
    if (nameFits || index === focus) {
      ctx.fillStyle = "#f6efe4";
      ctx.fillText(item.name, x, ground + 28);
      ctx.fillStyle = "#b7aa9a";
      ctx.font = "500 13px Outfit, sans-serif";
      ctx.fillText(item.detail, x, ground + 48);
    }
    ctx.restore();
  });

  lineupView = {
    ppm,
    cssW,
    viewM: fit.viewM,
    minM: fit.minM,
    centers: placed.map((item) => ({ name: item.name, center: item.center })),
  };
  const zoom = $("lineupZoom");
  const readout = $("lineupZoomReadout");
  if (zoom && document.activeElement !== zoom) zoom.value = String(lineupSliderValue(fit.viewM, fit.minM));
  if (readout) readout.textContent = `${Math.round(fit.viewM)} m`;
  document.querySelectorAll("[data-lineup-m]").forEach((btn) => {
    const metres = Number(btn.dataset.lineupM);
    const pressed = metres <= fit.minM
      ? Math.abs(fit.viewM - fit.minM) < 0.8
      : Math.abs(metres - fit.viewM) < 1.5;
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  });
  if (anchor) {
    requestAnimationFrame(() => {
      scroller.scrollLeft = 0;
      lineupState.drawing = false;
      markLineup();
    });
  } else {
    scroller.scrollLeft = worldLeft * ppm;
    lineupState.drawing = false;
    markLineup();
  }
}

function markLineup() {
  const scroller = $("lineupScroll");
  if (!lineupView || !scroller) return;
  if (!lineupState.drawing && lineupState.pin != null && Math.abs(scroller.scrollLeft - lineupState.pinLeft) > 24) {
    lineupState.pin = null;
  }
  const mid = (scroller.scrollLeft + scroller.clientWidth / 2) / lineupView.ppm;
  let best = lineupState.pin;
  if (best == null || !lineupView.centers[best]) {
    best = 0;
    let bestD = Infinity;
    lineupView.centers.forEach((item, index) => {
      const distance = Math.abs(item.center - mid);
      if (distance < bestD) {
        bestD = distance;
        best = index;
      }
    });
  }
  document.querySelectorAll("[data-lineup-i]").forEach((btn, index) => {
    btn.classList.toggle("is-on", index === best);
    if (index === best) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
}

function focusLineupItem(index) {
  const scroller = $("lineupScroll");
  const item = lineupView && lineupView.centers[index];
  if (!scroller || !item) return;
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const left = Math.min(maxLeft, Math.max(0, item.center * lineupView.ppm - scroller.clientWidth / 2));
  lineupState.pin = index;
  lineupState.pinLeft = left;
  scroller.scrollLeft = left;
  drawLineup();
}

function nudgeLineup(direction) {
  const scroller = $("lineupScroll");
  if (!scroller) return;
  lineupState.pin = null;
  scroller.scrollBy({ left: direction * scroller.clientWidth * 0.75, behavior: reduced ? "auto" : "smooth" });
}

function redrawAll() {
  renderHero();
  drawZoom();
  drawAcross();
  drawEngines();
  drawTiles();
  drawWalk();
  drawLineup();
  drawWater(state.shaking ? "fire" : "idle", state.shaking ? 1 : 0);
}

function boot() {
  const saved = localStorage.getItem("starship-catch-height-cm");
  if (saved && Number(saved) >= 100 && Number(saved) <= 220) $("heightCm").value = saved;
  renderBeats();
  setSeconds(0);
  syncSlider();
  updateShake();
  redrawAll();

  $("heightForm").addEventListener("submit", (event) => event.preventDefault());
  $("heightCm").addEventListener("input", () => {
    const raw = Number($("heightCm").value);
    if (!Number.isFinite(raw) || raw < 100 || raw > 220) return;
    localStorage.setItem("starship-catch-height-cm", String(Math.round(raw)));
    redrawAll();
  });

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => goPreset(btn.dataset.preset));
  });
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((other) => {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      if (state.preset === "tile") goPreset("tile");
      else drawZoom();
    });
  });
  $("zoomSlider").addEventListener("input", () => {
    state.anim += 1;
    state.preset = "";
    state.viewH = viewFromSlider(Number($("zoomSlider").value));
    if (state.viewH > 12 && state.anchorAlt > 20) state.anchorAlt = 0;
    drawZoom();
  });
  ["ghostBus", "ghost747", "ghostSaturn", "ghostLiberty"].forEach((id) => {
    $(id).addEventListener("change", drawZoom);
  });
  $("tileCanvas").addEventListener("click", onTileClick);
  $("walkScroll").addEventListener("scroll", readWalk);
  $("walkCatch").addEventListener("click", () => scrollWalkTo(100));
  $("walkEngines").addEventListener("click", () => scrollWalkTo(2));
  $("walkNose").addEventListener("click", () => scrollWalkTo(124));
  $("secondsSlider").addEventListener("input", () => {
    state.playing = false;
    $("secondsPlay").textContent = "Play the 18 seconds";
    $("secondsPlay").classList.remove("is-on");
    setSeconds(Number($("secondsSlider").value) / 10);
  });
  $("secondsPlay").addEventListener("click", playSeconds);
  $("secondsRestart").addEventListener("click", () => {
    state.playing = false;
    $("secondsPlay").textContent = "Play the 18 seconds";
    $("secondsPlay").classList.remove("is-on");
    setSeconds(0);
  });
  $("waterButton").addEventListener("click", runWater);
  $("distanceSlider").addEventListener("input", () => {
    state.distance = Number($("distanceSlider").value);
    updateShake();
  });

  const observer = new ResizeObserver(() => redrawAll());
  observer.observe($("zoomCanvas"));
  observer.observe($("acrossCanvas"));
  observer.observe($("tileCanvas"));
  observer.observe($("waterCanvas"));
  observer.observe($("lineupScroll"));
  const lineupNames = $("lineupNames");
  if (lineupNames) {
    lineupNames.innerHTML = lineupItems().map((item, index) => (
      `<button type="button" data-lineup-i="${index}">${item.name}</button>`
    )).join("");
    lineupNames.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      focusLineupItem(Number(btn.dataset.lineupI));
    });
  }
  document.querySelectorAll("[data-lineup-m]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lineupState.viewM = Number(btn.dataset.lineupM);
      drawLineup();
    });
  });
  $("lineupZoom").addEventListener("input", () => {
    const minM = lineupView ? lineupView.minM : 6;
    lineupState.viewM = lineupViewFromSlider($("lineupZoom").value, minM);
    drawLineup();
  });
  $("lineupPrev").addEventListener("click", () => nudgeLineup(-1));
  $("lineupNext").addEventListener("click", () => nudgeLineup(1));
  $("lineupScroll").addEventListener("scroll", markLineup, { passive: true });
  onFigures(redrawAll);
  onCutouts(redrawAll);
  if (!reduced) requestAnimationFrame(idleDraw);
}

let idleStamp = 0;

function idleDraw(now) {
  if (document.hidden) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestAnimationFrame(idleDraw);
    }, { once: true });
    return;
  }
  if (now - idleStamp > 90) {
    idleStamp = now;
    const shown = (id) => {
      const el = $(id);
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    if (shown("zoomCanvas")) drawZoom();
    if (shown("acrossCanvas")) drawAcross();
    if (shown("engineCanvas")) drawEngines();
    if (shown("tileCanvas")) drawTiles();
  }
  requestAnimationFrame(idleDraw);
}

boot();
