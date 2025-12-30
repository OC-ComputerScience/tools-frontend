<script setup>
import SectionServices from "../services/sectionServices";
import TermServices from "../services/termServices";
import { ref, onMounted } from "vue";

const courses = ref([]);
const terms = ref([]);
const selectedTerm = ref(null);
const message = ref("Select a term to view courses");

const retrieveTerms = () => {
  TermServices.getAllTerms()
    .then((response) => {
      terms.value = response.data;
      if (response.data.length > 0) {
        selectedTerm.value = response.data[0].id;
        retrieveCourses();
      }
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading terms";
    });
};

const retrieveCourses = () => {
  if (!selectedTerm.value) {
    courses.value = [];
    return;
  }

  SectionServices.getSectionsWithCount({ termId: selectedTerm.value })
    .then((response) => {
      courses.value = response.data.sort((a, b) => {
        // Sort by courseNumber first, then by courseSection in ascending order
        const courseNumberCompare = a.courseNumber.localeCompare(
          b.courseNumber,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
        if (courseNumberCompare !== 0) {
          return courseNumberCompare;
        }
        // If courseNumbers are the same, sort by courseSection
        return a.courseSection.localeCompare(b.courseSection, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading courses";
    });
};

onMounted(() => {
  retrieveTerms();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Courses</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Select Term</v-card-title>
        <v-card-text>
          <v-select
            v-model="selectedTerm"
            :items="terms"
            item-title="termName"
            item-value="id"
            label="Term"
            @update:model-value="retrieveCourses"
          ></v-select>
        </v-card-text>
      </v-card>

      <br />

      <v-card v-if="selectedTerm">
        <v-card-title>Courses for Selected Term</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">Course Number</th>
              <th class="text-left">Section</th>
              <th class="text-left">Description</th>
              <th class="text-left">Faculty</th>
              <th class="text-left">Assignment Count</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in courses" :key="course.id">
              <td>{{ course.courseNumber }}</td>
              <td>{{ course.courseSection }}</td>
              <td>{{ course.courseDescription }}</td>
              <td>{{ course.user?.fName }} {{ course.user?.lName }}</td>
              <td>{{ course.assignmentCount || 0 }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-container>
  </div>
</template>
