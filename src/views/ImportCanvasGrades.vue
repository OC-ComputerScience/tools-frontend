<script setup>
import { ref, computed, onMounted } from "vue";
import SemesterServices from "../services/semesterServices";
import AssignmentGradeServices from "../services/assignmentGradeServices";

const loading = ref(false);
const importing = ref(false);
const clearing = ref(false);
const semesters = ref([]);
const selectedSemesterId = ref(null);
const message = ref("");
const errorMessage = ref("");
const importSummary = ref(null);
const clearSummary = ref(null);
const confirmClear = ref(false);

const selectedSemester = computed(() =>
  semesters.value.find((semester) => semester.id === selectedSemesterId.value)
);

const semesterName = computed(() => selectedSemester.value?.name || "");

const loadSemesters = () => {
  loading.value = true;
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = SemesterServices.sortSemestersByDateDesc(response.data);
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading semesters";
    })
    .finally(() => {
      loading.value = false;
    });
};

const importGrades = () => {
  if (!selectedSemesterId.value) return;
  importing.value = true;
  message.value = "";
  errorMessage.value = "";
  importSummary.value = null;
  clearSummary.value = null;
  AssignmentGradeServices.importFromCanvas(selectedSemesterId.value)
    .then((response) => {
      importSummary.value = response.data;
      message.value = `Imported grades for ${response.data.semesterName || "the selected semester"}.`;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error importing Canvas grades";
    })
    .finally(() => {
      importing.value = false;
    });
};

const clearGrades = () => {
  if (!selectedSemesterId.value) return;
  clearing.value = true;
  message.value = "";
  errorMessage.value = "";
  confirmClear.value = false;
  AssignmentGradeServices.clearForSemester(selectedSemesterId.value)
    .then((response) => {
      clearSummary.value = response.data;
      importSummary.value = null;
      message.value = `Removed ${response.data.deleted} assignment grades for ${response.data.semesterName || "the selected semester"}.`;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error removing assignment grades";
    })
    .finally(() => {
      clearing.value = false;
    });
};

onMounted(() => {
  loadSemesters();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Import Canvas Grades</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-text>
          <p class="text-body-1 mb-4">
            Choose a semester. Import loads Canvas assignment scores for sections in that semester whose courses have assignments. Canvas assignments are matched by name. Remove deletes every assignment grade for sections in that semester.
          </p>
          <v-autocomplete
            v-model="selectedSemesterId"
            :items="semesters"
            item-title="name"
            item-value="id"
            label="Semester"
            :loading="loading"
            clearable
          ></v-autocomplete>
          <v-btn
            color="primary"
            class="mr-2"
            :disabled="!selectedSemesterId || importing || clearing"
            :loading="importing"
            @click="importGrades"
          >
            Import Canvas Grades
          </v-btn>
          <v-btn
            color="error"
            :disabled="!selectedSemesterId || importing || clearing"
            :loading="clearing"
            @click="confirmClear = true"
          >
            Remove Assignment Grades
          </v-btn>
          <v-alert v-if="message" type="success" class="mt-4" variant="tonal">
            {{ message }}
          </v-alert>
          <v-alert v-if="errorMessage" type="error" class="mt-4" variant="tonal">
            {{ errorMessage }}
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card v-if="importSummary" class="mt-4">
        <v-card-title>Import Results</v-card-title>
        <v-card-text>
          <div>Sections considered: {{ importSummary.sectionsConsidered }}</div>
          <div>Sections with grades saved: {{ importSummary.sectionsImported }}</div>
          <div>Grades created: {{ importSummary.gradesCreated }}</div>
          <div>Grades updated: {{ importSummary.gradesUpdated }}</div>
          <div>Submissions without a score: {{ importSummary.submissionsWithoutScore }}</div>
          <div v-if="importSummary.sectionsSkipped?.length" class="mt-3">
            <div class="text-subtitle-2">Skipped sections</div>
            <div v-for="(item, index) in importSummary.sectionsSkipped" :key="`skip-${index}`">
              {{ item.section }}: {{ item.reason }}
            </div>
          </div>
          <div v-if="importSummary.unmatchedAssignments?.length" class="mt-3">
            <div class="text-subtitle-2">Assignments not matched in Canvas</div>
            <div v-for="(item, index) in importSummary.unmatchedAssignments" :key="`miss-${index}`">
              {{ item.section }} — {{ item.assignment }}<span v-if="item.reason"> ({{ item.reason }})</span>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-dialog v-model="confirmClear" max-width="480px">
        <v-card>
          <v-card-title>Remove Assignment Grades</v-card-title>
          <v-card-text>
            Remove all assignment grades for every section in {{ semesterName || "this semester" }}? This cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="confirmClear = false" class="dialog-cancel">Cancel</v-btn>
            <v-btn color="error" variant="text" @click="clearGrades">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
