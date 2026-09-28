import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/universityOutcomes`);
  },
  getByUniversityId(universityId) {
    return apiClient.get(`/universityOutcomes/university/${universityId}`);
  },
  get(id) {
    return apiClient.get(`/universityOutcomes/${id}`);
  },
  create(data) {
    return apiClient.post(`/universityOutcomes`, data);
  },
  update(id, data) {
    return apiClient.put(`/universityOutcomes/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/universityOutcomes/${id}`);
  },
};
