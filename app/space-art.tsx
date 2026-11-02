'use client';
import { useEffect, useRef } from 'react';

// Decorative illustrations for the home sky. All of them are aria-hidden
// and ignore pointer events, so they never block the subject planets.

// The orbit plane is seen from above at this ratio (height / width); the
// galaxy uses the same tilt so the planets sit inside it.
export const TILT = 0.5;

type Particle = {
  r: number;
  angle: number;
  y: number;
  color: string;
  size: number;
};
type BackStar = { x: number; y: number; depth: number; size: number };

function mix(a: number[], b: number[], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Roughly bell-shaped random number between -1 and 1.
const bell = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

type RGB = [number, number, number];
const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

// A big spiral galaxy: soft halo, dark dust lanes, two glowing arms of
// stars with bright star-forming knots, and a brilliant core.
function drawSpiral(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tilt: number,
  angle: number,
  inner: RGB,
  outer: RGB,
  knot: RGB,
) {
  // Arms sweep out about three quarters of a turn from the core.
  const arm = (t: number, n: number) => n * Math.PI + t * 4.2;
  c.save();
  c.globalCompositeOperation = 'source-over';
  c.translate(x, y);
  c.rotate(angle);
  c.scale(1, tilt);
  const halo = c.createRadialGradient(0, 0, 0, 0, 0, size * 1.15);
  halo.addColorStop(0, rgba(inner, 0.3));
  halo.addColorStop(0.5, rgba(outer, 0.1));
  halo.addColorStop(1, rgba(outer, 0));
  c.fillStyle = halo;
  c.beginPath();
  c.arc(0, 0, size * 1.15, 0, Math.PI * 2);
  c.fill();
  // Dust lanes just inside each arm.
  for (let i = 0; i < 700; i++) {
    const t = 0.15 + Math.random() * 0.8;
    const a = arm(t, i % 2) - 0.28 + bell() * 0.12;
    c.fillStyle = 'rgba(6, 8, 30, 0.35)';
    c.fillRect(Math.cos(a) * t * size, Math.sin(a) * t * size, 2, 2);
  }
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5200; i++) {
    const t = 0.08 + Math.pow(Math.random(), 0.9) * 0.92;
    const a = arm(t, i % 2) + bell() * (0.55 - t * 0.3);
    const r = t * size * (1 + bell() * 0.08);
    const mixT = Math.min(1, t * 1.4);
    const col: RGB = [0, 1, 2].map((k) =>
      Math.round(inner[k] + (outer[k] - inner[k]) * mixT),
    ) as RGB;
    c.fillStyle = rgba(col, 0.25 + (1 - t) * 0.5);
    const d = Math.random() < 0.06 ? 1.8 : 1;
    c.fillRect(Math.cos(a) * r, Math.sin(a) * r, d, d);
  }
  for (let i = 0; i < 46; i++) {
    const t = 0.3 + Math.random() * 0.65;
    const a = arm(t, i % 2) + bell() * 0.15;
    const kx = Math.cos(a) * t * size;
    const ky = Math.sin(a) * t * size;
    const kr = 2 + Math.random() * 3;
    const g = c.createRadialGradient(kx, ky, 0, kx, ky, kr);
    g.addColorStop(0, rgba(knot, 0.9));
    g.addColorStop(1, rgba(knot, 0));
    c.fillStyle = g;
    c.fillRect(kx - kr, ky - kr, kr * 2, kr * 2);
  }
  const core = c.createRadialGradient(0, 0, 0, 0, 0, size * 0.45);
  core.addColorStop(0, 'rgba(255, 255, 250, 1)');
  core.addColorStop(0.12, 'rgba(255, 250, 235, 0.9)');
  core.addColorStop(0.35, rgba(inner, 0.55));
  core.addColorStop(1, rgba(inner, 0));
  c.fillStyle = core;
  c.beginPath();
  c.arc(0, 0, size * 0.45, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Sparkles, placed through the same tilt but drawn upright.
  const toWorld = (px: number, py: number): [number, number] => [
    x + Math.cos(angle) * px - Math.sin(angle) * py * tilt,
    y + Math.sin(angle) * px + Math.cos(angle) * py * tilt,
  ];
  drawSparkle(c, x, y, size * 0.18, inner);
  for (let i = 0; i < 10; i++) {
    const t = 0.3 + Math.random() * 0.6;
    const a = arm(t, i % 2);
    const [sx, sy] = toWorld(Math.cos(a) * t * size, Math.sin(a) * t * size);
    drawSparkle(c, sx, sy, 2 + Math.random() * 4, i % 3 ? outer : knot);
  }
}

// An anime sparkle: a four-pointed star with curved sides and a soft glow.
function drawSparkle(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: RGB,
) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.shadowColor = rgba(color, 0.9);
  c.shadowBlur = size * 1.6;
  c.fillStyle = 'rgba(255, 255, 255, 0.95)';
  c.beginPath();
  c.moveTo(x, y - size);
  c.quadraticCurveTo(x, y, x + size, y);
  c.quadraticCurveTo(x, y, x, y + size);
  c.quadraticCurveTo(x, y, x - size, y);
  c.quadraticCurveTo(x, y, x, y - size);
  c.fill();
  c.restore();
}

// A star with long cross-shaped diffraction spikes.
function drawFlare(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  color: RGB,
) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(x, y, 0, x, y, len * 0.45);
  halo.addColorStop(0, 'rgba(255, 255, 255, 1)');
  halo.addColorStop(0.25, rgba(color, 0.7));
  halo.addColorStop(1, rgba(color, 0));
  c.fillStyle = halo;
  c.fillRect(x - len, y - len, len * 2, len * 2);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const g = c.createLinearGradient(
      x - dx * len,
      y - dy * len,
      x + dx * len,
      y + dy * len,
    );
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(1, rgba(color, 0));
    c.strokeStyle = g;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x - dx * len, y - dy * len);
    c.lineTo(x + dx * len, y + dy * len);
    c.stroke();
  }
  c.restore();
  drawSparkle(c, x, y, len * 0.32, color);
}

