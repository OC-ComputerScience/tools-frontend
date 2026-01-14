<script setup>
import { ref, computed, onMounted } from "vue";
import SemesterServices from "../services/semesterServices";

const dialog = ref(false);
const loading = ref(false);
const semesters = ref([]);
const editedIndex = ref(-1);
const editedItem = ref({
  name: "",
  startDate: "",
  endDate: "",
});
const defaultItem = {
  name: "",
  startDate: "",
  endDate: "",
};

const headers = [
  { title: "Name", key: "name" },
  { title: "Start Date", key: "startDate" },
  { title: "End Date", key: "endDate" },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Semester" : "Edit Semester";
});

const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString();
};

const formatDateForInput = (date) => {
  const d = new Date(date);
  // Adjust for timezone offset
  const offset = d.getTimezoneOffset();
  const adjustedDate = new Date(d.getTime() - offset * 60 * 1000);
  return adjustedDate.toISOString().split("T")[0];
};

const initialize = () => {
  loading.value = true;
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching semesters:", error);
    })
    .finally(() => {
      loading.value = false;
    });
};

const editItem = (item) => {
  editedIndex.value = semesters.value.indexOf(item);
  editedItem.value = {
    ...item,
    startDate: formatDateForInput(item.startDate),
    endDate: formatDateForInput(item.endDate),
  };
  dialog.value = true;
};

const deleteItem = (item) => {
  const index = semesters.value.indexOf(item);
  if (confirm("Are you sure you want to delete this semester?")) {
    SemesterServices.delete(item.id)
      .then(() => {
        semesters.value.splice(index, 1);
      })
      .catch((error) => {
        console.error("Error deleting semester:", error);
      });
  }
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  if (editedIndex.value > -1) {
    // Update
    SemesterServices.update(editedItem.value.id, editedItem.value)
      .then((response) => {
        // Update the local data with the response data
        Object.assign(semesters.value[editedIndex.value], {
          ...editedItem.value,
          startDate: new Date(editedItem.value.startDate + "T00:00:00"),
          endDate: new Date(editedItem.value.endDate + "T00:00:00"),
        });
        close();
      })
      .catch((error) => {
        console.error("Error updating semester:", error);
      });
  } else {
    // Create
    SemesterServices.create(editedItem.value)
      .then((response) => {
        semesters.value.push(response.data);
        close();
      })
      .catch((error) => {
        console.error("Error creating semester:", error);
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
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Semesters</h1>
        <v-btn color="primary" @click="openDialog()">Add Semester</v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="semesters"
          :loading="loading"
          class="elevation-1"
        >
          <template v-slot:item.startDate="{ item }">
            {{ formatDate(item.startDate) }}
          </template>
          <template v-slot:item.endDate="{ item }">
            {{ formatDate(item.endDate) }}
          </template>
          <template v-slot:item.actions="{ item }">
            <v-icon small class="mr-2" @click="editItem(item)">
              mdi-pencil
            </v-icon>
            <v-icon small @click="deleteItem(item)"> mdi-delete </v-icon>
          </template>
        </v-data-table>
      </v-col>
    </v-row>

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
                  label="Semester Name"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.startDate"
                  label="Start Date"
                  type="date"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.endDate"
                  label="End Date"
                  type="date"
                  required
                ></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="close">
            Cancel
          </v-btn>
          <v-btn color="blue-darken-1" variant="text" @click="save">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.v-data-table :deep(th) {
  font-weight: bold !important;
}
</style>
