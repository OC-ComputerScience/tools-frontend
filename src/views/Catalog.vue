<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Catalogs</h1>
        <v-btn color="primary" @click="openDialog()">Add Catalog</v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="catalogs"
          :loading="loading"
          class="elevation-1"
        >
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
                  label="Catalog Name"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="editedItem.startSemesterId"
                  :items="semesters"
                  item-title="name"
                  item-value="id"
                  label="Starting Semester"
                  required
                ></v-select>
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="editedItem.endSemesterId"
                  :items="semesters"
                  item-title="name"
                  item-value="id"
                  label="Ending Semester"
                  required
                ></v-select>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="close">Cancel</v-btn>
          <v-btn color="blue darken-1" text @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import CatalogServices from "../services/catalogServices";
import SemesterServices from "../services/semesterServices";

const dialog = ref(false);
const loading = ref(false);
const catalogs = ref([]);
const semesters = ref([]);
const editedIndex = ref(-1);
const editedItem = ref({
  name: "",
  startSemesterId: null,
  endSemesterId: null,
});
const defaultItem = {
  name: "",
  startSemesterId: null,
  endSemesterId: null,
};

const headers = [
  { text: "Name", value: "name" },
  { text: "Starting Semester", value: "startSemester.name" },
  { text: "Ending Semester", value: "endSemester.name" },
  { text: "Actions", value: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Catalog" : "Edit Catalog";
});

const initialize = () => {
  loading.value = true;

  CatalogServices.getAll()
    .then((response) => {
      catalogs.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching catalogs:", error);
    });

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
  editedIndex.value = catalogs.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  const index = catalogs.value.indexOf(item);
  if (confirm("Are you sure you want to delete this catalog?")) {
    CatalogServices.delete(item.id)
      .then((response) => {
        catalogs.value.splice(index, 1);
      })
      .catch((error) => {
        console.error("Error deleting catalog:", error);
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
    CatalogServices.update(editedItem.value.id, editedItem.value)
      .then((response) => {
        // Find the semester data
        const startSemester = semesters.value.find(
          (s) => s.id === editedItem.value.startSemesterId
        );
        const endSemester = semesters.value.find(
          (s) => s.id === editedItem.value.endSemesterId
        );
        // Create a new object with the related data
        const updatedItem = {
          ...response.data,
          startSemester: startSemester,
          endSemester: endSemester,
        };
        Object.assign(catalogs.value[editedIndex.value], updatedItem);
        close();
      })
      .catch((error) => {
        console.error("Error updating catalog:", error);
      });
  } else {
    // Create
    CatalogServices.create(editedItem.value)
      .then((response) => {
        // Find the semester data
        const startSemester = semesters.value.find(
          (s) => s.id === editedItem.value.startSemesterId
        );
        const endSemester = semesters.value.find(
          (s) => s.id === editedItem.value.endSemesterId
        );
        // Create a new object with the related data
        const newItem = {
          ...response.data,
          startSemester: startSemester,
          endSemester: endSemester,
        };
        catalogs.value.push(newItem);
        close();
      })
      .catch((error) => {
        console.error("Error creating catalog:", error);
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

<style scoped>
.v-data-table :deep(th) {
  font-weight: bold !important;
}
</style>
