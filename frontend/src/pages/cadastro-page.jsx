import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"
import { useUI } from "../context/ui-context.jsx"
import "../styles/auth-page.css"

export default function CadastroPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { runBlockingTask, showError } = useUI()
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
      setError("Informe como deseja ser chamado")
      return
    }

    if (!email) {
      setError("Informe o e-mail")
      return
    }

    if (!password) {
      setError("Informe a senha")
      return
    }

    if (!confirmPassword) {
      setError("Confirme a senha")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    setIsSubmitting(true)

    try {
      await runBlockingTask(async () => {
        await register({ displayName, email, password })
        navigate("/inicio", { replace: true })
      }, {
        title: "Aguarde um instante",
        text: "Criando sua conta e preparando o acesso...",
        minDuration: 1000,
      })
    } catch (err) {
      const message = err.message || "Não foi possível criar a conta"
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
              <h1 className="auth-page__title">Crie sua conta</h1>
              <p className="auth-page__description">
                Configure seu acesso e escolha como deseja ser chamado dentro do sistema.
              </p>
            </div>
          </section>

          <section className="auth-page__card">
            <div className="auth-page__card-header">
              <h2 className="auth-page__card-title">Cadastro</h2>
              <p className="auth-page__card-description">
                Preencha os dados para começar a usar sua conta.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="displayName">
                  Como deseja ser chamado
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
                  autoComplete="new-password"
                  defaultValue=""
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="confirmPassword">
                  Confirmar senha
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
                {isSubmitting ? "Criando..." : "Criar conta"}
              </button>
            </form>

            <p className="auth-page__footer">
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
