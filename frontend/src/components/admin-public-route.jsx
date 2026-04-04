import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { adminRequest, clearAdminToken, getAdminToken } from "../services/admin-api.js"

function AdminPublicRouteLoader() {
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

export default function AdminPublicRoute({ children }) {
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
    return <AdminPublicRouteLoader />
  }

  if (status === "authenticated") {
    return <Navigate to="/admin" replace />
  }

  return children
}