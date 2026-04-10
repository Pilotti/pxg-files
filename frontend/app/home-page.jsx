import { useEffect, useMemo, useState } from "react"
import { Link } from "@/lib/react-router-compat"
import AppShell from "../components/app-shell.jsx"
import Topbar from "../components/topbar.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { useI18n } from "../context/i18n-context.jsx"
import { questsService } from "../services/quests-service.js"
import { tasksService } from "../services/tasks-service.js"

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
  const { t, locale } = useI18n()

  const formatNumber = (value) => new Intl.NumberFormat(locale).format(Number(value) || 0)
  const formatTaskType = (value) => {
    const map = {
      item_delivery: t("tasks.type.itemDelivery"),
      defeat: t("tasks.type.defeat"),
      capture: t("tasks.type.capture"),
      outro: t("tasks.type.other"),
    }
    return map[value] || value || "—"
  }
  const formatContinent = (value) => t(`continents.${value || "all"}`) || value || "—"
  const formatDate = (value) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date)
  }

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
        setError(err.message || t("dashboard.heroWithoutCharacter"))
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
  }, [activeCharacter?.id, t])

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
              <span className="dashboard-page__eyebrow">{t("dashboard.activeCharacter")}</span>
              <h2 className="dashboard-page__title">
                {activeCharacter ? activeCharacter.nome : t("dashboard.noCharacterSelected")}
              </h2>
              <p className="dashboard-page__description">
                {activeCharacter
                  ? t("dashboard.heroWithCharacter", { name: activeCharacter.nome })
                  : t("dashboard.heroWithoutCharacter")}
              </p>
            </div>

            {activeCharacter ? (
              <div className="dashboard-page__hero-aside">
                <div className="dashboard-page__identity-card">
                  <span className="dashboard-page__identity-label">{t("dashboard.quickSummary")}</span>
                  <strong className="dashboard-page__identity-name">{activeCharacter.nome}</strong>

                  <div className="dashboard-page__identity-grid">
                    <div className="dashboard-page__identity-item">
                      <span>{t("dashboard.clan")}</span>
                      <strong>{activeCharacter.cla}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>{t("dashboard.level")}</span>
                      <strong>{formatNumber(activeCharacter.nivel)}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>{t("dashboard.completedTasks")}</span>
                      <strong>{formatNumber(overview.completedTasks.length)}</strong>
                    </div>
                    <div className="dashboard-page__identity-item">
                      <span>{t("dashboard.completedQuests")}</span>
                      <strong>{formatNumber(overview.completedQuests.length)}</strong>
                    </div>
                  </div>

                  <div className="dashboard-page__hero-actions">
                    <Link className="dashboard-page__button dashboard-page__button--primary" to="/tasks">
                      {t("dashboard.openTasks")}
                    </Link>
                    <Link className="dashboard-page__button dashboard-page__button--ghost" to="/hunts">
                      {t("dashboard.openHunts")}
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
            label={t("dashboard.pendingTasks")}
            value={isLoading ? "..." : formatNumber(overview.activeTasks.length)}
            helper={t("dashboard.pendingTasksHelper")}
            tone="default"
          />
          <DashboardMetricCard
            label={t("dashboard.pendingQuests")}
            value={isLoading ? "..." : formatNumber(overview.activeQuests.length)}
            helper={t("dashboard.pendingQuestsHelper")}
            tone="default"
          />
          <DashboardMetricCard
            label={t("dashboard.completedTasks")}
            value={isLoading ? "..." : formatNumber(overview.completedTasks.length)}
            helper={t("dashboard.completedTasksHelper")}
            tone="positive"
          />
          <DashboardMetricCard
            label={t("dashboard.completedQuests")}
            value={isLoading ? "..." : formatNumber(overview.completedQuests.length)}
            helper={t("dashboard.completedQuestsHelper")}
            tone="default"
          />
        </div>

        <div className="dashboard-page__content-grid">
          <DashboardSection
            title={t("dashboard.pendingTasks")}
            actionLabel={t("dashboard.openTasks")}
            actionTo="/tasks"
          >
            {isLoading ? (
              <div className="dashboard-page__loading-state">{t("dashboard.loadingTasks")}</div>
            ) : pendingTasks.length ? (
              <DashboardList
                items={pendingTasks}
                renderItem={(task) => (
                  <article className="dashboard-page__list-card" key={task.id}>
                    <div className="dashboard-page__list-card-main">
                      <strong className="dashboard-page__list-card-title">{task.name}</strong>
                      <span className="dashboard-page__list-card-subtitle">
                        {task.description || t("dashboard.noDescription")}
                      </span>
                    </div>

                    <div className="dashboard-page__list-card-meta">
                      <div>
                        <span>{t("dashboard.type")}</span>
                        <strong>{formatTaskType(task.task_type)}</strong>
                      </div>
                      <div>
                        <span>{t("dashboard.continent")}</span>
                        <strong>{formatContinent(task.continent)}</strong>
                      </div>
                      <div>
                        <span>{t("dashboard.level")}</span>
                        <strong>{formatNumber(task.min_level)}</strong>
                      </div>
                    </div>
                  </article>
                )}
              />
            ) : (
              <DashboardEmptyState
                title={t("dashboard.noPendingTasks")}
                description={t("dashboard.noPendingTasksDescription")}
                ctaLabel={t("dashboard.activateTask")}
                ctaTo="/tasks"
              />
            )}
          </DashboardSection>

          <DashboardSection
            title={t("dashboard.pendingQuests")}
            actionLabel={t("dashboard.openTasks").replace("tasks", "quests")}
            actionTo="/quests"
          >
            {isLoading ? (
              <div className="dashboard-page__loading-state">{t("dashboard.loadingQuests")}</div>
            ) : pendingQuests.length ? (
              <DashboardList
                items={pendingQuests}
                renderItem={(quest) => (
                  <article className="dashboard-page__list-card" key={quest.id}>
                    <div className="dashboard-page__list-card-main">
                      <strong className="dashboard-page__list-card-title">{quest.name}</strong>
                      <span className="dashboard-page__list-card-subtitle">
                        {quest.description || t("dashboard.noDescription")}
                      </span>
                    </div>

                    <div className="dashboard-page__list-card-meta">
                      <div>
                        <span>{t("dashboard.continent")}</span>
                        <strong>{formatContinent(quest.continent)}</strong>
                      </div>
                      <div>
                        <span>{t("dashboard.level")}</span>
                        <strong>{formatNumber(quest.min_level)}</strong>
                      </div>
                      <div>
                        <span>{t("dashboard.activatedAt")}</span>
                        <strong>{formatDate(quest.activated_at)}</strong>
                      </div>
                    </div>
                  </article>
                )}
              />
            ) : (
              <DashboardEmptyState
                title={t("dashboard.noPendingQuests")}
                description={t("dashboard.noPendingQuestsDescription")}
                ctaLabel={t("dashboard.activateQuest")}
                ctaTo="/quests"
              />
            )}
          </DashboardSection>

          <DashboardSection
            title={t("dashboard.nextSteps")}
            actionLabel={t("dashboard.openDailies")}
            actionTo="/diarias"
          >
            <div className="dashboard-page__next-steps">
              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">{t("dashboard.usefulNow")}</span>
                <strong>{t("dashboard.realHome")}</strong>
                <p>{t("dashboard.realHomeDescription")}</p>
              </article>

              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">{t("dashboard.nextEvolution")}</span>
                <strong>{t("dashboard.dailiesModule")}</strong>
                <p>{t("dashboard.dailiesModuleDescription")}</p>
              </article>

              <article className="dashboard-page__next-step-card">
                <span className="dashboard-page__next-step-tag">{t("dashboard.structure")}</span>
                <strong>{t("dashboard.legacyCleanup")}</strong>
                <p>{t("dashboard.legacyCleanupDescription")}</p>
              </article>
            </div>
          </DashboardSection>
        </div>

        <div className="dashboard-page__footer-note">
          <span>{t("dashboard.trackedTasks")}:</span>
          <strong>{isLoading ? "..." : formatNumber(overview.trackedTasks)}</strong>
          <span>•</span>
          <span>{t("dashboard.trackedQuests")}:</span>
          <strong>{isLoading ? "..." : formatNumber(overview.trackedQuests)}</strong>
        </div>
      </section>
    </AppShell>
  )
}
