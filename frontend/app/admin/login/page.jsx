'use client'

import AdminPublicRoute from '@/components/admin-public-route'
import AdminLoginPage from '@/app/admin-login-page'

export default function Page() {
  return (
    <AdminPublicRoute>
      <AdminLoginPage />
    </AdminPublicRoute>
  )
}
