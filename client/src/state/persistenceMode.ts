import type { Project } from '../domain/types'
export type CloudPersistence = {
  projectId: string
  save: (project: Project) => Promise<void>
  loadSource: (id: string) => Promise<Blob | undefined>
  saveSource: (id: string, blob: Blob) => Promise<void>
}
let cloud: CloudPersistence | undefined
export const cloudPersistence = () => cloud
export function setCloudPersistence(next?: CloudPersistence) {
  cloud = next
}
