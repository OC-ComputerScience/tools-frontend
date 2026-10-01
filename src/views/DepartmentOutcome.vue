<script setup>
import { ref, computed, onMounted } from "vue";
import DepartmentOutcomeServices from "../services/departmentOutcomeServices";
import DepartmentServices from "../services/departmentServices";
import UniversityOutcomeServices from "../services/universityOutcomeServices";
import UserServices from "../services/userServices";
import Utils from "../config/utils";

const levelOptions = [
  { title: "Undergraduate", value: "undergraduate" },
  { title: "Graduate", value: "graduate" },
];

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const loadingDepartments = ref(false);
const outcomes = ref([]);
const departments = ref([]);
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

const selectedDepartment = computed(() =>
  departments.value.find((department) => department.id === selectedDepartmentId.value) || null
);

const departmentLabel = (department) => {
  if (!department) return "";
  return department.name || "";
};

const filteredOutcomes = computed(() => {
  if (!selectedDepartmentId.value) return [];
  return outcomes.value.filter(
    (outcome) =>
      Number(outcome.departmentId ?? outcome.department?.id) === Number(selectedDepartmentId.value)
  );
});

const editedIndex = ref(-1);
const editedItem = ref({
  departmentId: null,
  universityOutcomeIds: [],
  number: "",
  name: "",
  description: "",
  level: "undergraduate",
  effectiveDate: null,
  endDate: null,
});
const defaultItem = {
  departmentId: null,
  universityOutcomeIds: [],
  number: "",
  name: "",
  description: "",
  level: "undergraduate",
  effectiveDate: null,
  endDate: null,
};

const formErrors = ref({
  number: false,
  name: false,
  level: false,
});

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.departmentId &&
      editedItem.value.number &&
      editedItem.value.name &&
      editedItem.value.level
  );
});

const universityOutcomeLabel = (outcome) => {
  if (!outcome) return "";
  return `${outcome.number} - ${outcome.name}`;
};

const universityOutcomesForDepartment = computed(() => {
  const departmentId = Number(editedItem.value.departmentId);
  if (!departmentId) return [];
  const department = departments.value.find((d) => Number(d.id) === departmentId);
  const universityId = Number(department?.universityId ?? department?.university?.id);
  if (!universityId || !editedItem.value.level) return [];
  return universityOutcomes.value.filter(
    (outcome) =>
      Number(outcome.universityId ?? outcome.university?.id) === universityId &&
      outcome.level === editedItem.value.level
  );
});

const headers = [
  { title: "Number", key: "number", sortable: true },
  { title: "Name", key: "name", sortable: true },
  { title: "University Outcomes", key: "universityOutcomes", sortable: false },
  { title: "Level", key: "level", sortable: true },
  { title: "Effective Date", key: "effectiveDate", sortable: true },
  { title: "End Date", key: "endDate", sortable: true },
  { title: "Description", key: "description", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formatDate = (value) => {
  if (!value) return "";
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split("-");
  if (!year || !month || !day) return text;
  return `${month}/${day}/${year}`;
};

const toDateInput = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Department Outcome" : "Edit Department Outcome";
});

