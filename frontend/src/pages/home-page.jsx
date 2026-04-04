import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { questsService } from "../services/quests-service.js"
import { tasksService } from "../services/tasks-service.js"

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0)
}

function formatTaskType(value) {
  const map = {
    item_delivery: "Entrega de itens",
    defeat: "Derrotar",
    capture: "Capturar",
  }

  return map[value] || value || "—"
}

function formatContinent(value) {
  const map = {
    kanto: "Kanto",
    johto: "Johto",
    orange_islands: "Ilhas Laranjas",
    outland: "Outland",
    nightmare_world: "Nightmare World",
    orre: "Orre",
  }

  return map[value] || value || "—"
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function DashboardMetricCard({ label, value, helper, tone = "default" }) {
  return (
    <article className={`dashboard-page__metric dashboard-page__metric--${tone}`}>
      <span className="dashboard-page__metric-label">{label}</span>
      <strong className="dashboard-page__metric-value">{value}</strong>
      <span className="dashboard-page__metric-helper">{helper}</span>
    </article>
  )
}

function DashboardSection({ title, subtitle, actionLabel, actionTo, children }) {
  return (
    <section className="dashboard-page__panel">
      <div className="dashboard-page__panel-header">
        <div>
          <h3 className="dashboard-page__panel-title">{title}</h3>
          {subtitle ? <p className="dashboard-page__panel-subtitle">{subtitle}</p> : null}
        </div>

        {actionLabel && actionTo ? (
          <Link className="dashboard-page__panel-action" to={actionTo}>
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {children}
    </section>
  )
}

function DashboardEmptyState({ title, description, ctaLabel, ctaTo }) {
  return (
    <div className="dashboard-page__empty-state">
      <strong className="dashboard-page__empty-title">{title}</strong>
      <p className="dashboard-page__empty-description">{description}</p>
      {ctaLabel && ctaTo ? (
        <Link className="dashboard-page__button dashboard-page__button--ghost" to={ctaTo}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  )
}

function DashboardList({ items, renderItem }) {
  return <div className="dashboard-page__list">{items.map(renderItem)}</div>
}

export default function HomePage() {
  const { activeCharacter } = useCharacter()

  const [dashboardData, setDashboardData] = useState({
    tasks: [],
    quests: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      if (!activeCharacter?.id) {
        if (isMounted) {
          setDashboardData({ tasks: [], quests: [] })
          setError("")
          setIsLoading(false)
        }
        return
      }

      if (isMounted) {
        setIsLoading(true)
        setError("")
      }

      try {
        const [tasks, quests] = await Promise.all([
          tasksService.listByCharacter(activeCharacter.id),
          questsService.listByCharacter(activeCharacter.id),
        ])

        if (!isMounted) return

        setDashboardData({
          tasks: Array.isArray(tasks) ? tasks : [],
          quests: Array.isArray(quests) ? quests : [],
        })
      } catch (err) {
        if (!isMounted) return

        setError(err.message || "Não foi possível carregar a visão geral do personagem.")
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [activeCharacter?.id])

  const overview = useMemo(() => {
    const activeTasks = dashboardData.tasks.filter((task) => !task.is_completed)
    const completedTasks = dashboardData.tasks.filter((task) => task.is_completed)
    const activeQuests = dashboardData.quests.filter((quest) => !quest.is_completed)
    const completedQuests = dashboardData.quests.filter((quest) => quest.is_completed)

    return {
      activeTasks,
      completedTasks,
      activeQuests,
      completedQuests,
      trackedTasks: dashboardData.tasks.length,
      trackedQuests: dashboardData.quests.length,
    }
  }, [dashboardData])

  const pendingTasks = useMemo(() => overview.activeTasks.slice(0, 5), [overview.activeTasks])
  const pendingQuests = useMemo(() => overview.activeQuests.slice(0, 5), [overview.activeQuests])

  return (
    <AppShell>
      <Topbar />

      <section className="dashboard-page dashboard-page--overview">
        <div className="dashboard-page__hero dashboard-page__hero--overview">
          <div className="dashboard-page__hero-content dashboard-page__hero-content--overview">
            <div className="dashboard-page__hero-copy">
              <span className="dashboard-page__eyebrow">Personagem ativo</span>
              <h2 className="dashboard-page__title">
                {activeCharacter ? activeCharacter.nome : "Nenhum personagem selecionado"}
              </h2>
              <p className="dashboard-page__description">
                {activeCharacter
                  ? `Tudo no PXG Files está vinculado ao personagem ${activeCharacter.nome}. Aqui você já enxerga hunts recentes, pendências de tasks e quests, além do impacto geral do personagem.`
                  : "Selecione um personagem para liberar o dashboard principal."}
              </p>
            </div>

            {activeCharacter ? (
              <div className="dashboard-page__hero-aside">
                <div className="dashboard-page__identity-card">
                  <span className="dashboard-page__identity-label">Resumo rápido</span>
                  <strong className="dashboard-page__identity-name">{activeCharacter.nome}</strong>

                  <div className="dashboard-page__identity-grid">
                    <div className="dashboard-page__identity-item">
                      <span>Clã</span>
                      <strong>{activeCharacter.cla}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>Nível</span>
                      <strong>{formatNumber(activeCharacter.nivel)}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>Tasks concluídas</span>
                      <strong>{formatNumber(overview.completedTasks.length)}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>Quests concluídas</span>
                      <strong>{formatNumber(overview.completedQuests.length)}</strong>
                    </div>
                  </div>

                  <div className="dashboard-page__hero-actions">
                    <Link className="dashboard-page__button dashboard-page__button--primary" to="/tasks">
                      Abrir tasks
                    </Link>
                    <Link className="dashboard-page__button dashboard-page__button--ghost" to="/hunts">
                      Abrir hunts
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="dashboard-page__feedback">{error}</div> : null}

        <div className="dashboard-page__metrics-grid">
          <DashboardMetricCard
            label="Tasks pendentes"
            value={isLoading ? "..." : formatNumber(overview.activeTasks.length)}
            helper="O que ainda falta concluir no personagem ativo."
            tone="default"
          />
          <DashboardMetricCard
            label="Quests pendentes"
            value={isLoading ? "..." : formatNumber(overview.activeQuests.length)}
            helper="Quests em aberto vinculadas ao personagem atual."
            tone="default"
          />
          <DashboardMetricCard
            label="Tasks concluídas"
            value={isLoading ? "..." : formatNumber(overview.completedTasks.length)}
            helper="Total já concluído para o personagem ativo."
            tone="positive"
          />
          <DashboardMetricCard
            label="Quests concluídas"
            value={isLoading ? "..." : formatNumber(overview.completedQuests.length)}
            helper="Progresso acumulado nas quests do personagem."
            tone="default"
          />
        </div>

        <div className="dashboard-page__content-grid">
          <DashboardSection
            title="Tasks pendentes"
            actionLabel="Abrir tasks"
            actionTo="/tasks"
          >
            {isLoading ? (
              <div className="dashboard-page__loading-state">Carregando tasks...</div>
            ) : pendingTasks.length ? (
              <DashboardList
                items={pendingTasks}
                renderItem={(task) => (
                  <article className="dashboard-page__list-card" key={task.id}>
                    <div className="dashboard-page__list-card-main">
                      <strong className="dashboard-page__list-card-title">{task.name}</strong>
                      <span className="dashboard-page__list-card-subtitle">
                        {task.description || "Sem descrição cadastrada."}
                      </span>
                    </div>

                    <div className="dashboard-page__list-card-meta">
                      <div>
                        <span>Tipo</span>
                        <strong>{formatTaskType(task.task_type)}</strong>
                      </div>
                      <div>
                        <span>Continente</span>
                        <strong>{formatContinent(task.continent)}</strong>
                      </div>
                      <div>
                        <span>Nível</span>
                        <strong>{formatNumber(task.min_level)}</strong>
                      </div>
                    </div>
                  </article>
                )}
              />
            ) : (
              <DashboardEmptyState
                title="Nenhuma task pendente"
                description="As tasks ativas aparecem aqui automaticamente."
                ctaLabel="Ativar task"
                ctaTo="/tasks"
              />
            )}
          </DashboardSection>

          <DashboardSection
            title="Quests pendentes"
            actionLabel="Abrir quests"
            actionTo="/quests"
          >
            {isLoading ? (
              <div className="dashboard-page__loading-state">Carregando quests...</div>
            ) : pendingQuests.length ? (
              <DashboardList
                items={pendingQuests}
                renderItem={(quest) => (
                  <article className="dashboard-page__list-card" key={quest.id}>
                    <div className="dashboard-page__list-card-main">
                      <strong className="dashboard-page__list-card-title">{quest.name}</strong>
                      <span className="dashboard-page__list-card-subtitle">
                        {quest.description || "Sem descrição cadastrada."}
                      </span>
                    </div>

                    <div className="dashboard-page__list-card-meta">
                      <div>
                        <span>Continente</span>
                        <strong>{formatContinent(quest.continent)}</strong>
                      </div>
                      <div>
                        <span>Nível</span>
                        <strong>{formatNumber(quest.min_level)}</strong>
                      </div>
                      <div>
                        <span>Ativada em</span>
                        <strong>{formatDate(quest.activated_at)}</strong>
                      </div>
                    </div>
                  </article>
                )}
              />
            ) : (
              <DashboardEmptyState
                title="Nenhuma quest pendente"
                description="Quando houver quests ativas em aberto, elas ficam visíveis aqui."
                ctaLabel="Ativar quest"
                ctaTo="/quests"
              />
            )}
          </DashboardSection>

          <DashboardSection
            title="Diárias e próximos passos"
            actionLabel="Abrir diárias"
            actionTo="/diarias"
          >
            <div className="dashboard-page__next-steps">
              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">Já útil agora</span>
                <strong>Home virou dashboard real</strong>
                <p>
                  Esta página já puxa tasks e quests reais do personagem ativo, em vez de ficar apenas
                  como tela de apresentação.
                </p>
              </article>

              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">Próxima evolução</span>
                <strong>Módulo de diárias</strong>
                <p>
                  O próximo passo mais forte é transformar a aba de diárias em checklist funcional com
                  persistência por personagem.
                </p>
              </article>

              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">Estrutura</span>
                <strong>Limpeza de legado</strong>
                <p>
                  Ainda vale remover arquivos mortos e diretórios pesados do projeto para manutenção
                  ficar mais limpa e segura.
                </p>
              </article>
            </div>
          </DashboardSection>
        </div>

        <div className="dashboard-page__footer-note">
          <span>Tasks rastreadas:</span>
          <strong>{isLoading ? "..." : formatNumber(overview.trackedTasks)}</strong>
          <span>•</span>
          <span>Quests rastreadas:</span>
          <strong>{isLoading ? "..." : formatNumber(overview.trackedQuests)}</strong>
        </div>
      </section>
    </AppShell>
  )
}
