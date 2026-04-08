'use client'

import PrivateRoute from '@/components/private-route'
import FirstCharacterPage from '@/app/first-character-page'

export default function Page() {
  return (
    <PrivateRoute>
      <FirstCharacterPage />
    </PrivateRoute>
  )
}
