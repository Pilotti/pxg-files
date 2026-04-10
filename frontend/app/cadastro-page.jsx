import { useState } from "react"
import { Link, useNavigate } from "@/lib/react-router-compat"
import LanguageSelector from "@/components/language-selector.jsx"
import { useI18n } from "@/context/i18n-context.jsx"
import { useAuth } from "../context/auth-context.jsx"
import { useUI } from "../context/ui-context.jsx"
import "../styles/auth-page.css"

export default function CadastroPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { runBlockingTask, showError } = useUI()
  const { t } = useI18n()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    const formData = new FormData(event.currentTarget)

    const displayName = String(formData.get("displayName") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")

    if (!displayName) {
      setError(t("auth.errors.missingDisplayName"))
      return
    }

    if (!email) {
      setError(t("auth.errors.missingEmail"))
      return
    }

    if (!password) {
      setError(t("auth.errors.missingPassword"))
      return
    }

    if (!confirmPassword) {
      setError(t("auth.errors.missingConfirmPassword"))
      return
    }

    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"))
      return
    }

    setIsSubmitting(true)

    try {
      await runBlockingTask(async () => {
        await register({ displayName, email, password })
        navigate("/inicio", { replace: true })
      }, {
        title: t("auth.waitTitle"),
        text: t("auth.registerWait"),
        minDuration: 1000,
      })
    } catch (err) {
      const message = err.message || t("auth.errors.registerFailed")
      setError(message)
      showError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="page__inner">
        <div className="auth-page__layout">
          <section className="auth-page__hero">
            <div className="auth-page__hero-content">
              <LanguageSelector className="auth-page__language-selector" />
              <h1 className="auth-page__title">{t("auth.registerTitle")}</h1>
              <p className="auth-page__description">
                {t("auth.registerDescription")}
              </p>
            </div>
          </section>

          <section className="auth-page__card">
            <div className="auth-page__card-header">
              <h2 className="auth-page__card-title">{t("auth.registerCardTitle")}</h2>
              <p className="auth-page__card-description">
                {t("auth.registerCardDescription")}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="displayName">
                  {t("auth.displayName")}
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  className="auth-form__input"
                  autoComplete="name"
                  defaultValue=""
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="email">
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="auth-form__input"
                  autoComplete="email"
                  defaultValue=""
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="password">
                  {t("auth.password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-form__input"
                  autoComplete="new-password"
                  defaultValue=""
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="confirmPassword">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="auth-form__input"
                  autoComplete="new-password"
                  defaultValue=""
                  disabled={isSubmitting}
                />
              </div>

              {error && <p className="auth-form__error">{error}</p>}

              <button
                type="submit"
                className="auth-form__submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("auth.creating") : t("auth.createAccount")}
              </button>
            </form>

            <p className="auth-page__footer">
              {t("auth.alreadyAccount")} <Link to="/login">{t("auth.enter")}</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
