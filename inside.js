const F = {
  shipH: 52,
  shipD: 9,
  bayD: 8,
  bayH: 22,
  bayY: 22,
  deckH: 2.2,
  jetL: 76.3,
  jetCabinW: 6.1,
  jetCabinH: 2.4,
  jetSeats: 467,
  jetAcross: 10,
  dragonD: 4,
  dragonH: 8.1,
  dragonV: 9.3,
  dragonPeople: 4,
  volume: 1000,
  crew: 100,
  lunar: 12,
  seatW: 0.46,
  pitch: 0.79,
  aisle: 0.56,
  raptorH: 2.9,
  raptorD: 1.3,
  tile: 0.243,
  busH: 3.1,
};

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

const state = {
  place: "ship",
  stack: [],
  mode: "packed",
  wall: "windward",
  seat: null,
  hot: null,
  punch: 1,
  punchFrom: 0,
  anim: 0,
};

function heightM() {
  const cm = Number($("heightCm").value);
  if (!Number.isFinite(cm)) return 1.75;
  return Math.min(2.2, Math.max(1, cm / 100));
}

function metres(n) {
  const cm = Math.round(n * 100);
  if (cm % 100 === 0) return String(cm / 100);
  if (cm % 10 === 0) return (cm / 100).toFixed(1);
  return (cm / 100).toFixed(2);
}

function trim(n) {
  const tenths = Math.round(Number(n.toFixed(6)) * 10);
  const v = tenths / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function economySeats() {
  const R = F.bayD / 2 - 0.25;
  const seats = [];
  const xs = [-0.69, -0.23, 0.23, 0.69];
  for (let i = 0; i < 8; i += 1) {
    const x = 0.69 + 0.23 + F.aisle + F.seatW / 2 + i * F.seatW;
    xs.push(x, -x);
  }
  for (let r = -20; r <= 20; r += 1) {
    const y = r * F.pitch;
    xs.forEach((x) => {
      if (x * x + y * y < R * R) seats.push({ x, y });
    });
  }
  return seats;
}

function cabinPeople() {
  const people = [];
  const n = 9;
  for (let i = 0; i < n; i += 1) {
    const a = -Math.PI / 2 + (i + 0.5) * ((2 * Math.PI) / n);
    const r = 3.05;
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    people.push({ x: Math.cos(a) * r - tx * 0.38, y: Math.sin(a) * r - ty * 0.32, cabin: i });
    people.push({ x: Math.cos(a) * r + tx * 0.38, y: Math.sin(a) * r + ty * 0.32, cabin: i });
  }
  return people;
}

const PACKED = economySeats();
const CABIN = cabinPeople();

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
  const viewW = ctx.canvas.clientWidth || ctx.canvas.width / (window.devicePixelRatio || 1);
  const left = Math.max(6, Math.min(x, viewW - boxW - 6));
  roundRect(ctx, left - 2, y - 16, boxW, 22, 7);
  ctx.fillStyle = "rgba(12, 11, 9, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "rgba(228, 194, 122, 0.9)";
  ctx.stroke();
  ctx.fillStyle = "#f6efe4";
  ctx.fillText(text, left + 6, y);
  ctx.restore();
}

function camera(w, h, box) {
  const pad = 0.92 + (1 - state.punch) * 0.1;
  const ppm = Math.min((w * pad) / box.w, (h * pad) / box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    ppm,
    w,
    h,
    sx: (x) => w / 2 + (x - cx) * ppm,
    sy: (y) => h / 2 - (y - cy) * ppm,
  };
}

function viewBox(w, h) {
  const wide = w > h * 1.15;
  if (state.place === "ship") {
    return wide ? { x: -90, y: -3, w: 104, h: 62 } : { x: -9, y: -2, w: 22, h: 58 };
  }
  if (state.place === "across") return { x: -5.35, y: -5.35, w: 10.7, h: 10.7 };
  if (state.place === "deck") return { x: -5.15, y: -5.55, w: 10.3, h: 10.9 };
  if (state.place === "seat") return { x: -1.05, y: -0.18, w: 3.35, h: 2.58 };
  if (state.place === "engine") return { x: -0.4, y: -0.3, w: 7.2, h: 4.3 };
  return { x: -0.45, y: -0.28, w: 2.7, h: 2.62 };
}

