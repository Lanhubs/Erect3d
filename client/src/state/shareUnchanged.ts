// Project data is plain JSON. Reuse unchanged branches after an edit so geometry
// caches keep their identity when only furniture or saved viewpoints change.
export function shareUnchanged<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object'
    || Array.isArray(previous) !== Array.isArray(next)) return next
  const before = previous as Record<string, unknown>, after = next as Record<string, unknown>
  const keys = Object.keys(after), previousKeys = Object.keys(before)
  let unchanged = keys.length === previousKeys.length
  const result = (Array.isArray(next) ? [] : {}) as Record<string, unknown>
  for (const key of keys) {
    result[key] = shareUnchanged(before[key], after[key])
    if (!Object.hasOwn(before, key) || !Object.is(result[key], before[key])) unchanged = false
  }
  return unchanged ? previous : result as T
}