// Shade a sphere lit from the upper left: dark night side towards the
// lower right, plus a thin glowing atmosphere rim.
function shadeSphere(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rim: RGB,
  far = false,
) {
  const night = c.createRadialGradient(
    x - r * 0.45,
    y - r * 0.45,
    r * 0.2,
    x,
    y,
    r * 1.05,
  );
  night.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
  night.addColorStop(0.45, 'rgba(5, 8, 30, 0)');
  night.addColorStop(1, 'rgba(5, 8, 30, 0.7)');
  c.fillStyle = night;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  if (far) {
    // Distant planets stay soft and hazy so they never compete with the
    // bold subject planets: no cel edge, neon rim, gloss or sparkle.
    c.fillStyle = 'rgba(20, 30, 90, 0.5)';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    return;
  }
  // Anime cel shading: a hard-edged night side inside the planet.
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = 'rgba(14, 8, 52, 0.55)';
  c.beginPath();
  c.arc(x + r * 0.55, y + r * 0.6, r * 1.1, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.save();
  c.globalCompositeOperation = 'lighter';
  // Lit rim on the sunny side and a neon back-light on the dark edge.
  c.shadowColor = rgba(rim, 0.9);
  c.shadowBlur = r * 0.4;
  c.strokeStyle = rgba(rim, 0.7);
  c.lineWidth = Math.max(1, r * 0.07);
  c.beginPath();
  c.arc(x, y, r, Math.PI * 0.85, Math.PI * 1.65);
  c.stroke();
  c.shadowColor = 'rgba(94, 231, 255, 0.9)';
  c.strokeStyle = 'rgba(94, 231, 255, 0.55)';
  c.lineWidth = Math.max(1, r * 0.05);
  c.beginPath();
  c.arc(x, y, r * 0.99, Math.PI * 0.05, Math.PI * 0.55);
  c.stroke();
  // Glossy highlight.
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  c.beginPath();
  c.ellipse(
    x - r * 0.42,
    y - r * 0.45,
    r * 0.18,
    r * 0.1,
    -0.7,
    0,
    Math.PI * 2,
  );
  c.fill();
  c.restore();
  if (r > 12) drawSparkle(c, x - r * 0.62, y - r * 0.62, r * 0.22, rim);
}

// A banded gas giant like Jupiter, with a great red spot.
function drawGasGiant(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = '#c98d5a';
  c.fillRect(x - r, y - r, r * 2, r * 2);
  const bands = [
    '#efd9b8',
    '#a8673e',
    '#f2dfc2',
    '#c27a46',
    '#e6c49c',
    '#8f5534',
    '#f0d6b0',
    '#b9784a',
  ];
  let top = y - r;
  for (let i = 0; i < bands.length; i++) {
    const hgt = ((r * 2) / bands.length) * (0.7 + Math.random() * 0.6);
    c.fillStyle = bands[i];
    c.fillRect(x - r, top, r * 2, hgt);
    top += hgt;
  }
  c.fillStyle = '#b5523a';
  c.beginPath();
  c.ellipse(x + r * 0.25, y + r * 0.3, r * 0.2, r * 0.11, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  shadeSphere(c, x, y, r, [255, 220, 180], true);
}

// A pale ringed planet like Saturn: back half of the rings, the planet,
// then the front half of the rings over it.
function drawRingedPlanet(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  const ring = (start: number, end: number) => {
    for (const [scale, alpha, width] of [
      [2.2, 0.5, r * 0.22],
      [1.75, 0.75, r * 0.18],
    ]) {
      c.strokeStyle = `rgba(232, 214, 170, ${alpha})`;
      c.lineWidth = width;
      c.beginPath();
      c.ellipse(x, y, r * scale, r * scale * 0.28, -0.35, start, end);
      c.stroke();
    }
  };
  ring(Math.PI, Math.PI * 2);
  const body = c.createLinearGradient(x, y - r, x, y + r);
  body.addColorStop(0, '#f3e2b8');
  body.addColorStop(0.5, '#d9bd84');
  body.addColorStop(1, '#b8975e');
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  shadeSphere(c, x, y, r, [255, 240, 200], true);
  ring(0, Math.PI);
}

// The far background, painted once per size: the Milky Way as a diagonal
// band of light with a dust lane, and the Andromeda galaxy with its two
// small companions. `pad` leaves room for the parallax shift.
function paintBackdrop(w: number, h: number, pad: number, dpr: number) {
  const out = document.createElement('canvas');
  out.width = (w + pad * 2) * dpr;
  out.height = (h + pad * 2) * dpr;
  const c = out.getContext('2d')!;
  c.scale(dpr, dpr);
  c.translate(pad, pad);

  // Milky Way: from the bottom left to the top right.
  const angle = Math.atan2(-h * 0.85, w * 1.1);
  const length = Math.hypot(w * 1.2, h);
  const band = Math.max(110, Math.min(w, h) * 0.32);
  c.save();
  c.translate(w * 0.5, h * 0.48);
  c.rotate(angle);
  const glow = c.createLinearGradient(0, -band, 0, band);
  glow.addColorStop(0, 'rgba(200, 120, 230, 0)');
  glow.addColorStop(0.3, 'rgba(200, 120, 230, 0.12)');
  glow.addColorStop(0.5, 'rgba(255, 200, 235, 0.22)');
  glow.addColorStop(0.7, 'rgba(170, 150, 255, 0.12)');
  glow.addColorStop(1, 'rgba(170, 150, 255, 0)');
  c.fillStyle = glow;
  c.fillRect(-length / 2, -band, length, band * 2);
  c.globalCompositeOperation = 'lighter';
  // Pink star clouds along the band, then thousands of tiny stars.
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * length;
    const y = bell() * band * 0.4;
    const r = band * (0.25 + Math.random() * 0.35);
    const cloud = c.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, 'rgba(255, 150, 220, 0.10)');
    cloud.addColorStop(1, 'rgba(255, 150, 220, 0)');
    c.fillStyle = cloud;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 3200; i++) {
    const x = (Math.random() - 0.5) * length;
    const y = bell() * band * 0.75;
    c.globalAlpha = 0.25 + Math.random() * 0.55;
    c.fillStyle = ['#ffffff', '#ffe1f3', '#d6e6ff'][i % 3];
    c.fillRect(x, y, Math.random() < 0.1 ? 1.5 : 0.8, 0.8);
  }
  // Dust lane down the middle.
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  const dust = c.createLinearGradient(0, -band * 0.18, 0, band * 0.18);
  dust.addColorStop(0, 'rgba(12, 20, 69, 0)');
  dust.addColorStop(0.5, 'rgba(12, 20, 69, 0.35)');
  dust.addColorStop(1, 'rgba(12, 20, 69, 0)');
  c.fillStyle = dust;
  c.fillRect(-length / 2, -band * 0.18, length, band * 0.36);
  // Patchy dark dust clouds.
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * length;
    const y = bell() * band * 0.22;
    const r = band * (0.08 + Math.random() * 0.14);
    const patch = c.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, 'rgba(10, 14, 50, 0.4)');
    patch.addColorStop(1, 'rgba(10, 14, 50, 0)');
    c.fillStyle = patch;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.restore();

  // Blue and orange nebula clouds around the middle, behind the system.
  c.globalCompositeOperation = 'lighter';
  for (const [fx, fy, fr, color] of [
    [0.38, 0.4, 0.3, '70, 150, 255'],
    [0.62, 0.62, 0.26, '255, 140, 70'],
    [0.56, 0.32, 0.22, '90, 200, 255'],
    [0.42, 0.66, 0.2, '255, 110, 90'],
  ] as const) {
    const x = w * fx;
    const y = h * fy;
    const r = Math.min(w, h) * fr;
    const neb = c.createRadialGradient(x, y, 0, x, y, r);
    neb.addColorStop(0, `rgba(${color}, 0.16)`);
    neb.addColorStop(1, `rgba(${color}, 0)`);
    c.fillStyle = neb;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.globalCompositeOperation = 'source-over';

  // A dense field of faint stars across the whole sky.
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2000; i++) {
    c.globalAlpha = 0.15 + Math.random() * 0.45;
    c.fillStyle = ['#ffffff', '#cfe0ff', '#ffe6f4', '#fff3d6'][i % 4];
    c.fillRect(Math.random() * w, Math.random() * h, 0.8, 0.8);
  }

  // Distant galaxies: small tilted spirals and ellipticals in mixed colours.
  const tints = [
    '200, 210, 255',
    '255, 200, 235',
    '255, 230, 190',
    '190, 240, 255',
  ];
  for (let g = 0; g < 12; g++) {
    const gx = Math.random() * w;
    const gy = Math.random() * h;
    // Keep the middle clear for the subject planets.
    if (Math.abs(gx - w / 2) < w * 0.22 && Math.abs(gy - h / 2) < h * 0.25)
      continue;
    const gs = 10 + Math.random() * 22;
    const tint = tints[g % tints.length];
    c.save();
    c.translate(gx, gy);
    c.rotate(Math.random() * Math.PI);
    c.scale(1, 0.3 + Math.random() * 0.5);
    const core = c.createRadialGradient(0, 0, 0, 0, 0, gs);
    core.addColorStop(0, `rgba(255, 250, 240, 0.9)`);
    core.addColorStop(0.2, `rgba(${tint}, 0.45)`);
    core.addColorStop(1, `rgba(${tint}, 0)`);
    c.globalAlpha = 1;
    c.fillStyle = core;
    c.beginPath();
    c.arc(0, 0, gs, 0, Math.PI * 2);
    c.fill();
    if (g % 2 === 0)
      // Two faint spiral arms.
      for (let i = 0; i < 90; i++) {
        const t = i / 90;
        const arm = (i % 2) * Math.PI + t * 4;
        c.globalAlpha = 0.5 * (1 - t);
        c.fillStyle = `rgb(${tint})`;
        c.fillRect(Math.cos(arm) * t * gs, Math.sin(arm) * t * gs, 1, 1);
      }
    c.restore();
  }

  // Small anime sparkles scattered over the sky.
  for (let i = 0; i < 28; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    if (Math.abs(sx - w / 2) < w * 0.2 && Math.abs(sy - h / 2) < h * 0.22)
      continue;
    drawSparkle(
      c,
      sx,
      sy,
      2 + Math.random() * 5,
      [
        [170, 210, 255],
        [255, 160, 220],
        [255, 220, 150],
      ][i % 3] as RGB,
    );
  }
  // Bright stars with long spikes in blue-white, gold, orange and red.
  const flareColors: RGB[] = [
    [170, 210, 255],
    [255, 210, 150],
    [255, 160, 110],
    [255, 110, 110],
    [200, 225, 255],
  ];
  for (let i = 0; i < 16; i++) {
    const fx = Math.random() * w;
    const fy = Math.random() * h;
    if (Math.abs(fx - w / 2) < w * 0.2 && Math.abs(fy - h / 2) < h * 0.22)
      continue;
    drawFlare(
      c,
      fx,
      fy,
      8 + Math.random() * 16,
      flareColors[i % flareColors.length],
    );
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  // Andromeda: a tilted spiral seen almost edge-on, in the upper left.
  const ax = w * (w < 600 ? 0.22 : 0.17);
  const ay = h * (w < 600 ? 0.3 : 0.24);
  const size = Math.max(70, Math.min(w, h) * 0.13);
  c.save();
  c.translate(ax, ay);
  c.rotate(-0.6);
  c.scale(1, 0.34);
  const disk = c.createRadialGradient(0, 0, 0, 0, 0, size);
  disk.addColorStop(0, 'rgba(255, 246, 225, 0.95)');
  disk.addColorStop(0.12, 'rgba(255, 228, 200, 0.7)');
  disk.addColorStop(0.45, 'rgba(170, 185, 255, 0.28)');
  disk.addColorStop(1, 'rgba(120, 140, 255, 0)');
  c.fillStyle = disk;
  c.beginPath();
  c.arc(0, 0, size, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 500; i++) {
    const r = Math.sqrt(Math.random()) * size * 0.95;
    const a = Math.random() * Math.PI * 2 + r * 0.04;
    c.globalAlpha = 0.2 + (1 - r / size) * 0.5;
    c.fillStyle = r < size * 0.3 ? '#ffe9c9' : '#c9d6ff';
    c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1, 2.6);
  }
  c.restore();
  c.globalCompositeOperation = 'lighter';
  for (const [dx, dy, r] of [
    [size * 0.25, -size * 0.32, 4],
    [-size * 0.55, size * 0.12, 6],
  ]) {
    const blob = c.createRadialGradient(
      ax + dx,
      ay + dy,
      0,
      ax + dx,
      ay + dy,
      r,
    );
    blob.addColorStop(0, 'rgba(255, 240, 220, 0.8)');
    blob.addColorStop(1, 'rgba(255, 240, 220, 0)');
    c.globalAlpha = 1;
    c.fillStyle = blob;
    c.fillRect(ax + dx - r, ay + dy - r, r * 2, r * 2);
  }
  // Two big spiral galaxies, kept away from the middle. Normal blending
  // again: the shading below must darken, not add light.
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  const m = Math.min(w, h);
  drawSpiral(
    c,
    w * 0.83,
    h * 0.2,
    m * 0.26,
    0.42,
    -0.5,
    [140, 220, 255],
    [60, 130, 255],
    [255, 150, 120],
  );
  drawSpiral(
    c,
    w * 0.3,
    h * 0.88,
    m * 0.16,
    0.45,
    0.35,
    [255, 236, 200],
    [150, 170, 255],
    [255, 140, 200],
  );

  // Planets and moons in the far distance.
  // Far away: small, slightly blurred and hazy, behind everything else.
  c.save();
  c.filter = 'blur(0.8px)';
  drawGasGiant(c, w * 0.07, h * 0.4, Math.max(11, m * 0.03));
  drawRingedPlanet(c, w * 0.93, h * 0.5, Math.max(8, m * 0.02));
  c.restore();
  for (const [mx, my, mr] of [
    [0.6, 0.12, 5],
    [0.42, 0.95, 3.5],
    [0.97, 0.66, 4],
  ]) {
    c.fillStyle = '#9aa0b8';
    c.beginPath();
    c.arc(w * mx, h * my, mr, 0, Math.PI * 2);
    c.fill();
    shadeSphere(c, w * mx, h * my, mr, [220, 230, 255]);
  }
  return out;
}