function drawRowPerson(ctx, cam, x, h, you) {
  const px = cam.sx(x);
  const seatHalf = 0.22 * cam.ppm;
  const cushion = cam.sy(0.45);
  const backTop = cam.sy(1.15);
  const seatTop = backTop;
  const seatW = seatHalf * 2;
  ctx.save();
  ctx.globalAlpha = you ? 1 : 0.55;
  const shell = ctx.createLinearGradient(px, seatTop, px, cushion + 8);
  shell.addColorStop(0, you ? "#6a5438" : "#3a342c");
  shell.addColorStop(1, you ? "#2c241c" : "#221c18");
  roundRect(ctx, px - seatHalf, seatTop, seatW, cushion - seatTop + 0.08 * cam.ppm, Math.min(10, cam.ppm * 0.04));
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = you ? "rgba(240, 215, 164, 0.85)" : "rgba(235, 228, 214, 0.28)";
  ctx.stroke();
  ctx.fillStyle = you ? "#8a7048" : "#4a4036";
  roundRect(ctx, px - seatHalf + 3, cushion - 0.02 * cam.ppm, seatW - 6, 0.09 * cam.ppm, 4);
  ctx.fill();
  ctx.restore();

  const lapY = cushion - 2;
  const sitH = 0.52 * h * cam.ppm;
  drawSeated(ctx, px, lapY, sitH, 0.44 * cam.ppm, you ? 1 : 0.5);

  const bodyW = 0.4 * cam.ppm;
  const shoulderY = cam.sy(0.45 + h * 0.28);
  ctx.save();
  ctx.globalAlpha = you ? 1 : 0.7;
  ctx.strokeStyle = "#f6ead2";
  ctx.lineWidth = Math.max(3, cam.ppm * 0.028);
  ctx.lineCap = "round";
  ctx.beginPath();
  const strapTop = shoulderY + 0.04 * cam.ppm;
  const strapBot = lapY - 0.04 * cam.ppm;
  ctx.moveTo(px - bodyW * 0.28, strapTop);
  ctx.lineTo(px - bodyW * 0.08, strapBot);
  ctx.moveTo(px + bodyW * 0.28, strapTop);
  ctx.lineTo(px + bodyW * 0.08, strapBot);
  ctx.moveTo(px - bodyW * 0.42, strapBot);
  ctx.lineTo(px + bodyW * 0.42, strapBot);
  ctx.stroke();
  ctx.fillStyle = "#f3e0b0";
  ctx.beginPath();
  ctx.arc(px, strapBot, Math.max(3, cam.ppm * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6a5430";
  ctx.lineWidth = 1.25;
  ctx.stroke();
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

function drawSky(ctx, cam) {
  const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
  sky.addColorStop(0, "#24303a");
  sky.addColorStop(1, "#14110e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.w, cam.h);
}

function drawShip(ctx, cam, wide) {
  drawSky(ctx, cam);
  const ground = cam.sy(0);
  ctx.fillStyle = "#3e4a3c";
  ctx.fillRect(0, ground, cam.w, cam.h - ground + 2);

  if (wide) {
    const tail = -86;
    const len = F.jetL * cam.ppm;
    const drawn = drawCutout(ctx, "jet747", cam.sx(tail + F.jetL / 2), ground, len, "width", { flip: true });
    if (!drawn) {
      ctx.strokeStyle = "#d7e4ea";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cam.sx(tail), cam.sy(0.4));
      ctx.lineTo(cam.sx(tail + F.jetL), cam.sy(0.4));
      ctx.stroke();
    }
    label(ctx, "747-8, 76.3 m", cam.sx(tail + 20), cam.sy(24));
  }

  const dragonH = F.dragonH * cam.ppm;
  const dragonDrawn = drawCutout(ctx, "dragon", cam.sx(-5.6), ground, dragonH, "height");
  if (!dragonDrawn) paintDragon(ctx, cam.sx(-7.2), cam.sy(F.dragonH), F.dragonD * cam.ppm, dragonH);
  label(ctx, "Dragon", cam.sx(-6.4), cam.sy(F.dragonH) - 8);

  const sx = cam.sx(0);
  const sw = F.shipD * cam.ppm;
  const top = cam.sy(F.shipH);
  const bot = cam.sy(0);
  const grd = ctx.createLinearGradient(sx, top, sx + sw, top);
  grd.addColorStop(0, "#8e99a1");
  grd.addColorStop(0.5, "#e7eef2");
  grd.addColorStop(1, "#9aa6ae");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(sx, bot);
  ctx.lineTo(sx, cam.sy(44));
  ctx.quadraticCurveTo(sx + sw * 0.5, top - sw * 0.15, sx + sw, cam.sy(44));
  ctx.lineTo(sx + sw, bot);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx, bot);
  ctx.lineTo(sx, cam.sy(44));
  ctx.quadraticCurveTo(sx + sw * 0.5, top - sw * 0.15, sx + sw, cam.sy(44));
  ctx.lineTo(sx + sw, bot);
  ctx.clip();
  ctx.fillStyle = "#16191c";
  ctx.fillRect(sx, top, sw * 0.5, bot - top);
  ctx.restore();

  const bay = { x: 0.5, y: F.bayY, w: 8, h: F.bayH };
  const bx = cam.sx(bay.x);
  const by = cam.sy(bay.y + bay.h);
  const bw = bay.w * cam.ppm;
  const bh = bay.h * cam.ppm;
  const pulse = state.hot === "bay" ? 0.58 : 0.36 + (reduced ? 0 : 0.07 * Math.sin(performance.now() / 520));
  const sheen = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  const glide = reduced ? 0.5 : (performance.now() / 2600) % 1;
  sheen.addColorStop(0, `rgba(228, 194, 122, ${pulse})`);
  sheen.addColorStop(Math.max(0, glide - 0.18), `rgba(228, 194, 122, ${pulse})`);
  sheen.addColorStop(glide, "rgba(255, 236, 196, 0.72)");
  sheen.addColorStop(Math.min(1, glide + 0.18), `rgba(228, 194, 122, ${pulse * 0.85})`);
  sheen.addColorStop(1, `rgba(228, 194, 122, ${pulse})`);
  ctx.fillStyle = sheen;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = state.hot === "bay" ? "#fff4d8" : "#f0d7a4";
  ctx.lineWidth = state.hot === "bay" ? 3.5 : 2.75;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeStyle = "rgba(255, 236, 200, 0.8)";
  ctx.lineWidth = 1.25;
  for (let y = bay.y + F.deckH; y < bay.y + bay.h - 0.4; y += F.deckH) {
    ctx.beginPath();
    ctx.moveTo(cam.sx(bay.x) + 3, cam.sy(y));
    ctx.lineTo(cam.sx(bay.x + bay.w) - 3, cam.sy(y));
    ctx.stroke();
  }
  label(ctx, "Cabin, 8 m by 22 m. Click.", bx + 8, by + bh * 0.28);
  label(ctx, "Tiles", cam.sx(-0.2), cam.sy(47));
  label(ctx, "One engine", cam.sx(9.3), cam.sy(3));

  const hPx = heightM() * cam.ppm;
  drawPerson(ctx, cam.sx(-1.3), ground, hPx);
  if (hPx > 8) label(ctx, "You", cam.sx(-1.7), ground - hPx - 22);

  if (!wide) {
    const barW = Math.min(cam.w - 24, (F.jetL / F.shipH) * (F.shipH * cam.ppm));
    ctx.strokeStyle = "#d7e4ea";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, cam.h - 18);
    ctx.lineTo(12 + barW, cam.h - 18);
    ctx.stroke();
    label(ctx, "747-8 laid down, 76 m", 12, cam.h - 26);
  }
}

function drawAcross(ctx, cam) {
  drawSky(ctx, cam);
  const c = cam.sx(0);
  const cy = cam.sy(0);
  const skinR = (F.shipD / 2) * cam.ppm;
  ctx.beginPath();
  ctx.arc(c, cy, skinR, 0, Math.PI * 2);
  ctx.fillStyle = state.hot === "across" ? "rgba(228, 194, 122, 0.08)" : "rgba(20, 28, 34, 0.35)";
  ctx.fill();
  ctx.strokeStyle = "#e7eef2";
  ctx.lineWidth = Math.max(8, 0.11 * cam.ppm);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, cy, (F.bayD / 2) * cam.ppm, 0, Math.PI * 2);
  ctx.strokeStyle = "#f0d7a4";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = reduced ? 0 : -performance.now() / 40;
  ctx.stroke();
  ctx.setLineDash([]);

  const cw = F.jetCabinW * cam.ppm;
  const ch = F.jetCabinH * cam.ppm;
  paintCabin(ctx, c - cw / 2, cy - ch, cw, ch);
  paintCabin(ctx, c - cw / 2, cy, cw, ch);
  label(ctx, "A second 747 cabin", c - cw / 2 + 10, cy - ch + 22);
  label(ctx, "747 cabin, 2.4 m high", c + 10, cy + 24);
  label(ctx, "9 m across", cam.sx(-0.55), cam.sy(3.65));

  const hPx = heightM() * cam.ppm;
  const feet = cam.sy(-F.jetCabinH);
  const px = cam.sx(-2.05);
  drawPerson(ctx, px, feet, hPx);
  label(ctx, "You", px - 34, feet - hPx - 22);

  const dragonR = (F.dragonD / 2) * cam.ppm;
  const gap = 36;
  const roomRight = cam.w - (c + skinR) - 16;
  const roomBelow = cam.h - (cy + skinR) - 16;
  let dx = c + skinR + gap + dragonR;
  let dy = cy;
  if (roomRight < dragonR * 2 + gap) {
    dx = Math.min(c, cam.w / 2);
    dy = cy + skinR + gap + dragonR;
    if (roomBelow < dragonR * 2 + gap) return;
  }
  ctx.beginPath();
  ctx.arc(dx, dy, dragonR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(240, 210, 176, 0.38)";
  ctx.fill();
  ctx.strokeStyle = "#f6e0c4";
  ctx.lineWidth = Math.max(3, 0.07 * cam.ppm);
  ctx.stroke();
  label(ctx, "All of Dragon, same scale", dx - dragonR, dy - dragonR - 10);
}

function drawDeck(ctx, cam) {
  ctx.fillStyle = "#14181c";
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.beginPath();
  ctx.arc(cam.sx(0), cam.sy(0), (F.bayD / 2) * cam.ppm, 0, Math.PI * 2);
  ctx.fillStyle = "#1c232a";
  ctx.fill();
  ctx.strokeStyle = "rgba(197, 206, 212, 0.7)";
  ctx.lineWidth = 6;
  ctx.stroke();

  const half = F.jetCabinW / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cam.sx(0), cam.sy(0), (F.bayD / 2) * cam.ppm - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(214, 230, 238, 0.34)";
  ctx.fillRect(cam.sx(-half), cam.sy(4), F.jetCabinW * cam.ppm, 8 * cam.ppm);
  ctx.strokeStyle = "#f2f7fa";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cam.sx(-half), cam.sy(-4));
  ctx.lineTo(cam.sx(-half), cam.sy(4));
  ctx.moveTo(cam.sx(half), cam.sy(-4));
  ctx.lineTo(cam.sx(half), cam.sy(4));
  ctx.stroke();
  ctx.restore();
  label(ctx, "The pale band is a 747 cabin, 6.1 m wide", cam.sx(-2.6), cam.sy(4.85));

  if (state.mode === "packed") {
    PACKED.forEach((s) => paintPlanSeat(ctx, cam, s, Boolean(state.hot && state.hot.x === s.x && state.hot.y === s.y)));
    label(ctx, `${PACKED.length} seats on this one floor`, cam.sx(-2.2), cam.sy(-4.9));
  } else {
    const n = 9;
    ctx.lineWidth = 2.25;
    for (let i = 0; i < n; i += 1) {
      const a0 = -Math.PI / 2 + i * ((2 * Math.PI) / n) + 0.06;
      const a1 = a0 + (2 * Math.PI) / n - 0.12;
      ctx.beginPath();
      ctx.arc(cam.sx(0), cam.sy(0), 3.85 * cam.ppm, -a1, -a0);
      ctx.arc(cam.sx(0), cam.sy(0), 1.85 * cam.ppm, -a0, -a1, true);
      ctx.closePath();
      ctx.fillStyle = "rgba(228, 194, 122, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "#f0d7a4";
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cam.sx(0), cam.sy(0), 1.7 * cam.ppm, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(235, 228, 214, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(246, 239, 228, 0.7)";
    ctx.stroke();
    label(ctx, "Common floor", cam.sx(-0.7), cam.sy(0.15));
    CABIN.forEach((p) => paintPlanSeat(ctx, cam, p, Boolean(state.hot && state.hot.x === p.x && state.hot.y === p.y)));
  }
}

function paintPlanSeat(ctx, cam, s, hot) {
  const w = 0.4 * cam.ppm;
  const h = 0.58 * cam.ppm;
  const x = cam.sx(s.x) - w / 2;
  const y = cam.sy(s.y + 0.22);
  ctx.fillStyle = hot ? "#8a7048" : "#5c5148";
  roundRect(ctx, x, y, w, h * 0.32, 2);
  ctx.fill();
  ctx.fillStyle = hot ? "#f0e2cc" : "#d9cbb6";
  roundRect(ctx, x + 1, y + h * 0.22, w - 2, h * 0.74, 3);
  ctx.fill();
  ctx.lineWidth = hot ? 2 : 1;
  ctx.strokeStyle = hot ? "#f0d7a4" : "rgba(20, 16, 12, 0.45)";
  ctx.stroke();
  ctx.fillStyle = "#c4553a";
  ctx.beginPath();
  ctx.ellipse(cam.sx(s.x), y + h * 0.55, w * 0.28, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241c18";
  ctx.beginPath();
  ctx.arc(cam.sx(s.x), y + h * 0.4, Math.max(1.6, w * 0.16), 0, Math.PI * 2);
  ctx.fill();
}

function drawSeat(ctx, cam) {
  ctx.fillStyle = "#171410";
  ctx.fillRect(0, 0, cam.w, cam.h);
  const floor = cam.sy(0);
  const ceiling = cam.sy(F.deckH);
  ctx.fillStyle = "#2a2620";
  ctx.fillRect(0, ceiling, cam.w, floor - ceiling);
  ctx.fillStyle = "#3e4a3c";
  ctx.fillRect(0, floor, cam.w, cam.h - floor);

  const h = heightM();
  drawRowPerson(ctx, cam, -0.5, h, false);
  drawRowPerson(ctx, cam, 0, h, false);
  drawRowPerson(ctx, cam, 0.5, h, true);
  label(ctx, "You", cam.sx(0.5) - 16, cam.sy(1.45));

  const wall = 1.02;
  const wallX = cam.sx(wall);
  ctx.strokeStyle = "#e4c27a";
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const dimX = 18;
  ctx.moveTo(dimX, floor);
  ctx.lineTo(dimX, ceiling);
  ctx.moveTo(dimX - 6, floor);
  ctx.lineTo(dimX + 6, floor);
  ctx.moveTo(dimX - 6, ceiling);
  ctx.lineTo(dimX + 6, ceiling);
  ctx.stroke();
  label(ctx, "2.2 m to the next deck", dimX + 10, (floor + ceiling) / 2);

  if (state.wall === "windward") {
    ctx.fillStyle = "#10141a";
    ctx.fillRect(wallX, ceiling, cam.w - wallX, floor - ceiling);
    const r = (F.tile / Math.sqrt(3)) * cam.ppm;
    for (let row = 0; row < 14; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const shift = row % 2 ? 0.5 : 0;
        const x = wall + 0.08 + (col + shift) * F.tile;
        const y = 0.18 + row * F.tile * 0.866;
        if (y > F.deckH - 0.08) continue;
        paintHex(ctx, cam.sx(x), cam.sy(y), r * 0.9, false, col * 3 + row * 5);
      }
    }
    label(ctx, "Tile. No window this side.", wallX + 8, ceiling + 48);
  } else {
    ctx.fillStyle = "#10141a";
    ctx.fillRect(wallX, ceiling, cam.w - wallX, floor - ceiling);
    ctx.fillStyle = "#c5ced4";
    ctx.fillRect(wallX, ceiling, 0.12 * cam.ppm, floor - ceiling);
    const winW = 0.42;
    const winH = 0.55;
    const winX = wall + 0.16;
    const winY = 0.85;
    const wx = cam.sx(winX);
    const wy = cam.sy(winY + winH);
    const ww = winW * cam.ppm;
    const wh = winH * cam.ppm;
    ctx.fillStyle = "#8e99a1";
    ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
    const glass = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
    glass.addColorStop(0, "#9ec8d8");
    glass.addColorStop(1, "#245066");
    ctx.fillStyle = glass;
    ctx.fillRect(wx, wy, ww, wh);
    if (!reduced) {
      const glide = (performance.now() / 1800) % 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(wx + ww * glide * 0.7, wy, Math.max(3, ww * 0.12), wh);
    }
    label(ctx, "A small window. Size not published.", wx, wy - 8);
  }
}

function drawEngine(ctx, cam) {
  drawSky(ctx, cam);
  const ground = cam.sy(0);
  ctx.fillStyle = "#3e4a3c";
  ctx.fillRect(0, ground, cam.w, cam.h - ground);
  const busH = F.busH * cam.ppm;
  const busAspect = cutoutAspect("bus-front") || 0.823;
  const busW = busH * busAspect;
  const busDrawn = drawCutout(ctx, "bus-front", cam.sx(3.3) + busW / 2, ground, busH, "height");
  if (!busDrawn) paintBus(ctx, cam.sx(3.3), cam.sy(F.busH), busW, busH, "end");
  label(ctx, "Bus, 3.1 m tall", cam.sx(3.4), cam.sy(F.busH) - 8);
  const x = cam.sx(1.2);
  const y = cam.sy(F.raptorH);
  const w = F.raptorD * cam.ppm;
  const h = F.raptorH * cam.ppm;
  const metal = ctx.createLinearGradient(x, y, x + w, y);
  metal.addColorStop(0, "#1c2228");
  metal.addColorStop(0.45, "#d5dee4");
  metal.addColorStop(1, "#2c343c");
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y);
  ctx.lineTo(x + w * 0.72, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 248, 236, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#12161a";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w * 0.52, Math.max(4, h * 0.035), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, "One Raptor, 2.9 m", x, y - 8);
  const hPx = heightM() * cam.ppm;
  drawPerson(ctx, cam.sx(0.35), ground, hPx);
  label(ctx, "You", cam.sx(0.35) - 18, ground - hPx - 22);
}

function drawWall(ctx, cam) {
  ctx.fillStyle = "#1b242c";
  ctx.fillRect(0, 0, cam.w, cam.h);
  const steelTop = 2.2;
  ctx.fillStyle = "#8b969e";
  ctx.fillRect(cam.sx(0.62), cam.sy(steelTop), 1.6 * cam.ppm, steelTop * cam.ppm);
  const r = F.tile / Math.sqrt(3);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const shift = row % 2 ? 0.5 : 0;
      const x = 0.78 + (col + shift) * F.tile;
      const y = 0.16 + r + row * r * 1.5;
      if (x > 2.05 || y > steelTop - r) continue;
      paintHex(ctx, cam.sx(x), cam.sy(y), r * cam.ppm * 0.9, false, col * 3 + row * 5);
    }
  }
  const hPx = heightM() * cam.ppm;
  drawPerson(ctx, cam.sx(0.12), cam.sy(0), hPx);
  label(ctx, "You", cam.sx(0.12) - 18, cam.sy(heightM()) - 22);
  paintPlate(ctx, cam.sx(-0.2), cam.sy(0.34), 0.135 * cam.ppm);
  label(ctx, "27 cm plate", cam.sx(-0.42), cam.sy(0.62));
}

