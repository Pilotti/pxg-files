'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import QuestsPage from '@/app/quests-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <QuestsPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