function makeGalaxy(count: number): Particle[] {
  const inside = [255, 120, 190];
  const outside = [70, 140, 255];
  const arms = 3;
  return Array.from({ length: count }, (_, i) => {
    const r = Math.pow(Math.random(), 1.6);
    const spread = () =>
      Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.35 * r;
    return {
      r,
      angle: ((i % arms) / arms) * Math.PI * 2 + r * 5 + spread() * 3,
      y: spread() * 0.6,
      color: mix(inside, outside, Math.min(1, r * 1.3)),
      size: Math.random() < 0.08 ? 1.8 : 1,
    };
  });
}

// A slowly turning two-colour spiral galaxy around the supernova, in front
// of the Milky Way and Andromeda, with a field of stars that drifts with the
// pointer for depth.
export function GalaxyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const galaxy = makeGalaxy(still ? 1800 : 2600);
    const stars: BackStar[] = Array.from({ length: 320 }, () => ({
      x: Math.random(),
      y: Math.random(),
      depth: 0.2 + Math.random() * 0.8,
      size: Math.random() < 0.15 ? 1.6 : 0.9,
    }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;
    const pad = 24;
    let backdrop: HTMLCanvasElement | null = null;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      backdrop =
        width && height ? paintBackdrop(width, height, pad, dpr) : null;
    };
    const draw = (time: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      ctx.clearRect(0, 0, width, height);
      // The far galaxies move least with the pointer.
      if (backdrop)
        ctx.drawImage(
          backdrop,
          -pad - pointer.x * 8,
          -pad - pointer.y * 8,
          width + pad * 2,
          height + pad * 2,
        );
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + s.depth * 0.5;
        ctx.fillRect(
          s.x * width - pointer.x * 24 * s.depth,
          s.y * height - pointer.y * 24 * s.depth,
          s.size,
          s.size,
        );
      }
      const cx = width / 2 - pointer.x * 10;
      const cy = height / 2 - pointer.y * 10;
      const radius = Math.min(width * 0.62, height * 1.1, 760);
      const spin = still ? 0 : time * 0.00004;
      for (const p of galaxy) {
        const a = p.angle + spin * (1.6 - p.r);
        const x = cx + Math.cos(a) * p.r * radius;
        const y = cy + Math.sin(a) * p.r * radius * TILT + p.y * radius * 0.3;
        ctx.globalAlpha = 0.55 + (1 - p.r) * 0.35;
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (!still) frame = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    resize();
    draw(0);
    const observer = new ResizeObserver(() => {
      resize();
      if (still) draw(0);
    });
    observer.observe(canvas);
    window.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', move);
    };
  }, []);
  return <canvas ref={ref} className="galaxy" aria-hidden="true" />;
}

