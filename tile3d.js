/* One heat-shield tile, and a patch of them on the 9 m hull.
   Lengths come from tileFacts() in app.js. The picture does not invent them. */

const tile3d = {
  mode: "one",
  rotX: 0.42,
  rotY: 0.62,
  held: false,
  userMoved: false,
};

const TILE3D_RGB = [
  [196, 160, 106],
  [127, 151, 166],
  [196, 137, 138],
  [154, 170, 120],
  [208, 180, 138],
  [122, 173, 168],
];

function hexRing(side) {
  const ring = [];
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 2 + i * (Math.PI / 3);
    ring.push([Math.cos(a) * side, Math.sin(a) * side]);
  }
  return ring;
}

function tilePrism(cx, cy, cz, yaw, side, thick, tone, scale) {
  const s = scale == null ? 1 : scale;
  const tangent = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [0, 1, 0];
  const normal = [Math.sin(yaw), 0, Math.cos(yaw)];
  const ring = hexRing(side * s);
  const at = (lx, ly, along) => [
    cx + tangent[0] * lx + up[0] * ly + normal[0] * along,
    cy + tangent[1] * lx + up[1] * ly + normal[1] * along,
    cz + tangent[2] * lx + up[2] * ly + normal[2] * along,
  ];
  const outer = ring.map(([lx, ly]) => at(lx, ly, thick));
  const inner = ring.map(([lx, ly]) => at(lx, ly, 0));
  const faces = [{ pts: outer, rgb: tone, n: normal }];
  faces.push({
    pts: inner.slice().reverse(),
    rgb: tone.map((c) => Math.round(c * 0.55)),
    n: normal.map((v) => -v),
  });
  for (let i = 0; i < 6; i += 1) {
    const j = (i + 1) % 6;
    const mx = (ring[i][0] + ring[j][0]) / 2;
    const my = (ring[i][1] + ring[j][1]) / 2;
    const len = Math.hypot(mx, my) || 1;
    faces.push({
      pts: [outer[i], outer[j], inner[j], inner[i]],
      rgb: tone.map((c) => Math.round(c * 0.78)),
      n: [
        (tangent[0] * mx + up[0] * my) / len,
        (tangent[1] * mx + up[1] * my) / len,
        (tangent[2] * mx + up[2] * my) / len,
      ],
    });
  }
  return faces;
}

function discFaces(cx, cy, cz, radius, thick, rgb) {
  const n = 28;
  const ring = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    ring.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  const at = (lx, ly, z) => [cx + lx, cy + ly, cz + z];
  const front = ring.map(([lx, ly]) => at(lx, ly, thick));
  const back = ring.map(([lx, ly]) => at(lx, ly, 0));
  const faces = [
    { pts: front, rgb, n: [0, 0, 1] },
    { pts: back.slice().reverse(), rgb: rgb.map((c) => Math.round(c * 0.7)), n: [0, 0, -1] },
  ];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const mx = (ring[i][0] + ring[j][0]) / 2;
    const my = (ring[i][1] + ring[j][1]) / 2;
    const len = Math.hypot(mx, my) || 1;
    faces.push({
      pts: [front[i], front[j], back[j], back[i]],
      rgb: rgb.map((c) => Math.round(c * 0.82)),
      n: [mx / len, my / len, 0],
    });
  }
  return faces;
}

function steelQuads(cols, rows, flat, rowStep, radius) {
  const faces = [];
  const rgb = [140, 150, 158];
  const y0 = -((rows - 1) / 2) * rowStep - rowStep * 0.55;
  const x0 = -(cols / 2) * flat - flat * 0.15;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const corners = [
        [x0 + col * flat, y0 + row * rowStep],
        [x0 + (col + 1) * flat, y0 + row * rowStep],
        [x0 + (col + 1) * flat, y0 + (row + 1) * rowStep],
        [x0 + col * flat, y0 + (row + 1) * rowStep],
      ].map(([arc, y]) => {
        const theta = arc / radius;
        return [radius * Math.sin(theta), y, radius * Math.cos(theta) - radius];
      });
      const theta = ((x0 + (col + 0.5) * flat) / radius);
      faces.push({
        pts: corners,
        rgb,
        n: [Math.sin(theta), 0, Math.cos(theta)],
      });
    }
  }
  return faces;
}

