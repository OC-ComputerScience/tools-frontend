<script setup>
import { ref, onMounted } from "vue";
import AuthServices from "../services/authServices";
import Utils from "../config/utils.js";
import { useRouter } from "vue-router";

const router = useRouter();
const fName = ref("");
const lName = ref("");
const user = ref({});

const loginWithGoogle = () => {
  window.handleCredentialResponse = handleCredentialResponse;
  const client = import.meta.env.VITE_APP_CLIENT_ID;
  
  if (!client) {
    console.error("VITE_APP_CLIENT_ID is not set in the environment variables");
    alert("Google OAuth configuration error: VITE_APP_CLIENT_ID is missing. Please check your .env file.");
    return;
  }
  
  if (!window.google || !window.google.accounts) {
    console.error("Google accounts script not loaded");
    return;
  }
  
  window.google.accounts.id.initialize({
    client_id: client,
    cancel_on_tap_outside: false,
    auto_select: true,
    callback: window.handleCredentialResponse,
  });
  window.google.accounts.id.renderButton(document.getElementById("parent_id"), {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signup_with",
    width: 400,
  });
};

const isAdminUser = (userData) => {
  if (!userData) return false;
  if (userData.isAdmin === true) return true;
  if (userData.roles && Array.isArray(userData.roles)) {
    return userData.roles.some(
      (role) =>
        role.id === 1 ||
        (role.name || "").toLowerCase() === "admin"
    );
  }
  return false;
};

const handleCredentialResponse = async (response) => {
  let token = {
    credential: response.credential,
  };
  await AuthServices.loginUser(token)
    .then((response) => {
      user.value = response.data;
      Utils.setStore("user", user.value);
      fName.value = user.value.fName;
      lName.value = user.value.lName;

      // Redirect: Admin to Admin Home, Faculty to Faculty Home
      const routeName = isAdminUser(user.value) ? "dashboard" : "facultyDashboard";
      router.push({ name: routeName });
    })
    .catch((error) => {
      console.log("error", error);
    });
};

onMounted(() => {
  loginWithGoogle();
});
</script>

<template>
  <div class="signup-buttons">
    <v-row justify="center">
      <div display="flex" id="parent_id"></div>
    </v-row>
  </div>
</template>

