import { apiRequest } from "./api.js"
import { clearUserSession, getRefreshToken, setSessionTokens } from "./session-manager.js"

export const authService = {
  async getCurrentUser() {
    return apiRequest("/auth/me")
  },

  async login({ email, password }) {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    })

    setSessionTokens({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    })

    return response
  },

  async register({ displayName, email, password }) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        display_name: displayName.trim(),
        email: email.trim(),
        password,
      }),
    })
  },

  async logout() {
    const refreshToken = getRefreshToken()

    if (refreshToken) {
      try {
        await apiRequest("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
      } catch {
        // limpeza local continua mesmo se falhar remotamente
      }
    }

    clearUserSession()
  },

  clearSession() {
    clearUserSession()
  },
}
