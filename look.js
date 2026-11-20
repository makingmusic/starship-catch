/* Shared drawing for the scale pages.
   Metres stay in the page scripts. This file only paints:
   an illustrated person at a height the page already chose,
   and comparison marks that stay visible on a dark drawing. */

const lookReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const look = {
  front: null,
  back: null,
  seated: null,
  ready: false,
};

const lookWaiters = [];

function onFigures(fn) {
  if (look.ready) fn();
  else lookWaiters.push(fn);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function figureSway(x) {
  if (lookReduced) return 0;
  return Math.sin(performance.now() / 780 + x * 0.017) * 1.4;
}

function splitSheet(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const bg = [d[0], d[1], d[2]];
  const near = 62 * 62;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x += 1) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    stack.push(y * w, y * w + w - 1);
  }
  const isBg = (i) => {
    const dr = d[i] - bg[0];
    const dg = d[i + 1] - bg[1];
    const db = d[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db < near;
  };
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    d[i + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const edge = d[i - 4 + 3] === 0 || d[i + 4 + 3] === 0 || d[i - w * 4 + 3] === 0 || d[i + w * 4 + 3] === 0;
        if (!edge) continue;
        const dr = d[i] - bg[0];
        const dg = d[i + 1] - bg[1];
        const db = d[i + 2] - bg[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < 120 * 120) d[i + 3] = 0;
        else if (dist < 170 * 170) d[i + 3] = 120;
      }
    }
  }
  g.putImageData(image, 0, 0);

  const vis = new Uint8Array(w * h);
  const boxes = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (vis[start] || d[start * 4 + 3] < 24) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      const queue = [start];
      vis[start] = 1;
      while (queue.length) {
        const p = queue.pop();
        count += 1;
        const cx = p % w;
        const cy = (p / w) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const next = [p - 1, p + 1, p - w, p + w];
        for (let n = 0; n < next.length; n += 1) {
          const k = next[n];
          if (k < 0 || k >= w * h || vis[k] || d[k * 4 + 3] < 24) continue;
          const kx = k % w;
          if (Math.abs(kx - cx) > 1) continue;
          vis[k] = 1;
          queue.push(k);
        }
      }
      if (count > 600) boxes.push({ minX, minY, maxX, maxY, count });
    }
  }

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const left = Math.max(a.minX, b.minX);
        const right = Math.min(a.maxX, b.maxX);
        const overlap = right - left;
        const narrow = Math.min(a.maxX - a.minX, b.maxX - b.minX);
        if (overlap < narrow * 0.35) continue;
        const gap = Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY);
        if (gap > h * 0.08) continue;
        a.minX = Math.min(a.minX, b.minX);
        a.maxX = Math.max(a.maxX, b.maxX);
        a.minY = Math.min(a.minY, b.minY);
        a.maxY = Math.max(a.maxY, b.maxY);
        a.count += b.count;
        boxes.splice(j, 1);
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  boxes.sort((a, b) => a.minX - b.minX);
  return boxes.slice(0, 3).map((box) => {
    const pad = 2;
    const x = Math.max(0, box.minX - pad);
    const y = Math.max(0, box.minY - pad);
    const cw = Math.min(w - x, box.maxX - box.minX + 1 + pad * 2);
    const ch = Math.min(h - y, box.maxY - box.minY + 1 + pad * 2);
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d").drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
    return out;
  });
}

function loadFigures() {
  const img = new Image();
  img.onload = () => {
    const parts = splitSheet(img);
    look.front = parts[0] || null;
    look.back = parts[1] || null;
    look.seated = parts[2] || null;
    look.ready = Boolean(look.front);
    lookWaiters.splice(0).forEach((fn) => fn());
  };
  img.src = "media/figure-sheet.jpg";
}

/* Comparison pictures. The page chooses the metre.
   Each file is one subject on a flat magenta field. */

look.world = {};
look.worldReady = false;
const cutoutWaiters = [];

function onCutouts(fn) {
  if (look.worldReady) fn();
  else cutoutWaiters.push(fn);
}

