import { createHttpClient, parseApiError } from "./http-client.js"
import { API_URL, clearUserSession, getAccessToken, refreshAccessToken } from "./session-manager.js"

const client = createHttpClient({
  baseUrl: API_URL,
  getAccessToken,
  refreshAccessToken,
  onUnauthorized: clearUserSession,
  defaultHeaders: {
    "Content-Type": "application/json",
  },
})

export { API_URL, parseApiError }

export async function apiRequest(path, options = {}, retry = true) {
  return client.request(path, options, retry)
}
