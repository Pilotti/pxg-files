
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminRequest, setAdminToken } from "../services/admin-api.js"
import "../styles/admin-login-page.css"

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await adminRequest("/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
        }),
      })

      setAdminToken(response.access_token)
      navigate("/admin", { replace: true })
    } catch (err) {
      setError(err.message || "Não foi possível entrar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-page__backdrop" />

      <div className="admin-login-page__layout">
        <section className="admin-login-page__hero">
          <span className="admin-login-page__eyebrow">Admin</span>
          <h1 className="admin-login-page__title">Painel administrativo</h1>
          <p className="admin-login-page__subtitle">
            Acesso interno para criação, edição e governança do catálogo de tasks e quests.
          </p>

          <div className="admin-login-page__benefits">
            <div className="admin-login-page__benefit-card">
              <strong>Catálogo controlado</strong>
              <span>Crie e ajuste templates sem depender do cliente final.</span>
            </div>
            <div className="admin-login-page__benefit-card">
              <strong>Filtros rápidos</strong>
              <span>Encontre itens por nome, continente, level e status.</span>
            </div>
            <div className="admin-login-page__benefit-card">
              <strong>Operação segura</strong>
              <span>Área separada do restante do sistema com autenticação própria.</span>
            </div>
          </div>
        </section>

        <section className="admin-login-page__card">
          <div className="admin-login-page__card-header">
            <h2>Entrar</h2>
            <p>Use suas credenciais administrativas para acessar o painel.</p>
          </div>

          <form className="admin-login-page__form" onSubmit={handleSubmit}>
            <div className="admin-login-page__field">
              <label htmlFor="admin-username">Usuário</label>
              <input
                id="admin-username"
                className="admin-login-page__input"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
                disabled={isSubmitting}
                autoComplete="username"
                placeholder="Digite seu usuário admin"
              />
            </div>

            <div className="admin-login-page__field">
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                className="admin-login-page__input"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                disabled={isSubmitting}
                autoComplete="current-password"
                placeholder="Digite sua senha"
              />
            </div>

            {error && <p className="admin-login-page__error">{error}</p>}

            <button
              type="submit"
              className="admin-login-page__submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar no admin"}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
