import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get(`/universityCourses`);
  },
  getByUniversityId (universityId)  {
    return apiClient.get(`/universityCourses/university/${universityId}`);
  },
  get(id) {
    return apiClient.get(`/universityCourses/${id}`);
  },
  create(data) {
    return apiClient.post(`/universityCourses`, data);
  },
  update(id, data) {
    return apiClient.put(`/universityCourses/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/universityCourses/${id}`);
  },
}; 