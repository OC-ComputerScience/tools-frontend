import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/assessmentScores`);
  },
  get(id) {
    return apiClient.get(`/assessmentScores/${id}`);
  },
  create(data) {
    return apiClient.post(`/assessmentScores`, data);
  },
  update(id, data) {
    return apiClient.put(`/assessmentScores/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/assessmentScores/${id}`);
  },
};
