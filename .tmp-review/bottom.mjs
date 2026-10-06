import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(readFileSync(process.argv[2]));
const { width: W, height: H, data } = png;
const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};
const c = (v) => v.join(',');

const rows = [];
for (let y = H - 420; y < H; y += 8) rows.push(y);
const cols = [10, 30, 45, 90, 200, 340, 540, 740, 880, 990, 1035, 1050, 1070];

console.log('y     ' + cols.map((x) => String(x).padStart(12)).join(''));
for (const y of rows) {
  console.log(String(y).padStart(5) + ' ' + cols.map((x) => c(px(x, y)).padStart(12)).join(''));
}
