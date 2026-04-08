'use client'

import PrivateRoute from '@/components/private-route'
import CharacterRoute from '@/components/character-route'
import TasksPage from '@/app/tasks-page'

export default function Page() {
  return (
    <PrivateRoute>
      <CharacterRoute>
        <TasksPage />
      </CharacterRoute>
    </PrivateRoute>
  )
}
