'use client'

import { AuthProvider } from '@/context/auth-context'
import { CharacterProvider } from '@/context/character-context'
import { UIProvider } from '@/context/ui-context'
import ErrorBoundary from '@/components/error-boundary'
import UIFeedbackLayer from '@/components/ui-feedback-layer'

export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <UIProvider>
        <AuthProvider>
          <CharacterProvider>
            <UIFeedbackLayer />
            {children}
          </CharacterProvider>
        </AuthProvider>
      </UIProvider>
    </ErrorBoundary>
  )
}
