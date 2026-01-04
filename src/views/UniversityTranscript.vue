<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import UniversityTranscriptServices from "../services/universityTranscriptServices";
import UniversityServices from "../services/universityServices";
import TranscriptServices from "../services/transcriptServices";
import PDFViewer from "./PDFViewer.vue";
import apiClient from "../services/services.js";

const dialog = ref(false);
const uploadDialog = ref(false);
const pdfDialog = ref(false);
const selectedFile = ref(null);
const currentTranscript = ref(null);
const currentPdfUrl = ref("");
const loading = ref(false);
const universityTranscripts = ref([]);
const universities = ref([]);
const editedIndex = ref(-1);
const editedItem = ref({
  OCIdNumber: "",
  name: "",
  universityId: null,
  official: false,
});
const defaultItem = {
  OCIdNumber: "",
  name: "",
  universityId: null,
  official: false,
};
const fileInput = ref(null);
const isDragging = ref(false);
const formErrors = ref({
  OCIdNumber: false,
  name: false,
  universityId: false,
});

const headers = [
  { title: "OC ID Number", key: "OCIdNumber" },
  { title: "Student Name", key: "name" },
  { title: "University", key: "university.name" },
  { title: "Official", key: "official" },
  { title: "PDF", key: "pdf" },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1
    ? "New University Transcript"
    : "Edit University Transcript";
});

const initialize = () => {
  loading.value = true;

  UniversityTranscriptServices.getAll()
    .then((responce) => {
      universityTranscripts.value = responce.data;
    })
    .catch((error) => {
      console.log("Error reading University Transcripts");
    });

  UniversityServices.getAll()
    .then((responce) => {
      universities.value = responce.data;
    })
    .catch((error) => {
      console.log("Error reading Universitis");
    });

  loading.value = false;
};

