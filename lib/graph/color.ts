// Deterministic hue from a seed, so related globs (a group, a kind) read as related
// without hardcoding a palette. Same seed always yields the same colour, no RNG.
export function hashColor(seed: string | null | undefined, fallback = "var(--muted, #8a8a8a)"): string {
  if (!seed) return fallback
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return `hsl(${Math.abs(hash) % 360}, 60%, 60%)`
}