function tileScene(mode) {
  const facts = tileFacts();
  const side = facts.corner / 2;
  const faces = [];
  const marks = [];
  if (mode === "one") {
    const thick = facts.thick;
    const plateR = 0.135;
    const plateX = facts.flat / 2 + plateR + 0.09;
    const shift = -plateX / 2;
    faces.push(...tilePrism(shift, 0, 0, 0, side, thick, TILE3D_RGB[0], 1));
    faces.push(...discFaces(shift + plateX, 0, 0, plateR, 0.012, [236, 214, 176]));
    const right = facts.flat / 2;
    const gap = 0.055;
    const s = shift;
    marks.push(
      {
        pts: [[s - right, 0, thick], [s - right, -side - gap, thick], [s + right, -side - gap, thick], [s + right, 0, thick]],
        text: `${cm1(facts.flat)} cm across the flats`,
        dx: -78,
        dy: 16,
      },
      {
        pts: [[s, side, thick], [s - right - gap, side, thick], [s - right - gap, -side, thick], [s, -side, thick]],
        text: `${cm1(facts.corner)} cm corner to corner`,
        dx: -188,
        dy: -14,
      },
      {
        kind: "edge",
        a: [s + right, 0, thick],
        b: [s + right, 0, 0],
        text: `${cm1(facts.thick)} cm thick`,
      },
      {
        pts: [[s + plateX, plateR, 0.012]],
        text: "27 cm plate",
        dx: -36,
        dy: -28,
      },
    );
    return { faces, marks, outline: faces[0].pts };
  }

  const radius = F.diameter / 2;
  const flat = facts.flat;
  const rowStep = side * 1.5;
  const cols = 12;
  const rows = 8;
  faces.push(...steelQuads(cols, rows, flat, rowStep, radius - 0.004));
  for (let row = 0; row < rows; row += 1) {
    const shift = row % 2 ? 0.5 : 0;
    for (let col = 0; col < cols; col += 1) {
      const arc = (col + shift - cols / 2) * flat;
      const y = (row - (rows - 1) / 2) * rowStep;
      const theta = arc / radius;
      const cx = radius * Math.sin(theta);
      const cz = radius * Math.cos(theta) - radius;
      faces.push(...tilePrism(cx, y, cz, theta, side, facts.thick, TILE3D_RGB[(col * 3 + row * 5) % TILE3D_RGB.length], 0.92));
    }
  }
  const feetY = -((rows - 1) / 2) * rowStep - side;
  const feetX = -(cols / 2) * flat - 0.45;
  return {
    faces,
    marks: [],
    fit: 3.35,
    person: [feetX, feetY, 0],
    outline: null,
  };
}

function rotate3(p, ay, ax) {
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const x = p[0] * cy + p[2] * sy;
  let z = -p[0] * sy + p[2] * cy;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const y = p[1] * cx - z * sx;
  z = p[1] * sx + z * cx;
  return [x, y, z];
}

function placeLabel(ctx, text, x, y, w, h) {
  ctx.save();
  ctx.font = "600 12.5px Outfit, sans-serif";
  const boxW = ctx.measureText(text).width + 16;
  ctx.restore();
  const lx = Math.max(6, Math.min(x, w - boxW - 6));
  const ly = Math.max(20, Math.min(y, h - 12));
  label(ctx, text, lx, ly);
}

