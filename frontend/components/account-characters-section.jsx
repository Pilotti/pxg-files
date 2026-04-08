import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@/lib/react-router-compat"
import { useCharacter } from "../context/character-context.jsx"
import { clans } from "../data/clans.js"
import CharacterSwitchOverlay from "./character-switch-overlay.jsx"
import "../styles/account-characters-section.css"
import "../styles/character-modal.css"

const initialForm = {
  nome: "",
  cla: clans[0],
  nivel: ""
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.75l2.53 5.13 5.66.82-4.1 4  .97 5.64L12 16.68 6.94 19.34l.97-5.64-4.1-4 5.66-.82L12 3.75z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.75 15.92L15.8 4.86a2.1 2.1 0 113 2.97L7.78 18.89 4 20l1.11-3.78z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.5 7.5h13m-10.5 0V6a1.25 1.25 0 011.25-1.25h5.5A1.25 1.25 0 0116 6v1.5m-8.75 0l.7 10.03A1.75 1.75 0 009.7 19.2h4.6a1.75 1.75 0 001.75-1.67l.7-10.03"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CharacterStat({ label, value, accent = "default" }) {
  return (
    <article className={`account-stat-card account-stat-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export default function AccountCharactersSection() {
  const navigate = useNavigate()

  const {
    characters,
    activeCharacter,
    activeCharacterId,
    setActiveCharacterId,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setFavorite
  } = useCharacter()

  const [modal, setModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [postCreateModal, setPostCreateModal] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [favoriteLoadingId, setFavoriteLoadingId] = useState(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState(null)
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false)
  const [isApplyingPostCreateChoice, setIsApplyingPostCreateChoice] = useState(false)

  const isBusy =
    isSubmitting ||
    Boolean(favoriteLoadingId) ||
    Boolean(deleteLoadingId) ||
    isSwitchingCharacter ||
    isApplyingPostCreateChoice

  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1
      if (!a.is_favorite && b.is_favorite) return 1
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    })
  }, [characters])

  const totalCharacters = sortedCharacters.length
  const favoriteCharacter = sortedCharacters.find((character) => character.is_favorite)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return
      if (isBusy) return

      if (postCreateModal) {
        setPostCreateModal(null)
        return
      }

      if (deleteModal) {
        setDeleteModal(null)
        setDeleteError("")
        return
      }

      if (modal) {
        setModal(null)
        setError("")
        setForm(initialForm)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [modal, deleteModal, postCreateModal, isBusy])

  function openCreate() {
    if (isBusy) return
    setError("")
    setForm(initialForm)
    setModal({ type: "create" })
  }

  function openEdit(character) {
    if (isBusy) return

    setError("")
    setForm({
      nome: character.nome,
      cla: character.cla,
      nivel: String(character.nivel)
    })
    setModal({ type: "edit", character })
  }

  function closeModal() {
    if (isSubmitting) return
    setModal(null)
    setError("")
    setForm(initialForm)
  }

  function openDeleteModal(character) {
    if (isBusy) return
    setDeleteError("")
    setDeleteModal(character)
  }

  function closeDeleteModal() {
    if (deleteLoadingId) return
    setDeleteError("")
    setDeleteModal(null)
  }

  function closePostCreateModal() {
    if (isApplyingPostCreateChoice) return
    setPostCreateModal(null)
  }

  async function handleSubmit(event) {
    event?.preventDefault?.()
    setError("")

    const nome = form.nome.trim()
    const cla = form.cla.trim()
    const nivel = Number(form.nivel)

    if (!nome) {
      setError("Informe o nome do personagem.")
      return
    }

    if (!cla) {
      setError("Informe o clã do personagem.")
      return
    }

    if (!form.nivel || Number.isNaN(nivel) || nivel < 1) {
      setError("Informe um nível válido.")
      return
    }

    setIsSubmitting(true)

    try {
      if (modal.type === "create") {
        const isFirstCharacter = characters.length === 0
        const previousActive = activeCharacter
          ? {
              id: activeCharacter.id,
              nome: activeCharacter.nome
            }
          : null

        const createdCharacter = await addCharacter({ nome, cla, nivel })
        closeModal()

        if (isFirstCharacter) {
          setIsSwitchingCharacter(true)
          setActiveCharacterId(createdCharacter.id)
          await wait(1000)
          navigate("/inicio", { replace: true })
          setIsSwitchingCharacter(false)
          return
        }

        setPostCreateModal({
          createdCharacter,
          currentCharacter: previousActive
        })
        return
      }

      await updateCharacter(modal.character.id, { nome, cla, nivel })
      closeModal()
    } catch (err) {
      setError(err.message || "Não foi possível salvar o personagem.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFavorite(characterId) {
    if (isBusy) return
    setFavoriteLoadingId(characterId)

    try {
      await setFavorite(characterId)
    } catch (err) {
      console.error(err)
    } finally {
      setFavoriteLoadingId(null)
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteModal) return

    setDeleteError("")
    setDeleteLoadingId(deleteModal.id)

    try {
      const response = await removeCharacter(deleteModal.id)
      closeDeleteModal()

      if (response?.remaining_count === 0) {
        navigate("/primeiro-personagem", { replace: true })
      }
    } catch (err) {
      setDeleteError(err.message || "Não foi possível remover o personagem.")
    } finally {
      setDeleteLoadingId(null)
    }
  }

  async function handleSelectCharacter(characterId) {
    if (isBusy) return

    if (String(activeCharacterId) === String(characterId)) {
      navigate("/inicio", { replace: true })
      return
    }

    setIsSwitchingCharacter(true)
    setActiveCharacterId(characterId)
    await wait(1000)
    navigate("/inicio", { replace: true })
    setIsSwitchingCharacter(false)
  }

  async function handleKeepCurrentCharacter() {
    setIsApplyingPostCreateChoice(true)
    await wait(220)
    setPostCreateModal(null)
    setIsApplyingPostCreateChoice(false)
  }

  async function handleActivateNewCharacter() {
    if (!postCreateModal?.createdCharacter?.id) return

    setIsApplyingPostCreateChoice(true)
    setActiveCharacterId(postCreateModal.createdCharacter.id)
    setPostCreateModal(null)
    await wait(1000)
    navigate("/inicio", { replace: true })
    setIsApplyingPostCreateChoice(false)
  }

  const deleteTargetWasActive =
    deleteModal && String(deleteModal.id) === String(activeCharacterId)
  const deleteTargetIsFavorite = deleteModal?.is_favorite
  const willRemoveLastCharacter = characters.length === 1

  return (
    <>
      {(isSwitchingCharacter || isApplyingPostCreateChoice) && (
        <CharacterSwitchOverlay text="Aplicando o personagem selecionado..." />
      )}

      <section className="account-characters">
        <div className="account-characters__hero">
          <div className="account-characters__hero-copy">
            <span className="account-characters__eyebrow">GESTÃO DE PERSONAGENS</span>
            <h2 className="account-characters__title">Controle completo da conta.</h2>
            <p className="account-characters__subtitle">
              Organize personagens, mantenha um principal fixo e troque rapidamente
              o contexto ativo sem perder clareza visual.
            </p>
          </div>

          <button
            type="button"
            className="account-characters__add-button"
            onClick={openCreate}
            disabled={isBusy}
          >
            <span className="account-characters__add-button-plus">＋</span>
            <span>{isSubmitting && modal?.type === "create" ? "Criando..." : "Novo personagem"}</span>
          </button>
        </div>

        <div className="account-characters__stats-grid">
          <CharacterStat label="Total na conta" value={totalCharacters} />
          <CharacterStat label="Personagem ativo" value={activeCharacter?.nome || "Nenhum"} accent="primary" />
          <CharacterStat label="Principal" value={favoriteCharacter?.nome || "Não definido"} accent="favorite" />
        </div>

        {!sortedCharacters.length ? (
          <div className="account-characters__empty">
            <div className="account-characters__empty-icon">✦</div>
            <strong>Nenhum personagem cadastrado.</strong>
            <span>Crie o primeiro personagem da conta para liberar o restante do sistema.</span>
            <button
              type="button"
              className="account-characters__empty-action"
              onClick={openCreate}
              disabled={isBusy}
            >
              Criar primeiro personagem
            </button>
          </div>
        ) : (
          <div className="account-characters__grid">
            {sortedCharacters.map((character) => {
              const isActive = String(activeCharacterId) === String(character.id)
              const isFavoriteLoading = favoriteLoadingId === character.id
              const isDeleteLoading = deleteLoadingId === character.id

              return (
                <article
                  key={character.id}
                  className={
                    isActive
                      ? "account-character-card account-character-card--active"
                      : "account-character-card"
                  }
                >
                  <button
                    type="button"
                    className="account-character-card__select"
                    onClick={() => handleSelectCharacter(character.id)}
                    disabled={isBusy && !isActive}
                  >
                    <div className="account-character-card__main">
                      <div className="account-character-card__topline">
                        <strong className="account-character-card__name">{character.nome}</strong>
                        {isActive && <span className="account-character-card__active-ping" aria-hidden="true" />}
                      </div>

                      <span className="account-character-card__meta">{character.cla}</span>
                      <span className="account-character-card__meta">Nível {character.nivel}</span>

                      <div className="account-character-card__badges">
                        {character.is_favorite && (
                          <span className="account-character-card__badge account-character-card__badge--favorite">
                            Principal
                          </span>
                        )}

                        {isActive && (
                          <span className="account-character-card__badge">Ativo</span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="account-character-card__side-actions">
                    <button
                      type="button"
                      className={
                        character.is_favorite
                          ? "account-character-card__icon-button account-character-card__icon-button--favorite-active"
                          : "account-character-card__icon-button"
                      }
                      onClick={() => handleFavorite(character.id)}
                      title={character.is_favorite ? "Personagem principal" : "Definir como principal"}
                      disabled={isFavoriteLoading || isBusy}
                    >
                      {isFavoriteLoading ? "..." : <StarIcon filled={character.is_favorite} />}
                    </button>

                    <button
                      type="button"
                      className="account-character-card__icon-button"
                      onClick={() => openEdit(character)}
                      title="Editar personagem"
                      disabled={isBusy}
                    >
                      <PencilIcon />
                    </button>

                    <button
                      type="button"
                      className="account-character-card__icon-button account-character-card__icon-button--danger"
                      onClick={() => openDeleteModal(character)}
                      title="Remover personagem"
                      disabled={isDeleteLoading || isBusy}
                    >
                      {isDeleteLoading ? "..." : <TrashIcon />}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {modal && (
        <div className="character-modal-backdrop" onClick={closeModal}>
          <div className="character-modal" onClick={(event) => event.stopPropagation()}>
            <div className="character-modal__header">
              <div>
                <span className="character-modal__eyebrow">
                  {modal.type === "create" ? "NOVO PERSONAGEM" : "EDIÇÃO"}
                </span>
                <h2 className="character-modal__title">
                  {modal.type === "create" ? "Criar personagem" : "Editar personagem"}
                </h2>
                <p className="character-modal__description">
                  {modal.type === "create"
                    ? "Adicione um novo personagem à conta com nome, clã e nível inicial."
                    : "Atualize os dados do personagem selecionado sem perder o vínculo atual."}
                </p>
              </div>
            </div>

            <form className="character-modal__form" onSubmit={handleSubmit}>
              <div className="character-modal__field-grid">
                <div className="character-modal__field character-modal__field--full">
                  <label htmlFor="character-name">Nome</label>
                  <input
                    id="character-name"
                    className="character-modal__input"
                    value={form.nome}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nome: event.target.value }))
                    }
                    disabled={isSubmitting}
                    placeholder="Ex.: Pilotti"
                    autoFocus
                  />
                </div>

                <div className="character-modal__field">
                  <label htmlFor="character-clan">Clã</label>
                  <select
                    id="character-clan"
                    className="character-modal__input"
                    value={form.cla}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cla: event.target.value }))
                    }
                    disabled={isSubmitting}
                  >
                    {clans.map((cla) => (
                      <option key={cla} value={cla}>
                        {cla}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="character-modal__field">
                  <label htmlFor="character-level">Nível</label>
                  <input
                    id="character-level"
                    className="character-modal__input"
                    type="number"
                    min="1"
                    value={form.nivel}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nivel: event.target.value.replace(/[^0-9]/g, "") }))
                    }
                    disabled={isSubmitting}
                    placeholder="Ex.: 123"
                  />
                </div>
              </div>

              {error && <p className="character-modal__error">{error}</p>}

              <div className="character-modal__actions">
                <button
                  type="button"
                  className="character-modal__button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="character-modal__button character-modal__button--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? modal.type === "create"
                      ? "Criando..."
                      : "Salvando..."
                    : modal.type === "create"
                      ? "Criar personagem"
                      : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="character-modal-backdrop" onClick={closeDeleteModal}>
          <div
            className="character-modal character-modal--danger"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="character-modal__header">
              <div>
                <span className="character-modal__eyebrow character-modal__eyebrow--danger">AÇÃO IRREVERSÍVEL</span>
                <h2 className="character-modal__title">Confirmar exclusão</h2>
              </div>
            </div>

            <p className="character-modal__description">
              Você está prestes a remover <strong>{deleteModal.nome}</strong>. Essa ação não pode ser desfeita.
            </p>

            <div className="character-modal__notice-list">
              {deleteTargetWasActive && (
                <div className="character-modal__notice">
                  Esse é o personagem ativo. O sistema aplicará fallback automático para manter a conta consistente.
                </div>
              )}

              {deleteTargetIsFavorite && (
                <div className="character-modal__notice">
                  Esse é o personagem principal. Outro personagem será promovido automaticamente, se ainda existir algum.
                </div>
              )}

              {willRemoveLastCharacter && (
                <div className="character-modal__notice character-modal__notice--warning">
                  Esse é o último personagem da conta. Após remover, você será levado direto para a tela de criação do primeiro personagem.
                </div>
              )}
            </div>

            {deleteError && <p className="character-modal__error">{deleteError}</p>}

            <div className="character-modal__actions">
              <button
                type="button"
                className="character-modal__button"
                onClick={closeDeleteModal}
                disabled={Boolean(deleteLoadingId)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="character-modal__button character-modal__button--danger"
                onClick={handleDeleteConfirmed}
                disabled={Boolean(deleteLoadingId)}
              >
                {deleteLoadingId ? "Removendo..." : "Excluir personagem"}
              </button>
            </div>
          </div>
        </div>
      )}

      {postCreateModal && (
        <div className="character-modal-backdrop" onClick={closePostCreateModal}>
          <div className="character-modal" onClick={(event) => event.stopPropagation()}>
            <div className="character-modal__header">
              <div>
                <span className="character-modal__eyebrow">PERSONAGEM CRIADO</span>
                <h2 className="character-modal__title">Escolha o próximo contexto</h2>
              </div>
            </div>

            <p className="character-modal__description">
              O personagem <strong>{postCreateModal.createdCharacter.nome}</strong> foi adicionado à sua conta.
            </p>

            <div className="character-modal__notice-list">
              <div className="character-modal__notice">
                Personagem atual: <strong>{postCreateModal.currentCharacter?.nome || "Nenhum"}</strong>
              </div>
              <div className="character-modal__notice">
                Novo personagem: <strong>{postCreateModal.createdCharacter.nome}</strong>
              </div>
            </div>

            <p className="character-modal__description">
              Deseja manter o personagem atual ativo ou ativar o novo agora?
            </p>

            <div className="character-modal__actions">
              <button
                type="button"
                className="character-modal__button"
                onClick={handleKeepCurrentCharacter}
                disabled={isApplyingPostCreateChoice}
              >
                Manter atual
              </button>

              <button
                type="button"
                className="character-modal__button character-modal__button--primary"
                onClick={handleActivateNewCharacter}
                disabled={isApplyingPostCreateChoice}
              >
                Ativar novo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
