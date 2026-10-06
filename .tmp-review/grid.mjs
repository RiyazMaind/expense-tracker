import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(readFileSync(process.argv[2]));
const { width: W, height: H, data } = png;
const COLS = 16;
const ROWS = 32;
const bw = Math.floor(W / COLS);
const bh = Math.floor(H / ROWS);

const hex = (v) => v.toString(16).padStart(2, '0');
for (let ry = 0; ry < ROWS; ry++) {
  const parts = [];
  for (let cx = 0; cx < COLS; cx++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = ry * bh; y < (ry + 1) * bh; y += 3) {
      for (let x = cx * bw; x < (cx + 1) * bw; x += 3) {
        const i = (y * W + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    parts.push(hex(Math.round(r / n)) + hex(Math.round(g / n)) + hex(Math.round(b / n)));
  }
  console.log(String(Math.round(ry * bh)).padStart(4), parts.join(' '));
}
