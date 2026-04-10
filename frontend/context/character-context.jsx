import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { apiRequest } from "../services/api.js"
import { STORAGE_KEYS } from "../constants/storage-keys.js"
import { useAuth } from "./auth-context.jsx"

const CharacterContext = createContext(null)

function getStoredActiveCharacterId() {
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHARACTER_ID)
  const parsed = Number(raw)

  if (!raw || Number.isNaN(parsed)) {
    return null
  }

  return parsed
}

function persistActiveCharacterId(id) {
  if (!id) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHARACTER_ID)
    return
  }

  localStorage.setItem(STORAGE_KEYS.ACTIVE_CHARACTER_ID, String(id))
}

function resolveCharacterSelection(characters, preferredId = null) {
  if (!characters.length) return null

  if (preferredId && characters.some((character) => character.id === preferredId)) {
    return preferredId
  }

  const favorite = characters.find((character) => character.is_favorite)
  if (favorite) return favorite.id

  return characters[0].id
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function CharacterProvider({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth()

  const [characters, setCharacters] = useState([])
  const [activeCharacterId, setActiveCharacterIdState] = useState(null)
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [hasResolvedCharacters, setHasResolvedCharacters] = useState(false)
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false)

  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  const resetCharactersState = useCallback(() => {
    setCharacters([])
    setActiveCharacterIdState(null)
    setIsLoadingCharacters(false)
    setHasResolvedCharacters(false)
    setIsSwitchingCharacter(false)
    persistActiveCharacterId(null)
  }, [])

  const applySelection = useCallback((data, preferredId = null) => {
    const resolvedId = resolveCharacterSelection(data, preferredId)

    setCharacters(data)

    if (resolvedId) {
      setActiveCharacterIdState(resolvedId)
      persistActiveCharacterId(resolvedId)
    } else {
      setActiveCharacterIdState(null)
      persistActiveCharacterId(null)
    }

    return resolvedId
  }, [])

  const loadCharacters = useCallback(async (options = {}) => {
    const { preferredId = null } = options

    if (!isAuthenticated) {
      if (mountedRef.current) {
        resetCharactersState()
      }
      return []
    }

    const requestId = ++requestIdRef.current

    if (mountedRef.current) {
      setIsLoadingCharacters(true)
    }

    try {
      const data = await apiRequest("/characters")

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return data
      }

      const storedId = getStoredActiveCharacterId()
      const effectivePreferredId = preferredId ?? storedId
      applySelection(data, effectivePreferredId)

      return data
    } catch (error) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setCharacters([])
        setActiveCharacterIdState(null)
        persistActiveCharacterId(null)
      }

      throw error
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setIsLoadingCharacters(false)
        setHasResolvedCharacters(true)
      }
    }
  }, [applySelection, isAuthenticated, resetCharactersState])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isBootstrapping) {
      return
    }

    if (!isAuthenticated) {
      requestIdRef.current += 1
      resetCharactersState()
      return
    }

    setHasResolvedCharacters(false)
    loadCharacters().catch(() => {})
  }, [isAuthenticated, isBootstrapping, loadCharacters, resetCharactersState])

  const setActiveCharacterId = useCallback((id) => {
    if (!id) {
      setActiveCharacterIdState(null)
      persistActiveCharacterId(null)
      return
    }

    setActiveCharacterIdState(id)
    persistActiveCharacterId(id)
  }, [])

  const switchCharacter = useCallback(async (id, options = {}) => {
    const { minDuration = 1000 } = options

    if (!id || id === activeCharacterId) {
      return activeCharacterId
    }

    setIsSwitchingCharacter(true)
    setActiveCharacterId(id)

    try {
      await Promise.all([
        loadCharacters({ preferredId: id }),
        wait(minDuration),
      ])

      return id
    } finally {
      if (mountedRef.current) {
        setIsSwitchingCharacter(false)
      }
    }
  }, [activeCharacterId, loadCharacters, setActiveCharacterId])

  const addCharacter = useCallback(async (data) => {
    const created = await apiRequest("/characters", {
      method: "POST",
      body: JSON.stringify(data),
    })

    await loadCharacters({ preferredId: created?.id ?? null })
    return created
  }, [loadCharacters])

  const updateCharacter = useCallback(async (id, data) => {
    const updated = await apiRequest(`/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })

    await loadCharacters({ preferredId: activeCharacterId === id ? id : null })
    return updated
  }, [activeCharacterId, loadCharacters])

  const removeCharacter = useCallback(async (id) => {
    const response = await apiRequest(`/characters/${id}`, {
      method: "DELETE",
    })

    const preferredId = activeCharacterId === id ? null : activeCharacterId
    await loadCharacters({ preferredId })
    return response
  }, [activeCharacterId, loadCharacters])

  const setFavorite = useCallback(async (id) => {
    await apiRequest(`/characters/${id}/favorite`, {
      method: "PATCH",
    })

    await loadCharacters({ preferredId: activeCharacterId ?? id })
  }, [activeCharacterId, loadCharacters])

  const activeCharacter = useMemo(() => {
    return characters.find((character) => character.id === activeCharacterId) || null
  }, [characters, activeCharacterId])

  const value = useMemo(() => ({
    characters,
    activeCharacter,
    activeCharacterId,
    hasCharacters: characters.length > 0,
    isLoadingCharacters,
    hasResolvedCharacters,
    isSwitchingCharacter,
    loadCharacters,
    setActiveCharacterId,
    switchCharacter,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setFavorite,
  }), [
    characters,
    activeCharacter,
    activeCharacterId,
    isLoadingCharacters,
    hasResolvedCharacters,
    isSwitchingCharacter,
    loadCharacters,
    setActiveCharacterId,
    switchCharacter,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setFavorite,
  ])

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>
}

export function useCharacter() {
  const context = useContext(CharacterContext)

  if (!context) {
    throw new Error("useCharacter must be used within CharacterProvider")
  }

  return context
}
