import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "@/lib/react-router-compat"
import LanguageSelector from "@/components/language-selector.jsx"
import AppSelect from "@/components/app-select.jsx"
import { useI18n } from "@/context/i18n-context.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { clans } from "../data/clans.js"
import "../styles/auth-page.css"

export default function FirstCharacterPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
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
      setError(t("auth.errors.missingCharacterName"))
      return
    }

    if (!form.nivel || Number(form.nivel) < 1) {
      setError(t("auth.errors.invalidLevel"))
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
      setError(err.message || t("auth.errors.createCharacterFailed"))
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
              <h1 className="auth-page__title">{t("auth.firstCharacterTitle")}</h1>

              <p className="auth-page__description">
                {t("auth.firstCharacterDescription")}
              </p>
            </div>
          </section>

          <section className="auth-page__card">
            <div className="auth-page__card-header">
              <h2 className="auth-page__card-title">{t("auth.newCharacter")}</h2>
              <p className="auth-page__card-description">{t("auth.getStarted")}</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-form__field">
                <label>{t("auth.characterName")}</label>
                <input
                  className="auth-form__select"
                  value={form.nome}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label>{t("auth.clan")}</label>
                <AppSelect
                  className="auth-form__input"
                  value={form.cla}
                  options={clans.map((clan) => ({ value: clan, label: clan }))}
                  onChange={(value) => setForm((prev) => ({ ...prev, cla: value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form__field">
                <label>{t("auth.level")}</label>
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
                {isSubmitting ? t("auth.creating") : t("auth.createCharacter")}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
