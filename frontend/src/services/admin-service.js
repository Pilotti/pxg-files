import { adminRequest, clearAdminToken, setAdminToken } from "./admin-api.js"

export const adminService = {
  async login({ username, password }) {
    const response = await adminRequest("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })

    if (response?.access_token) {
      setAdminToken(response.access_token)
    }

    return response
  },

  logout() {
    clearAdminToken()
  },

  me() {
    return adminRequest("/admin/me")
  },

  listTasks(params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return
      query.append(key, String(value))
    })
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return adminRequest(`/admin/tasks${suffix}`)
  },

  createTask(payload) {
    return adminRequest("/admin/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  updateTask(id, payload) {
    return adminRequest(`/admin/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  deleteTask(id) {
    return adminRequest(`/admin/tasks/${id}`, {
      method: "DELETE",
    })
  },

  listQuests(params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return
      query.append(key, String(value))
    })
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return adminRequest(`/admin/quests${suffix}`)
  },

  createQuest(payload) {
    return adminRequest("/admin/quests", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  updateQuest(id, payload) {
    return adminRequest(`/admin/quests/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  deleteQuest(id) {
    return adminRequest(`/admin/quests/${id}`, {
      method: "DELETE",
    })
  },
}
