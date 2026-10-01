<script setup>
import { ref, computed, watch, onMounted } from "vue";
import CollegeServices from "../services/collegeServices";
import DepartmentServices from "../services/departmentServices";
import SemesterServices from "../services/semesterServices";
import CollegeOutcomeServices from "../services/collegeOutcomeServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";

const loadingColleges = ref(false);
const loadingSemesters = ref(false);
const loading = ref(false);
const colleges = ref([]);
const departments = ref([]);
const semesters = ref([]);
const outcomes = ref([]);
const collegeId = ref(null);
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

const visibleColleges = computed(() => {
  const userId = Number(user.value?.id || user.value?.userId);
  if (isProvost.value) {
    return colleges.value.filter(
      (college) => Number(college.university?.provostUserId) === userId
    );
  }
  if (isDean.value) {
    return colleges.value.filter((college) => Number(college.deanUserId) === userId);
  }
  if (isDepartmentChair.value) {
    const collegeIds = new Set(
      departments.value
        .filter((department) => Number(department.chairUserId) === userId)
        .map((department) => Number(department.collegeId))
        .filter(Boolean)
    );
    return colleges.value.filter((college) => collegeIds.has(Number(college.id)));
  }
  return colleges.value;
});

const restrictsColleges = computed(() => isProvost.value || isDean.value || isDepartmentChair.value);

const lockedCollege = computed(() =>
  restrictsColleges.value && visibleColleges.value.length === 1
    ? visibleColleges.value[0]
    : null
);

const collegeLabel = (college) => {
  if (!college) return "";
  return college.name;
};

const outcomeLabel = (outcome) => {
  if (!outcome) return "";
  return outcome.number ? `${outcome.number} - ${outcome.name}` : outcome.name;
};

const departmentLabel = (department) => {
  if (!department) return "";
  return department.name || "";
};

const headers = [
  { title: "University Outcome", key: "name", sortable: true },
  { title: "Assessment Score", key: "averageScore", sortable: true },
  { title: "Student Scores", key: "gradeCount", sortable: true },
  { title: "", key: "actions", sortable: false },
];

const departmentHeaders = [
  { title: "Department", key: "name", sortable: true },
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

const canLoad = computed(() => Boolean(collegeId.value && semesterIds.value.length));

const applyCollegeSelection = () => {
  if (lockedCollege.value) {
    collegeId.value = lockedCollege.value.id;
    return;
  }
  if (
    restrictsColleges.value &&
    !visibleColleges.value.some((college) => college.id === collegeId.value)
  ) {
    collegeId.value = null;
  }
};

const loadColleges = () => {
  loadingColleges.value = true;
  Promise.all([CollegeServices.getAll(), DepartmentServices.getAll()])
    .then(([collegeResponse, departmentResponse]) => {
      colleges.value = collegeResponse.data || [];
      departments.value = departmentResponse.data || [];
      applyCollegeSelection();
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading colleges";
    })
    .finally(() => {
      loadingColleges.value = false;
    });
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

const loadOutcomes = () => {
  if (!canLoad.value) {
    outcomes.value = [];
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  CollegeOutcomeServices.getForCollegeSemester(collegeId.value, semesterIds.value)
    .then((response) => {
      outcomes.value = response.data || [];
    })
    .catch((error) => {
      outcomes.value = [];
      errorMessage.value = error.response?.data?.message || "Error loading college assessment";
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

watch([collegeId, semesterIds], () => {
  loadOutcomes();
}, { deep: true });

onMounted(async () => {
  await ensureUser();
  loadColleges();
  loadSemesters();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>College Assessment</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" md="6">
          <div v-if="lockedCollege" class="v-card-title px-0">
            {{ collegeLabel(lockedCollege) }}
          </div>
          <v-autocomplete
            v-else
            v-model="collegeId"
            :items="visibleColleges"
            :item-title="collegeLabel"
            item-value="id"
            label="College"
            :loading="loadingColleges"
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
              :headers="departmentHeaders"
              :items="selectedOutcome?.departments || []"
              item-value="id"
              :items-per-page="-1"
            >
              <template v-slot:[`item.name`]="{ item }">
                {{ departmentLabel(item) }}
              </template>
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
