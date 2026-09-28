import apiClient from "./services.js";

export default {
  getForCollegeSemester(collegeId, semesterId) {
    return apiClient.get(`/collegeOutcomes`, {
      params: { collegeId, semesterId },
    });
  },
};
