import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    return apiClient.get(`/assignmentGrades`, { params });
  },
  get(id) {
    return apiClient.get(`/assignmentGrades/${id}`);
  },
  create(data) {
    return apiClient.post(`/assignmentGrades`, data);
  },
  update(id, data) {
    return apiClient.put(`/assignmentGrades/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/assignmentGrades/${id}`);
  },
  importFromCanvas(semesterId) {
    return apiClient.post(`/assignmentGrades/import`, { semesterId }, { timeout: 600000 });
  },
  clearForSemester(semesterId) {
    return apiClient.post(`/assignmentGrades/clear`, { semesterId });
  },
};
