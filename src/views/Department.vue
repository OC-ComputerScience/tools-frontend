<script setup>
import { ref, computed, onMounted } from "vue";
import DepartmentServices from "../services/departmentServices";
import UniversityServices from "../services/universityServices";
import CollegeServices from "../services/collegeServices";
import UserServices from "../services/userServices";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const departments = ref([]);
const universities = ref([]);
const colleges = ref([]);
const users = ref([]);
const universityFilter = ref("");

const filteredDepartments = computed(() => {
  if (!universityFilter.value) return departments.value;
  const query = universityFilter.value.toLowerCase();
  return departments.value.filter((department) =>
    department.university?.name?.toLowerCase().includes(query)
  );
});

const editedIndex = ref(-1);
const editedItem = ref({
  universityId: null,
  collegeId: null,
  code: "",
  name: "",
  chairUserId: null,
  assessmentWeight: null,
});
const defaultItem = {
  universityId: null,
  collegeId: null,
  code: "",
  name: "",
  chairUserId: null,
  assessmentWeight: null,
};

const formErrors = ref({
  universityId: false,
  code: false,
  name: false,
});

const assessmentWeightError = computed(() => {
  const value = editedItem.value.assessmentWeight;
  if (value === "" || value == null) return "";
  const weight = Number(value);
  if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
    return "Enter a whole number from 0 to 100";
  }
  return "";
});

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.universityId &&
      editedItem.value.code &&
      editedItem.value.name &&
      !assessmentWeightError.value
  );
});

const headers = [
  { title: "University", key: "university.name", sortable: true },
  { title: "College", key: "college.name", sortable: true },
  { title: "Code", key: "code", sortable: true },
  { title: "Name", key: "name", sortable: true },
  { title: "Chair", key: "chair", sortable: true },
  { title: "Assessment Weight", key: "assessmentWeight", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const collegesForUniversity = computed(() => {
  if (!editedItem.value.universityId) return [];
  return colleges.value.filter((college) => college.universityId === editedItem.value.universityId);
});

const onUniversityChange = () => {
  formErrors.value.universityId = false;
  const collegeStillValid = collegesForUniversity.value.some(
    (college) => college.id === editedItem.value.collegeId
  );
  if (!collegeStillValid) editedItem.value.collegeId = null;
};

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Department" : "Edit Department";
});

const chairName = (chair) => {
  if (!chair) return "";
  return `${chair.lName}, ${chair.fName}`;
};

const initialize = () => {
  loading.value = true;
  DepartmentServices.getAll()
    .then((response) => {
      departments.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching departments:", error);
    });

  UniversityServices.getAll()
    .then((response) => {
      universities.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching universities:", error);
    });

  CollegeServices.getAll()
    .then((response) => {
      colleges.value = response.data || [];
    })
    .catch((error) => {
      console.error("Error fetching colleges:", error);
    });

  UserServices.getAllUsers()
    .then((response) => {
      users.value = response.data
        .map((user) => ({
          ...user,
          fullName: `${user.lName}, ${user.fName}`,
        }))
        .sort((a, b) => a.lName.localeCompare(b.lName));
    })
    .catch((error) => {
      console.error("Error fetching users:", error);
    })
    .finally(() => {
      loading.value = false;
    });
};

const editItem = (item) => {
  editedIndex.value = departments.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = departments.value.indexOf(itemToDelete.value);
  DepartmentServices.delete(itemToDelete.value.id)
    .then(() => {
      departments.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting department:", error);
    });
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  const payload = {
    universityId: editedItem.value.universityId,
    collegeId: editedItem.value.collegeId || null,
    code: editedItem.value.code,
    name: editedItem.value.name,
    chairUserId: editedItem.value.chairUserId || null,
    assessmentWeight:
      editedItem.value.assessmentWeight === "" || editedItem.value.assessmentWeight == null
        ? null
        : Number(editedItem.value.assessmentWeight),
  };

  if (editedIndex.value > -1) {
    DepartmentServices.update(editedItem.value.id, payload)
      .then((response) => {
        Object.assign(departments.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        console.error("Error updating department:", error);
      });
  } else {
    DepartmentServices.create(payload)
      .then((response) => {
        departments.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating department:", error);
      });
  }
};

const openDialog = () => {
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
  dialog.value = true;
};

onMounted(() => {
  initialize();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Departments</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Department</v-btn>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" sm="6" md="4">
          <v-text-field
            v-model="universityFilter"
            label="Filter by University Name"
            prepend-icon="mdi-magnify"
            clearable
          ></v-text-field>
        </v-col>
      </v-row>

      <v-card>
        <v-card-title>Departments</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredDepartments"
            :loading="loading"
          >
            <template v-slot:[`item.university.name`]="{ item }">
              {{ item.university ? item.university.name : "N/A" }}
            </template>
            <template v-slot:[`item.college.name`]="{ item }">
              {{ item.college ? item.college.name : "" }}
            </template>
            <template v-slot:[`item.chair`]="{ item }">
              {{ chairName(item.chair) || "N/A" }}
            </template>
            <template v-slot:[`item.assessmentWeight`]="{ item }">
              {{ item.assessmentWeight == null ? "" : `${item.assessmentWeight}%` }}
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
          <v-card-title>
            <span class="text-h5">{{ formTitle }}</span>
          </v-card-title>

          <v-card-text>
            <v-container>
              <v-row>
                <v-col cols="12">
                  <v-autocomplete
                    v-model="editedItem.universityId"
                    :items="universities"
                    item-title="name"
                    item-value="id"
                    label="University"
                    required
                    :error="formErrors.universityId"
                    :error-messages="
                      formErrors.universityId ? 'University is required' : ''
                    "
                    @update:model-value="onUniversityChange"
                    clearable
                  ></v-autocomplete>
                </v-col>
                <v-col cols="12">
                  <v-autocomplete
                    v-model="editedItem.collegeId"
                    :items="collegesForUniversity"
                    item-title="name"
                    item-value="id"
                    label="College"
                    :disabled="!editedItem.universityId"
                    clearable
                  ></v-autocomplete>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="editedItem.code"
                    label="Code"
                    required
                    :error="formErrors.code"
                    :error-messages="formErrors.code ? 'Code is required' : ''"
                    @input="formErrors.code = false"
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
                  <v-text-field
                    v-model="editedItem.assessmentWeight"
                    label="Assessment Weight"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    suffix="%"
                    :error="Boolean(assessmentWeightError)"
                    :error-messages="assessmentWeightError"
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-autocomplete
                    v-model="editedItem.chairUserId"
                    :items="users"
                    item-title="fullName"
                    item-value="id"
                    label="Chair"
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
          <v-card-title class="text-h5">Delete Department</v-card-title>
          <v-card-text>
            Are you sure you want to delete this department? This action cannot be undone.
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
