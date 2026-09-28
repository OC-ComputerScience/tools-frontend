import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/departments`);
  },
  getByUniversityId(universityId) {
    return apiClient.get(`/departments/university/${universityId}`);
  },
  get(id) {
    return apiClient.get(`/departments/${id}`);
  },
  create(data) {
    return apiClient.post(`/departments`, data);
  },
  update(id, data) {
    return apiClient.put(`/departments/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/departments/${id}`);
  },
};
