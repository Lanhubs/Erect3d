import { documentChanges, type Project } from '../../../api/client'
import { atPath, patch } from './changes'
const related = (a: string[], b: string[]) =>
  a.slice(0, Math.min(a.length, b.length)).every((key, i) => key === b[i])
// Merge independent edits; overlapping changes require the existing conflict review.
export function mergeDraft(base: Project, draft: Project, remote: Project): Project | undefined {
  const local = documentChanges(base, draft),
    incoming = documentChanges(base, remote),
    remaining = []
  for (const change of local) {
    const current = atPath(remote, change.path)
    if (
      change.action === 'delete'
        ? current === undefined
        : JSON.stringify(current) === JSON.stringify(change.value)
    )
      continue
    if (incoming.some((other) => related(change.path, other.path))) return undefined
    remaining.push(change)
  }
  try {
    return patch(remote, remaining)
  } catch {
    return undefined
  }
}
