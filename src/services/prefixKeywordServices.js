import apiClient from "./services.js";

export default {
  getAllPrefixKeywords() {
    return apiClient.get("prefixKeywords");
  },
  getPrefixKeyword(id) {
    return apiClient.get(`prefixKeywords/${id}`);
  },
  createPrefixKeyword(prefixKeyword) {
    return apiClient.post("prefixKeywords", prefixKeyword);
  },
  updatePrefixKeyword(id, prefixKeyword) {
    return apiClient.put(`prefixKeywords/${id}`, prefixKeyword);
  },
  deletePrefixKeyword(id) {
    return apiClient.delete(`prefixKeywords/${id}`);
  },
};
