'use client'

import { useLayoutEffect } from 'react'
import { AuthProvider } from '@/context/auth-context'
import { CharacterProvider } from '@/context/character-context'
import { I18nProvider } from '@/context/i18n-context'
import { UIProvider } from '@/context/ui-context'
import ErrorBoundary from '@/components/error-boundary'
import UIFeedbackLayer from '@/components/ui-feedback-layer'
import { initializeAppPreferences } from '@/services/app-preferences'

function AppPreferencesBootstrap() {
  useLayoutEffect(() => {
    initializeAppPreferences()
  }, [])

  return null
}

export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <UIProvider>
        <AuthProvider>
          <I18nProvider>
            <CharacterProvider>
              <AppPreferencesBootstrap />
              <UIFeedbackLayer />
              {children}
            </CharacterProvider>
          </I18nProvider>
        </AuthProvider>
      </UIProvider>
    </ErrorBoundary>
  )
}
