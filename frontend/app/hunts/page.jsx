'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import HuntsPage from '@/app/hunts-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <HuntsPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
