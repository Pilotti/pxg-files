import { Navigate } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"
import RouteLoader from "./route-loader.jsx"

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return (
      <RouteLoader
        title="Carregando sessão"
        text="Validando sua autenticação..."
      />
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