// Anime style: bold ink outlines, flat cel shading with hard-edged shadows
// and glossy white highlights.
const ink = '#1b1440';

function Astronaut({
  id,
  className,
  accent,
  mirror = false,
  face,
  photo,
}: {
  id: string;
  className: string;
  accent: string;
  mirror?: boolean;
  face: React.ReactNode;
  photo?: string;
}) {
  // Gradient-shaded suit and metal, so the figure reads as 3D.
  const suit = `url(#${id}-suit)`;
  const shade = '#b9c0e0';
  const dark = '#262a52';
  const line = {
    stroke: ink,
    strokeWidth: 2.2,
    strokeLinejoin: 'round' as const,
  };
  const limb = (d: string) => (
    <>
      <path
        d={d}
        stroke={ink}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={d}
        stroke={suit}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
  return (
    <svg className={className} viewBox="0 -6 160 276" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glass`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#3b4fb8" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e3e7f8" />
          <stop offset="1" stopColor="#aeb6dc" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a71aa" />
          <stop offset="1" stopColor="#262a52" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-visor`}>
          <circle cx="80" cy="48" r="29" />
        </clipPath>
      </defs>
      <g transform={mirror ? 'matrix(-1 0 0 1 160 0)' : undefined}>
        {/* jetpack with two glowing thrusters */}
        <rect
          x="44"
          y="90"
          width="72"
          height="80"
          rx="10"
          fill={`url(#${id}-metal)`}
          {...line}
        />
        <path
          d="M50 102 L50 160 M110 102 L110 160"
          stroke={accent}
          strokeWidth="2"
          opacity="0.8"
        />
        <rect
          x="50"
          y="168"
          width="18"
          height="10"
          rx="3"
          fill={dark}
          {...line}
        />
        <rect
          x="92"
          y="168"
          width="18"
          height="10"
          rx="3"
          fill={dark}
          {...line}
        />
        <g className="jet-flame">
          <path d="M53 178 L59 204 L65 178 Z" fill={accent} opacity="0.85" />
          <path d="M95 178 L101 204 L107 178 Z" fill={accent} opacity="0.85" />
          <path
            d="M56 178 L59 192 L62 178 Z M98 178 L101 192 L104 178 Z"
            fill="#fff"
          />
        </g>
        {/* legs, knee plates and boots */}
        <path d="M62 174 L57 244 L73 246 L80 180 Z" fill={suit} {...line} />
        <path d="M98 174 L103 244 L87 246 L80 180 Z" fill={suit} {...line} />
        <path d="M92 182 L98 176 L102 242 L96 243 Z" fill={shade} />
        <rect
          x="56"
          y="206"
          width="16"
          height="10"
          rx="3"
          fill={dark}
          {...line}
        />
        <rect
          x="88"
          y="206"
          width="16"
          height="10"
          rx="3"
          fill={dark}
          {...line}
        />
        <path d="M51 242 L77 242 L79 260 L48 260 Z" fill={dark} {...line} />
        <path d="M83 242 L109 242 L112 260 L81 260 Z" fill={dark} {...line} />
        <path
          d="M50 256 L78 256 M82 256 L111 256"
          stroke={accent}
          strokeWidth="2"
        />
        {/* relaxed arm behind */}
        {limb('M112 102 Q126 132 118 162')}
        <circle cx="117" cy="166" r="7" fill={dark} {...line} />
        {/* torso, cel shadow, belt and chest plate with neon trim */}
        <path
          d="M50 92 Q80 82 110 92 L104 150 Q80 160 56 150 Z"
          fill={suit}
          {...line}
        />
        <path
          d="M95 89 Q104 90 110 92 L104 150 Q99 153 93 155 Q101 124 95 89 Z"
          fill={shade}
        />
        <path
          d="M56 150 Q80 160 104 150 L102 176 Q80 184 58 176 Z"
          fill={dark}
          {...line}
        />
        <rect x="72" y="160" width="16" height="7" rx="2" fill={accent} />
        <path
          className="rim-light"
          color={accent}
          d="M109 95 L103.5 148 M97 178 L101.5 242"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M62 100 L98 100 L94 128 L66 128 Z"
          fill="#dfe4f7"
          stroke={ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M67 113 L93 113"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="80" cy="121" r="2.8" fill={accent} />
        {/* shoulder plates and the waving arm in front */}
        <circle cx="111" cy="97" r="10" fill={suit} {...line} />
        {limb('M48 100 Q30 84 32 52')}
        <path
          d="M27 66 L37 70"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="46" r="8" fill={dark} {...line} />
        <circle cx="49" cy="97" r="10" fill={suit} {...line} />
        <ellipse cx="80" cy="84" rx="22" ry="7" fill={dark} {...line} />
      </g>
      {/* helmet with a comms antenna light */}
      <path
        d="M100 22 L110 4"
        stroke={ink}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle
        cx="111"
        cy="2"
        r="3.5"
        fill={accent}
        stroke={ink}
        strokeWidth="1.5"
      />
      <circle cx="80" cy="48" r="36" fill={suit} {...line} />
      <path d="M108 24 A36 36 0 0 1 88 84 A32 32 0 0 0 108 24 Z" fill={shade} />
      <rect
        x="113"
        y="42"
        width="5"
        height="12"
        rx="2"
        fill={accent}
        stroke={ink}
        strokeWidth="1.2"
      />
      <g clipPath={`url(#${id}-visor)`}>
        <rect x="46" y="14" width="68" height="68" fill="#10183f" />
        {photo ? (
          <image
            href={photo}
            x="51"
            y="19"
            width="58"
            height="58"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <g transform="translate(80 50) scale(0.56) translate(-100 -88)">
            {face}
          </g>
        )}
        {/* Lighter glass over a photo so the real face stays clear. */}
        <circle
          cx="80"
          cy="48"
          r="29"
          fill={`url(#${id}-glass)`}
          opacity={photo ? 0.3 : 1}
        />
      </g>
      <circle cx="80" cy="48" r="29" fill="none" {...line} />
      {/* neon back-light along the helmet edge */}
      <path
        className="rim-light"
        color={accent}
        d="M113 34 A35 35 0 0 1 95 81"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* glossy reflection band and a sparkle on the visor */}
      <path
        d="M54 60 Q66 76 94 74 Q72 70 62 56 Z"
        fill={`url(#${id}-gloss)`}
        opacity="0.6"
      />
      <path
        d="M98 30 Q98 35 103 35 Q98 35 98 40 Q98 35 93 35 Q98 35 98 30 Z"
        fill="#fff"
      />
      <path
        d="M57 42 Q61 27 76 21"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <circle cx="56" cy="51" r="2.5" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function Eye({ x, y, iris }: { x: number; y: number; iris: string }) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y}
        rx="7"
        ry="9.5"
        fill="#2a1a12"
        stroke={ink}
        strokeWidth="1.5"
      />
      <ellipse cx={x} cy={y + 3} rx="5" ry="5.5" fill={iris} />
      <circle cx={x - 2.5} cy={y - 3.5} r="3" fill="#fff" />
      <circle cx={x + 2.5} cy={y + 5} r="1.5" fill="#fff" />
      <path
        d={`M${x - 8} ${y - 6} Q${x} ${y - 12} ${x + 8} ${y - 6}`}
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

export function ArinAstronaut({ photo }: { photo?: string }) {
  const hair = {
    fill: '#6b4428',
    stroke: ink,
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Astronaut
      photo={photo}
      id="arin"
      className="arin"
      accent="#ff5fc8"
      face={
        <>
          <path
            d="M58 86 C56 52 76 36 100 36 C124 36 144 52 142 86 L144 124 C134 128 126 124 122 118 L78 118 C74 124 66 128 56 124 Z"
            {...hair}
            fill="#5b3720"
          />
          <ellipse
            cx="100"
            cy="90"
            rx="30"
            ry="31"
            fill="#f5c9a6"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M70 80 C70 60 84 48 100 48 C116 48 130 60 130 80 C124 70 116 66 100 66 C84 66 76 70 70 80 Z"
            fill="#e8b08c"
          />
          <path
            d="M68 82 C66 58 82 46 100 46 C118 46 134 58 132 82 L125 70 L119 82 L111 64 L105 80 L99 62 L93 80 L85 66 L79 82 L73 70 Z"
            {...hair}
          />
          <path
            d="M70 76 C64 94 66 110 72 122 L79 118 C75 106 74 92 76 80 Z"
            {...hair}
          />
          <path
            d="M130 76 C136 94 134 110 128 122 L121 118 C125 106 126 92 124 80 Z"
            {...hair}
          />
          <path
            d="M80 56 Q92 50 106 52"
            stroke="#a77a52"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M82 79 Q88 76 94 79 M106 79 Q112 76 118 79"
            stroke="#4a2c18"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <Eye x={88} y={93} iris="#8a5a36" />
          <Eye x={112} y={93} iris="#8a5a36" />
          <path
            d="M93 108 Q100 116 107 108 Z"
            fill="#c2453b"
            stroke={ink}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </>
      }
    />
  );
}

// Neco, Arin's cousin: short dark hair and round glasses.
export function NecoAstronaut({ photo }: { photo?: string }) {
  const hair = {
    fill: '#2a211d',
    stroke: ink,
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Astronaut
      photo={photo}
      id="neco"
      className="neco"
      accent="#5ee7ff"
      mirror
      face={
        <>
          <ellipse
            cx="70"
            cy="96"
            rx="5"
            ry="7"
            fill="#e2ad84"
            stroke={ink}
            strokeWidth="1.5"
          />
          <ellipse
            cx="130"
            cy="96"
            rx="5"
            ry="7"
            fill="#e2ad84"
            stroke={ink}
            strokeWidth="1.5"
          />
          <ellipse
            cx="100"
            cy="92"
            rx="30"
            ry="31"
            fill="#e2ad84"
            stroke={ink}
            strokeWidth="2"
          />
          <path
            d="M68 82 L72 56 L82 64 L88 46 L97 60 L104 44 L111 60 L119 48 L123 64 L131 56 L132 82 C124 72 114 68 100 68 C86 68 76 72 68 82 Z"
            {...hair}
          />
          <path
            d="M82 80 Q88 76 95 79 M105 79 Q112 76 118 80"
            stroke="#1a1412"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="88" cy="94" rx="4.5" ry="6" fill="#2a1a12" />
          <ellipse cx="112" cy="94" rx="4.5" ry="6" fill="#2a1a12" />
          <circle cx="86.5" cy="91.5" r="2" fill="#fff" />
          <circle cx="110.5" cy="91.5" r="2" fill="#fff" />
          <circle
            cx="88"
            cy="94"
            r="11"
            fill="#cfe9ff"
            fillOpacity="0.2"
            stroke="#141218"
            strokeWidth="3"
          />
          <circle
            cx="112"
            cy="94"
            r="11"
            fill="#cfe9ff"
            fillOpacity="0.2"
            stroke="#141218"
            strokeWidth="3"
          />
          <path d="M99 94 L101 94" stroke="#141218" strokeWidth="3" />
          <path
            d="M82 88 l5 -5 M106 88 l5 -5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M93 110 Q100 115 107 110"
            stroke={ink}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </>
      }
    />
  );
}

// Big glossy anime cat eyes.
function CatEye({
  x,
  y,
  iris,
  deep,
}: {
  x: number;
  y: number;
  iris: string;
  deep: string;
}) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y}
        rx="6.5"
        ry="8"
        fill={iris}
        stroke={ink}
        strokeWidth="1.5"
      />
      <path
        d={`M${x - 6} ${y - 2} A6.5 8 0 0 1 ${x + 6} ${y - 2} Z`}
        fill={deep}
        opacity="0.6"
      />
      <ellipse cx={x} cy={y + 0.5} rx="2.4" ry="6" fill="#141218" />
      <circle cx={x - 2.2} cy={y - 3.5} r="2.4" fill="#fff" />
      <circle cx={x + 2.2} cy={y + 4} r="1.1" fill="#fff" />
    </>
  );
}

