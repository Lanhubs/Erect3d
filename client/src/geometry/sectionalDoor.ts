export function sectionalPanelPose(height: number, panelCenter: number, progress: number) {
  const radius = Math.min(0.28, height * 0.15),
    corner = height - radius,
    arc = (Math.PI * radius) / 2
  const s = panelCenter + Math.max(0, Math.min(1, progress)) * (height + 0.35)
  if (s <= corner) return { y: s, z: 0, rotation: 0 }
  if (s < corner + arc) {
    const angle = (s - corner) / radius
    return { y: corner + radius * Math.sin(angle), z: -radius * (1 - Math.cos(angle)), rotation: -angle }
  }
  return { y: height, z: -radius - (s - corner - arc), rotation: -Math.PI / 2 }
}
