<script setup>
import { ref, onMounted } from "vue";
import Utils from "../config/utils.js";
import UserServices from "../services/userServices.js";

const user = ref(null);

onMounted(async () => {
  user.value = Utils.getStore("user");

  if (user.value && (!user.value.roles || !Array.isArray(user.value.roles))) {
    try {
      const response = await UserServices.getUser(user.value.id || user.value.userId);
      if (response.data?.roles) {
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
        <v-toolbar-title>Dean Dashboard</v-toolbar-title>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <p class="text-body-1">
            You can use this system to view your University, College, Department,
            and Core Assessments.
          </p>
          <p class="text-body-1 mt-4">
            You also have access to maintain the Department Outcomes and
            Assignments for departments in your College.
          </p>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
