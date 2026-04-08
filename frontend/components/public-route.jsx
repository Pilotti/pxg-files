import { Navigate } from "@/lib/react-router-compat";
import { getStartupPagePreference } from "../services/app-preferences.js";
import { useAuth } from "../context/auth-context.jsx";
import { useCharacter } from "../context/character-context.jsx";
import RouteLoader from "./route-loader.jsx";

export default function PublicRoute({ children }) {
  const { isAuthenticated, isBootstrapping, isInitializing } = useAuth();
  const {
    isLoadingCharacters = false,
    hasResolvedCharacters = true,
    characters = [],
  } = useCharacter();

  const authLoading = Boolean(isBootstrapping || isInitializing);

  if (authLoading || (isAuthenticated && (isLoadingCharacters || !hasResolvedCharacters))) {
    return <RouteLoader text="Carregando..." />;
  }

  if (isAuthenticated) {
    if (Array.isArray(characters) && characters.length === 0) {
      return <Navigate to="/primeiro-personagem" replace />;
    }

    const startupPage = getStartupPagePreference();
    return <Navigate to={startupPage || "/inicio"} replace />;
  }

  return children;
}
