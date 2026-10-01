<script setup>
import { ref, computed, watch, onMounted } from "vue";
import UniversityServices from "../services/universityServices";
import CollegeServices from "../services/collegeServices";
import DepartmentServices from "../services/departmentServices";
import SemesterServices from "../services/semesterServices";
import CoreAssessmentServices from "../services/coreAssessmentServices";
import UniversityOutcomeServices from "../services/universityOutcomeServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";
import { buildCoreAssessmentPdf } from "../utils/coreAssessmentReport";

const loadingUniversities = ref(false);
const loadingSemesters = ref(false);
const loading = ref(false);
const exporting = ref(false);
const universities = ref([]);
const colleges = ref([]);
const departments = ref([]);
const semesterOptions = ref([]);
const outcomes = ref([]);
const universityId = ref(null);
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

const currentUserId = computed(() => Number(user.value?.id || user.value?.userId));

const provostUniversities = computed(() =>
  universities.value.filter(
    (university) => Number(university.provostUserId) === currentUserId.value
  )
);

const chairUniversities = computed(() => {
  const universityIds = new Set(
    departments.value
      .filter((department) => Number(department.chairUserId) === currentUserId.value)
      .map((department) => Number(department.universityId))
      .filter(Boolean)
  );
  return universities.value.filter((university) => universityIds.has(Number(university.id)));
});

const visibleUniversities = computed(() => {
  if (isProvost.value || provostUniversities.value.length) {
    return provostUniversities.value;
  }
  if (isDepartmentChair.value || chairUniversities.value.length) {
    return chairUniversities.value;
  }
  if (isDean.value) {
    const universityIds = new Set(
      colleges.value
        .filter((college) => Number(college.deanUserId) === currentUserId.value)
        .map((college) => Number(college.universityId))
        .filter(Boolean)
    );
    return universities.value.filter((university) => universityIds.has(Number(university.id)));
  }
  return universities.value;
});

const restrictsUniversities = computed(
  () =>
    isProvost.value ||
    isDean.value ||
    isDepartmentChair.value ||
    provostUniversities.value.length > 0 ||
    chairUniversities.value.length > 0
);

const lockedUniversity = computed(() =>
  restrictsUniversities.value && visibleUniversities.value.length === 1
    ? visibleUniversities.value[0]
    : null
);

const outcomeLabel = (outcome) => {
  if (!outcome) return "";
  return outcome.number ? `${outcome.number} - ${outcome.name}` : outcome.name;
};

const scoreColumns = computed(() => outcomes.value.find((outcome) => outcome.scoreColumns?.length)?.scoreColumns || []);

const headers = computed(() => [
  { title: "University Outcome", key: "name", sortable: true },
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
    { title: "Department", key: "department", sortable: true },
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

const semesterStartValue = (semester) => {
  const match = String(semester?.startDate ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const selectedSemesters = computed(() =>
  semesterOptions.value.filter((semester) => semesterIds.value.includes(semester.id))
);

const selectedSemesterName = computed(() =>
  selectedSemesters.value.map((semester) => semester.name).join(", ")
);

const selectedUniversity = computed(() =>
  universities.value.find((university) => university.id === universityId.value) || null
);

const provostName = (provost) => {
  if (!provost) return "";
  return `${provost.lName}, ${provost.fName}`;
};

const downloadReport = async () => {
  if (!canLoad.value || !selectedUniversity.value) return;
  exporting.value = true;
  errorMessage.value = "";
  try {
    const outcomeResponse = await UniversityOutcomeServices.getByUniversityId(universityId.value);
    const university = selectedUniversity.value;
    const doc = buildCoreAssessmentPdf({
      universityName: university.name || "",
      provostName: provostName(university.provost),
      semesterName: selectedSemesterName.value,
      semesterStartDates: selectedSemesters.value.map((semester) => semester.startDate),
      outcomes: outcomeResponse.data || [],
      assessmentOutcomes: outcomes.value,
    });
    const semesterLabel = selectedSemesterName.value.replaceAll(", ", "-") || "semesters";
    doc.save(`core-assessment-${university.name || university.id}-${semesterLabel}.pdf`);
  } catch (error) {
    errorMessage.value = error.response?.data?.message || "Error creating the core assessment report";
  } finally {
    exporting.value = false;
  }
};

const departmentName = (department) => {
  const text = String(department || "");
  const separator = " - ";
  const index = text.indexOf(separator);
  return index === -1 ? text : text.slice(index + separator.length);
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

const canLoad = computed(() => Boolean(universityId.value && semesterIds.value.length));

const applyUniversitySelection = () => {
  if (lockedUniversity.value) {
    universityId.value = lockedUniversity.value.id;
    return;
  }
  if (
    restrictsUniversities.value &&
    !visibleUniversities.value.some((university) => university.id === universityId.value)
  ) {
    universityId.value = null;
  }
};

const loadUniversities = () => {
  loadingUniversities.value = true;
  Promise.all([
    UniversityServices.getAll(),
    CollegeServices.getAll(),
    DepartmentServices.getAll(),
  ])
    .then(([universityResponse, collegeResponse, departmentResponse]) => {
      universities.value = universityResponse.data || [];
      colleges.value = collegeResponse.data || [];
      departments.value = departmentResponse.data || [];
      applyUniversitySelection();
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading universities";
    })
    .finally(() => {
      loadingUniversities.value = false;
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

const loadSemesters = () => {
  loadingSemesters.value = true;
  SemesterServices.getAll()
    .then((response) => {
      const rows = Array.isArray(response.data) ? response.data.map((semester) => ({ ...semester })) : [];
      rows.sort((left, right) => semesterStartValue(right) - semesterStartValue(left));
      semesterOptions.value = rows;
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
  CoreAssessmentServices.getForUniversitySemester(universityId.value, semesterIds.value)
    .then((response) => {
      outcomes.value = response.data || [];
    })
    .catch((error) => {
      outcomes.value = [];
      errorMessage.value = error.response?.data?.message || "Error loading core assessment";
    })
    .finally(() => {
      loading.value = false;
    });
};

watch([universityId, semesterIds], () => {
  loadAssessment();
}, { deep: true });

onMounted(async () => {
  await ensureUser();
  loadUniversities();
  loadSemesters();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Core Assessment</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" md="6">
          <div v-if="lockedUniversity" class="v-card-title px-0">
            {{ lockedUniversity.name }}
          </div>
          <v-autocomplete
            v-else
            v-model="universityId"
            :items="visibleUniversities"
            item-title="name"
            item-value="id"
            label="University"
            :loading="loadingUniversities"
            clearable
          ></v-autocomplete>
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="semesterIds"
            :items="semesterOptions"
            item-title="name"
            item-value="id"
            label="Semesters"
            multiple
            chips
            closable-chips
            clearable
            :loading="loadingSemesters"
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
              <template v-slot:[`item.department`]="{ item }">
                {{ departmentName(item.department) }}
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

