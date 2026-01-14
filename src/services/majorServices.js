import apiClient from "./services.js";

export default {
  getAllMajors() {
    return apiClient.get("majors");
  },
  getMajor(id) {
    return apiClient.get(`majors/${id}`);
  },
  createMajor(major) {
    return apiClient.post("majors", major);
  },
  updateMajor(id, major) {
    return apiClient.put(`majors/${id}`, major);
  },
  deleteMajor(id) {
    return apiClient.delete(`majors/${id}`);
  },
};




