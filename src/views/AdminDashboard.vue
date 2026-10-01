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

const isDepartmentChair = computed(() => {
  if (!user.value?.roles || !Array.isArray(user.value.roles)) return false;
  return user.value.roles.some(
    (role) => (role.name || "").toLowerCase() === "department chair",
  );
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
          <h1 v-if="!isDepartmentChair">Welcome to the {{ rolesDisplay }} Tools</h1>
          <template v-else>
            <p class="text-body-1">
              You can use this system to help you create a Department Assessment.
              You can set up your Department Learning Outcomes and associate them
              with the University Learning Outcomes, add assignments and associate
              them with Department Outcomes and view the department assessments.
              The system will get the scores of the assignments from Canvas and
              tabulate them for Departmental Assessment. The departmental results
              will be rolled up for College and University Assessment.
            </p>
            <p class="text-body-1 mt-4">
              You can also use this system to add assignments and mark them for
              Core Assessment and associate them to University Learning Outcomes.
              The system will get the scores of the assignments from Canvas and
              tabulate them for Core Assessment.
            </p>
          </template>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