function keyOne(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const bg = [d[0], d[1], d[2]];
  const near = 78 * 78;
  const isBg = (i) => {
    const dr = d[i] - bg[0];
    const dg = d[i + 1] - bg[1];
    const db = d[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db < near;
  };
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    if (isBg(i)) d[i + 3] = 0;
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const edge = d[i - 4 + 3] === 0 || d[i + 4 + 3] === 0 || d[i - w * 4 + 3] === 0 || d[i + w * 4 + 3] === 0;
        if (!edge) continue;
        const dr = d[i] - bg[0];
        const dg = d[i + 1] - bg[1];
        const db = d[i + 2] - bg[2];
        if (dr * dr + dg * dg + db * db < 150 * 150) d[i + 3] = 0;
      }
    }
  }
  g.putImageData(image, 0, 0);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (d[(y * w + x) * 4 + 3] < 24) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!count) return canvas;
  const pad = 1;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const cw = Math.min(w - x0, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - y0, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d").drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

function cutoutAspect(name) {
  const img = look.world[name];
  return img && img.height ? img.width / img.height : 0;
}

function drawCutout(ctx, name, x, baseline, sizePx, mode, opts) {
  const img = look.world[name];
  if (!img || !(sizePx > 1)) return null;
  const aspect = img.width / img.height;
  let dw;
  let dh;
  if (mode === "width") {
    dw = sizePx;
    dh = sizePx / aspect;
  } else {
    dh = sizePx;
    dw = sizePx * aspect;
  }
  const flip = opts && opts.flip;
  const noseUp = opts && opts.noseUp;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x, baseline);
  if (noseUp) {
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -dw, -dh / 2, dw, dh);
  } else {
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
  return noseUp ? { w: dh, h: dw } : { w: dw, h: dh };
}

function loadCutouts() {
  const files = {
    jet747: "media/world/jet747.jpg",
    jet737: "media/world/jet737.jpg",
    bus: "media/world/bus.jpg",
    "bus-front": "media/world/bus-front.jpg",
    doubledecker: "media/world/doubledecker.jpg",
    car: "media/world/car.jpg",
    whale: "media/world/whale.jpg",
    container: "media/world/container.jpg",
    giraffe: "media/world/giraffe.jpg",
    liberty: "media/world/liberty.jpg",
    saturn: "media/world/saturn.jpg",
    dragon: "media/world/dragon.jpg",
    bicycle: "media/world/bicycle.jpg",
  };
  const names = Object.keys(files);
  let pending = names.length;
  const done = () => {
    pending -= 1;
    if (pending > 0) return;
    look.worldReady = true;
    cutoutWaiters.splice(0).forEach((fn) => fn());
  };
  names.forEach((name) => {
    const img = new Image();
    img.onload = () => {
      look.world[name] = keyOne(img);
      done();
    };
    img.onerror = done;
    img.src = files[name];
  });
}

