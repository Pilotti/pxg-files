'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { STORAGE_KEYS } from "@/constants/storage-keys.js"
import { LANGUAGE_OPTIONS, LOCALE_BY_LANGUAGE, MENU_LABELS, resolveTranslation, SUPPORTED_LANGUAGES } from "@/i18n/translations.js"
import { useAuth } from "@/context/auth-context.jsx"
import { authService } from "@/services/auth-service.js"
import { getStoredValue, setStoredValue } from "@/services/storage.js"
import { useUI } from "@/context/ui-context.jsx"

export const I18nContext = createContext(null)

function normalizeLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : "pt"
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""))
}

export function I18nProvider({ children }) {
  const { user, reloadUser } = useAuth()
  const { showBlockingLoader, hideBlockingLoader } = useUI()
  const [language, setLanguageState] = useState(() => normalizeLanguage(getStoredValue(STORAGE_KEYS.LANGUAGE) || "pt"))

  useEffect(() => {
    const accountLanguage = normalizeLanguage(user?.preferred_language)
    if (!user?.preferred_language) return

    setLanguageState(accountLanguage)
    setStoredValue(STORAGE_KEYS.LANGUAGE, accountLanguage)
  }, [user?.preferred_language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback(async (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage)
    if (normalized === language) {
      return
    }

    const loaderId = showBlockingLoader({
      title: resolveTranslation(normalized, "common.switchingLanguage"),
      text: resolveTranslation(normalized, "common.loading"),
      surface: "brand",
      minDuration: 350,
    })

    setLanguageState(normalized)
    setStoredValue(STORAGE_KEYS.LANGUAGE, normalized)

    if (!user) {
      await hideBlockingLoader(loaderId)
      return
    }

    try {
      await authService.updatePreferences({ preferredLanguage: normalized })
      await reloadUser()
    } catch {
    } finally {
      await hideBlockingLoader(loaderId)
    }
  }, [hideBlockingLoader, language, reloadUser, showBlockingLoader, user])

  const t = useCallback((key, params = {}) => interpolate(resolveTranslation(language, key), params), [language])

  const translateMenuLabel = useCallback((menuKey, fallbackLabel = "") => {
    return MENU_LABELS[menuKey]?.[language] || fallbackLabel || menuKey
  }, [language])

  const value = useMemo(() => ({
    language,
    locale: LOCALE_BY_LANGUAGE[language] || "pt-BR",
    options: LANGUAGE_OPTIONS,
    setLanguage,
    t,
    translateMenuLabel,
  }), [language, setLanguage, t, translateMenuLabel])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }

  return context
}
