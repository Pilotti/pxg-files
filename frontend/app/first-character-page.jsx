import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "@/lib/react-router-compat"
import { useCharacter } from "../context/character-context.jsx"
import { clans } from "../data/clans.js"
import "../styles/auth-page.css"

export default function FirstCharacterPage() {
  const navigate = useNavigate()
  const {
    addCharacter,
    hasCharacters,
    hasResolvedCharacters,
    isLoadingCharacters,
    setActiveCharacterId,
  } = useCharacter()

  const [form, setForm] = useState({
    nome: "",
    cla: clans[0],
    nivel: "",
  })

  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setError("")
  }, [hasCharacters])

  if (!hasResolvedCharacters || isLoadingCharacters) {
    return null
  }

  if (hasCharacters) {
    return <Navigate to="/inicio" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    if (!form.nome.trim()) {
      setError("Informe o nome do personagem")
      return
    }

    if (!form.nivel || Number(form.nivel) < 1) {
      setError("Informe um nível válido")
      return
    }

    setIsSubmitting(true)

    try {
      const created = await addCharacter({
        nome: form.nome.trim(),
        cla: form.cla,
        nivel: Number(form.nivel),
      })

      setActiveCharacterId(created.id)
      navigate("/inicio", { replace: true })
    } catch (err) {
      setError(err.message || "Erro ao criar personagem")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="page__inner">
        <div className="auth-page__layout">
          <section className="auth-page__hero">
            <div className="auth-page__hero-content">
              <h1 className="auth-page__title">Configure seu primeiro personagem</h1>

              <p className="auth-page__description">
                Antes de continuar, você precisa criar pelo menos um personagem.
                Esse personagem será usado para organizar hunts, tasks, quests e tudo dentro do sistema.
              </p>
            </div>
          </section>

          <section className="auth-page__card">
            <div className="auth-page__card-header">
              <h2 className="auth-page__card-title">Novo personagem</h2>
              <p className="auth-page__card-description">Preencha os dados para começar.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-form__field">
                <label>Nome</label>
                <input
                  className="auth-form__input"
                  value={form.nome}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label>Clã</label>
                <select
                  className="auth-form__input"
                  value={form.cla}
                  onChange={(event) => setForm((prev) => ({ ...prev, cla: event.target.value }))}
                  disabled={isSubmitting}
                >
                  {clans.map((clan) => (
                    <option key={clan} value={clan}>
                      {clan}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form__field">
                <label>Nível</label>
                <input
                  type="number"
                  min="1"
                  className="auth-form__input"
                  value={form.nivel}
                  onChange={(event) => setForm((prev) => ({ ...prev, nivel: event.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              {error && <p className="auth-form__error">{error}</p>}

              <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar personagem"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