function draw() {
  const canvas = $("insideCanvas");
  const { ctx, w, h } = prep(canvas);
  const wide = w > h * 1.15;
  const cam = camera(w, h, viewBox(w, h));
  ctx.clearRect(0, 0, w, h);
  if (state.place === "ship") drawShip(ctx, cam, wide);
  else if (state.place === "across") drawAcross(ctx, cam);
  else if (state.place === "deck") drawDeck(ctx, cam);
  else if (state.place === "seat") drawSeat(ctx, cam);
  else if (state.place === "engine") drawEngine(ctx, cam);
  else drawWall(ctx, cam);
}

function redraw() {
  draw();
  paintChrome();
}

function middleRow() {
  return PACKED.filter((s) => Math.abs(s.y) < 0.01).length;
}

function paintChrome() {
  const h = heightM();
  const names = {
    ship: "The ship",
    across: "The width",
    deck: "One deck",
    seat: "A seat",
    wall: "The wall",
    engine: "One engine",
  };
  const trail = [...state.stack, state.place];
  $("crumbs").innerHTML = trail.map((id, i) => {
    const current = i === trail.length - 1;
    return `<button type="button" data-crumb="${i}" ${current ? 'aria-current="page"' : ""}>${names[id]}</button>`;
  }).join("");

  const modes = $("modes");
  if (state.place === "deck") {
    modes.innerHTML = `<button type="button" data-mode="packed" aria-pressed="${state.mode === "packed"}">Packed like a 747</button><button type="button" data-mode="cabins" aria-pressed="${state.mode === "cabins"}">A long flight</button>`;
  } else if (state.place === "seat") {
    modes.innerHTML = `<button type="button" data-wall="windward" aria-pressed="${state.wall === "windward"}">Windward, tile</button><button type="button" data-wall="leeward" aria-pressed="${state.wall === "leeward"}">Leeward, a window</button>`;
  } else {
    modes.innerHTML = "";
  }

  const doors = [];
  if (state.place === "ship") {
    doors.push(["across", "Into the cabin"], ["wall", "The heat-shield wall"], ["engine", "One engine"]);
  } else if (state.place === "across") doors.push(["deck", "Step onto a deck"]);
  else if (state.place === "deck") doors.push(["seat", "Sit in a seat"]);
  else if (state.place === "seat") doors.push(["wall", "Closer, to the tile"]);
  if (state.stack.length) doors.push(["back", "Back out"]);
  $("doors").innerHTML = doors.map(([id, text]) => `<button type="button" data-go="${id}">${text}</button>`).join("");

  const perCrew = F.volume / F.crew;
  const perDragon = F.dragonV / F.dragonPeople;
  let caption = "";
  let hint = "Click the drawing, or use the buttons. Escape steps back out.";
  const facts = [];
  if (state.place === "ship") {
    caption = `The airplane is longer than the rocket is tall. The rocket is the tower. The gold band is the published payload bay, 8 metres across and up to 22 metres tall, drawn in the forward body because SpaceX publishes the envelope and not a station on Ship 42. A cylinder of that envelope is about ${Math.round(Math.PI * 16 * F.bayH)} cubic metres. SpaceX describes about ${F.volume.toLocaleString()} of it as usable.`;
    facts.push(["Long flight", `${F.crew} people`], ["Each of them", `${trim(perCrew)} m³ of air`], ["Dragon, four people", `${trim(perDragon)} m³ each`], ["747-8", `${F.jetSeats} seats`]);
  } else if (state.place === "across") {
    caption = `The pale circle is the 9 metre skin. The gold dashes are the 8 metre payload envelope. Inside it, two 747 main-deck cross-sections, each ${F.jetCabinW} by ${F.jetCabinH} metres, fit one above the other. You are standing in the lower one. Dragon’s whole 4 metre hull is the small circle.`;
    facts.push(["You", `${metres(h)} m`], ["747 cabin", `${F.jetCabinW} m wide`], ["Envelope", `${F.bayD} m`], ["Headroom in this sketch", `${metres(F.jetCabinH - h)} m`]);
  } else if (state.place === "deck") {
    if (state.mode === "packed") {
      caption = `Looking down one floor. Each mark is an economy seat with someone in it, ${Math.round(F.seatW * 100)} cm wide and ${Math.round(F.pitch * 100)} cm to the next row, in a 5-4-5 layout. The middle row is ${middleRow()} across. A 747 is ${F.jetAcross} across. This one floor holds ${PACKED.length} people, which is already the published long-flight crew, packed the way a short airline hop is packed. The pale band is the width of a 747 cabin. SpaceX has not said it will board a ship this way.`;
      facts.push(["This floor", `${PACKED.length} seats`], ["Across the middle", `${middleRow()} people`], ["A 747 row", `${F.jetAcross} across`], ["Whole 747", `${F.jetSeats} seats`]);
    } else {
      caption = `The same floor, spent the way a long flight needs. Nine cabins around the rim, two people in each, and an open common floor in the middle. That is ${CABIN.length} people on this deck. Five such decks are 90 people, close to the published hundred, and the rest of the 22 metres can be the common room, the storm shelter, the stores, and the viewing gallery the user’s guide names. This is not a SpaceX floor plan.`;
      facts.push(["This deck", `${CABIN.length} people`], ["Five decks", `${CABIN.length * 5} people`], ["Published crew", `${F.crew}`], ["Air each", `${trim(perCrew)} m³`]);
    }
    hint = "Click a person to sit down.";
  } else if (state.place === "seat") {
    const edge = state.seat && Math.abs(state.seat.x) > 2.6;
    const where = edge
      ? "You chose a seat near the skin. The middle of that seat is about half a metre from the metal."
      : "A middle seat has a few metres of other people between you and the metal. This drawing puts you in the seat against the wall, which is the tight side.";
    const stand = h < F.deckH - 0.15
      ? `The next deck is ${F.deckH} m above the floor, so at ${metres(h)} m you can stand.`
      : `At ${metres(h)} m you are into the ${F.deckH} m deck spacing. You would duck.`;
    caption = `${where} This looks at one row from behind. The pale lines are straps over both shoulders and a belt at the lap, with a buckle where they meet. A lap belt is enough on an airliner that stays the right way up. Your shoulders are about 40 cm across and the seat is 46, so the next person is close. Above your head there is still room to stand: the next deck in this sketch is ${F.deckH} m up. Launch pushes you toward the engines, so you lie on your back relative to the ground, looking at the nose. In orbit there is no down. Entry is belly-first, so down swings into the heat-shield wall until the ship flips upright for the landing burn. SpaceX has not published how the seat faces both of those. ${stand}`;
    facts.push(["Seat", `${Math.round(F.seatW * 100)} cm wide`], ["You", `${metres(h)} m`], ["Deck spacing", `${F.deckH} m`], ["Wall", state.wall === "windward" ? "Tile" : "A window"]);
  } else if (state.place === "wall") {
    caption = `Each colored hex is one tile, about ${Math.round(F.tile * 100)} cm across the flats. The colors are a diagram. In the photographs this wall is black. Two tiles are about the width of an adult’s shoulders. This is the windward wall, the side that took the plasma on the way home. There is no window in it. The other side of the ship is bare steel, and a crew ship is described as having windows somewhere that side, or forward. A tanker, SpaceX says, is this ship without the windows.`;
    facts.push(["One tile", `${Math.round(F.tile * 100)} cm`], ["Across 9 m", `about ${Math.round(F.shipD / F.tile)}`], ["You", `${metres(h)} m`], ["Window here", "No"]);
    hint = "This is as close as the page goes.";
  } else {
    caption = `A Raptor is ${F.raptorD} m across and ${F.raptorH} m tall. You are ${metres(h)} m. The bell is a bit wider than your shoulders and taller than you are, and there are 33 of them on the booster. The bus beside it is a city bus, whose roof is about the height of this one engine.`;
    facts.push(["Raptor", `${F.raptorH} m tall`], ["Across", `${F.raptorD} m`], ["You", `${metres(h)} m`], ["Bus roof", `${F.busH} m`]);
  }
  $("insideCaption").textContent = caption;
  $("insideHint").textContent = hint;
  $("insideFacts").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  canvasLabel();
  photo();
}

