import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"

export default function DiariasPage() {
  const { activeCharacter } = useCharacter()
  const { t } = useI18n()

  return (
    <AppShell>
      <Topbar />
      <section className="dashboard-page">
        <div className="dashboard-page__hero">
          <div className="dashboard-page__hero-content">
            <span className="dashboard-page__eyebrow">{t("dailies.eyebrow")}</span>
            <h2 className="dashboard-page__title">
              {activeCharacter
                ? t("dailies.titleForCharacter", { name: activeCharacter.nome })
                : t("dailies.titleNoCharacter")}
            </h2>
            <p className="dashboard-page__description">{t("dailies.description")}</p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