const editItem = (item) => {
  editedIndex.value = universityTranscripts.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = async (item) => {
  const index = universityTranscripts.value.indexOf(item);
  if (confirm("Are you sure you want to delete this university transcript?")) {
    await UniversityTranscriptServices.delete(item.id)
      .then((response) => {
        universityTranscripts.value.splice(index, 1);
      })
      .catch((error) => {
        console.error("Error deleting university transcript:", error);
      });
  }
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const validateForm = () => {
  formErrors.value.OCIdNumber = !editedItem.value.OCIdNumber;
  formErrors.value.name = !editedItem.value.name;
  formErrors.value.universityId = !editedItem.value.universityId;

  return !Object.values(formErrors.value).some((error) => error);
};

const isFormValid = computed(() => {
  return (
    editedItem.value.OCIdNumber &&
    editedItem.value.name &&
    editedItem.value.universityId
  );
});

const save = async () => {
  if (editedIndex.value > -1) {
    // Update
    await UniversityTranscriptServices.update(
      editedItem.value.id,
      editedItem.value
    )
      .then((response) => {
        // Find the university data
        const university = universities.value.find(
          (u) => u.id === editedItem.value.universityId
        );
        // Create a new object with the university data
        const updatedItem = {
          ...response.data,
          university: university,
        };
        Object.assign(
          universityTranscripts.value[editedIndex.value],
          updatedItem
        );
        close();
      })
      .catch((error) => {
        console.error("Error updating university transcript:", error);
      });
  } else {
    // Create
    await UniversityTranscriptServices.create(editedItem.value)
      .then((response) => {
        // Find the university data
        const university = universities.value.find(
          (u) => u.id === editedItem.value.universityId
        );
        // Create a new object with the university data
        const newItem = {
          ...response.data,
          university: university,
        };
        universityTranscripts.value.push(newItem);
        close();
      })
      .catch((error) => {
        console.error("Error creating university transcript:", error);
      });
  }
};

const openDialog = () => {
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
  dialog.value = true;
};

const openUploadDialog = (item) => {
  currentTranscript.value = item;
  uploadDialog.value = true;
};

const handleFileSelect = (event) => {
  selectedFile.value = event.target.files[0];
};

const uploadFile = async () => {
  if (!selectedFile.value || !currentTranscript.value) return;

  console.log("Current transcript:", currentTranscript.value); // Debug log
  try {
    await TranscriptServices.uploadTranscript(
      selectedFile.value,
      currentTranscript.value.id
    );
    uploadDialog.value = false;
    selectedFile.value = null;
    currentTranscript.value = null;
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

const viewPdf = async (item) => {
  // Get the base URL from the API client and remove the /transcript/ suffix
  const baseUrl = apiClient.defaults.baseURL.replace("/transcript/", "");

  // Add timestamp to prevent caching
  const timestamp = new Date().getTime();
  const url = `${baseUrl}/data/transcripts/transcript-${item.id}.pdf?t=${timestamp}`;
  currentPdfUrl.value = url;
  pdfDialog.value = true;
};

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleDrop = (event) => {
  isDragging.value = false;
  const file = event.dataTransfer.files[0];
  if (file && file.type === "application/pdf") {
    selectedFile.value = file;
  } else {
    alert("Please drop a PDF file");
  }
};

const clearFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const closeUploadDialog = () => {
  uploadDialog.value = false;
  selectedFile.value = null;
  isDragging.value = false;
};

onMounted(() => {
  initialize();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>University Transcripts</h1>
        <v-btn color="primary" @click="openDialog()"
          >Add University Transcript</v-btn
        >
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="universityTranscripts"
          :loading="loading"
          class="elevation-1"
        >
          <template v-slot:item.official="{ item }">
            <v-icon :color="item.official ? 'green' : 'red'">
              {{ item.official ? "mdi-check-circle" : "mdi-close-circle" }}
            </v-icon>
          </template>
          <template v-slot:item.pdf="{ item }">
            <div class="d-flex align-center">
              <v-icon
                small
                class="mr-2"
                @click="openUploadDialog(item)"
                color="primary"
              >
                mdi-file-pdf-box
              </v-icon>
              <v-icon small class="mr-2" @click="viewPdf(item)" color="primary">
                mdi-eye
              </v-icon>
            </div>
          </template>
          <template v-slot:item.actions="{ item }">
            <v-icon small class="mr-2" @click="editItem(item)">
              mdi-pencil
            </v-icon>
            <v-icon small class="mr-2" @click="deleteItem(item)">
              mdi-delete
            </v-icon>
            <v-icon
              small
              @click="$router.push(`/transcript-courses/${item.id}`)"
            >
              mdi-book-open-page-variant
            </v-icon>
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
                  v-model="editedItem.OCIdNumber"
                  label="OC ID Number"
                  required
                  :error="formErrors.OCIdNumber"
                  :error-messages="
                    formErrors.OCIdNumber ? 'OC ID Number is required' : ''
                  "
                  @input="formErrors.OCIdNumber = false"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.name"
                  label="Student Name"
                  required
                  :error="formErrors.name"
                  :error-messages="
                    formErrors.name ? 'Student Name is required' : ''
                  "
                  @input="formErrors.name = false"
                ></v-text-field>
              </v-col>
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
                  :filter="
                    (item, queryText) => {
                      const text = item.name.toLowerCase();
                      const query = queryText.toLowerCase();
                      return text.includes(query);
                    }
                  "
                  clearable
                ></v-autocomplete>
              </v-col>
              <v-col cols="12" sm="6" md="6">
                <v-checkbox
                  v-model="editedItem.official"
                  label="Official Transcript"
                  color="primary"
                ></v-checkbox>
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

    <!-- Upload Dialog -->
    <v-dialog v-model="uploadDialog" max-width="500px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Upload Transcript PDF</span>
        </v-card-title>

        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <!-- Drag and Drop Area -->
                <v-card
                  class="mb-4 pa-4"
                  :class="{ 'drag-over': isDragging }"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                  style="
                    border: 2px dashed #ccc;
                    border-radius: 8px;
                    cursor: pointer;
                  "
                  @click="triggerFileInput"
                >
                  <div class="text-center">
                    <v-icon size="48" color="primary" class="mb-2"
                      >mdi-cloud-upload</v-icon
                    >
                    <div class="text-h6 mb-2">
                      Drag and drop your PDF file here
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      or click to browse
                    </div>
                  </div>
                </v-card>

                <!-- File Input (hidden) -->
                <input
                  ref="fileInput"
                  type="file"
                  accept=".pdf"
                  style="display: none"
                  @change="handleFileSelect"
                />

                <!-- Selected File Info -->
                <v-card
                  v-if="selectedFile"
                  class="mb-4 pa-4"
                  variant="outlined"
                >
                  <div class="d-flex align-center">
                    <v-icon color="primary" class="mr-2"
                      >mdi-file-pdf-box</v-icon
                    >
                    <div class="flex-grow-1">
                      <div class="text-subtitle-1">{{ selectedFile.name }}</div>
                      <div class="text-caption text-medium-emphasis">
                        {{ formatFileSize(selectedFile.size) }}
                      </div>
                    </div>
                    <v-btn icon @click="clearFile" color="error">
                      <v-icon>mdi-close</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeUploadDialog"
            >Cancel</v-btn
          >
          <v-btn
            color="blue darken-1"
            text
            @click="uploadFile"
            :disabled="!selectedFile"
          >
            Upload
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PDF Viewer Dialog -->
    <PDFViewer
      v-if="pdfDialog"
      :path="currentPdfUrl"
      :model-value="true"
      @update:model-value="pdfDialog = $event"
    />
  </v-container>
</template>

<style scoped>
.v-dialog--fullscreen {
  height: 90vh;
}

.drag-over {
  border-color: var(--v-primary-base) !important;
  background-color: rgba(var(--v-primary-base), 0.05);
}

.v-data-table :deep(th) {
  font-weight: bold !important;
}
</style>
