import { Navigate } from "@/lib/react-router-compat"
import { useAuth } from "../context/auth-context.jsx"
import RouteLoader from "./route-loader.jsx"

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return <RouteLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