function canvasLabel() {
  const text = {
    ship: "The ship beside a 747 and a Crew Dragon. The cabin band can be opened.",
    across: "Cross-section of the ship with two 747 cabins inside it.",
    deck: "One deck of seats, looking down.",
    seat: "One row from behind. You are strapped into the seat against the wall.",
    wall: "Heat-shield tiles beside a person and a dinner plate.",
    engine: "One Raptor beside a person and a bus.",
  };
  $("insideCanvas").setAttribute("aria-label", text[state.place]);
}

function photo() {
  const img = $("insideImg");
  const cap = $("insideFig");
  if (state.place === "wall" || (state.place === "seat" && state.wall === "windward")) {
    img.src = "media/tiles-still.jpg";
    img.alt = "Looking up the black heat-shield tiles of Ship 42 from inside the tower.";
    cap.innerHTML = `The real windward wall, the evening of the catch. Elon Musk, “Ship 42 looks great.” <a href="https://x.com/elonmusk/status/2121746382402797892">The post</a>`;
  } else {
    img.src = "media/pad-01.jpg";
    img.alt = "A person in a lift basket beside the stainless barrel of Super Heavy. The person is tiny against one tank section.";
    cap.innerHTML = `One person against the real barrel, 10 November 2026, as the booster was moved to the pad. <a href="https://x.com/SpaceX/status/2120220290219208884">SpaceX</a>`;
  }
}

