import { apiRequest } from "./api.js"

export const charactersService = {
  list() {
    return apiRequest("/characters")
  },

  create(data) {
    return apiRequest("/characters", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update(id, data) {
    return apiRequest(`/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  remove(id) {
    return apiRequest(`/characters/${id}`, {
      method: "DELETE",
    })
  },

  setFavorite(id) {
    return apiRequest(`/characters/${id}/favorite`, {
      method: "PATCH",
    })
  },
}
