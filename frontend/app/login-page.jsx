import { useState } from "react"
import { Link, useNavigate } from "@/lib/react-router-compat"
import { useAuth } from "../context/auth-context.jsx"
import { useUI } from "../context/ui-context.jsx"
import "../styles/auth-page.css"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { runBlockingTask, showError } = useUI()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    const formData = new FormData(event.currentTarget)

    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    if (!email) {
      setError("Informe o e-mail")
      return
    }

    if (!password) {
      setError("Informe a senha")
      return
    }

    setIsSubmitting(true)

    try {
      await runBlockingTask(async () => {
        await login({ email, password })
        navigate("/inicio", { replace: true })
      }, {
        title: "Aguarde um instante",
        text: "Validando seus dados e preparando o acesso...",
        minDuration: 1000,
      })
    } catch (err) {
      const message = err.message || "Não foi possível entrar"
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
              <h1 className="auth-page__title">Entre na sua conta</h1>
              <p className="auth-page__description">
                Acesse seus personagens, hunts, tasks, quests, diárias e toda a organização da sua conta.
              </p>
            </div>
          </section>

          <section className="auth-page__card">
            <div className="auth-page__card-header">
              <h2 className="auth-page__card-title">Login</h2>
              <p className="auth-page__card-description">
                Entre com seu e-mail e senha para continuar.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="email">
                  E-mail
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
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="auth-form__input"
                  autoComplete="current-password"
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
                {isSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="auth-page__footer">
              Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
