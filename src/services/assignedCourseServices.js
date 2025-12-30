import apiClient from "./services.js";

export default {
  getAllAssignedCourses(params = {}) {
    return apiClient.get("assignedCourses", { params });
  },
  getAssignedCourseBySectionId(sectionId) {
    return apiClient.get(`assignedCourses/section/${sectionId}`);
  },
  getAssignedCourse(id) {
    return apiClient.get(`assignedCourses/${id}`);
  },
  createAssignedCourse(assignedCourse) {
    return apiClient.post("assignedCourses", assignedCourse);
  },
  updateAssignedCourse(id, assignedCourse) {
    return apiClient.put(`assignedCourses/${id}`, assignedCourse);
  },
  deleteAssignedCourse(id) {
    return apiClient.delete(`assignedCourses/${id}`);
  },
  deleteAssignedCourseBySectionId(sectionId) {
    return apiClient.delete(`assignedCourses/section/${sectionId}`);
  },
};

