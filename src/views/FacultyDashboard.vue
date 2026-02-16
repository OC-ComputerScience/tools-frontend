<script setup>
import { ref, onMounted, computed } from "vue";
import Utils from "../config/utils.js";
import UserServices from "../services/userServices.js";
import { useRouter } from "vue-router";

// Change to 1 to show full instructions with button; 2 = closed message with no button
const FACULTY_HOME_VERSION = 2;

const router = useRouter();
const user = ref(null);

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

const userName = computed(() => {
  if (!user.value) return "";
  return `${user.value.fName || ""} ${user.value.lName || ""}`.trim();
});

const goToImportCourses = () => {
  router.push({ name: "facultyCourses" });
};
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Faculty Home</v-toolbar-title>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <h1>Welcome to the Faculty Tools{{ userName ? `, ${userName}` : "" }}</h1>
        </v-card-text>
      </v-card>

      <!-- Version 1: Full instructions with button -->
      <template v-if="FACULTY_HOME_VERSION === 1">
        <v-card class="mt-4">
          <v-card-title>Primary Instructions</v-card-title>
          <v-card-text>
            <div class="text-body-1 mb-3">
              This tool lets you specify exactly which Blackboard courses you want to have imported into Canvas for the courses you teach.
            </div>
            <div class="text-body-1 mb-3">
              For courses in the Summer 2026 or Fall 2026 semesters, you can assign a course from the past (back to Fall 2023) to import, or you can select to not import a course, which means you want to start from a blank template in Canvas. If you choose to import a course from Blackboard into Canvas, the conversion goes reasonably well in most cases, but there will still be work to do once the content is inside of Canvas. You will receive training on how to do this work.
            </div>
            <div class="text-body-1 mb-4">
              For courses that you teach but are not in the Summer 2026 or Fall 2026 schedule, you can specify a Blackboard course from the past to be copied into Canvas so it will be available in that past term for you to use in the future.
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
          <v-card-title>Alternate Instructions</v-card-title>
          <v-card-text>
            <div class="text-body-1 mb-3">
              For future semesters: For each course, assign a Blackboard course from a past semester to be copied into Canvas, or indicate that you do not want to import a course (you will start from a blank template in Canvas).
            </div>
            <div class="text-body-1 mb-3">
              For past semesters: You may assign a Blackboard course in the same semester to be copied into Canvas for future use when setting up courses. Note: when you click assign, the course is assigned to itself (no dialog is displayed).
            </div>
            <div class="text-center">
              <v-btn color="primary" @click="goToImportCourses">
                Click to Assign Blackboard Courses to Import into Canvas
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </template>

      <!-- Version 2: Closed message with no button -->
      <v-card v-else class="mt-4">
        <v-card-text>
          <div class="text-body-1">
            Assigning Blackboard courses for copying into Canvas is currently closed. It may open again in the future.
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
