import { Component, ReactNode, ErrorInfo } from "react"

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State { return { hasError: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('🔴 BOUNDARY CAUGHT:', error.message)
    console.error('🔴 Stack:', error.stack)
    console.error('🔴 Component stack:', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-4 bg-background">
          <span className="text-xs text-muted">Something went wrong — refresh to recover</span>
        </div>
      )
    }
    return this.props.children
  }
}
