export function presentRun(run: any, revision?: number) {
  if (!run) return null
  const stale = run.status === 'ready' && revision !== undefined && revision !== Number(run.base_revision)
  const visible = Object.fromEntries(
    ['id', 'status', 'progress', 'scope', 'summary', 'failure_code', 'proposal', 'created_at']
      .filter((key) => run[key] !== undefined)
      .map((key) => [key, run[key]]),
  )
  return {
    ...visible,
    base_revision: Number(run.base_revision),
    applied_revision: run.applied_revision === null ? null : Number(run.applied_revision),
    ...(stale ? { status: 'stale', progress: 'The model changed. Prepare a new proposal.' } : {}),
  }
}
