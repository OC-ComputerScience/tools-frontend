import apiClient from "./services.js";

export default {
  getForUniversitySemester(universityId, semesterId) {
    return apiClient.get(`/coreAssessments`, {
      params: { universityId, semesterId },
    });
  },
};
