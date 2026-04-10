import { useState } from "react"
import { useNavigate } from "@/lib/react-router-compat"
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
      setError(err.message || "Não foi possível entrar no painel administrativo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-page__backdrop" />

      <div className="admin-login-page__layout">
        <section className="admin-login-page__hero">
          <span className="admin-login-page__eyebrow">Painel administrativo</span>
          <h1 className="admin-login-page__title">Acesse o controle do PXG Files</h1>
          <p className="admin-login-page__subtitle">Entre com sua conta administrativa para gerenciar conteúdos, preços, usuários e estrutura do app.</p>

          <div className="admin-login-page__benefits">
            <div className="admin-login-page__benefit-card">
              <strong>Catálogos centralizados</strong>
              <span>Atualize tasks, quests, Pokémon, consumíveis e itens de OCR em um só lugar.</span>
            </div>
            <div className="admin-login-page__benefit-card">
              <strong>Filtros e manutenção rápida</strong>
              <span>Encontre registros com agilidade e mantenha o conteúdo do app sempre consistente.</span>
            </div>
            <div className="admin-login-page__benefit-card">
              <strong>Gestão segura</strong>
              <span>Use uma área separada para administrar o sistema sem impactar o fluxo normal dos usuários.</span>
            </div>
          </div>
        </section>

        <section className="admin-login-page__card">
          <div className="admin-login-page__card-header">
            <h2>Entrar no admin</h2>
            <p>Use suas credenciais para abrir o painel administrativo.</p>
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
                placeholder="Digite seu usuário"
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
