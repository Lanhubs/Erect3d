import './loadingState.css'
export function LoadingState({
  label,
  detail,
  compact = false,
}: {
  label: string
  detail?: string
  compact?: boolean
}) {
  return (
    <div className={`loading-state${compact ? ' compact' : ''}`} role="status" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
        <span />
      </div>
      <div>
        <strong>{label}</strong>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  )
}
