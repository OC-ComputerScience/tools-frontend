import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/departmentOutcomes`);
  },
  getByDepartmentId(departmentId) {
    return apiClient.get(`/departmentOutcomes/department/${departmentId}`);
  },
  get(id) {
    return apiClient.get(`/departmentOutcomes/${id}`);
  },
  create(data) {
    return apiClient.post(`/departmentOutcomes`, data);
  },
  update(id, data) {
    return apiClient.put(`/departmentOutcomes/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/departmentOutcomes/${id}`);
  },
};
