<script setup>
import { ref, computed, onMounted } from "vue";
import CollegeServices from "../services/collegeServices";
import UniversityServices from "../services/universityServices";
import UserServices from "../services/userServices";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const colleges = ref([]);
const universities = ref([]);
const users = ref([]);
const universityFilter = ref("");

const filteredColleges = computed(() => {
  if (!universityFilter.value) return colleges.value;
  const query = universityFilter.value.toLowerCase();
  return colleges.value.filter((college) =>
    college.university?.name?.toLowerCase().includes(query)
  );
});

const editedIndex = ref(-1);
const editedItem = ref({
  universityId: null,
  name: "",
  deanUserId: null,
  assessmentWeight: null,
});
const defaultItem = {
  universityId: null,
  name: "",
  deanUserId: null,
  assessmentWeight: null,
};

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
      String(editedItem.value.name || "").trim() &&
      !assessmentWeightError.value
  );
});

const headers = [
  { title: "University", key: "university.name", sortable: true },
  { title: "Name", key: "name", sortable: true },
  { title: "Dean", key: "dean", sortable: true },
  { title: "Assessment Weight", key: "assessmentWeight", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New College" : "Edit College";
});

const deanName = (dean) => {
  if (!dean) return "";
  return `${dean.lName}, ${dean.fName}`;
};

const initialize = () => {
  loading.value = true;
  CollegeServices.getAll()
    .then((response) => {
      colleges.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching colleges:", error);
    });

  UniversityServices.getAll()
    .then((response) => {
      universities.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching universities:", error);
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
  editedIndex.value = colleges.value.indexOf(item);
  editedItem.value = {
    id: item.id,
    universityId: item.universityId,
    name: item.name,
    deanUserId: item.deanUserId,
    assessmentWeight: item.assessmentWeight,
  };
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = colleges.value.indexOf(itemToDelete.value);
  CollegeServices.delete(itemToDelete.value.id)
    .then(() => {
      colleges.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting college:", error);
    });
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  if (!isFormValid.value) return;
  const payload = {
    universityId: editedItem.value.universityId,
    name: String(editedItem.value.name || "").trim(),
    deanUserId: editedItem.value.deanUserId || null,
    assessmentWeight:
      editedItem.value.assessmentWeight === "" || editedItem.value.assessmentWeight == null
        ? null
        : Number(editedItem.value.assessmentWeight),
  };

  if (editedIndex.value > -1) {
    CollegeServices.update(editedItem.value.id, payload)
      .then((response) => {
        Object.assign(colleges.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        console.error("Error updating college:", error);
      });
  } else {
    CollegeServices.create(payload)
      .then((response) => {
        colleges.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating college:", error);
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
        <v-toolbar-title>Colleges</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add College</v-btn>
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
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredColleges"
            :loading="loading"
          >
            <template v-slot:[`item.university.name`]="{ item }">
              {{ item.university ? item.university.name : "" }}
            </template>
            <template v-slot:[`item.dean`]="{ item }">
              {{ deanName(item.dean) }}
            </template>
            <template v-slot:[`item.assessmentWeight`]="{ item }">
              {{ item.assessmentWeight == null ? "" : `${item.assessmentWeight}%` }}
            </template>
            <template v-slot:item.actions="{ item }">
              <v-icon small class="mr-2" @click="editItem(item)">mdi-pencil</v-icon>
              <v-icon small @click="deleteItem(item)">mdi-delete</v-icon>
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
            <v-autocomplete
              v-model="editedItem.universityId"
              :items="universities"
              item-title="name"
              item-value="id"
              label="University"
              clearable
            ></v-autocomplete>
            <v-text-field v-model="editedItem.name" label="Name" required></v-text-field>
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
            <v-autocomplete
              v-model="editedItem.deanUserId"
              :items="users"
              item-title="fullName"
              item-value="id"
              label="Dean"
              clearable
            ></v-autocomplete>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="close">Cancel</v-btn>
            <v-btn color="primary" variant="text" :disabled="!isFormValid" @click="save">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete College</v-card-title>
          <v-card-text>
            Are you sure you want to delete this college? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
            <v-btn color="error" variant="text" @click="confirmDelete">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
