'use client'

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@/lib/react-router-compat"
import AdminShell from "@/components/admin/admin-shell.jsx"
import AdminToast from "@/components/admin/admin-toast.jsx"
import AliasesAdminTab from "@/components/admin/tabs/aliases-admin-tab.jsx"
import ConsumablesAdminTab from "@/components/admin/tabs/consumables-admin-tab.jsx"
import NpcPricesAdminTab from "@/components/admin/tabs/npc-prices-admin-tab.jsx"
import OcrReviewAdminTab from "@/components/admin/tabs/ocr-review-admin-tab.jsx"
import PokemonAdminTab from "@/components/admin/tabs/pokemon-admin-tab.jsx"
import QuestsAdminTab from "@/components/admin/tabs/quests-admin-tab.jsx"
import SidebarAdminTab from "@/components/admin/tabs/sidebar-admin-tab.jsx"
import TasksAdminTab from "@/components/admin/tabs/tasks-admin-tab.jsx"
import UsersAdminTab from "@/components/admin/tabs/users-admin-tab.jsx"
import { adminRequest, clearAdminToken, getAdminToken } from "@/services/admin-api.js"
import { readAppPreferences } from "@/services/app-preferences.js"

export default function AdminPage() {
  const navigate = useNavigate()
  const preferences = useMemo(() => readAppPreferences(), [])
  const confirmBeforeRemoving = preferences.confirmBeforeRemoving !== false

  const [activeTab, setActiveTab] = useState("tasks")
  const [adminName, setAdminName] = useState("")
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function bootstrapAdmin() {
      if (!getAdminToken()) {
        navigate("/admin/login", { replace: true })
        return
      }

      try {
        const data = await adminRequest("/admin/me")
        if (isMounted) {
          setAdminName(data?.username || "admin")
        }
      } catch {
        clearAdminToken()
        if (isMounted) {
          navigate("/admin/login", { replace: true })
        }
      }
    }

    bootstrapAdmin()

    return () => {
      isMounted = false
    }
  }, [navigate])

  useEffect(() => {
    if (!toast) return undefined

    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  function showSuccess(message) {
    setToast({ type: "success", message })
  }

  function showError(message) {
    setToast({ type: "error", message })
  }

  function handleLogout() {
    clearAdminToken()
    navigate("/admin/login", { replace: true })
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "tasks":
        return (
          <TasksAdminTab
            confirmBeforeRemoving={confirmBeforeRemoving}
            showError={showError}
            showSuccess={showSuccess}
          />
        )
      case "quests":
        return (
          <QuestsAdminTab
            confirmBeforeRemoving={confirmBeforeRemoving}
            showError={showError}
            showSuccess={showSuccess}
          />
        )
      case "aliases":
        return <AliasesAdminTab showError={showError} showSuccess={showSuccess} />
      case "ocr-review":
        return <OcrReviewAdminTab showError={showError} showSuccess={showSuccess} />
      case "npc-prices":
        return <NpcPricesAdminTab showError={showError} showSuccess={showSuccess} />
      case "consumables":
        return <ConsumablesAdminTab showError={showError} showSuccess={showSuccess} />
      case "users":
        return <UsersAdminTab showError={showError} showSuccess={showSuccess} />
      case "pokemon":
        return <PokemonAdminTab showError={showError} showSuccess={showSuccess} />
      case "sidebar":
        return <SidebarAdminTab showError={showError} showSuccess={showSuccess} />
      default:
        return (
          <TasksAdminTab
            confirmBeforeRemoving={confirmBeforeRemoving}
            showError={showError}
            showSuccess={showSuccess}
          />
        )
    }
  }

  return (
    <>
      <AdminToast toast={toast} onClose={() => setToast(null)} />
      <AdminShell
        adminName={adminName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      >
        {renderActiveTab()}
      </AdminShell>
    </>
  )
}
