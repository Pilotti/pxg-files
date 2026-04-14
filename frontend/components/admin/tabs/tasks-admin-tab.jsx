'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { adminRequest } from "@/services/admin-api.js"
import AppSelect from "@/components/app-select.jsx"
import { CONTINENTS, TASK_INITIAL_FORM, TASK_PAGE_SIZE, TASK_TYPES } from "../admin-constants.js"
import { buildQuery, formatCity, formatContinent, formatTaskType, normalizeCoordinateInput, normalizeMinLevelInput } from "../admin-utils.js"
import { useDebouncedValue } from "../use-debounced-value.js"

export default function TasksAdminTab({ confirmBeforeRemoving, showError, showSuccess }) {
  const [tasks, setTasks] = useState([])
  const [taskPage, setTaskPage] = useState(1)
  const [taskTotal, setTaskTotal] = useState(0)
  const [taskTotalPages, setTaskTotalPages] = useState(1)
  const [taskFilters, setTaskFilters] = useState({
    search: "",
    task_type: "",
    continent: "",
    nw_level: "",
    city: "",
    min_level: "",
    max_level: "",
    is_active: "",
  })
  const [taskModal, setTaskModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [taskForm, setTaskForm] = useState(TASK_INITIAL_FORM)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isTogglingTaskId, setIsTogglingTaskId] = useState(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)
  const debouncedTaskFilters = useDebouncedValue(taskFilters, 250)
  const taskRequestControllerRef = useRef(null)

  const taskCityOptions = useMemo(() => {
    const filteredByContinent = taskFilters.continent
      ? tasks.filter((task) => task.continent === taskFilters.continent)
      : tasks

    const citySet = new Set(
      filteredByContinent
        .map((task) => String(task.city || "").trim())
        .filter(Boolean)
        .map((city) => city.toLowerCase()),
    )

    return Array.from(citySet)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((city) => ({ value: city, label: formatCity(city) }))
  }, [tasks, taskFilters.continent])

  const taskStats = useMemo(() => ({
    active: tasks.filter((task) => task.is_active).length,
    inactive: tasks.filter((task) => !task.is_active).length,
    city: taskFilters.city
      ? tasks.filter((task) => String(task.city || "").trim().toLowerCase() === taskFilters.city).length
      : null,
  }), [tasks, taskFilters.city])

  const loadTasks = useCallback(async (nextFilters = debouncedTaskFilters, nextPage = taskPage) => {
    taskRequestControllerRef.current?.abort()
    const controller = new AbortController()
    taskRequestControllerRef.current = controller

    setIsLoadingTasks(true)
    try {
      const response = await adminRequest(
        `/admin/tasks${buildQuery({ ...nextFilters, page: nextPage, page_size: TASK_PAGE_SIZE })}`,
        { signal: controller.signal },
      )

      const items = Array.isArray(response?.items) ? response.items : []
      const total = Number(response?.total ?? items.length)
      const totalPages = Math.max(1, Number(response?.total_pages ?? 1))

      setTasks(items)
      setTaskTotal(total)
      setTaskTotalPages(totalPages)

      if (nextPage > totalPages) {
        setTaskPage(totalPages)
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return
      }
      showError(err.message || "Erro ao carregar tasks")
    } finally {
      setIsLoadingTasks(false)
    }
  }, [debouncedTaskFilters, showError, taskPage])

  useEffect(() => {
    loadTasks(debouncedTaskFilters, taskPage)
  }, [debouncedTaskFilters, taskPage, loadTasks])

  useEffect(() => () => {
    taskRequestControllerRef.current?.abort()
  }, [])

  function updateTaskFilters(updater) {
    setTaskPage(1)
    setTaskFilters((prev) => {
      if (typeof updater === "function") {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
  }

  function openCreateTask() {
    setTaskForm(TASK_INITIAL_FORM)
    setTaskModal({ type: "create" })
  }

  function openEditTask(task) {
    setTaskForm({
      name: task.name,
      description: task.description || "",
      task_type: Array.isArray(task.task_type) ? task.task_type : [task.task_type],
      continent: task.continent,
      min_level: task.min_level,
      nw_level: task.nw_level ?? "",
      reward_text: task.reward_text || "",
      coordinate: task.coordinate || "",
      city: task.city || "",
      is_active: task.is_active,
    })
    setTaskModal({ type: "edit", item: task })
  }

  function openDeleteModal(item) {
    if (confirmBeforeRemoving) {
      setDeleteModal({ item })
      return
    }

    handleDeleteDirect(item)
  }

  function closeDeleteModal() {
    if (!isDeletingItem) {
      setDeleteModal(null)
    }
  }

  async function handleSubmitTask(event) {
    event.preventDefault()
    setIsSubmittingTask(true)

    try {
      if (!String(taskForm.city || "").trim()) throw new Error("Cidade é obrigatória para salvar a task.")
      if (!String(taskForm.description || "").trim()) throw new Error("Descrição é obrigatória para salvar a task.")
      if (!taskForm.task_type || taskForm.task_type.length === 0) throw new Error("Selecione ao menos um tipo de task.")
      if (!String(taskForm.reward_text || "").trim()) throw new Error("Recompensa é obrigatória para salvar a task.")
      if (taskForm.continent === "nightmare_world" && !String(taskForm.nw_level || "").trim()) {
        throw new Error("NW Level é obrigatório para tasks em Nightmare World.")
      }

      const payload = {
        ...taskForm,
        coordinate: taskForm.coordinate ? normalizeCoordinateInput(taskForm.coordinate) : null,
        min_level: normalizeMinLevelInput(taskForm.min_level),
        nw_level: taskForm.continent === "nightmare_world" ? Number(taskForm.nw_level) : null,
      }

      if (taskModal.type === "create") {
        await adminRequest("/admin/tasks", { method: "POST", body: JSON.stringify(payload) })
        showSuccess("Task criada com sucesso.")
      } else {
        await adminRequest(`/admin/tasks/${taskModal.item.id}`, { method: "PUT", body: JSON.stringify(payload) })
        showSuccess("Task atualizada com sucesso.")
      }

      setTaskModal(null)
      await loadTasks(debouncedTaskFilters, taskPage)
    } catch (err) {
      showError(err.message || "Erro ao salvar task")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function toggleTaskActive(taskId) {
    try {
      setIsTogglingTaskId(taskId)
      await adminRequest(`/admin/tasks/${taskId}/toggle-active`, { method: "PATCH" })
      showSuccess("Status da task atualizado.")
      await loadTasks(debouncedTaskFilters, taskPage)
    } catch (err) {
      showError(err.message || "Erro ao alterar status da task")
    } finally {
      setIsTogglingTaskId(null)
    }
  }

  async function handleDeleteDirect(item) {
    setIsDeletingItem(true)

    try {
      await adminRequest(`/admin/tasks/${item.id}`, { method: "DELETE" })
      showSuccess("Task removida permanentemente.")
      await loadTasks(debouncedTaskFilters, taskPage)
    } catch (err) {
      showError(err.message || "Erro ao remover item")
    } finally {
      setIsDeletingItem(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteModal) return
    await handleDeleteDirect(deleteModal.item)
    setDeleteModal(null)
  }

  return (
    <>
      <section className="admin-page__panel">
        <div className="admin-page__section-header">
          <div>
            <h2 className="admin-page__section-title">Tasks</h2>
            <p className="admin-page__section-subtitle">Controle completo de templates de tasks do sistema.</p>
          </div>
          <button type="button" className="admin-page__primary-button" onClick={openCreateTask}>Nova task</button>
        </div>

        <div className="admin-page__filters-card">
          <div className="admin-page__filters-grid admin-page__filters-grid--tasks">
            <input className="admin-page__input" placeholder="Buscar por nome" value={taskFilters.search} onChange={(event) => updateTaskFilters({ search: event.target.value })} />
            <AppSelect className="admin-page__select" value={taskFilters.task_type} options={TASK_TYPES} onChange={(value) => updateTaskFilters({ task_type: value })} />
            <AppSelect className="admin-page__select" value={taskFilters.continent} options={CONTINENTS} onChange={(value) => updateTaskFilters((prev) => ({ ...prev, continent: value, city: "", nw_level: value === "nightmare_world" ? prev.nw_level : "" }))} />
            {taskFilters.continent === "nightmare_world" ? <input className="admin-page__input" type="number" min="1" max="999" placeholder="NW Level" value={taskFilters.nw_level} onChange={(event) => updateTaskFilters({ nw_level: event.target.value })} /> : null}
            <AppSelect className="admin-page__select" value={taskFilters.city} options={[{ value: "", label: "Todas as cidades" }, ...taskCityOptions]} onChange={(value) => updateTaskFilters({ city: value })} />
            <input className="admin-page__input" type="number" placeholder="Nível mín." value={taskFilters.min_level} onChange={(event) => updateTaskFilters({ min_level: event.target.value })} />
            <input className="admin-page__input" type="number" placeholder="Nível máx." value={taskFilters.max_level} onChange={(event) => updateTaskFilters({ max_level: event.target.value })} />
            <AppSelect className="admin-page__select" value={taskFilters.is_active} options={[{ value: "", label: "Todos os status" }, { value: "true", label: "Ativas" }, { value: "false", label: "Inativas" }]} onChange={(value) => updateTaskFilters({ is_active: value })} />
          </div>
        </div>

        <div className="admin-page__stats-row">
          <span className="admin-page__stat">Total filtrado: {taskTotal}</span>
          <span className="admin-page__stat">Página: {taskPage} / {taskTotalPages}</span>
          <span className="admin-page__stat">Na página: {tasks.length}</span>
          <span className="admin-page__stat admin-page__stat--active">Ativas (página): {taskStats.active}</span>
          <span className="admin-page__stat admin-page__stat--inactive">Inativas (página): {taskStats.inactive}</span>
          {taskFilters.city ? <span className="admin-page__stat admin-page__stat--location">{formatCity(taskFilters.city)}: {taskStats.city}</span> : null}
          {taskFilters.continent === "nightmare_world" && taskFilters.nw_level ? <span className="admin-page__stat admin-page__stat--location">Filtro NW ativo: {taskFilters.nw_level}</span> : null}
        </div>

        <div className="admin-page__pagination">
          <button type="button" className="admin-page__ghost-button" onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))} disabled={isLoadingTasks || taskPage <= 1}>Anterior</button>
          <button type="button" className="admin-page__ghost-button" onClick={() => setTaskPage((prev) => Math.min(taskTotalPages, prev + 1))} disabled={isLoadingTasks || taskPage >= taskTotalPages}>Próxima</button>
        </div>

        <div className="admin-page__cards-grid">
          {isLoadingTasks ? <div className="admin-page__empty admin-page__empty--full">Carregando tasks...</div> : !tasks.length ? <div className="admin-page__empty admin-page__empty--full">Nenhuma task encontrada.</div> : tasks.map((task) => (
            <article key={task.id} className="admin-page__tile admin-page__tile--task">
              <div className="admin-page__tile-main">
                <div className="admin-page__tile-top">
                  <strong className="admin-page__tile-title">{task.name}</strong>
                </div>
                <p className="admin-page__tile-description">{task.description || "Sem descrição cadastrada."}</p>
                <div className="admin-page__chip-row">
                  <span className="admin-page__chip">Tipo: {formatTaskType(task.task_type)}</span>
                  <span className="admin-page__chip">Continente: {formatContinent(task.continent)}</span>
                  <span className="admin-page__chip">Cidade: {formatCity(task.city) || "—"}</span>
                  <span className="admin-page__chip">Nível mín.: {task.min_level}</span>
                  {task.continent === "nightmare_world" && task.nw_level !== null && task.nw_level !== undefined ? <span className="admin-page__chip">NW Level: {task.nw_level}</span> : null}
                </div>
                <p className="admin-page__tile-reward">Recompensa: {task.reward_text || "—"}</p>
              </div>
              <div className="admin-page__tile-right">
                <span className={task.is_active ? "admin-page__status admin-page__status--active admin-page__status--compact" : "admin-page__status admin-page__status--inactive admin-page__status--compact"}>{task.is_active ? "Ativa" : "Inativa"}</span>
                <div className="admin-page__task-actions">
                  <button type="button" className="admin-page__icon-button" onClick={() => openEditTask(task)} title="Editar" aria-label="Editar task">✎</button>
                  <button type="button" className={task.is_active ? "admin-page__icon-button admin-page__icon-button--warning" : "admin-page__icon-button admin-page__icon-button--success"} onClick={() => toggleTaskActive(task.id)} disabled={isTogglingTaskId === task.id} title={task.is_active ? "Desativar" : "Ativar"} aria-label={task.is_active ? "Desativar task" : "Ativar task"}>{isTogglingTaskId === task.id ? "…" : "⏻"}</button>
                  <button type="button" className="admin-page__icon-button admin-page__icon-button--danger" onClick={() => openDeleteModal(task)} title="Remover" aria-label="Remover task">🗑</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {taskModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal">
            <h2 className="character-modal__title">{taskModal.type === "create" ? "Nova task" : "Editar task"}</h2>
            <form onSubmit={handleSubmitTask}>
              <div className="character-modal__field"><label>Nome do NPC</label><input className="character-modal__input" value={taskForm.name} onChange={(event) => setTaskForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="character-modal__field"><label>O que deve fazer</label><input className="character-modal__input" required value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Tipo (selecione um ou mais)</label><div className="character-modal__checkboxes">{TASK_TYPES.filter((item) => item.value).map((item) => <label key={item.value} className="character-modal__checkbox"><input type="checkbox" checked={taskForm.task_type.includes(item.value)} onChange={(event) => { if (!event.target.checked && taskForm.task_type.length === 1) { showError("Selecione ao menos um tipo de task"); return } setTaskForm((prev) => ({ ...prev, task_type: event.target.checked ? [...prev.task_type, item.value] : prev.task_type.filter((type) => type !== item.value) })) }} /><span>{item.label}</span></label>)}</div></div>
              <div className="character-modal__field"><label>Continente</label><AppSelect className="character-modal__select" value={taskForm.continent} options={CONTINENTS.filter((item) => item.value)} onChange={(value) => setTaskForm((prev) => ({ ...prev, continent: value, nw_level: value === "nightmare_world" ? prev.nw_level : "" }))} /></div>
              <div className="character-modal__field"><label>Nível mínimo <span style={{ color: "#999", fontSize: "0.85em" }}>(vazio = 5)</span></label><input className="character-modal__input" type="number" min="0" max="625" value={taskForm.min_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, min_level: event.target.value }))} /></div>
              {taskForm.continent === "nightmare_world" ? <div className="character-modal__field"><label>Nightmare Level (NW Level)</label><input className="character-modal__input" type="number" min="1" max="999" value={taskForm.nw_level} onChange={(event) => setTaskForm((prev) => ({ ...prev, nw_level: event.target.value }))} /></div> : null}
              <div className="character-modal__field"><label>Recompensa</label><input className="character-modal__input" required value={taskForm.reward_text} onChange={(event) => setTaskForm((prev) => ({ ...prev, reward_text: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Coordenada <span style={{ color: "#999", fontSize: "0.85em" }}>(opcional)</span></label><input className="character-modal__input" placeholder="Ex: 1000000,-1000000,500" value={taskForm.coordinate} onChange={(event) => setTaskForm((prev) => ({ ...prev, coordinate: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Cidade</label><input className="character-modal__input" required value={taskForm.city} onChange={(event) => setTaskForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
              <div className="character-modal__field"><label>Disponível para o usuário adicionar</label><button type="button" className={taskForm.is_active ? "admin-page__toggle admin-page__toggle--active" : "admin-page__toggle"} onClick={() => setTaskForm((prev) => ({ ...prev, is_active: !prev.is_active }))}>{taskForm.is_active ? "Ativa" : "Inativa"}</button></div>
              <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={() => setTaskModal(null)} disabled={isSubmittingTask}>Cancelar</button><button type="submit" className="character-modal__button character-modal__button--primary" disabled={isSubmittingTask}>{isSubmittingTask ? "Salvando..." : "Salvar"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal ? (
        <div className="character-modal-backdrop">
          <div className="character-modal character-modal--danger">
            <h2 className="character-modal__title">Remover task</h2>
            <p className="character-modal__description">Você está prestes a remover permanentemente <strong>{deleteModal.item.name}</strong>.</p>
            <div className="character-modal__notice-list">
              <div className="character-modal__notice character-modal__notice--warning">Essa ação apagará o item do sistema inteiro.</div>
              <div className="character-modal__notice character-modal__notice--warning">Ela não pode ser desfeita.</div>
            </div>
            <div className="character-modal__actions"><button type="button" className="character-modal__button" onClick={closeDeleteModal} disabled={isDeletingItem}>Cancelar</button><button type="button" className="character-modal__button character-modal__button--danger" onClick={handleDeleteConfirmed} disabled={isDeletingItem}>{isDeletingItem ? "Removendo..." : "Remover permanentemente"}</button></div>
          </div>
        </div>
      ) : null}
    </>
  )
}
