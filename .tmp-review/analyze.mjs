import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const file = process.argv[2];
const png = PNG.sync.read(readFileSync(file));
const { width: W, height: H, data } = png;

const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};

/** Mean RGB over a row segment. */
function rowMean(y, x0, x1) {
  let r = 0, g = 0, b = 0;
  const n = x1 - x0;
  for (let x = x0; x < x1; x++) {
    const [pr, pg, pb] = px(x, y);
    r += pr; g += pg; b += pb;
  }
  return [r / n, g / n, b / n];
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

console.log(`image ${W}x${H}`);

// Scan the lower 45% of the screen for a horizontal band brighter than the canvas.
const bg = [8, 11, 18];
const bgLum = lum(bg);
const y0 = Math.floor(H * 0.55);
const rows = [];
for (let y = y0; y < H; y++) {
  const [r, g, b] = rowMean(y, 60, W - 60);
  rows.push({ y, l: lum([r, g, b]), rgb: [Math.round(r), Math.round(g), Math.round(b)] });
}

// Report rows whose luminance sits clearly above the app canvas.
const band = rows.filter((row) => row.l > bgLum + 6);
if (band.length) {
  const top = band[0].y;
  const bottom = band[band.length - 1].y;
  console.log(`bright band rows ${top}..${bottom} (height ${bottom - top + 1}px)`);
  console.log('first rows:', band.slice(0, 4).map((r) => `${r.y}:${r.rgb}`).join(' '));
  console.log('last rows :', band.slice(-4).map((r) => `${r.y}:${r.rgb}`).join(' '));
} else {
  console.log('no bright band found in lower 45%');
}

// Sample the bar interior: mid-height of the band, avoiding centre Add button.
function profile(y) {
  const marks = [70, 140, 210, 300, 380, 470, W - 470, W - 380, W - 300, W - 210, W - 140, W - 70];
  return marks.map((x) => `${x}:${px(x, y).join(',')}`).join('  ');
}

if (band.length) {
  const midY = Math.floor((band[0].y + band[band.length - 1].y) / 2);
  console.log(`\ninterior profile @y=${midY}`);
  console.log('  ' + profile(midY));

  // Interior statistics (exclude the centre 26% where the Add button lives).
  const x0 = Math.floor(W * 0.06);
  const x1 = Math.floor(W * 0.36);
  let n = 0, r = 0, g = 0, b = 0;
  const ys = [];
  for (let y = band[0].y + 8; y <= band[band.length - 1].y - 8; y++) ys.push(y);
  for (const y of ys) {
    for (let x = x0; x < x1; x++) {
      const [pr, pg, pb] = px(x, y);
      r += pr; g += pg; b += pb; n++;
    }
  }
  const mean = [r / n, g / n, b / n];
  let vr = 0;
  for (const y of ys) {
    for (let x = x0; x < x1; x++) {
      const [pr, pg, pb] = px(x, y);
      vr += (pr - mean[0]) ** 2 + (pg - mean[1]) ** 2 + (pb - mean[2]) ** 2;
    }
  }
  const sd = Math.sqrt(vr / n);
  console.log(
    `\nleft-third interior mean ${mean.map((v) => v.toFixed(1)).join(',')}  stdev ${sd.toFixed(1)}`,
  );
  console.log(
    `expected pure fill over canvas rgba(19,25,38,0.85) => 17.4,22.9,35.0`,
  );

  // Border check: brightest pixel along the top edge of the band.
  let best = 0;
  let bestX = 0;
  for (let x = 40; x < W - 40; x++) {
    const l = lum(px(x, band[0].y + 1));
    if (l > best) { best = l; bestX = x; }
  }
  console.log(`top-edge brightest pixel ${best.toFixed(1)} at x=${bestX}`);

  // Shadow/falloff just below the bar.
  const below = [];
  for (let k = 2; k <= 26; k += 6) below.push(`${k}:${px(W / 2, band[band.length - 1].y + k).join(',')}`);
  console.log(`below bar: ${below.join('  ')}`);
}
