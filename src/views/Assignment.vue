<script setup>
import { ref, computed, onMounted } from "vue";
import AssignmentServices from "../services/assignmentServices";
import DepartmentServices from "../services/departmentServices";
import CourseServices from "../services/courseServices";
import DepartmentOutcomeServices from "../services/departmentOutcomeServices";
import UniversityOutcomeServices from "../services/universityOutcomeServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const loadingDepartments = ref(false);
const assignments = ref([]);
const departments = ref([]);
const courses = ref([]);
const departmentOutcomes = ref([]);
const universityOutcomes = ref([]);
const selectedDepartmentId = ref(null);
const user = ref(null);

const hasRole = (roleName) => {
  const roles = user.value?.roles;
  if (!Array.isArray(roles)) return false;
  return roles.some((role) => (role.name || "").toLowerCase() === roleName);
};

const isDepartmentChair = computed(() => hasRole("department chair"));
const isDean = computed(() => hasRole("dean"));

const visibleDepartments = computed(() => {
  const userId = Number(user.value?.id || user.value?.userId);
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

const restrictsDepartments = computed(() => isDean.value || isDepartmentChair.value);

const lockedDepartment = computed(() =>
  restrictsDepartments.value && visibleDepartments.value.length === 1
    ? visibleDepartments.value[0]
    : null
);

const selectedDepartment = computed(() =>
  departments.value.find((department) => department.id === selectedDepartmentId.value) || null
);

const departmentLabel = (department) => {
  if (!department) return "";
  return department.name || "";
};

const courseLabel = (course) => {
  if (!course) return "";
  return course.description ? `${course.number} - ${course.description}` : course.number;
};

const outcomeLabel = (outcome) => {
  if (!outcome) return "";
  return `${outcome.number} - ${outcome.name}`;
};

const filteredAssignments = computed(() => {
  if (!selectedDepartmentId.value) return [];
  return assignments.value.filter(
    (assignment) =>
      Number(assignment.departmentId ?? assignment.department?.id) === Number(selectedDepartmentId.value)
  );
});

const editedIndex = ref(-1);
const editedItem = ref({
  departmentId: null,
  courseId: null,
  name: "",
  totalPoints: null,
  description: "",
  coreAssessment: false,
  departmentOutcomeId: null,
  universityOutcomeId: null,
});
const defaultItem = {
  departmentId: null,
  courseId: null,
  name: "",
  totalPoints: null,
  description: "",
  coreAssessment: false,
  departmentOutcomeId: null,
  universityOutcomeId: null,
};

const formErrors = ref({
  courseId: false,
  name: false,
});

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.departmentId &&
      editedItem.value.courseId &&
      editedItem.value.name
  );
});

const outcomesForDepartment = computed(() => {
  const departmentId = Number(editedItem.value.departmentId);
  if (!departmentId) return [];
  return departmentOutcomes.value.filter(
    (outcome) => Number(outcome.departmentId) === departmentId
  );
});

const universityOutcomesForDepartment = computed(() => {
  const department = departments.value.find(
    (item) => item.id === Number(editedItem.value.departmentId)
  );
  const universityId = Number(department?.universityId || department?.university?.id);
  if (!universityId) return [];
  return universityOutcomes.value.filter(
    (outcome) => Number(outcome.universityId) === universityId
  );
});

const headers = [
  { title: "Course", key: "course", sortable: true },
  { title: "Name", key: "name", sortable: true },
  { title: "Total Points", key: "totalPoints", sortable: true },
  { title: "Description", key: "description", sortable: true },
  { title: "Core Assessment", key: "coreAssessment", sortable: true },
  { title: "Outcome", key: "departmentOutcome", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Assignment" : "Edit Assignment";
});

const initialize = () => {
  loading.value = true;
  AssignmentServices.getAll()
    .then((response) => {
      assignments.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching assignments:", error);
    });

  loadingDepartments.value = true;
  DepartmentServices.getAll()
    .then((response) => {
      departments.value = response.data || [];
      if (lockedDepartment.value) {
        selectedDepartmentId.value = lockedDepartment.value.id;
      } else if (
        restrictsDepartments.value &&
        !visibleDepartments.value.some((department) => department.id === selectedDepartmentId.value)
      ) {
        selectedDepartmentId.value = null;
      }
    })
    .catch((error) => {
      console.error("Error fetching departments:", error);
    })
    .finally(() => {
      loadingDepartments.value = false;
    });

  CourseServices.getAllCourses()
    .then((response) => {
      courses.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching courses:", error);
    });

  DepartmentOutcomeServices.getAll()
    .then((response) => {
      departmentOutcomes.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching department outcomes:", error);
    })
    .finally(() => {
      loading.value = false;
    });

  UniversityOutcomeServices.getAll()
    .then((response) => {
      universityOutcomes.value = response.data || [];
    })
    .catch((error) => {
      console.error("Error fetching university outcomes:", error);
    });
};

