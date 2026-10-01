import apiClient from "./services.js";

export default {
  getForDepartmentSemester(departmentId, semesterIds) {
    const ids = Array.isArray(semesterIds) ? semesterIds : [semesterIds];
    return apiClient.get(`/departmentAssessments`, {
      params: { departmentId, semesterId: ids.filter(Boolean).join(",") },
    });
  },
};
