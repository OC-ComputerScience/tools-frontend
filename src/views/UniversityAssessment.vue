<script setup>
import { ref, computed, watch, onMounted } from "vue";
import UniversityServices from "../services/universityServices";
import CollegeServices from "../services/collegeServices";
import DepartmentServices from "../services/departmentServices";
import SemesterServices from "../services/semesterServices";
import UniversityAssessmentServices from "../services/universityAssessmentServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";

const loadingUniversities = ref(false);
const loadingSemesters = ref(false);
const loading = ref(false);
const universities = ref([]);
const colleges = ref([]);
const departments = ref([]);
const semesters = ref([]);
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

const headers = [
  { title: "University Outcome", key: "name", sortable: true },
  { title: "Assessment Score", key: "averageScore", sortable: true },
  { title: "Student Scores", key: "gradeCount", sortable: true },
  { title: "", key: "actions", sortable: false },
];

const collegeHeaders = [
  { title: "College", key: "name", sortable: true },
  { title: "Assessment Weight", key: "assessmentWeight", sortable: true },
  { title: "Assessment Score", key: "averageScore", sortable: true },
  { title: "Student Scores", key: "gradeCount", sortable: true },
];

const detailsDialog = ref(false);
const selectedOutcome = ref(null);

const selectedSemesterName = computed(() =>
  semesters.value
    .filter((semester) => semesterIds.value.includes(semester.id))
    .map((semester) => semester.name)
    .join(", ")
);

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

const loadSemesters = () => {
  loadingSemesters.value = true;
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = (response.data || []).slice().sort((a, b) =>
        String(b.name || "").localeCompare(String(a.name || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading semesters";
    })
    .finally(() => {
      loadingSemesters.value = false;
    });
};

const loadOutcomes = () => {
  if (!canLoad.value) {
    outcomes.value = [];
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  UniversityAssessmentServices.getForUniversitySemester(universityId.value, semesterIds.value)
    .then((response) => {
      outcomes.value = response.data || [];
    })
    .catch((error) => {
      outcomes.value = [];
      errorMessage.value = error.response?.data?.message || "Error loading university assessment";
    })
    .finally(() => {
      loading.value = false;
    });
};

const openDetails = (outcome) => {
  selectedOutcome.value = outcome;
  detailsDialog.value = true;
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

watch([universityId, semesterIds], () => {
  loadOutcomes();
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
        <v-toolbar-title>University Assessment</v-toolbar-title>
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
        <v-col cols="12" md="6">
          <v-autocomplete
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
          ></v-autocomplete>
        </v-col>
      </v-row>

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
            <template v-slot:item.actions="{ item }">
              <v-icon small title="Details" @click="openDetails(item)">mdi-text-box-search-outline</v-icon>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>

      <v-dialog v-model="detailsDialog" max-width="720px">
        <v-card>
          <v-card-title>
            {{ outcomeLabel(selectedOutcome) }}
            <span v-if="selectedSemesterName"> — {{ selectedSemesterName }}</span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="collegeHeaders"
              :items="selectedOutcome?.colleges || []"
              item-value="id"
              :items-per-page="-1"
            >
              <template v-slot:[`item.assessmentWeight`]="{ item }">
                {{ item.assessmentWeight == null ? "" : `${item.assessmentWeight}%` }}
              </template>
              <template v-slot:[`item.averageScore`]="{ item }">
                {{ item.averageScore == null ? "" : item.averageScore }}
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