const editItem = (item) => {
  editedIndex.value = assignments.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  editedItem.value.coreAssessment = Boolean(item.coreAssessment);
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = assignments.value.indexOf(itemToDelete.value);
  AssignmentServices.delete(itemToDelete.value.id)
    .then(() => {
      assignments.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting assignment:", error);
    });
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  const payload = {
    departmentId: editedIndex.value > -1 ? editedItem.value.departmentId : selectedDepartmentId.value,
    courseId: editedItem.value.courseId,
    name: editedItem.value.name,
    totalPoints:
      editedItem.value.totalPoints === "" || editedItem.value.totalPoints == null
        ? null
        : Number(editedItem.value.totalPoints),
    description: editedItem.value.description || null,
    coreAssessment: Boolean(editedItem.value.coreAssessment),
    departmentOutcomeId: editedItem.value.coreAssessment ? null : editedItem.value.departmentOutcomeId || null,
    universityOutcomeId: editedItem.value.coreAssessment ? editedItem.value.universityOutcomeId || null : null,
  };

  if (editedIndex.value > -1) {
    AssignmentServices.update(editedItem.value.id, payload)
      .then((response) => {
        Object.assign(assignments.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        console.error("Error updating assignment:", error);
      });
  } else {
    AssignmentServices.create(payload)
      .then((response) => {
        assignments.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating assignment:", error);
      });
  }
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

const onCoreAssessmentChange = (value) => {
  if (value) editedItem.value.departmentOutcomeId = null;
  else editedItem.value.universityOutcomeId = null;
};

const openDialog = () => {
  if (!selectedDepartmentId.value) return;
  editedItem.value = Object.assign({}, defaultItem);
  editedItem.value.departmentId = selectedDepartmentId.value;
  editedIndex.value = -1;
  dialog.value = true;
};

onMounted(async () => {
  await ensureUser();
  initialize();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Assignments</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" :disabled="!selectedDepartmentId" @click="openDialog()">Add Assignment</v-btn>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" md="6">
          <div v-if="lockedDepartment" class="v-card-title px-0">
            {{ departmentLabel(lockedDepartment) }}
          </div>
          <v-autocomplete
            v-else
            v-model="selectedDepartmentId"
            :items="visibleDepartments"
            :item-title="departmentLabel"
            item-value="id"
            label="Department"
            :loading="loadingDepartments"
            clearable
          ></v-autocomplete>
        </v-col>
      </v-row>

      <v-card>
        <v-card-title>Assignments</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredAssignments"
            :loading="loading"
          >
            <template v-slot:[`item.course`]="{ item }">
              {{ courseLabel(item.course) || "N/A" }}
            </template>
            <template v-slot:[`item.coreAssessment`]="{ item }">
              {{ item.coreAssessment ? "Yes" : "" }}
            </template>
            <template v-slot:[`item.departmentOutcome`]="{ item }">
              {{
                item.coreAssessment
                  ? outcomeLabel(item.universityOutcome)
                  : outcomeLabel(item.departmentOutcome)
              }}
            </template>
            <template v-slot:item.actions="{ item }">
              <v-icon small class="mr-2" @click="editItem(item)">
                mdi-pencil
              </v-icon>
              <v-icon small @click="deleteItem(item)"> mdi-delete </v-icon>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>

      <v-dialog v-model="dialog" max-width="500px">
        <v-card>
          <v-card-title class="d-flex flex-column align-start">
            <span class="text-h5">{{ formTitle }}</span>
            <span v-if="selectedDepartment" class="text-body-1 mt-1">
              {{ departmentLabel(selectedDepartment) }}
            </span>
          </v-card-title>

          <v-card-text>
            <v-container>
              <v-row>
                <v-col cols="12">
                  <v-autocomplete
                    v-model="editedItem.courseId"
                    :items="courses"
                    :item-title="courseLabel"
                    item-value="id"
                    label="Course"
                    required
                    :error="formErrors.courseId"
                    :error-messages="formErrors.courseId ? 'Course is required' : ''"
                    @update:model-value="formErrors.courseId = false"
                    clearable
                  ></v-autocomplete>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="editedItem.name"
                    label="Name"
                    required
                    :error="formErrors.name"
                    :error-messages="formErrors.name ? 'Name is required' : ''"
                    @input="formErrors.name = false"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="editedItem.totalPoints"
                    label="Total Points"
                    type="number"
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="editedItem.description"
                    label="Description"
                  ></v-textarea>
                </v-col>
                <v-col cols="12">
                  <v-checkbox
                    v-model="editedItem.coreAssessment"
                    label="Core Assessment"
                    @update:model-value="onCoreAssessmentChange"
                  ></v-checkbox>
                </v-col>
                <v-col v-if="editedItem.coreAssessment" cols="12">
                  <v-autocomplete
                    v-model="editedItem.universityOutcomeId"
                    :items="universityOutcomesForDepartment"
                    :item-title="outcomeLabel"
                    item-value="id"
                    label="University Learning Outcome"
                    :disabled="!editedItem.departmentId"
                    clearable
                  ></v-autocomplete>
                </v-col>
                <v-col v-else cols="12">
                  <v-autocomplete
                    v-model="editedItem.departmentOutcomeId"
                    :items="outcomesForDepartment"
                    :item-title="outcomeLabel"
                    item-value="id"
                    label="Department Outcome"
                    :disabled="!editedItem.departmentId"
                    clearable
                  ></v-autocomplete>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="close" class="dialog-cancel">Cancel</v-btn>
            <v-btn
              color="blue darken-1"
              text
              @click="save"
              :disabled="!isFormValid"
               class="dialog-save">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete Assignment</v-card-title>
          <v-card-text>
            Are you sure you want to delete this assignment? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey darken-1" text @click="deleteDialog = false" class="dialog-cancel">Cancel</v-btn>
            <v-btn color="error" text @click="confirmDelete">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

<style scoped>
.v-data-table :deep(th) {
  font-weight: bold !important;
}
</style>
