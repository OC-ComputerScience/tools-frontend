import apiClient from "./services.js";

export default {
  getAllUsers() {
    return apiClient.get("users");
  },
  getUser(id) {
    return apiClient.get(`users/${id}`);
  },
  updateUser(id, user) {
    return apiClient.put(`users/${id}`, user);
  },
};

