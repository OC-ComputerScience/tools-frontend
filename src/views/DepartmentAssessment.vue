<script setup>
import { ref, computed, watch, onMounted } from "vue";
import DepartmentServices from "../services/departmentServices";
import SemesterServices from "../services/semesterServices";
import DepartmentAssessmentServices from "../services/departmentAssessmentServices";
import DepartmentOutcomeServices from "../services/departmentOutcomeServices";
import AssignmentServices from "../services/assignmentServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";
import { buildDepartmentAssessmentPdf } from "../utils/departmentAssessmentReport";

const loadingDepartments = ref(false);
const loadingSemesters = ref(false);
const loading = ref(false);
const exporting = ref(false);
const departments = ref([]);
const semesters = ref([]);
const outcomes = ref([]);
const departmentId = ref(null);
const semesterIds = ref([]);
const errorMessage = ref("");
const user = ref(null);

const hasRole = (roleName) => {
  const roles = user.value?.roles;
  if (!Array.isArray(roles)) return false;
  return roles.some((role) => (role.name || "").toLowerCase() === roleName);
};

const isDepartmentChair = computed(() => hasRole("department chair"));
const isDean = computed(() => hasRole("dean"));
const isProvost = computed(() => hasRole("provost"));

const visibleDepartments = computed(() => {
  const userId = Number(user.value?.id || user.value?.userId);
  if (isProvost.value) {
    return departments.value.filter(
      (department) => Number(department.university?.provostUserId) === userId
    );
  }
  if (isDean.value) {
    return departments.value.filter(
      (department) => Number(department.college?.deanUserId) === userId
    );
  }
  if (isDepartmentChair.value) {
    return departments.value.filter((department) => Number(department.chairUserId) === userId);
  }
  return departments.value;
});

const restrictsDepartments = computed(() => isProvost.value || isDean.value || isDepartmentChair.value);

const lockedDepartment = computed(() =>
  restrictsDepartments.value && visibleDepartments.value.length === 1
    ? visibleDepartments.value[0]
    : null
);

const departmentLabel = (department) => {
  if (!department) return "";
  return department.name || "";
};

const outcomeLabel = (outcome) => {
  if (!outcome) return "";
  return outcome.number ? `${outcome.number} - ${outcome.name}` : outcome.name;
};

const scoreColumns = computed(() => outcomes.value.find((outcome) => outcome.scoreColumns?.length)?.scoreColumns || []);

const headers = computed(() => [
  { title: "Outcome", key: "name", sortable: true },
  { title: "Assessment Score", key: "averageScore", sortable: true },
  { title: "Student Scores", key: "gradeCount", sortable: true },
  ...scoreColumns.value.map((column) => ({
    title: column.title,
    key: column.key,
    sortable: true,
    align: "end",
  })),
  { title: "", key: "actions", sortable: false },
]);

const detailsDialog = ref(false);
const selectedOutcome = ref(null);

const assignmentHeaders = computed(() => {
  const columns = selectedOutcome.value?.scoreColumns || scoreColumns.value;
  return [
    { title: "Section", key: "section", sortable: true },
    { title: "Assignment", key: "name", sortable: true },
    { title: "Assessment Score", key: "averageScore", sortable: true },
    { title: "Student Scores", key: "gradeCount", sortable: true },
    ...columns.map((column) => ({
      title: column.title,
      key: column.key,
      sortable: true,
      align: "end",
    })),
  ];
});

const selectedSemesters = computed(() =>
  semesters.value.filter((semester) => semesterIds.value.includes(semester.id))
);

const selectedSemesterName = computed(() =>
  selectedSemesters.value.map((semester) => semester.name).join(", ")
);

const selectedDepartment = computed(() =>
  departments.value.find((department) => department.id === departmentId.value) || null
);

const chairName = (chair) => {
  if (!chair) return "";
  return `${chair.lName}, ${chair.fName}`;
};

const downloadReport = async () => {
  if (!canLoad.value || !selectedDepartment.value) return;
  exporting.value = true;
  errorMessage.value = "";
  try {
    const [outcomeResponse, assignmentResponse] = await Promise.all([
      DepartmentOutcomeServices.getByDepartmentId(departmentId.value),
      AssignmentServices.getByDepartmentId(departmentId.value),
    ]);
    const department = selectedDepartment.value;
    const doc = buildDepartmentAssessmentPdf({
      universityName: department.university?.name || "",
      collegeName: department.college?.name || "",
      departmentName: department.name || "",
      chairName: chairName(department.chair),
      semesterName: selectedSemesterName.value,
      semesterStartDates: selectedSemesters.value.map((semester) => semester.startDate),
      outcomes: outcomeResponse.data || [],
      assessmentOutcomes: outcomes.value,
      assignments: assignmentResponse.data || [],
    });
    const code = department.code || department.id;
    const semesterLabel = selectedSemesterName.value.replaceAll(", ", "-") || "semesters";
    doc.save(`department-assessment-${code}-${semesterLabel}.pdf`);
  } catch (error) {
    errorMessage.value = error.response?.data?.message || "Error creating the department assessment report";
  } finally {
    exporting.value = false;
  }
};

const sectionLabel = (assignment) => {
  if (!assignment?.courseSection) return "";
  const description = assignment.courseDescription ? ` ${assignment.courseDescription}` : "";
  const semester = assignment.semesterName ? `${assignment.semesterName} ` : "";
  return `${semester}${assignment.courseNumber}-${assignment.courseSection}${description}`;
};