function Whiskers({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9">
      <path
        d={`M${x - 10} ${y} L${x - 30} ${y - 4} M${x - 10} ${y + 3} L${x - 29} ${y + 6}`}
      />
      <path
        d={`M${x + 10} ${y} L${x + 30} ${y - 4} M${x + 10} ${y + 3} L${x + 29} ${y + 6}`}
      />
    </g>
  );
}

// Piso: a slim grey tabby with a white muzzle, flying an anime flying
// saucer the opposite way to Mia.
export function PisoShip({ photo }: { photo?: string }) {
  const line = {
    stroke: ink,
    strokeWidth: 2.2,
    strokeLinejoin: 'round' as const,
  };
  return (
    <div className="piso-ship">
      <svg viewBox="0 0 220 186" aria-hidden="true">
        <defs>
          <linearGradient id="piso-hullgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fffd9" />
            <stop offset="0.5" stopColor="#1fb683" />
            <stop offset="1" stopColor="#0a4f3c" />
          </linearGradient>
          <clipPath id="piso-glass">
            <path d="M60 102 A50 64 0 0 1 160 102 Z" />
          </clipPath>
          <clipPath id="piso-face">
            <circle cx="110" cy="72" r="32" />
          </clipPath>
        </defs>
        {/* striped tractor beam */}
        <g className="piso-beam">
          <path
            d="M88 122 L132 122 L172 186 L48 186 Z"
            fill="#b9ffd9"
            opacity="0.45"
          />
          <path
            d="M80 138 L140 138 M70 156 L150 156 M60 174 L160 174"
            stroke="#fff"
            strokeWidth="3"
            opacity="0.4"
          />
        </g>
        {/* antennae */}
        <path
          d="M84 46 L72 18 M136 46 L148 18"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx="71"
          cy="15"
          r="3.5"
          fill="#ff4f9a"
          stroke={ink}
          strokeWidth="2"
        />
        <circle
          cx="149"
          cy="15"
          r="3.5"
          fill="#ffc93c"
          stroke={ink}
          strokeWidth="2"
        />
        {/* Piso in the dome */}
        <path d="M60 102 A50 64 0 0 1 160 102 Z" fill="#163a5c" />
        <g clipPath="url(#piso-glass)">
          {photo ? (
            <>
              <image
                href={photo}
                x="78"
                y="40"
                width="64"
                height="64"
                clipPath="url(#piso-face)"
                preserveAspectRatio="xMidYMid slice"
              />
              <circle
                cx="110"
                cy="72"
                r="32"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.7"
                strokeWidth="2"
              />
            </>
          ) : (
            <>
              <path
                d="M84 62 L78 30 L102 50 Z"
                fill="#8a929e"
                stroke={ink}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M136 62 L142 30 L118 50 Z"
                fill="#8a929e"
                stroke={ink}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M86 56 L83 38 L96 50 Z" fill="#f2a5b4" />
              <path d="M134 56 L137 38 L124 50 Z" fill="#f2a5b4" />
              <ellipse
                cx="110"
                cy="76"
                rx="32"
                ry="27"
                fill="#8a929e"
                stroke={ink}
                strokeWidth="2"
              />
              <path
                d="M128 56 Q142 72 136 92 Q130 82 124 60 Z"
                fill="#6f7782"
              />
              <path
                d="M101 52 L103 63 M110 50 L110 63 M119 52 L117 63"
                stroke="#59606a"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M110 76 C98 78 90 88 94 98 C100 106 120 106 126 98 C130 88 122 78 110 76 Z"
                fill="#fff"
              />
              <CatEye x={98} y={76} iris="#c6d35e" deep="#7d8a2a" />
              <CatEye x={122} y={76} iris="#c6d35e" deep="#7d8a2a" />
              <path
                d="M106 88 L114 88 L110 92 Z"
                fill="#f28fa5"
                stroke={ink}
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <path
                d="M110 92 Q107 96 104 94 M110 92 Q113 96 116 94"
                stroke={ink}
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
              <Whiskers x={110} y={92} />
            </>
          )}
          <path
            d="M60 102 A50 64 0 0 1 160 102 Z"
            fill="#bfffe6"
            opacity="0.12"
          />
        </g>
        <path d="M60 102 A50 64 0 0 1 160 102" fill="none" {...line} />
        <path
          d="M74 76 Q78 54 96 44"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <circle cx="74" cy="88" r="3" fill="#fff" opacity="0.8" />
        {/* cel-shaded saucer with a glowing rim of lights */}
        <ellipse
          cx="110"
          cy="108"
          rx="104"
          ry="24"
          fill="url(#piso-hullgrad)"
          {...line}
        />
        <path
          d="M8 104 A104 18 0 0 1 212 104 A104 12 0 0 1 8 104 Z"
          fill="#39e0a5"
        />
        <path
          d="M30 98 Q110 86 190 98"
          stroke="#d6fff0"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx="110"
          cy="124"
          rx="34"
          ry="10"
          fill="#0d6e52"
          stroke={ink}
          strokeWidth="2.5"
        />
        {/* cyan neon rim under the saucer */}
        <path
          className="rim-light"
          d="M10 112 A104 22 0 0 0 210 112"
          stroke="#5ee7ff"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          color="#5ee7ff"
        />
        <g className="piso-lights" stroke={ink} strokeWidth="1.5">
          <circle cx="30" cy="112" r="5.5" fill="#ffc93c" />
          <circle cx="62" cy="119" r="5.5" fill="#ff4f9a" />
          <circle cx="94" cy="122" r="5.5" fill="#19c3d6" />
          <circle cx="126" cy="122" r="5.5" fill="#ffc93c" />
          <circle cx="158" cy="119" r="5.5" fill="#ff4f9a" />
          <circle cx="190" cy="112" r="5.5" fill="#19c3d6" />
        </g>
      </svg>
    </div>
  );
}

