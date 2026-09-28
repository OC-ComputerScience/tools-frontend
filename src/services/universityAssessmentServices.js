import apiClient from "./services.js";

export default {
  getForUniversitySemester(universityId, semesterId) {
    return apiClient.get(`/universityAssessments`, {
      params: { universityId, semesterId },
    });
  },
};
