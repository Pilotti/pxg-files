import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation, useNavigate } from "@/lib/react-router-compat"
import { useI18n } from "@/context/i18n-context.jsx"
import { useCharacter } from "../context/character-context.jsx"
import { FALLBACK_SIDEBAR_MENU_ITEMS } from "../constants/sidebar-menu-fallback.js"
import { shouldOpenHomeAfterCharacterSwitch } from "../services/app-preferences.js"
import "../styles/sidebar.css"

function getCharacterLevel(character) {
  return character?.nivel || character?.level || 0
}

function isCharacterPrimary(character) {
  return Boolean(
    character?.is_primary ||
    character?.isPrimary ||
    character?.favorite ||
    character?.is_favorite ||
    character?.main,
  )
}

export default function Sidebar({ menuItems: menuItemsProp }) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectorRef = useRef(null)
  const { t, translateMenuLabel } = useI18n()

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
    return [...characters].sort(
      (a, b) => Number(isCharacterPrimary(b)) - Number(isCharacterPrimary(a)),
    )
  }, [characters])

  const getCharacterName = (character) =>
    character?.nome || character?.name || t("sidebar.selectCharacter")

  const getCharacterClan = (character) =>
    character?.clan ||
    character?.cla ||
    character?.clã ||
    character?.team ||
    character?.faction ||
    t("sidebar.noClan")

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
            className={
              isOpen
                ? "sidebar__selector-button sidebar__selector-button--open"
                : "sidebar__selector-button"
            }
            onClick={() => setIsOpen((current) => !current)}
            disabled={isSwitchingCharacter}
          >
            <div className="sidebar__selector-text">
              <strong className="sidebar__selector-name">{getCharacterName(activeCharacter)}</strong>
              <span className="sidebar__selector-subtitle">
                {getCharacterClan(activeCharacter)} • {t("sidebar.levelShort")} {getCharacterLevel(activeCharacter)}
              </span>
            </div>

            <svg
              className={
                isOpen
                  ? "sidebar__selector-arrow sidebar__selector-arrow--open"
                  : "sidebar__selector-arrow"
              }
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                d="M5.25 7.5L10 12.5L14.75 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isOpen ? (
            <div className="sidebar__selector-menu">
              {sortedCharacters.length === 0 ? (
                <div className="sidebar__selector-empty">{t("sidebar.noCharacters")}</div>
              ) : (
                sortedCharacters.map((character) => {
                  const isActive = character.id === activeCharacter?.id
                  const isPrimary = isCharacterPrimary(character)

                  return (
                    <div
                      key={character.id}
                      className={
                        isActive
                          ? "sidebar__selector-option sidebar__selector-option--active"
                          : "sidebar__selector-option"
                      }
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
                            {getCharacterClan(character)} • {t("sidebar.levelShort")} {getCharacterLevel(character)}
                          </span>
                        </div>
                      </button>

                      <span
                        className={
                          isPrimary
                            ? "sidebar__selector-favorite sidebar__selector-favorite--active"
                            : "sidebar__selector-favorite"
                        }
                        title={
                          isPrimary
                            ? t("sidebar.favoriteCharacter")
                            : t("sidebar.notFavoriteCharacter")
                        }
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

            const translatedLabel = translateMenuLabel(item.menu_key, item.label)

            if (!item.is_enabled) {
              return (
                <div
                  key={item.menu_key || item.path}
                  className="sidebar__nav-link sidebar__nav-link--locked"
                  aria-disabled="true"
                >
                  <span className="sidebar__nav-label">{translatedLabel}</span>
                  <span className="sidebar__nav-meta">
                    {item.is_beta ? (
                      <span className="sidebar__nav-beta">{t("sidebar.beta")}</span>
                    ) : null}
                    <span
                      className="sidebar__nav-lock"
                      title={t("sidebar.adminLocked")}
                      aria-label={t("sidebar.adminLocked")}
                    >
                      🔒
                    </span>
                  </span>
                </div>
              )
            }

            return (
              <NavLink
                key={item.menu_key || item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive
                    ? "sidebar__nav-link sidebar__nav-link--active"
                    : "sidebar__nav-link"
                }
              >
                <span className="sidebar__nav-label">{translatedLabel}</span>
                {item.is_beta ? <span className="sidebar__nav-beta">{t("sidebar.beta")}</span> : null}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
