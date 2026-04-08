import { useEffect, useState } from "react"
import { Navigate } from "@/lib/react-router-compat"
import { adminRequest, clearAdminToken, getAdminToken } from "../services/admin-api.js"

function AdminRouteLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: "1rem",
      }}
    >
      Verificando sessão admin...
    </div>
  )
}

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState("checking")

  useEffect(() => {
    let isMounted = true

    async function validateAdminSession() {
      const token = getAdminToken()

      if (!token) {
        if (isMounted) {
          setStatus("unauthenticated")
        }
        return
      }

      try {
        await adminRequest("/admin/me")
        if (isMounted) {
          setStatus("authenticated")
        }
      } catch {
        clearAdminToken()
        if (isMounted) {
          setStatus("unauthenticated")
        }
      }
    }

    validateAdminSession()

    return () => {
      isMounted = false
    }
  }, [])

  if (status === "checking") {
    return <AdminRouteLoader />
  }

  if (status === "unauthenticated") {
    return <Navigate to="/admin/login" replace />
  }

  return children
}