function shadeRgb(rgb, n, light) {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const nd = Math.max(0.5, (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len);
  return `rgb(${Math.round(rgb[0] * nd)}, ${Math.round(rgb[1] * nd)}, ${Math.round(rgb[2] * nd)})`;
}

function drawTile3d() {
  const canvas = $("tile3d");
  if (!canvas) return;
  const { ctx, w, h } = prep(canvas);
  const scene = tileScene(tile3d.mode);
  const ay = tile3d.rotY;
  const ax = tile3d.rotX;
  const light = rotate3([0.25, 0.72, 0.65], -ay, -ax);
  const dist = tile3d.mode === "one" ? 1.15 : 6.2;
  const facts = tileFacts();
  const scale = tile3d.mode === "one"
    ? Math.min(w * 0.46, h * 0.46) / facts.corner
    : Math.min(w * 0.72, h * 0.7) / 1.9;
  const project = (p) => {
    const r = rotate3(p, ay, ax);
    const view = dist - r[2];
    const f = dist / Math.max(0.25, view);
    return {
      x: w / 2 + r[0] * f * scale,
      y: h / 2 - r[1] * f * scale,
      z: r[2],
    };
  };

  ctx.fillStyle = "#14181d";
  ctx.fillRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1c242c");
  sky.addColorStop(1, "#12100e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const drawn = scene.faces.map((face) => {
    const pts = face.pts.map(project);
    const z = pts.reduce((sum, p) => sum + p.z, 0) / pts.length;
    return { pts, z, fill: shadeRgb(face.rgb, rotate3(face.n, ay, ax), light) };
  });
  drawn.sort((a, b) => a.z - b.z);
  drawn.forEach((face) => {
    ctx.beginPath();
    face.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
  });

  if (scene.outline) {
    const ring = scene.outline.map(project);
    ctx.beginPath();
    ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 248, 236, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (scene.person) {
    const feet = project(scene.person);
    const head = project([scene.person[0], scene.person[1] + heightM(), scene.person[2]]);
    const hPx = Math.hypot(head.x - feet.x, head.y - feet.y);
    drawPerson(ctx, feet.x, feet.y, hPx, true);
    placeLabel(ctx, "You", feet.x + 8, head.y - 8, w, h);
  }

  scene.marks.forEach((mark) => {
    if (mark.kind === "edge") {
      const a = project(mark.a);
      const b = project(mark.b);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const lx = mx - 24;
      const ly = my + 52;
      ctx.strokeStyle = "rgba(228, 194, 122, 0.95)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(mx, my);
      ctx.lineTo(lx + 48, ly - 16);
      ctx.stroke();
      placeLabel(ctx, mark.text, lx, ly, w, h);
      return;
    }
    const pts = mark.pts.map(project);
    ctx.strokeStyle = "rgba(228, 194, 122, 0.95)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    const mid = pts[Math.floor((pts.length - 1) / 2)];
    placeLabel(ctx, mark.text, mid.x + mark.dx, mid.y + mark.dy, w, h);
  });
}

function tile3dCopy() {
  const facts = tileFacts();
  const caption = $("tile3dCaption");
  const canvas = $("tile3d");
  if (tile3d.mode === "one") {
    caption.textContent = `One tile, turned so the thickness shows. It is ${cm1(facts.flat)} cm across the flats, ${cm1(facts.corner)} cm from corner to corner, and about ${cm1(facts.thick)} cm thick. That face is ${Math.round(facts.area * 10000)} cm². A solid slab this thick would be ${litres1(facts.solid)} litres, a bit under a 2 litre bottle. The real back is partly hollow, and that depth is not published. The plate beside it is 27 cm. Drag to turn it.`;
    canvas.setAttribute("aria-label", "A single heat-shield tile beside a 27 centimetre plate. Drag to turn the tile.");
  } else {
    caption.textContent = `A patch of the windward skin on the 9 metre hull. Each colored plate is one tile. The curve is the real 4.5 metre radius, and the person is your height. The colors are a diagram. In the photographs this side is black. Drag to turn the patch.`;
    canvas.setAttribute("aria-label", "Colored heat-shield tiles on a curved patch of the Starship hull, next to a person. Drag to turn.");
  }
}

function fillTileFacts() {
  const facts = tileFacts();
  const rows = [
    ["Across the flats", `${cm1(facts.flat)} cm`, "The width used in these drawings, from a photo measurement near 24.4 cm."],
    ["Corner to corner", `${cm1(facts.corner)} cm`, "Fixed once the flat width of a regular hexagon is fixed."],
    ["One face", `${Math.round(facts.area * 10000)} cm²`, "The area of that hexagon. About a large dinner plate."],
    ["Thickness", `about ${cm1(facts.thick)} cm`, "A community estimate, not a number SpaceX prints."],
    ["If it were solid", `${litres1(facts.solid)} litres`, "The face times that thickness. A bit under a 2 litre bottle."],
    ["The ceramic itself", "less than that", "The back is partly hollow. The hollow depth is not published."],
    ["On the ship", facts.count.toLocaleString(), "SpaceX’s count, from an earlier flight broadcast."],
    ["All the faces", `about ${Math.round(facts.shield)} m²`, "Only if every tile were this size. They are not."],
  ];
  $("tileFacts").innerHTML = rows.map(([name, value, note]) => (
    `<div><dt>${name}</dt><dd>${value}</dd><p>${note}</p></div>`
  )).join("");
}

function setTileMode(mode) {
  tile3d.mode = mode;
  tile3d.userMoved = false;
  tile3d.rotX = mode === "one" ? 0.34 : 0.28;
  tile3d.rotY = mode === "one" ? 0.48 : -0.55;
  $("tileModeOne").setAttribute("aria-pressed", mode === "one" ? "true" : "false");
  $("tileModeHull").setAttribute("aria-pressed", mode === "hull" ? "true" : "false");
  tile3dCopy();
  drawTile3d();
}

function bootTile3d() {
  const canvas = $("tile3d");
  if (!canvas || !$("tileFacts")) return;
  fillTileFacts();
  tile3dCopy();
  drawTile3d();
  $("tileModeOne").addEventListener("click", () => setTileMode("one"));
  $("tileModeHull").addEventListener("click", () => setTileMode("hull"));

  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (event) => {
    tile3d.held = true;
    tile3d.userMoved = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!tile3d.held) return;
    tile3d.rotY += (event.clientX - lastX) * 0.01;
    tile3d.rotX += (event.clientY - lastY) * 0.01;
    tile3d.rotX = Math.max(-1.15, Math.min(1.15, tile3d.rotX));
    lastX = event.clientX;
    lastY = event.clientY;
    drawTile3d();
  });
  const release = () => { tile3d.held = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.08 : 0.18;
    if (event.key === "ArrowLeft") tile3d.rotY -= step;
    else if (event.key === "ArrowRight") tile3d.rotY += step;
    else if (event.key === "ArrowUp") tile3d.rotX -= step;
    else if (event.key === "ArrowDown") tile3d.rotX += step;
    else return;
    tile3d.userMoved = true;
    event.preventDefault();
    drawTile3d();
  });

  new ResizeObserver(() => drawTile3d()).observe(canvas);
  if (!lookReduced) requestAnimationFrame(spinTile3d);
}

let tile3dStamp = 0;

function spinTile3d(now) {
  if (document.hidden) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestAnimationFrame(spinTile3d);
    }, { once: true });
    return;
  }
  if (!tile3d.held && !tile3d.userMoved && now - tile3dStamp > 30) {
    tile3dStamp = now;
    const canvas = $("tile3d");
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      tile3d.rotY += 0.004;
      drawTile3d();
    }
  }
  requestAnimationFrame(spinTile3d);
}

bootTile3d();
