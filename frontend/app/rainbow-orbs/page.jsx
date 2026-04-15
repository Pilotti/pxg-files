'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import RainbowOrbsPage from '@/app/rainbow-orbs-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <RainbowOrbsPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
