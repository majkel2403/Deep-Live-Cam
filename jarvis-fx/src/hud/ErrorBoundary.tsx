import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
  fallback?: (error: Error, reset: () => void) => ReactNode
}

/** Keeps one broken effect/widget from taking down the whole HUD. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[jx] ${this.props.label ?? 'component'} crashed:`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div role="alert" className="h-full w-full grid place-items-center p-4 text-center">
        <div>
          <p className="jx-label text-jx-danger">Błąd modułu{this.props.label ? ` · ${this.props.label}` : ''}</p>
          <p className="jx-num text-xs text-jx-dim mt-1 max-w-sm break-words">{error.message}</p>
          <button className="jx-aug-btn mt-3 px-3 py-1 text-xs" data-augmented-ui="tl-clip br-clip border" onClick={this.reset}>
            Ponów
          </button>
        </div>
      </div>
    )
  }
}
