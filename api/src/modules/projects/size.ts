import type { Project } from '../../contracts/project'
import { ApiError } from '../../security/errors'

export function validateDocumentSize(document: Project, maximum: number) {
  // Upload limits bound one request; this also bounds growth accumulated across many small edits.
  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > maximum) {
    throw new ApiError(413, 'PROJECT_TOO_LARGE', 'This project exceeds the configured document capacity')
  }
}