const scorePercent = (item, key) => {
  const total = Number(item?.gradeCount);
  const count = Number(item?.[key]);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(count)) return "";
  const percent = Math.round((count / total) * 1000) / 10;
  return `${percent}%`;
};

const openDetails = (outcome) => {
  selectedOutcome.value = outcome;
  detailsDialog.value = true;
};

const canLoad = computed(() => Boolean(departmentId.value && semesterIds.value.length));

const applyChairDepartment = () => {
  if (lockedDepartment.value) {
    departmentId.value = lockedDepartment.value.id;
    return;
  }
  if (
    restrictsDepartments.value &&
    !visibleDepartments.value.some((department) => department.id === departmentId.value)
  ) {
    departmentId.value = null;
  }
};

const loadDepartments = () => {
  loadingDepartments.value = true;
  DepartmentServices.getAll()
    .then((response) => {
      departments.value = response.data || [];
      applyChairDepartment();
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading departments";
    })
    .finally(() => {
      loadingDepartments.value = false;
    });
};

const ensureUser = async () => {
  user.value = Utils.getStore("user");
  if (!user.value || (user.value.roles && Array.isArray(user.value.roles))) return;
  try {
    const response = await UserServices.getUser(user.value.id || user.value.userId);
    if (response.data?.roles) {
      user.value = { ...user.value, roles: response.data.roles };
      Utils.setStore("user", user.value);
    }
  } catch (error) {
    console.error("Error refreshing user data:", error);
  }
};

const semesterStartValue = (semester) => {
  const match = String(semester?.startDate ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const loadSemesters = () => {
  loadingSemesters.value = true;
  SemesterServices.getAll()
    .then((response) => {
      const rows = Array.isArray(response.data) ? response.data.map((semester) => ({ ...semester })) : [];
      rows.sort((left, right) => semesterStartValue(right) - semesterStartValue(left));
      semesters.value = rows;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading semesters";
    })
    .finally(() => {
      loadingSemesters.value = false;
    });
};

const loadAssessment = () => {
  if (!canLoad.value) {
    outcomes.value = [];
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  DepartmentAssessmentServices.getForDepartmentSemester(departmentId.value, semesterIds.value)
    .then((response) => {
      outcomes.value = response.data || [];
    })
    .catch((error) => {
      outcomes.value = [];
      errorMessage.value = error.response?.data?.message || "Error loading department assessment";
    })
    .finally(() => {
      loading.value = false;
    });
};

watch([departmentId, semesterIds], () => {
  loadAssessment();
}, { deep: true });

onMounted(async () => {
  await ensureUser();
  loadDepartments();
  loadSemesters();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Department Assessment</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" md="6">
          <div v-if="lockedDepartment" class="v-card-title px-0">
            {{ departmentLabel(lockedDepartment) }}
          </div>
          <v-autocomplete
            v-else
            v-model="departmentId"
            :items="visibleDepartments"
            :item-title="departmentLabel"
            item-value="id"
            label="Department"
            :loading="loadingDepartments"
            clearable
          ></v-autocomplete>
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="semesterIds"
            :items="semesters"
            item-title="name"
            item-value="id"
            label="Semesters"
            multiple
            chips
            closable-chips
            :loading="loadingSemesters"
            clearable
            :menu-props="{ maxHeight: 320, location: 'bottom' }"
          ></v-select>
        </v-col>
      </v-row>

      <v-btn
        color="primary"
        class="mb-4"
        :disabled="!canLoad || loading || exporting"
        :loading="exporting"
        @click="downloadReport"
      >
        Create PDF
      </v-btn>

      <v-alert v-if="errorMessage" type="error" class="mb-4" variant="tonal">
        {{ errorMessage }}
      </v-alert>

      <v-card>
        <v-card-text>
          <v-data-table :headers="headers" :items="outcomes" :loading="loading">
            <template v-slot:[`item.name`]="{ item }">
              {{ outcomeLabel(item) }}
            </template>
            <template v-slot:[`item.averageScore`]="{ item }">
              <span v-if="item.averageScore != null">{{ item.averageScore }}</span>
              <span v-if="item.scoreDescription"> - {{ item.scoreDescription }}</span>
            </template>
            <template
              v-for="column in scoreColumns"
              :key="column.key"
              v-slot:[`item.${column.key}`]="{ item }"
            >
              {{ scorePercent(item, column.key) }}
            </template>
            <template v-slot:item.actions="{ item }">
              <v-icon small title="Details" @click="openDetails(item)">mdi-text-box-search-outline</v-icon>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>

      <v-dialog v-model="detailsDialog" max-width="1200px">
        <v-card>
          <v-card-title>
            {{ outcomeLabel(selectedOutcome) }}
            <span v-if="selectedSemesterName"> — {{ selectedSemesterName }}</span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="assignmentHeaders"
              :items="selectedOutcome?.assignments || []"
              item-value="id"
              :items-per-page="-1"
            >
              <template v-slot:[`item.section`]="{ item }">
                {{ sectionLabel(item) }}
              </template>
              <template v-slot:[`item.averageScore`]="{ item }">
                {{ item.averageScore == null ? "" : item.averageScore }}
              </template>
              <template
                v-for="column in selectedOutcome?.scoreColumns || []"
                :key="column.key"
                v-slot:[`item.${column.key}`]="{ item }"
              >
                {{ scorePercent(item, column.key) }}
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="detailsDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
