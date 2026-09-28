import apiClient from "./services.js";

export default {
  getForDepartmentSemester(departmentId, semesterId) {
    return apiClient.get(`/departmentAssessments`, {
      params: { departmentId, semesterId },
    });
  },
};
