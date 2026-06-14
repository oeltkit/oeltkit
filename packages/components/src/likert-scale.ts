// Pure scale generation for <oelt-likert>, separated for DOM-free unit testing.
// See specs/components/likert.md §2.

export interface ScalePoint {
  value: string;
  label: string;
}

/**
 * Generate an N-point numeric scale (values "1".."N"). End anchors, when given,
 * are folded into the first/last labels (e.g. "1 — Very hard") so each end
 * point's accessible name carries its anchor. N < 2 falls back to 5.
 */
export function likertScale(n: number, lowLabel?: string, highLabel?: string): ScalePoint[] {
  const count = Number.isInteger(n) && n >= 2 ? n : 5;
  const points: ScalePoint[] = [];
  for (let i = 1; i <= count; i++) {
    let label = String(i);
    if (i === 1 && lowLabel) label = `${i} — ${lowLabel}`;
    else if (i === count && highLabel) label = `${i} — ${highLabel}`;
    points.push({ value: String(i), label });
  }
  return points;
}