function beginPunch() {
  state.hot = null;
  state.punch = 0;
  state.punchFrom = performance.now();
  paintChrome();
  if (reduced) {
    state.punch = 1;
    draw();
  }
}

function go(next) {
  if (next === "back") {
    state.place = state.stack.pop() || "ship";
  } else if (next !== state.place) {
    state.stack.push(state.place);
    state.place = next;
  }
  beginPunch();
}

function loop(now) {
  if (document.hidden) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestAnimationFrame(loop);
    }, { once: true });
    return;
  }
  if (state.punch < 1) {
    const u = Math.min(1, (now - state.punchFrom) / 420);
    state.punch = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
  }
  draw();
  requestAnimationFrame(loop);
}

function worldPoint(event) {
  const canvas = $("insideCanvas");
  const rect = canvas.getBoundingClientRect();
  const { w, h } = { w: rect.width, h: rect.height };
  const cam = camera(w, h, viewBox(w, h));
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  return { x: (sx - cam.sx(0)) / cam.ppm, y: (cam.sy(0) - sy) / cam.ppm, w, h };
}

function onCanvasClick(event) {
  const p = worldPoint(event);
  if (state.place === "ship") {
    const wide = p.w > p.h * 1.15;
    if (p.y >= 0 && p.y <= 5 && p.x >= -1 && p.x <= 11) return go("engine");
    if (p.y >= 45 && p.y <= 51 && p.x >= -1 && p.x <= 5) return go("wall");
    if (p.x >= 0 && p.x <= 9 && p.y >= F.bayY && p.y <= F.bayY + F.bayH) return go("across");
    if (!wide && p.y > 40) return go("wall");
    return;
  }
  if (state.place === "across") {
    if (p.x * p.x + p.y * p.y < 20) go("deck");
    return;
  }
  if (state.place === "deck") {
    const list = state.mode === "packed" ? PACKED : CABIN;
    let best = null;
    let bestD = 0.45 ** 2;
    list.forEach((s) => {
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    });
    if (best) {
      state.seat = best;
      go("seat");
    }
  }
}

