import { Component } from "react"
import { I18nContext } from "@/context/i18n-context.jsx"
import "../styles/error-boundary.css"

export default class ErrorBoundary extends Component {
  static contextType = I18nContext

  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const t = this.context?.t ?? ((key) => key)

    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <span className="error-boundary__eyebrow">{t("errorBoundary.eyebrow")}</span>
            <h1 className="error-boundary__title">{t("errorBoundary.title")}</h1>
            <p className="error-boundary__text">{t("errorBoundary.text")}</p>

            <button
              type="button"
              className="error-boundary__button"
              onClick={this.handleReload}
            >
              {t("errorBoundary.reload")}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
