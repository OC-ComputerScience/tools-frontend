import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/catalogs`);
  },
  get(id) {
    return apiClient.get(`/catalogs/${id}`);
  },
  create(data) {
    return apiClient.post(`/catalogs`, data);
  },
  update(id, data) {
    return apiClient.put(`/catalogs/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/catalogs/${id}`);
  },
}; 