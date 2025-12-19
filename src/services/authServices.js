import apiClient from "./services.js";

export default {
  loginUser(user) {
    return apiClient.post("login", user);
  },
  logoutUser(token) {
    return apiClient.post("logout", token);
  },
};

