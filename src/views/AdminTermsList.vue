<script setup>
import TermServices from "../services/termServices";
import { ref, onMounted } from "vue";

const terms = ref([]);
const message = ref("Manage Terms");
const dialog = ref(false);
const editedTerm = ref({});
const defaultTerm = ref({ termName: "", startDate: null });

const retrieveTerms = () => {
  TermServices.getAllTerms()
    .then((response) => {
      terms.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading terms";
    });
};

const openDialog = (term = null) => {
  editedTerm.value = term ? { ...term } : { ...defaultTerm.value };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedTerm.value = { ...defaultTerm.value };
};

const saveTerm = () => {
  if (!editedTerm.value.termName) {
    message.value = "Term name is required";
    return;
  }

  if (editedTerm.value.id) {
    TermServices.updateTerm(editedTerm.value.id, editedTerm.value)
      .then(() => {
        message.value = "Term updated successfully";
        closeDialog();
        retrieveTerms();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error updating term";
      });
  } else {
    TermServices.createTerm(editedTerm.value)
      .then(() => {
        message.value = "Term created successfully";
        closeDialog();
        retrieveTerms();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error creating term";
      });
  }
};

const deleteTerm = (term) => {
  if (confirm(`Are you sure you want to delete ${term.termName}?`)) {
    TermServices.deleteTerm(term.id)
      .then(() => {
        message.value = "Term deleted successfully";
        retrieveTerms();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error deleting term";
      });
  }
};

onMounted(() => {
  retrieveTerms();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Terms</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Term</v-btn>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Terms</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">Term Name</th>
              <th class="text-left">Start Date</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="term in terms" :key="term.id">
              <td>{{ term.id }}</td>
              <td>{{ term.termName }}</td>
              <td>{{ term.startDate || "N/A" }}</td>
              <td>
                <v-icon small class="mx-2" @click="openDialog(term)">
                  mdi-pencil
                </v-icon>
                <v-icon small class="mx-2" @click="deleteTerm(term)">
                  mdi-trash-can
                </v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Edit/Create Dialog -->
      <v-dialog v-model="dialog" max-width="500px">
        <v-card>
          <v-card-title>
            {{ editedTerm.id ? "Edit Term" : "Create Term" }}
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedTerm.termName"
              label="Term Name"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedTerm.startDate"
              label="Start Date"
              type="date"
              hint="Date when the term starts"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" @click="saveTerm">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
