import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"

export default function DiariasPage() {
  const { activeCharacter } = useCharacter()

  return (
    <AppShell>
      <Topbar
        secondaryActionLabel="Personalizar"
        primaryActionLabel="Adicionar diária"
      />
      <section className="dashboard-page">
        <div className="dashboard-page__hero">
          <div className="dashboard-page__hero-content">
            <span className="dashboard-page__eyebrow">Diárias</span>
            <h2 className="dashboard-page__title">
              {activeCharacter ? `Diárias de ${activeCharacter.nome}` : "Nenhum personagem selecionado"}
            </h2>
            <p className="dashboard-page__description">
              Essa área vai controlar os módulos diários do personagem, incluindo o que deve aparecer, ordem e progresso de execução.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}