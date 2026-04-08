import { STORAGE_KEYS } from "../constants/storage-keys.js"
import { clearStoredValues, getStoredValue, removeStoredValue, setStoredValue } from "./storage.js"
import { parseApiError, safeReadJson } from "./http-client.js"

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim()

let isRefreshing = false
let refreshPromise = null

export function getAccessToken() {
  return getStoredValue(STORAGE_KEYS.ACCESS_TOKEN)
}

export function getRefreshToken() {
  return getStoredValue(STORAGE_KEYS.REFRESH_TOKEN)
}

export function getAdminToken() {
  return getStoredValue(STORAGE_KEYS.ADMIN_TOKEN)
}

export function setSessionTokens({ accessToken, refreshToken }) {
  setStoredValue(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
  setStoredValue(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
}

export function clearUserSession() {
  clearStoredValues([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.ACTIVE_CHARACTER_ID,
  ])
}

export function setAdminToken(token) {
  setStoredValue(STORAGE_KEYS.ADMIN_TOKEN, token)
}

export function clearAdminSession() {
  removeStoredValue(STORAGE_KEYS.ADMIN_TOKEN)
}

async function requestNewAccessToken() {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    clearUserSession()
    throw new Error("Sessão expirada")
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    clearUserSession()

    const errorData = await safeReadJson(response)
    throw new Error(parseApiError(errorData, "Sessão expirada"))
  }

  const data = await response.json()

  setSessionTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  })

  return data.access_token
}

export async function refreshAccessToken() {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = requestNewAccessToken()

  try {
    return await refreshPromise
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}
