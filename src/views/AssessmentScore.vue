<script setup>
import { ref, computed, onMounted } from "vue";
import AssessmentScoreServices from "../services/assessmentScoreServices";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const saving = ref(false);
const scores = ref([]);
const errorMessage = ref("");
const editedIndex = ref(-1);
const editedItem = ref({
  score: null,
  percentage: null,
  description: "",
});
const defaultItem = {
  score: null,
  percentage: null,
  description: "",
};

const isFormValid = computed(() => {
  return editedItem.value.score !== "" &&
    editedItem.value.score != null &&
    editedItem.value.percentage !== "" &&
    editedItem.value.percentage != null;
});

const headers = [
  { title: "Score", key: "score", sortable: true },
  { title: "Percentage", key: "percentage", sortable: true },
  { title: "Description", key: "description", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Assessment Score" : "Edit Assessment Score";
});

const initialize = () => {
  loading.value = true;
  errorMessage.value = "";
  AssessmentScoreServices.getAll()
    .then((response) => {
      scores.value = response.data;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading assessment scores";
    })
    .finally(() => {
      loading.value = false;
    });
};

const editItem = (item) => {
  editedIndex.value = scores.value.indexOf(item);
  editedItem.value = {
    id: item.id,
    score: item.score,
    percentage: item.percentage,
    description: item.description || "",
  };
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = scores.value.indexOf(itemToDelete.value);
  AssessmentScoreServices.delete(itemToDelete.value.id)
    .then(() => {
      scores.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error deleting assessment score";
      deleteDialog.value = false;
    });
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  if (!isFormValid.value) return;
  saving.value = true;
  errorMessage.value = "";
  const payload = {
    score: Number(editedItem.value.score),
    percentage: Number(editedItem.value.percentage),
    description: editedItem.value.description || "",
  };

  if (editedIndex.value > -1) {
    AssessmentScoreServices.update(editedItem.value.id, payload)
      .then((response) => {
        Object.assign(scores.value[editedIndex.value], response.data);
        close();
      })
      .catch((error) => {
        errorMessage.value = error.response?.data?.message || "Error updating assessment score";
      })
      .finally(() => {
        saving.value = false;
      });
  } else {
    AssessmentScoreServices.create(payload)
      .then((response) => {
        scores.value.push(response.data);
        close();
      })
      .catch((error) => {
        errorMessage.value = error.response?.data?.message || "Error creating assessment score";
      })
      .finally(() => {
        saving.value = false;
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
        <v-toolbar-title>Assessment Scores</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Assessment Score</v-btn>
      </v-toolbar>
      <br />

      <v-alert v-if="errorMessage" type="error" class="mb-4" variant="tonal">
        {{ errorMessage }}
      </v-alert>

      <v-card>
        <v-card-text>
          <v-data-table :headers="headers" :items="scores" :loading="loading">
            <template v-slot:item.actions="{ item }">
              <v-icon small class="mr-2" @click="editItem(item)">mdi-pencil</v-icon>
              <v-icon small @click="deleteItem(item)">mdi-delete</v-icon>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>

      <v-dialog v-model="dialog" max-width="480px">
        <v-card>
          <v-card-title>
            <span class="text-h5">{{ formTitle }}</span>
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedItem.score"
              label="Score"
              type="number"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedItem.percentage"
              label="Percentage"
              type="number"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedItem.description"
              label="Description"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="close">Cancel</v-btn>
            <v-btn
              color="primary"
              variant="text"
              :disabled="!isFormValid"
              :loading="saving"
              @click="save"
            >
              Save
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete Assessment Score</v-card-title>
          <v-card-text>
            Are you sure you want to delete this assessment score? This action cannot be undone.
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
