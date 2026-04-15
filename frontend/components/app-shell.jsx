'use client'

import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "@/lib/react-router-compat"
import { apiRequest } from "../services/api.js"
import { FALLBACK_SIDEBAR_MENU_ITEMS } from "../constants/sidebar-menu-fallback.js"
import Sidebar from "./sidebar.jsx"
import CharacterSwitchOverlay from "./character-switch-overlay.jsx"
import { useCharacter } from "../context/character-context.jsx"
import "../styles/app-shell.css"

function normalizePath(path) {
  if (!path) return "/"
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1)
  }
  return path
}

function isPathMatch(menuPath, currentPath) {
  const normalizedMenuPath = normalizePath(menuPath)
  const normalizedCurrentPath = normalizePath(currentPath)

  return (
    normalizedCurrentPath === normalizedMenuPath ||
    normalizedCurrentPath.startsWith(`${normalizedMenuPath}/`)
  )
}

export default function AppShell({ children }) {
  const { isSwitchingCharacter, characterSwitchText } = useCharacter()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuItems, setMenuItems] = useState(FALLBACK_SIDEBAR_MENU_ITEMS)

  useEffect(() => {
    let isMounted = true

    async function loadSidebarMenus() {
      try {
        const data = await apiRequest("/ui/sidebar-menus")
        if (!Array.isArray(data) || !isMounted) return

        const missingFallbackItems = FALLBACK_SIDEBAR_MENU_ITEMS.filter((fallbackItem) => (
          !data.some((item) => item?.menu_key === fallbackItem.menu_key)
        ))
        const normalized = [...data, ...missingFallbackItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        if (normalized.length) {
          setMenuItems(normalized)
        }
      } catch {
      }
    }

    loadSidebarMenus()

    return () => {
      isMounted = false
    }
  }, [])

  const enabledPaths = useMemo(() => {
    return menuItems
      .filter((item) => item?.is_enabled && item?.path)
      .map((item) => normalizePath(item.path))
  }, [menuItems])

  useEffect(() => {
    if (!location?.pathname) return

    const blockedItem = menuItems.find((item) => {
      if (!item?.path || item.is_enabled) return false
      return isPathMatch(item.path, location.pathname)
    })

    if (!blockedItem) {
      return
    }

    const targetPath =
      enabledPaths.find((path) => path === "/inicio") ||
      enabledPaths[0]

    if (targetPath && targetPath !== normalizePath(location.pathname)) {
      navigate(targetPath, { replace: true })
    }
  }, [enabledPaths, location?.pathname, menuItems, navigate])

  return (
    <div className="app-shell">
      {isSwitchingCharacter && (
        <CharacterSwitchOverlay text={characterSwitchText} />
      )}

      <div className="page">
        <div className="page__inner">
          <div className="app-layout">
            <Sidebar menuItems={menuItems} />
            <main className="app-layout__content">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
