'use client'

import PublicRoute from '@/components/public-route'
import LoginPage from '@/app/login-page'

export default function Page() {
  return (
    <PublicRoute>
      <LoginPage />
    </PublicRoute>
  )
}