// Mia flies a sleek anime starfighter: white and pink hull, bubble canopy,
// swept wings and a layered thruster flame with speed lines.
export function MiaShip({ photo }: { photo?: string }) {
  const line = {
    stroke: ink,
    strokeWidth: 2.2,
    strokeLinejoin: 'round' as const,
  };
  return (
    <div className="mia-ship">
      <svg viewBox="0 0 260 150" aria-hidden="true">
        <defs>
          <linearGradient id="mia-hullgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#e2e4f8" />
            <stop offset="1" stopColor="#a9afd9" />
          </linearGradient>
          <linearGradient id="mia-winggrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="1" stopColor="#4c1fd1" />
          </linearGradient>
          <radialGradient id="mia-bloom">
            <stop offset="0" stopColor="#fff2b0" stopOpacity="0.85" />
            <stop offset="0.4" stopColor="#ff8a3d" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ff5fc8" stopOpacity="0" />
          </radialGradient>
          <clipPath id="mia-glass">
            <path d="M106 70 A44 48 0 0 1 194 70 Z" />
          </clipPath>
          <clipPath id="mia-face">
            <circle cx="150" cy="48" r="26" />
          </clipPath>
        </defs>
        <g
          className="mia-speed"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        >
          <path d="M4 60 L40 60 M0 104 L32 104 M14 118 L44 118 M10 46 L30 46" />
        </g>
        {/* layered thruster flame */}
        {/* engine bloom behind the flame */}
        <circle cx="58" cy="82" r="34" fill="url(#mia-bloom)" />
        <g className="mia-flame">
          <path
            d="M66 64 C44 66 26 74 6 82 C26 88 44 96 66 100 Z"
            fill="#ff7a2e"
            stroke={ink}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M66 70 C50 72 38 77 24 82 C38 86 50 91 66 94 Z"
            fill="#ffd23f"
          />
          <path
            d="M66 75 C58 76 50 79 42 82 C50 84 58 87 66 89 Z"
            fill="#fff"
          />
        </g>
        {/* far wing, hull, cel shadow, pink stripe and nose */}
        <path d="M100 66 L84 34 L114 36 L136 64 Z" fill="#c7b8ff" {...line} />
        <rect
          x="58"
          y="66"
          width="16"
          height="34"
          rx="5"
          fill="#5b2ee0"
          {...line}
        />
        <path
          d="M66 64 C100 52 170 50 214 66 C232 72 244 78 252 82 C244 86 232 92 214 98 C170 114 100 112 66 100 Z"
          fill="url(#mia-hullgrad)"
          {...line}
        />
        <path
          d="M72 94 C110 106 170 106 214 96 C230 91 242 86 250 83 C244 87 232 92 214 98 C170 114 100 112 68 100 Z"
          fill="#d6d0f5"
        />
        <path
          d="M84 78 C120 72 170 72 222 78 L220 86 C170 81 122 81 86 87 Z"
          fill="#ff4f9a"
          stroke={ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M226 72 C238 76 246 80 252 82 C246 84 238 88 226 92 C230 86 230 78 226 72 Z"
          fill="#ff4f9a"
          stroke={ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M112 95 L168 95"
          stroke="#5ee7ff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* pink neon underglow along the hull */}
        <path
          className="rim-light"
          d="M72 101 C110 113 172 112 216 98"
          stroke="#ff5fc8"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          color="#ff5fc8"
        />
        {/* near wing with a yellow stripe */}
        <path
          d="M112 100 L96 136 L134 132 L156 102 Z"
          fill="url(#mia-winggrad)"
          {...line}
        />
        <path d="M120 106 L110 126 L126 124 L140 106 Z" fill="#ffc93c" />
        {/* bubble canopy with Mia */}
        <path d="M106 70 A44 48 0 0 1 194 70 Z" fill="#163a5c" />
        <g clipPath="url(#mia-glass)">
          {photo ? (
            <>
              <image
                href={photo}
                x="124"
                y="22"
                width="52"
                height="52"
                clipPath="url(#mia-face)"
                preserveAspectRatio="xMidYMid slice"
              />
              <circle
                cx="150"
                cy="48"
                r="26"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.7"
                strokeWidth="2"
              />
            </>
          ) : (
            <>
              <path
                d="M128 42 L122 16 L144 32 Z"
                fill="#7f8794"
                stroke={ink}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M172 42 L178 16 L156 32 Z"
                fill="#7f8794"
                stroke={ink}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M130 37 L127 23 L139 32 Z" fill="#f2a5b4" />
              <path d="M170 37 L173 23 L161 32 Z" fill="#f2a5b4" />
              <ellipse
                cx="150"
                cy="54"
                rx="30"
                ry="25"
                fill="#8a929e"
                stroke={ink}
                strokeWidth="2"
              />
              <path
                d="M166 36 Q180 50 176 70 Q170 60 162 40 Z"
                fill="#737b88"
              />
              <CatEye x={139} y={52} iris="#f5b623" deep="#b86e00" />
              <CatEye x={161} y={52} iris="#f5b623" deep="#b86e00" />
              <path
                d="M146.5 63 L153.5 63 L150 67 Z"
                fill="#6b5a63"
                stroke={ink}
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <path
                d="M150 67 Q147 71 144 69 M150 67 Q153 71 156 69"
                stroke={ink}
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
              <Whiskers x={150} y={66} />
            </>
          )}
          <path
            d="M106 70 A44 48 0 0 1 194 70 Z"
            fill="#cdeaff"
            opacity="0.12"
          />
        </g>
        <path d="M106 70 A44 48 0 0 1 194 70" fill="none" {...line} />
        <path
          d="M118 52 Q124 34 142 26"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <circle cx="116" cy="62" r="3" fill="#fff" opacity="0.85" />
        <path
          d="M176 40 L184 52 M171 44 L177 53"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M190 22 Q190 27 195 27 Q190 27 190 32 Q190 27 185 27 Q190 27 190 22 Z"
          fill="#fff"
        />
      </svg>
    </div>
  );
}

// A meteor shower: streaks fanning out from the top right in the colours of
// burning metals. [left %, top %, angle, colour, delay s]
const shower: [number, number, number, string, number][] = [
  [82, 4, -32, '#b8ffc4', 0],
  [60, 2, -40, '#ffc2ec', 1.4],
  [96, 18, -26, '#fff2a8', 2.9],
  [70, 12, -36, '#a8f0ff', 4.1],
  [90, 34, -22, '#ffffff', 5.6],
  [50, 6, -46, '#fff2a8', 6.8],
  [98, 46, -18, '#ffc2ec', 8.2],
  [76, 24, -30, '#b8ffc4', 9.5],
  [40, 3, -52, '#a8f0ff', 10.7],
  [88, 8, -34, '#ffffff', 12.1],
];

export function SkyEffects() {
  return (
    <div className="sky-effects" aria-hidden="true">
      {shower.map(([left, top, angle, color, delay], i) => (
        <span
          key={i}
          className="shooting-star"
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              '--angle': `${angle}deg`,
              '--color': color,
              animationDelay: `${delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="meteor meteor-big">
        <span className="rock" />
      </span>
      <span className="meteor meteor-small">
        <span className="rock" />
      </span>
    </div>
  );
}
