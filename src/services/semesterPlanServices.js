import apiClient from "./services.js";

export default {
  getAllSemesterPlans(params = {}) {
    return apiClient.get("semesterPlans", { params });
  },
  getSemesterPlan(id) {
    return apiClient.get(`semesterPlans/${id}`);
  },
  createSemesterPlan(semesterPlan) {
    return apiClient.post("semesterPlans", semesterPlan);
  },
  updateSemesterPlan(id, semesterPlan) {
    return apiClient.put(`semesterPlans/${id}`, semesterPlan);
  },
  deleteSemesterPlan(id) {
    return apiClient.delete(`semesterPlans/${id}`);
  },
  importCSV(file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("semesterPlans/import", formData);
  },
};




