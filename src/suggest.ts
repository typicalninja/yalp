function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** Closest candidate to `input`, or undefined if nothing is close enough. */
export function suggest(input: string, candidates: string[]): string | undefined {
  const limit = Math.max(2, Math.floor(input.length / 3));
  let best: string | undefined;
  let bestScore = Infinity;
  for (const c of candidates) {
    // An exact (case-sensitive) match isn't a typo: never suggest it back.
    if (c === input) continue;
    const d = distance(input.toLowerCase(), c.toLowerCase());
    if (d < bestScore && d <= limit) {
      best = c;
      bestScore = d;
    }
  }
  return best;
}
