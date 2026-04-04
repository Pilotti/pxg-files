import { Component } from "react"
import "../styles/error-boundary.css"

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erro não tratado na interface:", error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <span className="error-boundary__eyebrow">Erro inesperado</span>
            <h1 className="error-boundary__title">A interface encontrou uma falha.</h1>
            <p className="error-boundary__text">
              Recarregue a aplicação para restaurar o estado. Se o problema continuar,
              vale revisar a última alteração feita nesta tela.
            </p>

            <button
              type="button"
              className="error-boundary__button"
              onClick={this.handleReload}
            >
              Recarregar aplicação
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
