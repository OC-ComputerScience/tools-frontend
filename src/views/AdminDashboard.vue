<script setup>
import { ref, onMounted, computed } from "vue";
import Utils from "../config/utils.js";
import UserServices from "../services/userServices.js";

const user = ref(null);
const rolesDisplay = computed(() => {
  if (!user.value || !user.value.roles || !Array.isArray(user.value.roles) || user.value.roles.length === 0) {
    return "User";
  }
  // Get role names and join them, or use first role if multiple
  const roleNames = user.value.roles.map((role) => role.name || role.description || "User");
  if (roleNames.length === 1) {
    return roleNames[0];
  }
  // If multiple roles, use first one or join them
  return roleNames[0] || "User";
});

onMounted(async () => {
  user.value = Utils.getStore("user");
  
  // If user doesn't have roles, refresh user data
  if (user.value && (!user.value.roles || !Array.isArray(user.value.roles))) {
    try {
      const response = await UserServices.getUser(user.value.id || user.value.userId);
      if (response.data && response.data.roles) {
        user.value = { ...user.value, roles: response.data.roles };
        Utils.setStore("user", user.value);
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Dashboard</v-toolbar-title>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <h1>Welcome to the {{ rolesDisplay }} Tools</h1>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
