import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation, useNavigate } from "@/lib/react-router-compat"
import { useCharacter } from "../context/character-context.jsx"
import { FALLBACK_SIDEBAR_MENU_ITEMS } from "../constants/sidebar-menu-fallback.js"
import { shouldOpenHomeAfterCharacterSwitch } from "../services/app-preferences.js"
import "../styles/sidebar.css"

function getCharacterName(character) {
  return character?.nome || character?.name || "Selecionar personagem"
}

function getCharacterClan(character) {
  return (
    character?.clan ||
    character?.cla ||
    character?.clã ||
    character?.team ||
    character?.faction ||
    "Sem clã"
  )
}

function getCharacterLevel(character) {
  return character?.nivel || character?.level || 0
}

function isCharacterPrimary(character) {
  return Boolean(
    character?.is_primary ||
    character?.isPrimary ||
    character?.favorite ||
    character?.is_favorite ||
    character?.main
  )
}

export default function Sidebar({ menuItems: menuItemsProp }) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectorRef = useRef(null)

  const {
    characters = [],
    activeCharacter,
    isSwitchingCharacter = false,
    switchCharacter,
  } = useCharacter()

  const [isOpen, setIsOpen] = useState(false)
  const [menuItems, setMenuItems] = useState(menuItemsProp || FALLBACK_SIDEBAR_MENU_ITEMS)

  useEffect(() => {
    function handleClickOutside(event) {
      if (!selectorRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  useEffect(() => {
    if (Array.isArray(menuItemsProp) && menuItemsProp.length > 0) {
      setMenuItems(menuItemsProp)
    }
  }, [menuItemsProp])

  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => Number(isCharacterPrimary(b)) - Number(isCharacterPrimary(a)))
  }, [characters])

  async function handleSwitchCharacter(characterId) {
    if (!characterId || characterId === activeCharacter?.id) {
      setIsOpen(false)
      return
    }

    if (typeof switchCharacter === "function") {
      await switchCharacter(characterId)
    }

    setIsOpen(false)

    if (shouldOpenHomeAfterCharacterSwitch() && location.pathname !== "/inicio") {
      navigate("/inicio")
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__card">
        <div className="sidebar__selector" ref={selectorRef}>
          <button
            type="button"
            className={isOpen ? "sidebar__selector-button sidebar__selector-button--open" : "sidebar__selector-button"}
            onClick={() => setIsOpen((current) => !current)}
            disabled={isSwitchingCharacter}
          >
            <div className="sidebar__selector-text">
              <strong className="sidebar__selector-name">{getCharacterName(activeCharacter)}</strong>
              <span className="sidebar__selector-subtitle">
                {getCharacterClan(activeCharacter)} • Lv {getCharacterLevel(activeCharacter)}
              </span>
            </div>

            <svg
              className={isOpen ? "sidebar__selector-arrow sidebar__selector-arrow--open" : "sidebar__selector-arrow"}
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M5.25 7.5L10 12.5L14.75 7.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isOpen ? (
            <div className="sidebar__selector-menu">
              {sortedCharacters.length === 0 ? (
                <div className="sidebar__selector-empty">Nenhum personagem disponível.</div>
              ) : (
                sortedCharacters.map((character) => {
                  const isActive = character.id === activeCharacter?.id
                  const isPrimary = isCharacterPrimary(character)

                  return (
                    <div
                      key={character.id}
                      className={isActive ? "sidebar__selector-option sidebar__selector-option--active" : "sidebar__selector-option"}
                    >
                      <button
                        type="button"
                        className="sidebar__selector-option-main"
                        onClick={() => handleSwitchCharacter(character.id)}
                        disabled={isSwitchingCharacter}
                      >
                        <div className="sidebar__selector-option-text">
                          <strong>{getCharacterName(character)}</strong>
                          <span>
                            {getCharacterClan(character)} • Lv {getCharacterLevel(character)}
                          </span>
                        </div>
                      </button>

                      <span
                        className={isPrimary ? "sidebar__selector-favorite sidebar__selector-favorite--active" : "sidebar__selector-favorite"}
                        title={isPrimary ? "Personagem favorito" : "Personagem não favorito"}
                        aria-hidden="true"
                      >
                        ★
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          ) : null}
        </div>

        <nav className="sidebar__nav">
          {menuItems.map((item) => {
            if (!item?.path || !item?.label) return null

            if (!item.is_enabled) {
              return (
                <div key={item.menu_key || item.path} className="sidebar__nav-link sidebar__nav-link--locked" aria-disabled="true">
                  <span className="sidebar__nav-label">{item.label}</span>
                  <span className="sidebar__nav-meta">
                    {item.is_beta ? <span className="sidebar__nav-beta">beta</span> : null}
                    <span className="sidebar__nav-lock" title="Menu bloqueado pelo admin" aria-label="Menu bloqueado">🔒</span>
                  </span>
                </div>
              )
            }

            return (
              <NavLink
                key={item.menu_key || item.path}
                to={item.path}
                className={({ isActive }) => isActive ? "sidebar__nav-link sidebar__nav-link--active" : "sidebar__nav-link"}
              >
                <span className="sidebar__nav-label">{item.label}</span>
                {item.is_beta ? <span className="sidebar__nav-beta">beta</span> : null}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
