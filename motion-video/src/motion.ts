export const clamp = (v: number) => Math.max(0, Math.min(1, v))
export const ease = (v: number) => {
  const x = clamp(v)
  return x * x * x * (x * (x * 6 - 15) + 10)
}
export const progress = (t: number, a: number, b: number) => ease((t - a) / (b - a))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const envelope = (t: number, a: number, b: number, fade = 0.35) =>
  progress(t, a, a + fade) * (1 - progress(t, b - fade, b))
