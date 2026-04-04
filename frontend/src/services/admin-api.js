import { createHttpClient } from "./http-client.js"
import {
  API_URL,
  clearAdminSession,
  getAdminToken as readAdminToken,
  setAdminToken as persistAdminToken,
} from "./session-manager.js"

const adminClient = createHttpClient({
  baseUrl: API_URL,
  getAccessToken: readAdminToken,
  onUnauthorized: clearAdminSession,
  defaultHeaders: {
    "Content-Type": "application/json",
  },
})

export function getAdminToken() {
  return readAdminToken()
}

export function setAdminToken(token) {
  persistAdminToken(token)
}

export function clearAdminToken() {
  clearAdminSession()
}

export async function adminRequest(path, options = {}) {
  return adminClient.request(path, options, false)
}
