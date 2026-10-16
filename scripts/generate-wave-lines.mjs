/**
 * Gera public/textures/wave-lines.svg: linhas finas paralelas que ondulam juntas (textura dos fundos do hero e do Percurso).
 * O SVG é usado como máscara em CSS (ver .texture em src/styles/global.css), por isso a cor vem do tema e não daqui.
 * Determinístico: correr outra vez dá o mesmo ficheiro. Uso: node scripts/generate-wave-lines.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const width = 1440;
const height = 800;
const lines = 34;
const step = 40; // distância horizontal entre pontos; as curvas são suavizadas com Catmull-Rom
const gap = height / lines;

const y = (x, i) => {
  // a amplitude cresce no meio do conjunto, para as linhas se juntarem e afastarem como um tecido
  const swell = 0.45 + 0.55 * Math.sin((i / (lines - 1)) * Math.PI);
  return (
    gap * (i + 0.5) +
    48 * swell * Math.sin((2 * Math.PI * x) / 1150 + i * 0.16) +
    14 * Math.sin((2 * Math.PI * x) / 390 + i * 0.33 + 0.8)
  );
};

const round = (n) => Math.round(n); // 1 px de precisão chega para linhas finas e reduz o ficheiro

function path(i) {
  const pts = [];
  for (let x = -step; x <= width + step; x += step) pts.push([x, y(x, i)]);
  let d = `M${round(pts[1][0])} ${round(pts[1][1])}`;
  for (let k = 1; k < pts.length - 2; k++) {
    const [p0, p1, p2, p3] = [pts[k - 1], pts[k], pts[k + 1], pts[k + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d;
}

const paths = Array.from({ length: lines }, (_, i) => `<path d="${path(i)}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#000" stroke-width="1.2">${paths}</svg>\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), '../public/textures/wave-lines.svg');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, svg);
console.log(`${out} (${Math.round(svg.length / 1024)} KB)`);
