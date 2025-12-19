import apiClient from "./services.js";

export default {
  getAllCourses(params = {}) {
    return apiClient.get("courses", { params });
  },
  getCoursesWithCount(params = {}) {
    return apiClient.get("courses/withCount", { params });
  },
  getCoursesByUserEmail(email, params = {}) {
    return apiClient.get(`courses/user/${email}`, { params });
  },
  getCourse(id) {
    return apiClient.get(`courses/${id}`);
  },
  createCourse(course) {
    return apiClient.post("courses", course);
  },
  updateCourse(id, course) {
    return apiClient.put(`courses/${id}`, course);
  },
  deleteCourse(id) {
    return apiClient.delete(`courses/${id}`);
  },
};

