<script setup>
import { ref, computed, onMounted } from "vue";
import UniversityServices from "../services/universityServices";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const universities = ref([]);
const universityNameFilter = ref("");
const filteredUniversities = computed(() => {
  if (!universityNameFilter.value) return universities.value;
  return universities.value.filter((university) =>
    university.name
      .toLowerCase()
      .includes(universityNameFilter.value.toLowerCase())
  );
});
const editedIndex = ref(-1);
const editedItem = ref({
  name: "",
  city: "",
  state: "",
  country: "",
  oc_university_id: null,
});
const defaultItem = {
  name: "",
  city: "",
  state: "",
  country: "",
  oc_university_id: null,
};

const formErrors = ref({
  name: false,
  oc_university_id: false,
});

const isFormValid = computed(() => {
  return editedItem.value.name && editedItem.value.oc_university_id;
});

const headers = [
  { title: "Name", value: "name", sortable: true },
  { title: "City", value: "city", sortable: true },
  { title: "State", value: "state", sortable: true },
  { title: "Country", value: "country", sortable: true },
  { title: "OC University ID", value: "oc_university_id", sortable: true },
  { title: "Actions", value: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New University" : "Edit University";
});

const initialize = () => {
  loading.value = true;
  UniversityServices.getAll()
    .then((response) => {
      console.log("Universities data:", response.data);
      universities.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching universities:", error);
    })
    .finally(() => {
      loading.value = false;
    });
};

const editItem = (item) => {
  editedIndex.value = universities.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = universities.value.indexOf(itemToDelete.value);
  UniversityServices.delete(itemToDelete.value.id)
    .then((response) => {
      universities.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting university:", error);
    });
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  if (editedIndex.value > -1) {
    // Update
    UniversityServices.update(editedItem.value.id, editedItem.value)
      .then((response) => {
        Object.assign(universities.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        console.error("Error updating university:", error);
      });
  } else {
    // Create
    UniversityServices.create(editedItem.value)
      .then((response) => {
        universities.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating university:", error);
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
        <v-toolbar-title>Manage Universities</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add University</v-btn>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" sm="6" md="4">
          <v-text-field
            v-model="universityNameFilter"
            label="Filter by University Name"
            prepend-icon="mdi-magnify"
            clearable
          ></v-text-field>
        </v-col>
      </v-row>

      <v-card>
        <v-card-title>Universities</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredUniversities"
            :loading="loading"
          >
          <template v-slot:item.actions="{ item }">
            <v-icon small class="mr-2" @click="editItem(item)">
              mdi-pencil
            </v-icon>
            <v-icon small @click="deleteItem(item)"> mdi-delete </v-icon>
          </template>
          <template v-slot:[`item.oc_university_id`]="{ item }">
            {{ item.oc_university_id || "N/A" }}
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
                <v-text-field
                  v-model="editedItem.name"
                  label="University Name"
                  required
                  :error="formErrors.name"
                  :error-messages="
                    formErrors.name ? 'University Name is required' : ''
                  "
                  @input="formErrors.name = false"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.city"
                  label="City"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.state"
                  label="State"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.country"
                  label="Country"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.oc_university_id"
                  label="OC University ID"
                  required
                  :error="formErrors.oc_university_id"
                  :error-messages="
                    formErrors.oc_university_id
                      ? 'OC University ID is required'
                      : ''
                  "
                  @input="formErrors.oc_university_id = false"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="close">Cancel</v-btn>
          <v-btn
            color="blue darken-1"
            text
            @click="save"
            :disabled="!isFormValid"
            >Save</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Delete University</v-card-title>
        <v-card-text>
          Are you sure you want to delete this university? This action cannot be
          undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey darken-1" text @click="deleteDialog = false"
            >Cancel</v-btn
          >
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
