'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import HomePage from '@/app/home-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <HomePage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
