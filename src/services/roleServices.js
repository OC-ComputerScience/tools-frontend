import apiClient from "./services.js";

export default {
  getAllRoles() {
    return apiClient.get("roles");
  },
  getRole(id) {
    return apiClient.get(`roles/${id}`);
  },
  createRole(role) {
    return apiClient.post("roles", role);
  },
  updateRole(id, role) {
    return apiClient.put(`roles/${id}`, role);
  },
  deleteRole(id) {
    return apiClient.delete(`roles/${id}`);
  },
};




