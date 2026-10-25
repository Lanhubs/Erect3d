import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './tooltips.css'

type Hint = { trigger: HTMLElement; text: string }

// One lightweight tooltip host; hovering tools never rerenders the workspace/model.
export function Tooltips() {
  const id = useId()
  const card = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let owner: HTMLElement | null = null
    const clear = () => clearTimeout(timer)
    const hide = () => {
      clear()
      owner = null
      setHint(null)
    }
    const target = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null
    const show = (trigger: HTMLElement, delay: number) => {
      if (owner === trigger) return
      clear()
      owner = trigger
      setHint(null)
      timer = setTimeout(() => {
        const text = trigger.dataset.tooltip
        if (text && trigger.isConnected) setHint({ trigger, text })
      }, delay)
    }
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const trigger = target(event.target)
      if (trigger) show(trigger, 400)
    }
    const out = (event: PointerEvent) => {
      if (
        owner &&
        !(event.relatedTarget instanceof Node && owner.contains(event.relatedTarget)) &&
        document.activeElement !== owner
      )
        hide()
    }
    const focus = (event: FocusEvent) => {
      const trigger = target(event.target)
      if (trigger?.matches(':focus-visible')) show(trigger, 0)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      clear()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  useLayoutEffect(() => {
    if (!hint || !card.current) return
    const trigger = hint.trigger.getBoundingClientRect()
    const box = card.current.getBoundingClientRect()
    const below = trigger.top < box.height + 18
    setPosition({
      left: Math.max(
        12,
        Math.min(trigger.left + trigger.width / 2 - box.width / 2, window.innerWidth - box.width - 12),
      ),
      top: Math.max(
        12,
        Math.min(
          below ? trigger.bottom + 8 : trigger.top - box.height - 8,
          window.innerHeight - box.height - 12,
        ),
      ),
    })
    const describedBy = hint.trigger.getAttribute('aria-describedby')
    hint.trigger.setAttribute('aria-describedby', [describedBy, id].filter(Boolean).join(' '))
    return () => {
      const remaining = hint.trigger
        .getAttribute('aria-describedby')
        ?.split(' ')
        .filter((value) => value !== id)
        .join(' ')
      if (remaining) hint.trigger.setAttribute('aria-describedby', remaining)
      else hint.trigger.removeAttribute('aria-describedby')
    }
  }, [hint, id])

  return (
    hint &&
    createPortal(
      <div ref={card} id={id} role="tooltip" className="tool-hint" style={position}>
        {hint.text}
      </div>,
      document.body,
    )
  )
}
