import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/assignments`);
  },
  getByDepartmentId(departmentId) {
    return apiClient.get(`/assignments/department/${departmentId}`);
  },
  get(id) {
    return apiClient.get(`/assignments/${id}`);
  },
  create(data) {
    return apiClient.post(`/assignments`, data);
  },
  update(id, data) {
    return apiClient.put(`/assignments/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/assignments/${id}`);
  },
};
