import apiClient from "./services.js";

export default {
  getAllTerms() {
    return apiClient.get("terms");
  },
  getTerm(id) {
    return apiClient.get(`terms/${id}`);
  },
  createTerm(term) {
    return apiClient.post("terms", term);
  },
  updateTerm(id, term) {
    return apiClient.put(`terms/${id}`, term);
  },
  deleteTerm(id) {
    return apiClient.delete(`terms/${id}`);
  },
};

