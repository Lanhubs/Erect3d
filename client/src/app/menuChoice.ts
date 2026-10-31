import type { MouseEvent } from 'react'

export type WorkspaceMode = 'edit' | 'analyze' | 'present'

export function choose(event: MouseEvent<HTMLButtonElement>, action: () => void) {
  const menu = event.currentTarget.closest('details')
  if (menu) {
    menu.open = false
    menu.querySelector('summary')?.focus()
  }
  action()
}
