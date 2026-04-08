'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import DiariaPage from '@/app/diarias-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <DiariaPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