function boot() {
  const saved = localStorage.getItem("starship-catch-height-cm");
  if (saved && Number(saved) >= 100 && Number(saved) <= 220) $("heightCm").value = saved;
  $("heightForm").addEventListener("submit", (event) => event.preventDefault());
  $("heightCm").addEventListener("input", () => {
    const raw = Number($("heightCm").value);
    if (!Number.isFinite(raw) || raw < 100 || raw > 220) return;
    localStorage.setItem("starship-catch-height-cm", String(Math.round(raw)));
    redraw();
  });
  $("insideCanvas").addEventListener("click", onCanvasClick);
  $("insideCanvas").addEventListener("mousemove", onCanvasMove);
  $("insideCanvas").addEventListener("mouseleave", () => {
    state.hot = null;
    $("insideCanvas").style.cursor = "default";
    if (reduced) draw();
  });
  document.body.addEventListener("click", (event) => {
    const crumb = event.target.closest("[data-crumb]");
    if (crumb) {
      const index = Number(crumb.dataset.crumb);
      state.place = [...state.stack, state.place][index];
      state.stack = state.stack.slice(0, index);
      beginPunch();
      return;
    }
    const mode = event.target.closest("[data-mode]");
    if (mode) {
      state.mode = mode.dataset.mode;
      redraw();
      return;
    }
    const wall = event.target.closest("[data-wall]");
    if (wall) {
      state.wall = wall.dataset.wall;
      redraw();
      return;
    }
    const door = event.target.closest("[data-go]");
    if (door) go(door.dataset.go);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.stack.length) go("back");
  });
  const canvas = $("insideCanvas");
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", draw);
  }
  redraw();
  onFigures(redraw);
  onCutouts(redraw);
  if (!reduced) requestAnimationFrame(loop);
}

function sameHot(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return a.x === b.x && a.y === b.y;
}

function onCanvasMove(event) {
  const p = worldPoint(event);
  let hot = null;
  if (state.place === "ship") {
    const wide = p.w > p.h * 1.15;
    if (p.y >= 0 && p.y <= 5 && p.x >= -1 && p.x <= 11) hot = "engine";
    else if (p.y >= 45 && p.y <= 51 && p.x >= -1 && p.x <= 5) hot = "wall";
    else if (p.x >= 0 && p.x <= 9 && p.y >= F.bayY && p.y <= F.bayY + F.bayH) hot = "bay";
    else if (!wide && p.y > 40) hot = "wall";
  } else if (state.place === "across") {
    if (p.x * p.x + p.y * p.y < 20) hot = "across";
  } else if (state.place === "deck") {
    const list = state.mode === "packed" ? PACKED : CABIN;
    let best = null;
    let bestD = 0.45 ** 2;
    list.forEach((s) => {
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    });
    hot = best;
  }
  $("insideCanvas").style.cursor = hot ? "pointer" : "default";
  if (!sameHot(state.hot, hot)) {
    state.hot = hot;
    if (reduced) draw();
  }
}

boot();
