import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/universities`);
  },
  get(id) {
    return apiClient.get(`/universities/${id}`);
  },
  create(data) {
    return apiClient.post(`/universities`, data);
  },
  update(id, data) {
    return apiClient.put(`/universities/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/universities/${id}`);
  },
}; 