import axios from "axios";
import Utils from "../config/utils.js";
import AuthServices from "./authServices.js";
import router from "../router.js";

var baseurl = "";
if (import.meta.env.DEV) {
  baseurl = "http://localhost/tools/";
} else {
  baseurl = "/tools/";
}

const apiClient = axios.create({
  baseURL: baseurl,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  transformRequest: (data, headers) => {
    let user = Utils.getStore("user");
    if (user != null) {
      let token = user.token;
      let authHeader = "";
      if (token != null && token != "") authHeader = "Bearer " + token;
      headers["Authorization"] = authHeader;
    }
    return JSON.stringify(data);
  },
  transformResponse: function (data) {
    data = JSON.parse(data);
    if (data.message !== undefined && data.message.includes("Unauthorized")) {
      AuthServices.logoutUser(Utils.getStore("user"))
        .then((response) => {
          Utils.removeItem("user");
          router.push({ name: "login" });
        })
        .catch((error) => {
          console.log("error", error);
        });
    }
    return data;
  },
});

export default apiClient;

