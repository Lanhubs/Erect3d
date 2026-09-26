import type { Project } from '../domain/types'

export type Unit = Project['units']
const factors: Record<Unit, number> = { m: 1, cm: 100, mm: 1000 }
export const toDisplay = (metres: number, unit: Unit) => metres * factors[unit]
export const toMetres = (value: number, unit: Unit) => value / factors[unit]
export const formatDistance = (metres: number, unit: Unit) => `${toDisplay(metres, unit).toFixed(unit === 'm' ? 2 : 0)} ${unit}`
export const formatArea = (squareMetres: number, unit: Unit) => `${(squareMetres * factors[unit] ** 2).toFixed(unit === 'm' ? 1 : 0)} ${unit}²`
