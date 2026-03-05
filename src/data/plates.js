export const PLATES = [45, 35, 25, 10, 5, 2.5];

export const calcPlates = (total) => {
  let ps = (total - 45) / 2;
  if (ps <= 0) return total <= 45 ? [] : null;
  const r = [];
  for (const p of PLATES) {
    while (ps >= p) { r.push(p); ps -= p; }
  }
  return ps === 0 ? r : null;
};

export const toKg = (lbs) => Math.round(lbs * 0.4536 * 10) / 10;
export const toLbs = (kg) => Math.round(kg / 0.4536 * 10) / 10;
export const wUnit = (units) => units === "kg" ? "kg" : "lbs";
export const convW = (v, units) => units === "kg" ? toKg(v) : v;
