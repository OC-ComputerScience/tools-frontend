<script setup>
import { ref, computed, onMounted } from "vue";
import UniversityOutcomeServices from "../services/universityOutcomeServices";
import UniversityServices from "../services/universityServices";

const levelOptions = [
  { title: "Undergraduate", value: "undergraduate" },
  { title: "Graduate", value: "graduate" },
];

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const outcomes = ref([]);
const universities = ref([]);
const universityFilter = ref("");

const filteredOutcomes = computed(() => {
  if (!universityFilter.value) return outcomes.value;
  const query = universityFilter.value.toLowerCase();
  return outcomes.value.filter((outcome) =>
    outcome.university?.name?.toLowerCase().includes(query)
  );
});

const editedIndex = ref(-1);
const editedItem = ref({
  universityId: null,
  number: "",
  name: "",
  description: "",
  level: "undergraduate",
  effectiveDate: null,
  endDate: null,
});
const defaultItem = {
  universityId: null,
  number: "",
  name: "",
  description: "",
  level: "undergraduate",
  effectiveDate: null,
  endDate: null,
};

const formErrors = ref({
  universityId: false,
  number: false,
  name: false,
  level: false,
});

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.universityId &&
      editedItem.value.number &&
      editedItem.value.name &&
      editedItem.value.level
  );
});

const headers = [
  { title: "University", key: "university.name", sortable: true },
  { title: "Number", key: "number", sortable: true },
  { title: "Name", key: "name", sortable: true },
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
  return editedIndex.value === -1 ? "New University Outcome" : "Edit University Outcome";
});

const initialize = () => {
  loading.value = true;
  UniversityOutcomeServices.getAll()
    .then((response) => {
      outcomes.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching university outcomes:", error);
    });

  UniversityServices.getAll()
    .then((response) => {
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
  editedIndex.value = outcomes.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
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
  UniversityOutcomeServices.delete(itemToDelete.value.id)
    .then(() => {
      outcomes.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      console.error("Error deleting university outcome:", error);
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
    number: editedItem.value.number,
    name: editedItem.value.name,
    description: editedItem.value.description || null,
    level: editedItem.value.level,
    effectiveDate: editedItem.value.effectiveDate || null,
    endDate: editedItem.value.endDate || null,
  };

  if (editedIndex.value > -1) {
    UniversityOutcomeServices.update(editedItem.value.id, payload)
      .then((response) => {
        const university = universities.value.find(
          (u) => u.id === payload.universityId
        );
        Object.assign(outcomes.value[editedIndex.value], {
          ...response.data,
          university,
        });
        close();
      })
      .catch((error) => {
        console.error("Error updating university outcome:", error);
      });
  } else {
    UniversityOutcomeServices.create(payload)
      .then((response) => {
        const university = universities.value.find(
          (u) => u.id === payload.universityId
        );
        outcomes.value.push({
          ...response.data,
          university,
        });
        close();
      })
      .catch((error) => {
        console.error("Error creating university outcome:", error);
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
        <v-toolbar-title>Manage University Outcomes</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add University Outcome</v-btn>
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
        <v-card-title>University Outcomes</v-card-title>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredOutcomes"
            :loading="loading"
          >
            <template v-slot:[`item.university.name`]="{ item }">
              {{ item.university ? item.university.name : "N/A" }}
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
                    @update:model-value="formErrors.universityId = false"
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
                  <v-select
                    v-model="editedItem.level"
                    :items="levelOptions"
                    label="Level"
                    required
                    :error="formErrors.level"
                    :error-messages="formErrors.level ? 'Level is required' : ''"
                    @update:model-value="formErrors.level = false"
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
                <v-col cols="12">
                  <v-textarea
                    v-model="editedItem.description"
                    label="Description"
                  ></v-textarea>
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

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete University Outcome</v-card-title>
          <v-card-text>
            Are you sure you want to delete this university outcome? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey darken-1" text @click="deleteDialog = false">Cancel</v-btn>
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
