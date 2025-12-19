import apiClient from "./services.js";

export default {
  getAllAssignedCourses(params = {}) {
    return apiClient.get("assignedCourses", { params });
  },
  getAssignedCourseByCourseId(courseId) {
    return apiClient.get(`assignedCourses/course/${courseId}`);
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
  deleteAssignedCourseByCourseId(courseId) {
    return apiClient.delete(`assignedCourses/course/${courseId}`);
  },
};

