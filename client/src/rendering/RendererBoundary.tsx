import { Component, type ReactNode } from 'react'
// A failed renderer owns its canvas context. Recovery uses a new canvas,
// rather than requesting WebGL on a canvas already bound to WebGPU.
export class RendererBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
