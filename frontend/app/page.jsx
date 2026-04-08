'use client'

import PublicRoute from '@/components/public-route'
import { Navigate } from '@/lib/react-router-compat'

export default function Home() {
  return (
    <PublicRoute>
      <Navigate to="/login" replace />
    </PublicRoute>
  )
}
