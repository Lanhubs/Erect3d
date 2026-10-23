import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
export function architecturalMaterial(key: string, color: string) {
  if (key === 'window-glass' || key === 'frosted-glass')
    return new MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: key === 'frosted-glass' ? 0.48 : 0.08,
      ior: 1.5,
      thickness: 0.008,
      transparent: true,
      opacity: key === 'frosted-glass' ? 0.76 : 0.3,
      depthWrite: false,
    })
  if (key === 'facade-glass')
    return new MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.12,
      ior: 1.5,
      thickness: 0.012,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  if (key === 'glass')
    return new MeshPhysicalMaterial({
      color,
      metalness: 0.02,
      roughness: 0.12,
      ior: 1.5,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  const roughness =
    key === 'metal'
      ? 0.34
      : key === 'timber'
        ? 0.68
        : key === 'stone'
          ? 0.72
          : key === 'seat'
            ? 0.52
            : key === 'render'
              ? 0.92
              : 0.86
  return new MeshStandardMaterial({ color, roughness, metalness: key === 'metal' ? 0.65 : 0 })
}
