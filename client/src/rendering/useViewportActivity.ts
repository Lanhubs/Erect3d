import { useEffect, useState, type RefObject } from 'react'
export function useViewportActivity(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [visible, setVisible] = useState(true),
    [foreground, setForeground] = useState(() => !document.hidden)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries.some((entry) => entry.isIntersecting)),
    )
    observer.observe(ref.current)
    const change = () => setForeground(!document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', change)
    }
  }, [ref])
  return active && visible && foreground
}
