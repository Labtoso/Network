/** Kleiner deterministischer Value-Noise (2D) fuer Stroemungsfelder, ohne Abhaengigkeiten. */
const PERM = (() => {
  const p = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  let seed = 1337;
  for (let i = 255; i > 0; i -= 1) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i += 1) p[i] = base[i & 255];
  return p;
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const grad = (hash: number, x: number, y: number) => {
  const h = hash & 3;
  return (h & 1 ? -x : x) + (h & 2 ? -y : y);
};

export function noise2(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];
  return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
}

export function pick(list: string): string;
export function pick<T>(list: readonly T[]): T;
export function pick<T>(list: readonly T[] | string): T | string {
  return list[Math.floor(Math.random() * list.length)];
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./g, "$&$&") : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export const KATAKANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ";
export const DIGITS = "0123456789";
export const HEX = "0123456789ABCDEF";
