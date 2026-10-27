export const floatingMenus =
  '.studio-menu,.view-options,.cloud-session-menu,.graphics-preference,.reconstruction-popover'

/** Trigger and popup share a details element. Ignore touch and keyboard focus. */
export function installMenuDismissal(root: Document) {
  let keyboardFocus = false
  const timers = new Map<HTMLDetailsElement, ReturnType<typeof setTimeout>>()
  const clear = (menu: HTMLDetailsElement) => {
    clearTimeout(timers.get(menu))
    timers.delete(menu)
  }
  const out = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return
    const menu = event.target.closest<HTMLDetailsElement>(floatingMenus)
    if (!menu?.open || (event.relatedTarget instanceof Node && menu.contains(event.relatedTarget))) return
    clear(menu)
    timers.set(
      menu,
      setTimeout(() => {
        timers.delete(menu)
        const focused = root.activeElement,
          editing =
            focused instanceof Element &&
            focused.matches(
              'input:not([type=checkbox]):not([type=radio]),select,textarea,[contenteditable=true]',
            )
        if (!(menu.contains(focused) && (keyboardFocus || editing)) && !menu.matches(':hover'))
          menu.open = false
      }, 200),
    )
  }
  const over = (event: PointerEvent) => {
    if (event.target instanceof Element) {
      const menu = event.target.closest<HTMLDetailsElement>(floatingMenus)
      if (menu) clear(menu)
    }
  }
  const keyboard = () => {
    keyboardFocus = true
  }
  const down = (event: PointerEvent) => {
    keyboardFocus = false
    root.querySelectorAll<HTMLDetailsElement>(floatingMenus).forEach((menu) => {
      if (menu.open && event.target instanceof Node && !menu.contains(event.target)) {
        clear(menu)
        menu.open = false
      }
    })
  }
  root.addEventListener('pointerout', out)
  root.addEventListener('pointerover', over)
  root.addEventListener('keydown', keyboard, true)
  root.addEventListener('pointerdown', down)
  return () => {
    timers.forEach(clearTimeout)
    root.removeEventListener('pointerout', out)
    root.removeEventListener('pointerover', over)
    root.removeEventListener('keydown', keyboard, true)
    root.removeEventListener('pointerdown', down)
  }
}
