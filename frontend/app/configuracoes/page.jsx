'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import ConfiguracoesPage from '@/app/configuracoes-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <ConfiguracoesPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
