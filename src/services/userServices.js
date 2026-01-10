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
  importUsersCSV(file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("users/import", formData);
  },
};

