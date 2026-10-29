import type { Project } from '../../contracts/project'
import { projectSchema } from '../../contracts/project'
import { editCommand, type AssistantScope, type EditCommand } from '../../contracts/assistant'
import { defaultRoof, uid, type EntityKind } from '../../../../client/src/domain/types'
import { blankLevel, duplicateLevel } from '../../../../client/src/domain/levels'
import { detachTypicalFloor } from '../../../../client/src/domain/typicalFloors'
import { transformElement } from '../../../../client/src/domain/elementEditing'
import { schemas, collections, findTarget, parseProperties, type Kind } from './entities'
import { scopeContext, permitTarget } from './scope'
import { connectStair } from './stair'
import { ApiError } from '../../security/errors'
import { validateLockedLevels } from '../projects/locked-levels'
import { validateGeometry } from '../projects/geometry-validation'
import { documentChanges } from '../../../client'
import { validateEdits } from './validation'
import { setBuildingRoof } from '../../../../client/src/domain/roofDesign'
import { effectiveRoofSections } from '../../../../client/src/domain/roofCoverage'
import { protectedFields, levelFields } from './edit-fields'
import type { buildingCreationBrief } from '../../../../client/src/domain/assistantCreation'
export class EditWorkspace {
  document: Project
  descriptions: string[] = []
  allowed: Set<string>
  creation?: ReturnType<typeof buildingCreationBrief>
  focusLevelId?: string
  constructor(
    readonly original: Project,
    readonly scope: AssistantScope,
  ) {
    this.scope = { ...scope }
    this.document = structuredClone(original)
    this.allowed = scopeContext(original, scope).allowed
  }
  apply(raw: unknown) {
    const command = editCommand.parse(raw),
      result = this.execute(command)
    this.descriptions.push(`${command.action} ${'kind' in command ? command.kind : 'floor'}`)
    return result
  }
  private execute(command: EditCommand): unknown {
    const { building } = scopeContext(this.document, this.scope)
    if (command.action === 'create') {
      const level = building.levels.find((l) => l.id === command.levelId)
      if (!level || level.locked)
        throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose an unlocked target floor')
      const properties = parseProperties(command.properties)
      if (Object.keys(properties).some((k) => protectedFields.has(k)))
        throw new ApiError(422, 'ASSISTANT_PROPERTIES', 'IDs, sources and locks are managed by the editor')
      const selectedRoom =
        this.scope.mode === 'selection' &&
        this.allowed.has(String(properties.roomId)) &&
        command.kind === 'furniture'
      if (
        (this.scope.mode !== 'building' && this.scope.levelId !== level.id && !this.allowed.has(level.id)) ||
        (this.scope.mode === 'selection' && !selectedRoom && !this.allowed.has(level.id))
      )
        throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose This floor to add model elements')
      const id = uid(command.kind)
      if (command.kind === 'level') {
        if (this.scope.mode !== 'building')
          throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose Whole building to add floors')
        const next = schemas.level.parse({
          ...blankLevel(
            String(properties.name || 'New floor'),
            Number(properties.elevation),
            Number(properties.floorToFloorHeight || 3),
          ),
          ...properties,
          id,
        })
        building.levels.push(next)
        return next
      }
      if (command.kind === 'roof' || command.kind === 'fence')
        throw new ApiError(422, 'ASSISTANT_PROPERTIES', 'Use set for the roof or create a roof-section')
      const value = schemas[command.kind].parse({
        ...properties,
        id,
        ...(command.kind === 'furniture' ? { levelId: level.id } : {}),
      })
      if (command.kind === 'system') {
        if ((value as any).levelId !== level.id)
          throw new ApiError(422, 'ASSISTANT_SCOPE', 'System must belong to the target floor')
        building.systems ||= { version: 1, typology: 'unknown', systems: [] }
        building.systems.systems.push(value as any)
      } else if (command.kind === 'roof-section') {
        if ((value as any).levelId !== level.id)
          throw new ApiError(422, 'ASSISTANT_SCOPE', 'Roof section must belong to the target floor')
        ;(building.roofSections ||= []).push(value as any)
      } else {
        const field = collections[command.kind]
        ;((level as any)[field] ||= []).push(value)
      }
      this.allowed.add(id)
      return value
    }
    if (command.action === 'connect-stair') {
      const target = findTarget(this.document, 'level', command.levelId)
      permitTarget(this.scope, target, this.allowed)
      connectStair(this.document, building, command)
      return { connected: true }
    }
    const kind: Kind =
      command.action === 'duplicate-level'
        ? 'level'
        : command.action === 'detach-floor'
          ? 'system'
          : command.kind
    const target = findTarget(this.document, kind, command.id)
    permitTarget(this.scope, target, this.allowed)
    if (
      this.scope.floorIndex !== undefined &&
      command.id === this.scope.entityId &&
      target.value?.kind === 'typical-floors' &&
      command.action !== 'detach-floor'
    )
      throw new ApiError(422, 'ASSISTANT_SCOPE', 'Detach the selected linked floor before editing it')
    if (command.action === 'detach-floor') {
      if (
        this.scope.mode === 'selection' &&
        this.scope.floorIndex !== undefined &&
        command.index !== this.scope.floorIndex
      )
        throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose the selected floor instance')
      this.document = detachTypicalFloor(this.document, building.id, command.id, command.index)
      const owner = this.document.buildings.find((b) => b.id === building.id)!,
        group = owner.systems!.systems.find((s) => s.id === command.id)!
      if (group.kind !== 'typical-floors')
        throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose a linked floor group')
      const detached = owner.levels.find((l) => l.id === group.detached[String(command.index)])!
      this.allowed.add(detached.id)
      for (const c of Object.values(collections)) for (const e of detached[c] || []) this.allowed.add(e.id)
      return detached
    }
    if (command.action === 'duplicate-level') {
      if (this.scope.mode !== 'building')
        throw new ApiError(422, 'ASSISTANT_SCOPE', 'Choose Whole building to add floors')
      const next = duplicateLevel(target.value, command.name, command.elevation)
      building.levels.push(next)
      return next
    }
    if (command.action === 'transform') {
      const { action, kind, id, ...change } = command
      const local = { ...this.document, buildings: [building] },
        result = transformElement(
          local,
          { kind: (kind === 'system' ? 'architecture' : kind) as EntityKind, id },
          change,
        )
      if (result.issue) throw new ApiError(422, 'ASSISTANT_GEOMETRY', result.issue)
      this.document.buildings = this.document.buildings.map((b) =>
        b.id === building.id ? result.project.buildings[0] : b,
      )
      return { updated: id }
    }
    if (command.action === 'remove') {
      if (kind === 'roof') delete target.parent[target.key]
      else if (Array.isArray(target.parent)) target.parent.splice(Number(target.key), 1)
      else delete target.parent[target.key]
      if (kind === 'wall' && target.level)
        for (const field of ['doors', 'windows', 'passages'] as const)
          (target.level as any)[field] = target.level[field]?.filter((o) => o.wallId !== command.id)
      return { removed: command.id }
    }
    const properties = parseProperties(command.properties)
    for (const key of Object.keys(properties))
      if (protectedFields.has(key) || (kind === 'level' && !levelFields.has(key))) {
        if (JSON.stringify(properties[key]) === JSON.stringify(target.value?.[key])) delete properties[key]
        else
          throw new ApiError(
            422,
            'ASSISTANT_PROPERTIES',
            'Use semantic edit tools for these properties; set accepts changed editable fields only, without IDs or locks',
          )
      }
    if (
      ('levelId' in properties && properties.levelId !== target.value?.levelId) ||
      ('fromLevelId' in properties && properties.fromLevelId !== target.value?.fromLevelId)
    )
      throw new ApiError(422, 'ASSISTANT_SCOPE', 'An element cannot be moved to another floor with set')
    const value = schemas[kind].parse({
      ...(kind === 'roof' && !target.value ? defaultRoof : target.value),
      ...properties,
    })
    if (kind === 'roof') {
      if (!target.level) setBuildingRoof(building, properties)
      else {
        if (!building.roofSections?.some((section) => section.levelId === target.level!.id)) {
          const derived = effectiveRoofSections(building).filter(
            (section) => section.levelId === target.level!.id,
          )
          ;(building.roofSections ||= []).push(
            ...derived.map((section) => ({ ...section, id: uid('roof-section') })),
          )
        }
        target.level.roof = value as any
        for (const section of building.roofSections || [])
          if (section.levelId === target.level.id)
            section.roof = schemas.roof.parse({ ...section.roof, ...properties })
      }
      return value
    }
    target.parent[target.key] = value
    return value
  }
  proposal() {
    const document = projectSchema.parse(this.document)
    validateLockedLevels(this.original, document)
    validateGeometry(document)
    validateEdits(this.original, document)
    const changes = documentChanges(this.original, document)
    if (!changes.length) throw new ApiError(422, 'ASSISTANT_EMPTY', 'No model changes were prepared')
    if (changes.length > 512) throw new ApiError(422, 'ASSISTANT_SIZE', 'Request a smaller group of changes')
    return {
      document,
      changes,
      descriptions: this.descriptions,
      allowedIds: [...this.allowed],
      ...(this.focusLevelId ? { focusLevelId: this.focusLevelId } : {}),
    }
  }
}
