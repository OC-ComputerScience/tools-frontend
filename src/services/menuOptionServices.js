import apiClient from "./services.js";

export default {
  getAllMenuOptions() {
    return apiClient.get("menuOptions");
  },
  getMenuOption(id) {
    return apiClient.get(`menuOptions/${id}`);
  },
  createMenuOption(menuOption) {
    return apiClient.post("menuOptions", menuOption);
  },
  updateMenuOption(id, menuOption) {
    return apiClient.put(`menuOptions/${id}`, menuOption);
  },
  deleteMenuOption(id) {
    return apiClient.delete(`menuOptions/${id}`);
  },
};

