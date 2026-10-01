import apiClient from "./services.js";

export default {
  getForCollegeSemester(collegeId, semesterIds) {
    const ids = Array.isArray(semesterIds) ? semesterIds : [semesterIds];
    return apiClient.get(`/collegeOutcomes`, {
      params: { collegeId, semesterId: ids.filter(Boolean).join(",") },
    });
  },
};
