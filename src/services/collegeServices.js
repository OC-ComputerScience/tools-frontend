import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/colleges`);
  },
  get(id) {
    return apiClient.get(`/colleges/${id}`);
  },
  create(data) {
    return apiClient.post(`/colleges`, data);
  },
  update(id, data) {
    return apiClient.put(`/colleges/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/colleges/${id}`);
  },
};
