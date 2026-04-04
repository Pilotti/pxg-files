function joinUrl(baseUrl, path) {
  if (!path) return baseUrl

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedBase = baseUrl.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export function parseApiError(errorData, fallbackMessage = "Erro na requisição") {
  if (!errorData) return fallbackMessage

  if (typeof errorData === "string") {
    return errorData
  }

  if (typeof errorData.detail === "string") {
    return errorData.detail
  }

  if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
    return errorData.detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .join(", ")
  }

  if (typeof errorData.message === "string") {
    return errorData.message
  }

  return fallbackMessage
}

export async function safeReadJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function createHttpClient({
  baseUrl,
  getAccessToken,
  refreshAccessToken,
  onUnauthorized,
  defaultHeaders,
} = {}) {
  async function request(path, options = {}, retry = true) {
    const token = getAccessToken ? getAccessToken() : null
    const headers = {
      ...(defaultHeaders || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    }

    const response = await fetch(joinUrl(baseUrl, path), {
      ...options,
      headers,
    })

    if (response.status === 401 && retry && typeof refreshAccessToken === "function") {
      try {
        const refreshedToken = await refreshAccessToken()

        return request(
          path,
          {
            ...options,
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${refreshedToken}`,
            },
          },
          false,
        )
      } catch (error) {
        if (typeof onUnauthorized === "function") {
          onUnauthorized(error)
        }
        throw error
      }
    }

    if (response.status === 401 && typeof onUnauthorized === "function") {
      onUnauthorized()
    }

    if (!response.ok) {
      const errorData = await safeReadJson(response)
      throw new Error(parseApiError(errorData, "Erro na requisição"))
    }

    if (response.status === 204) {
      return null
    }

    return safeReadJson(response)
  }

  return {
    request,
  }
}
