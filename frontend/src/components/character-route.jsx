import { Navigate } from "react-router-dom"
import { useCharacter } from "../context/character-context.jsx"
import RouteLoader from "./route-loader.jsx"

export default function CharacterRoute({ children }) {
  const {
    activeCharacter,
    hasCharacters,
    hasResolvedCharacters,
    isLoadingCharacters,
    isSwitchingCharacter,
  } = useCharacter()

  if (!hasResolvedCharacters || isLoadingCharacters) {
    return (
      <RouteLoader
        title="Carregando personagens"
        text="Restaurando seus dados..."
      />
    )
  }

  if (isSwitchingCharacter) {
    return (
      <RouteLoader
        title="Trocando personagem"
        text="Aplicando o novo contexto do personagem selecionado..."
      />
    )
  }

  if (!hasCharacters || !activeCharacter) {
    return <Navigate to="/primeiro-personagem" replace />
  }

  return children
}