function capsule(ctx, x1, y1, x2, y2, r) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.arc(x1, y1, r, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.arc(x2, y2, r, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
}

function drawVector(ctx, x, feetY, hPx) {
  const h = hPx;
  ctx.save();
  ctx.translate(x, feetY);
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 1, h * 0.12, Math.max(1.2, h * 0.028), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#241c18";
  capsule(ctx, -h * 0.07, -h * 0.02, -h * 0.07, -h * 0.5, h * 0.045);
  capsule(ctx, h * 0.07, -h * 0.02, h * 0.07, -h * 0.5, h * 0.045);
  ctx.fillStyle = "#1a140c";
  ctx.beginPath();
  ctx.ellipse(-h * 0.07, -h * 0.015, h * 0.055, h * 0.02, 0, 0, Math.PI * 2);
  ctx.ellipse(h * 0.09, -h * 0.015, h * 0.055, h * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9a4030";
  capsule(ctx, -h * 0.15, -h * 0.74, -h * 0.2, -h * 0.42, h * 0.032);
  capsule(ctx, h * 0.15, -h * 0.74, h * 0.18, -h * 0.4, h * 0.032);
  ctx.fillStyle = "#e4c2a6";
  ctx.beginPath();
  ctx.arc(-h * 0.2, -h * 0.4, h * 0.028, 0, Math.PI * 2);
  ctx.arc(h * 0.18, -h * 0.38, h * 0.028, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c4553a";
  ctx.beginPath();
  ctx.moveTo(-h * 0.15, -h * 0.52);
  ctx.lineTo(-h * 0.17, -h * 0.8);
  ctx.quadraticCurveTo(0, -h * 0.9, h * 0.17, -h * 0.8);
  ctx.lineTo(h * 0.15, -h * 0.52);
  ctx.quadraticCurveTo(0, -h * 0.46, -h * 0.15, -h * 0.52);
  ctx.fill();
  ctx.fillStyle = "#9a4030";
  ctx.fillRect(-h * 0.04, -h * 0.8, h * 0.08, h * 0.16);

  ctx.fillStyle = "#e4c2a6";
  const headR = h * 0.072;
  const headY = -h * 0.9;
  ctx.beginPath();
  ctx.ellipse(0, headY, headR * 0.86, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241c18";
  ctx.beginPath();
  ctx.ellipse(0, headY - headR * 0.12, headR * 0.9, headR * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95, true);
  ctx.fill();
  if (h > 42) {
    ctx.fillStyle = "#2a211c";
    ctx.beginPath();
    ctx.arc(-headR * 0.32, headY + headR * 0.12, Math.max(0.7, headR * 0.09), 0, Math.PI * 2);
    ctx.arc(headR * 0.32, headY + headR * 0.12, Math.max(0.7, headR * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, feetY, hPx, still) {
  if (!(hPx > 1)) return;
  const sway = still || lookReduced ? 0 : figureSway(x);
  if (hPx < 8) {
    ctx.fillStyle = "#c4553a";
    ctx.beginPath();
    ctx.arc(x, feetY - hPx * 0.55, Math.max(1.5, hPx * 0.42), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (look.front && hPx >= 32) {
    const img = look.front;
    const dw = img.width * (hPx / img.height);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = Math.max(2, hPx * 0.035);
    ctx.shadowOffsetY = Math.max(1, hPx * 0.015);
    const breath = still || lookReduced ? 1 : 1 + Math.sin(performance.now() / 900) * 0.012;
    ctx.translate(x + sway, feetY);
    ctx.scale(1, breath);
    ctx.drawImage(img, -dw / 2, -hPx, dw, hPx);
    ctx.restore();
    return;
  }
  drawVector(ctx, x + sway, feetY, hPx);
}

function drawSeated(ctx, x, lapY, hPx, maxW, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  const img = look.seated;
  if (img && hPx >= 28) {
    let dw = img.width * (hPx / img.height);
    let dh = hPx;
    if (maxW && dw > maxW) {
      dh *= maxW / dw;
      dw = maxW;
    }
    const sway = lookReduced ? 0 : figureSway(x) * 0.35;
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = Math.max(3, dh * 0.04);
    ctx.drawImage(img, x - dw / 2 + sway, lapY - dh, dw, dh);
    ctx.restore();
    return;
  }
  const h = hPx;
  ctx.translate(x, lapY);
  ctx.fillStyle = "#2c3138";
  roundRect(ctx, -h * 0.22, -h * 0.34, h * 0.44, h * 0.34, h * 0.06);
  ctx.fill();
  ctx.fillStyle = "#c4553a";
  roundRect(ctx, -h * 0.26, -h * 0.78, h * 0.52, h * 0.5, h * 0.08);
  ctx.fill();
  ctx.fillStyle = "#241c18";
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.9, h * 0.16, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintBox(ctx, x, y, w, h, style) {
  if (w < 2 || h < 2) return;
  const o = style || {};
  ctx.save();
  ctx.fillStyle = o.fill || "rgba(228, 194, 122, 0.34)";
  ctx.strokeStyle = o.stroke || "#f0d7a4";
  ctx.lineWidth = o.lineWidth || 2.75;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  const mark = Math.max(7, Math.min(18, w * 0.18, h * 0.18));
  ctx.lineWidth = (o.lineWidth || 2.75) + 1;
  ctx.beginPath();
  ctx.moveTo(x, y + mark);
  ctx.lineTo(x, y);
  ctx.lineTo(x + mark, y);
  ctx.moveTo(x + w - mark, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + mark);
  ctx.moveTo(x, y + h - mark);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + mark, y + h);
  ctx.moveTo(x + w - mark, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - mark);
  ctx.stroke();
  if (o.accent) {
    ctx.fillStyle = o.accent;
    ctx.fillRect(x, y, Math.min(7, w * 0.08), h);
  }
  ctx.restore();
}

function paintBus(ctx, x, y, w, h, kind) {
  if (w < 3 || h < 3) return;
  ctx.save();
  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "#f4e7c4");
  body.addColorStop(0.55, "#e4c98a");
  body.addColorStop(1, "#b8893e");
  roundRect(ctx, x, y, w, h, Math.min(10, w * 0.08, h * 0.12));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.035);
  ctx.strokeStyle = "#5c4316";
  ctx.stroke();
  ctx.fillStyle = "#163044";
  if (kind === "side") {
    const winY = y + h * 0.16;
    const winH = Math.max(3, h * 0.3);
    const count = Math.max(2, Math.min(8, Math.floor(w / Math.max(16, h * 0.55))));
    const span = w * 0.78;
    const gap = span / count;
    for (let i = 0; i < count; i += 1) {
      const wx = x + w * 0.1 + i * gap;
      roundRect(ctx, wx, winY, gap * 0.68, winH, 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1a140c";
    const wr = Math.min(h * 0.14, w * 0.08);
    ctx.beginPath();
    ctx.arc(x + w * 0.22, y + h - wr * 0.65, wr, 0, Math.PI * 2);
    ctx.arc(x + w * 0.78, y + h - wr * 0.65, wr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d7e4ea";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    roundRect(ctx, x + w * 0.12, y + h * 0.1, w * 0.76, h * 0.36, Math.min(6, w * 0.06));
    ctx.fill();
    ctx.fillStyle = "#f6f1e4";
    ctx.beginPath();
    ctx.arc(x + w * 0.24, y + h * 0.72, Math.max(1.6, w * 0.055), 0, Math.PI * 2);
    ctx.arc(x + w * 0.76, y + h * 0.72, Math.max(1.6, w * 0.055), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(x + w * 0.1, y + h * 0.86, w * 0.8, Math.max(2, h * 0.07));
  }
  ctx.restore();
}

function paintCabin(ctx, x, y, w, h) {
  if (w < 4 || h < 4) return;
  ctx.save();
  ctx.fillStyle = "rgba(214, 230, 238, 0.3)";
  ctx.strokeStyle = "#f2f7fa";
  ctx.lineWidth = 2.75;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(12, 28, 38, 0.72)";
  const winW = Math.max(3, Math.min(12, w * 0.035));
  const winH = Math.max(4, h * 0.28);
  ctx.fillRect(x + 4, y + h * 0.22, winW, winH);
  ctx.fillRect(x + w - 4 - winW, y + h * 0.22, winW, winH);
  ctx.fillStyle = "rgba(74, 58, 42, 0.78)";
  const seats = 10;
  const inner = w * 0.86;
  const seatW = inner / seats;
  for (let i = 0; i < seats; i += 1) {
    if (i === 4 || i === 5) continue;
    const sx = x + w * 0.07 + i * seatW;
    roundRect(ctx, sx + 1, y + h * 0.62, seatW * 0.72, h * 0.26, 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintDragon(ctx, x, y, w, h) {
  if (w < 3 || h < 3) return;
  ctx.save();
  ctx.fillStyle = "rgba(240, 210, 176, 0.42)";
  ctx.strokeStyle = "#f0d2b0";
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.03);
  const trunkTop = y + h * 0.58;
  ctx.fillRect(x + w * 0.14, trunkTop, w * 0.72, h * 0.42);
  ctx.strokeRect(x + w * 0.14, trunkTop, w * 0.72, h * 0.42);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, trunkTop + 1);
  ctx.bezierCurveTo(x + w * 0.02, y + h * 0.16, x + w * 0.98, y + h * 0.16, x + w * 0.92, trunkTop + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(90, 150, 170, 0.9)";
  ctx.fillRect(x + w * 0.24, y + h * 0.28, w * 0.52, Math.max(2, h * 0.045));
  ctx.restore();
}

function paintPlate(ctx, x, y, r) {
  if (r < 1.5) return;
  ctx.save();
  const dish = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  dish.addColorStop(0, "#fff8ee");
  dish.addColorStop(0.72, "#f0e2cc");
  dish.addColorStop(1, "#c4a574");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = dish;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120, 86, 40, 0.45)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  ctx.restore();
}

const TILE_TONES = [
  ["#c4a06a", "#6a5430"],
  ["#7f97a6", "#314049"],
  ["#c4898a", "#6a3a40"],
  ["#9aaa78", "#3c442c"],
  ["#d0b48a", "#6e5a38"],
  ["#7aada8", "#2c4442"],
];

function paintHex(ctx, x, y, r, lifted, seed) {
  if (!(r > 0.6)) return;
  const tone = TILE_TONES[(seed == null ? 0 : Math.abs(seed | 0)) % TILE_TONES.length];
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  if (lifted) {
    ctx.save();
    ctx.translate(Math.max(2, r * 0.14), Math.max(2, r * 0.2));
    path();
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fill();
    ctx.restore();
  }
  path();
  const face = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  face.addColorStop(0, tone[0]);
  face.addColorStop(1, tone[1]);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = "rgba(244, 239, 230, 0.92)";
  ctx.stroke();
}

function paintWalker(canvas, hPx) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssH = hPx;
  const cssW = Math.round(hPx * 0.46);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  drawPerson(ctx, cssW / 2, cssH - 1, cssH - 2, true);
}

loadFigures();
loadCutouts();