const initialize = () => {
  loading.value = true;
  DepartmentOutcomeServices.getAll()
    .then((response) => {
      outcomes.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching department outcomes:", error);
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

  UniversityOutcomeServices.getAll()
    .then((response) => {
      universityOutcomes.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching university outcomes:", error);
    })
    .finally(() => {
      loading.value = false;
    });
};

const onLevelChange = () => {
  formErrors.value.level = false;
  clearUniversityOutcomeIfNotAllowed();
};

const universityOutcomeListLabel = (item) => {
  const assigned = item.universityOutcomes || [];
  if (!assigned.length) return "";
  return assigned
    .map((outcome) => {
      const level = outcome.level === "graduate" ? "Graduate" : "Undergraduate";
      return `${outcome.number} - ${outcome.name} (${level})`;
    })
    .join(", ");
};

const clearUniversityOutcomeIfNotAllowed = () => {
  const allowedIds = new Set(
    universityOutcomesForDepartment.value.map((outcome) => Number(outcome.id))
  );
  editedItem.value.universityOutcomeIds = (editedItem.value.universityOutcomeIds || []).filter((id) =>
    allowedIds.has(Number(id))
  );
};

const editItem = (item) => {
  editedIndex.value = outcomes.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  editedItem.value.universityOutcomeIds = (item.universityOutcomes || []).map((outcome) => outcome.id);
  editedItem.value.effectiveDate = toDateInput(item.effectiveDate);
  editedItem.value.endDate = toDateInput(item.endDate);
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = outcomes.value.indexOf(itemToDelete.value);
  DepartmentOutcomeServices.delete(itemToDelete.value.id)
    .then(() => {
      outcomes.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting department outcome:", error);
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
    universityOutcomeIds: editedItem.value.universityOutcomeIds || [],
    number: editedItem.value.number,
    name: editedItem.value.name,
    description: editedItem.value.description || null,
    level: editedItem.value.level,
    effectiveDate: editedItem.value.effectiveDate || null,
    endDate: editedItem.value.endDate || null,
  };

  if (editedIndex.value > -1) {
    DepartmentOutcomeServices.update(editedItem.value.id, payload)
      .then((response) => {
        Object.assign(outcomes.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        console.error("Error updating department outcome:", error);
      });
  } else {
    DepartmentOutcomeServices.create(payload)
      .then((response) => {
        outcomes.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating department outcome:", error);
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
        <v-toolbar-title>Manage Department Outcomes</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" :disabled="!selectedDepartmentId" @click="openDialog()">Add Department Outcome</v-btn>
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
        <v-card-title>Department Outcomes</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredOutcomes"
            :loading="loading"
          >
            <template v-slot:[`item.universityOutcomes`]="{ item }">
              {{ universityOutcomeListLabel(item) || "" }}
            </template>
            <template v-slot:[`item.level`]="{ item }">
              {{ item.level === "graduate" ? "Graduate" : "Undergraduate" }}
            </template>
            <template v-slot:[`item.effectiveDate`]="{ item }">
              {{ formatDate(item.effectiveDate) || "" }}
            </template>
            <template v-slot:[`item.endDate`]="{ item }">
              {{ formatDate(item.endDate) || "" }}
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

      <v-dialog v-model="dialog" max-width="640px">
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
                    v-model="editedItem.universityOutcomeIds"
                    :items="universityOutcomesForDepartment"
                    :item-title="universityOutcomeLabel"
                    item-value="id"
                    label="University Outcomes"
                    multiple
                    chips
                    closable-chips
                    :disabled="!editedItem.departmentId"
                    clearable
                  ></v-autocomplete>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="editedItem.number"
                    label="Number"
                    required
                    :error="formErrors.number"
                    :error-messages="formErrors.number ? 'Number is required' : ''"
                    @input="formErrors.number = false"
                  ></v-text-field>
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
                <v-col cols="12">
                  <v-textarea
                    v-model="editedItem.description"
                    label="Description"
                  ></v-textarea>
                </v-col>
                <v-col cols="12">
                  <v-select
                    v-model="editedItem.level"
                    :items="levelOptions"
                    label="Level"
                    required
                    :error="formErrors.level"
                    :error-messages="formErrors.level ? 'Level is required' : ''"
                    @update:model-value="onLevelChange"
                  ></v-select>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="editedItem.effectiveDate"
                    label="Effective Date"
                    type="date"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="editedItem.endDate"
                    label="End Date"
                    type="date"
                  ></v-text-field>
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
          <v-card-title class="text-h5">Delete Department Outcome</v-card-title>
          <v-card-text>
            Are you sure you want to delete this department outcome? This action cannot be undone.
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
