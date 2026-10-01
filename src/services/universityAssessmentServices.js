import apiClient from "./services.js";

export default {
  getForUniversitySemester(universityId, semesterIds) {
    const ids = Array.isArray(semesterIds) ? semesterIds : [semesterIds];
    return apiClient.get(`/universityAssessments`, {
      params: { universityId, semesterId: ids.filter(Boolean).join(",") },
    });
  },
};
