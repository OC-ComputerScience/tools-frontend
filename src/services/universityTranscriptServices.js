import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/universityTranscripts`);
  },
  get(id) {
    return apiClient.get(`/universityTranscripts/${id}`);
  },
  create(data) {
    return apiClient.post(`/universityTranscripts`, data);
  },
  update(id, data) {
    return apiClient.put(`/universityTranscripts/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/universityTranscripts/${id}`);
  },
}; 