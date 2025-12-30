import apiClient from "./services.js";

export default {
  getAllSections(params = {}) {
    return apiClient.get("sections", { params });
  },
  getSectionsWithCount(params = {}) {
    return apiClient.get("sections/withCount", { params });
  },
  getSectionsByUserEmail(email, params = {}) {
    return apiClient.get(`sections/user/${email}`, { params });
  },
  getSection(id) {
    return apiClient.get(`sections/${id}`);
  },
  createSection(section) {
    return apiClient.post("sections", section);
  },
  updateSection(id, section) {
    return apiClient.put(`sections/${id}`, section);
  },
  deleteSection(id) {
    return apiClient.delete(`sections/${id}`);
  },
};

