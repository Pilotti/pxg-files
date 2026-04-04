import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { STORAGE_KEYS } from "../constants/storage-keys.js"
import { authService } from "../services/auth-service.js"
import { getStoredValue } from "../services/storage.js"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const mountedRef = useRef(true)
  const bootstrapRequestIdRef = useRef(0)

  const setBootstrappingState = useCallback((value) => {
    if (mountedRef.current) {
      setIsBootstrapping(value)
    }
  }, [])

  const setUserState = useCallback((value) => {
    if (mountedRef.current) {
      setUser(value)
    }
  }, [])

  const loadCurrentUser = useCallback(async () => {
    const requestId = ++bootstrapRequestIdRef.current
    const token = getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)

    if (!token) {
      if (mountedRef.current && requestId === bootstrapRequestIdRef.current) {
        setUser(null)
        setIsBootstrapping(false)
      }
      return null
    }

    setBootstrappingState(true)

    try {
      const currentUser = await authService.getCurrentUser()

      if (!mountedRef.current || requestId !== bootstrapRequestIdRef.current) {
        return currentUser
      }

      setUser(currentUser)
      return currentUser
    } catch {
      authService.clearSession()

      if (mountedRef.current && requestId === bootstrapRequestIdRef.current) {
        setUser(null)
      }

      return null
    } finally {
      if (mountedRef.current && requestId === bootstrapRequestIdRef.current) {
        setIsBootstrapping(false)
      }
    }
  }, [setBootstrappingState])

  useEffect(() => {
    mountedRef.current = true
    loadCurrentUser()

    return () => {
      mountedRef.current = false
    }
  }, [loadCurrentUser])

  const login = useCallback(async (data) => {
    await authService.login({
      email: data.email,
      password: data.password,
    })

    const currentUser = await authService.getCurrentUser()
    setUserState(currentUser)
    return currentUser
  }, [setUserState])

  const register = useCallback(async (data) => {
    await authService.register({
      displayName: data.displayName,
      email: data.email,
      password: data.password,
    })

    return login({
      email: data.email,
      password: data.password,
    })
  }, [login])

  const logout = useCallback(async () => {
    await authService.logout()
    bootstrapRequestIdRef.current += 1
    setUserState(null)
  }, [setUserState])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      register,
      logout,
      reloadUser: loadCurrentUser,
    }),
    [user, isBootstrapping, login, register, logout, loadCurrentUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
