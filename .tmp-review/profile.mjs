import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(readFileSync(process.argv[2]));
const { width: W, height: H, data } = png;
const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};

console.log(`image ${W}x${H}`);
for (let y = 0; y < H; y += 40) {
  const l = px(60, y).join(',').padEnd(12);
  const c = px(W >> 1, y).join(',').padEnd(12);
  const r = px(W - 60, y).join(',');
  console.log(String(y).padStart(4), 'L:', l, 'C:', c, 'R:', r);
}
