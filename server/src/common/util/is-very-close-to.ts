export const isVeryCloseTo = (a: number, b: number) => {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const norm = Math.abs(a) + Math.abs(b);
  return norm === 0 ? diff < 1e-6 : diff / norm < 1e-6;
};
