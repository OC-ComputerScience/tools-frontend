<script setup>
import PrefixKeywordServices from "../services/prefixKeywordServices";
import { ref, onMounted } from "vue";

const prefixKeywords = ref([]);
const message = ref("Manage Prefix Keywords");
const dialog = ref(false);
const editedPrefixKeyword = ref({});
const defaultPrefixKeyword = ref({ prefix: "", keywords: "" });

const retrievePrefixKeywords = () => {
  PrefixKeywordServices.getAllPrefixKeywords()
    .then((response) => {
      prefixKeywords.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading prefix keywords";
    });
};

const openDialog = (prefixKeyword = null) => {
  editedPrefixKeyword.value = prefixKeyword ? { ...prefixKeyword } : { ...defaultPrefixKeyword.value };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedPrefixKeyword.value = { ...defaultPrefixKeyword.value };
};

const savePrefixKeyword = () => {
  if (!editedPrefixKeyword.value.prefix || !editedPrefixKeyword.value.keywords) {
    message.value = "Prefix and keywords are required";
    return;
  }

  if (editedPrefixKeyword.value.id) {
    PrefixKeywordServices.updatePrefixKeyword(editedPrefixKeyword.value.id, editedPrefixKeyword.value)
      .then(() => {
        message.value = "Prefix keyword updated successfully";
        closeDialog();
        retrievePrefixKeywords();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error updating prefix keyword";
      });
  } else {
    PrefixKeywordServices.createPrefixKeyword(editedPrefixKeyword.value)
      .then(() => {
        message.value = "Prefix keyword created successfully";
        closeDialog();
        retrievePrefixKeywords();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error creating prefix keyword";
      });
  }
};

const deletePrefixKeyword = (prefixKeyword) => {
  if (confirm(`Are you sure you want to delete prefix ${prefixKeyword.prefix}?`)) {
    PrefixKeywordServices.deletePrefixKeyword(prefixKeyword.id)
      .then(() => {
        message.value = "Prefix keyword deleted successfully";
        retrievePrefixKeywords();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error deleting prefix keyword";
      });
  }
};

onMounted(() => {
  retrievePrefixKeywords();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Prefix Keywords</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Prefix Keyword</v-btn>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Prefix Keywords</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">Prefix</th>
              <th class="text-left">Keywords</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="prefixKeyword in prefixKeywords" :key="prefixKeyword.id">
              <td>{{ prefixKeyword.id }}</td>
              <td>{{ prefixKeyword.prefix }}</td>
              <td>{{ prefixKeyword.keywords }}</td>
              <td>
                <v-icon small class="mx-2" @click="openDialog(prefixKeyword)">
                  mdi-pencil
                </v-icon>
                <v-icon small class="mx-2" @click="deletePrefixKeyword(prefixKeyword)">
                  mdi-trash-can
                </v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Edit/Create Dialog -->
      <v-dialog v-model="dialog" max-width="600px">
        <v-card>
          <v-card-title>
            {{ editedPrefixKeyword.id ? "Edit Prefix Keyword" : "Create Prefix Keyword" }}
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedPrefixKeyword.prefix"
              label="Prefix"
              required
              hint="First 4 characters of course number (e.g., CMSC)"
              persistent-hint
            ></v-text-field>
            <v-textarea
              v-model="editedPrefixKeyword.keywords"
              label="Keywords"
              required
              rows="4"
              hint="Comma-separated list of keywords (max 1000 characters)"
              persistent-hint
              counter="1000"
              maxlength="1000"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" @click="savePrefixKeyword">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
