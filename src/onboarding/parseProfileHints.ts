export type ParsedProfileHints = {
  age?: number;
  height_cm?: number;
  current_weight_kg?: number;
  goal_weight_kg?: number;
};

function parseFloatIt(s: string): number | undefined {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Estrae età, altezza, peso attuale e obiettivo da testo libero in italiano. */
export function parseProfileHints(text: string): ParsedProfileHints {
  const t = text.trim();
  if (!t) return {};

  const out: ParsedProfileHints = {};

  const ageM = t.match(/(\d+)\s*anni\b/i);
  if (ageM) {
    const a = parseInt(ageM[1], 10);
    if (a > 0 && a < 130) out.age = a;
  }

  const heightM = t.match(/(\d+)\s*cm\b/i);
  if (heightM) {
    const h = parseInt(heightM[1], 10);
    if (h > 50 && h < 260) out.height_cm = h;
  }

  const goalM = t.match(/obiettivo\s+(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (goalM) {
    const g = parseFloatIt(goalM[1]);
    if (g != null && g > 20 && g < 400) out.goal_weight_kg = g;
  }

  const kgMatches = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*kg\b/gi)];
  const kgVals = kgMatches
    .map((m) => parseFloatIt(m[1]))
    .filter((n): n is number => n != null && n > 20 && n < 400);

  if (out.goal_weight_kg != null) {
    const notGoal = kgVals.filter((v) => Math.abs(v - out.goal_weight_kg!) > 0.01);
    if (notGoal.length) {
      out.current_weight_kg = Math.max(...notGoal);
    }
  } else if (kgVals.length >= 2) {
    out.current_weight_kg = Math.max(...kgVals);
    out.goal_weight_kg = Math.min(...kgVals);
  } else if (kgVals.length === 1) {
    out.current_weight_kg = kgVals[0];
  }

  return out;
}
