<script setup>
import { ref, computed, onMounted } from "vue";
import CourseServices from "../services/courseServices";
import SectionServices from "../services/sectionServices";
import SemesterServices from "../services/semesterServices";

const dialog = ref(false);
const deleteDialog = ref(false);
const itemToDelete = ref(null);
const loading = ref(false);
const saving = ref(false);
const courses = ref([]);
const semesters = ref([]);
const courseFilter = ref("");
const errorMessage = ref("");
const sectionsDialog = ref(false);
const sectionsLoading = ref(false);
const sectionsSaving = ref(false);
const selectedCourse = ref(null);
const courseSections = ref([]);
const sectionDialog = ref(false);
const sectionDeleteDialog = ref(false);
const sectionToDelete = ref(null);
const sectionEditedIndex = ref(-1);
const sectionError = ref("");
const sectionItem = ref({
  semesterId: null,
  courseSection: "",
  courseDescription: "",
  accountId: "",
  sectionCode: "",
  canvasSISCourseID: "",
});
const defaultSectionItem = {
  semesterId: null,
  courseSection: "",
  courseDescription: "",
  accountId: "",
  sectionCode: "",
  canvasSISCourseID: "",
};

const filteredCourses = computed(() => {
  if (!courseFilter.value) return courses.value;
  const query = courseFilter.value.toLowerCase();
  return courses.value.filter((course) => {
    return (
      String(course.number).toLowerCase().includes(query) ||
      course.description?.toLowerCase().includes(query)
    );
  });
});

const editedIndex = ref(-1);
const editedItem = ref({
  code: "",
  number: "",
  description: "",
  hours: null,
});
const defaultItem = {
  code: "",
  number: "",
  description: "",
  hours: null,
};

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.code?.trim() &&
      editedItem.value.number?.trim() &&
      editedItem.value.description?.trim()
  );
});

const headers = [
  { title: "Number", key: "number", sortable: true },
  { title: "Description", key: "description", sortable: true },
  { title: "Hours", key: "hours", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1 ? "New Course" : "Edit Course";
});

const sectionHeaders = [
  { title: "Semester", key: "semester.name", sortable: true },
  { title: "Section", key: "courseSection", sortable: true },
  { title: "Description", key: "courseDescription", sortable: true },
  { title: "Canvas SIS Course ID", key: "canvasSISCourseID", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const sectionFormTitle = computed(() => {
  return sectionEditedIndex.value === -1 ? "New Section" : "Edit Section";
});

const isSectionFormValid = computed(() => {
  return Boolean(sectionItem.value.semesterId && sectionItem.value.courseSection?.trim());
});

const blankToNull = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text ? text : null;
};

const coursePayload = () => {
  const hours = editedItem.value.hours;
  return {
    code: editedItem.value.code.trim(),
    number: String(editedItem.value.number).trim(),
    description: editedItem.value.description.trim(),
    hours: hours === "" || hours == null ? null : Number(hours),
  };
};

const initialize = () => {
  loading.value = true;
  errorMessage.value = "";
  CourseServices.getAllCourses()
    .then((response) => {
      courses.value = response.data;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading courses";
    })
    .finally(() => {
      loading.value = false;
    });
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data || [];
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error loading semesters";
    });
};

const loadCourseSections = () => {
  if (!selectedCourse.value?.number) {
    courseSections.value = [];
    return;
  }
  sectionsLoading.value = true;
  sectionError.value = "";
  SectionServices.getAllSections({ courseNumber: selectedCourse.value.number })
    .then((response) => {
      courseSections.value = response.data || [];
    })
    .catch((error) => {
      sectionError.value = error.response?.data?.message || "Error loading sections";
    })
    .finally(() => {
      sectionsLoading.value = false;
    });
};

const openSections = (course) => {
  selectedCourse.value = course;
  courseSections.value = [];
  sectionError.value = "";
  sectionsDialog.value = true;
  loadCourseSections();
};

const openSectionDialog = (section = null) => {
  if (section) {
    sectionEditedIndex.value = courseSections.value.indexOf(section);
    sectionItem.value = {
      id: section.id,
      semesterId: section.semesterId,
      courseSection: section.courseSection,
      courseDescription: section.courseDescription || "",
      accountId: section.accountId || "",
      sectionCode: section.sectionCode || "",
      canvasSISCourseID: section.canvasSISCourseID || "",
    };
  } else {
    sectionEditedIndex.value = -1;
    sectionItem.value = Object.assign({}, defaultSectionItem);
  }
  sectionDialog.value = true;
};

const closeSectionDialog = () => {
  sectionDialog.value = false;
  sectionItem.value = Object.assign({}, defaultSectionItem);
  sectionEditedIndex.value = -1;
};

const sectionPayload = () => ({
  semesterId: sectionItem.value.semesterId,
  courseNumber: selectedCourse.value.number,
  courseSection: sectionItem.value.courseSection.trim(),
  courseDescription: blankToNull(sectionItem.value.courseDescription),
  accountId: blankToNull(sectionItem.value.accountId),
  sectionCode: blankToNull(sectionItem.value.sectionCode),
  canvasSISCourseID: blankToNull(sectionItem.value.canvasSISCourseID),
});

const saveSection = () => {
  if (!isSectionFormValid.value) return;
  sectionsSaving.value = true;
  sectionError.value = "";
  const payload = sectionPayload();
  const semester = semesters.value.find((item) => item.id === payload.semesterId);

  if (sectionEditedIndex.value > -1) {
    SectionServices.updateSection(sectionItem.value.id, payload)
      .then(() => {
        Object.assign(courseSections.value[sectionEditedIndex.value], payload, { semester });
        closeSectionDialog();
      })
      .catch((error) => {
        sectionError.value = error.response?.data?.message || "Error updating section";
      })
      .finally(() => {
        sectionsSaving.value = false;
      });
  } else {
    SectionServices.createSection(payload)
      .then((response) => {
        courseSections.value.push({ ...response.data, semester });
        closeSectionDialog();
      })
      .catch((error) => {
        sectionError.value = error.response?.data?.message || "Error creating section";
      })
      .finally(() => {
        sectionsSaving.value = false;
      });
  }
};

const confirmDeleteSection = () => {
  SectionServices.deleteSection(sectionToDelete.value.id)
    .then(() => {
      courseSections.value = courseSections.value.filter((section) => section.id !== sectionToDelete.value.id);
      sectionDeleteDialog.value = false;
      sectionToDelete.value = null;
    })
    .catch((error) => {
      sectionError.value = error.response?.data?.message || "Error deleting section";
      sectionDeleteDialog.value = false;
    });
};

const editItem = (item) => {
  editedIndex.value = courses.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const confirmDelete = () => {
  const index = courses.value.indexOf(itemToDelete.value);
  CourseServices.deleteCourse(itemToDelete.value.id)
    .then(() => {
      courses.value.splice(index, 1);
      deleteDialog.value = false;
      itemToDelete.value = null;
    })
    .catch((error) => {
      errorMessage.value = error.response?.data?.message || "Error deleting course";
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
  const payload = coursePayload();

  if (editedIndex.value > -1) {
    CourseServices.updateCourse(editedItem.value.id, payload)
      .then(() => {
        Object.assign(courses.value[editedIndex.value], payload);
        close();
      })
      .catch((error) => {
        errorMessage.value = error.response?.data?.message || "Error updating course";
      })
      .finally(() => {
        saving.value = false;
      });
  } else {
    CourseServices.createCourse(payload)
      .then((response) => {
        courses.value.push(response.data);
        close();
      })
      .catch((error) => {
        errorMessage.value = error.response?.data?.message || "Error creating course";
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
        <v-toolbar-title>Courses</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Course</v-btn>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" sm="6" md="4">
          <v-text-field
            v-model="courseFilter"
            label="Filter by number or description"
            prepend-icon="mdi-magnify"
            clearable
          ></v-text-field>
        </v-col>
      </v-row>

      <v-alert v-if="errorMessage" type="error" class="mb-4" variant="tonal">
        {{ errorMessage }}
      </v-alert>

      <v-card>
        <v-card-text>
          <v-data-table
            :headers="headers"
            :items="filteredCourses"
            :loading="loading"
          >
            <template v-slot:item.actions="{ item }">
              <v-icon small class="mr-2" title="Sections" @click="openSections(item)">mdi-google-classroom</v-icon>
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
            <v-container>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.code" label="Code" required></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.number" label="Number" required></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="editedItem.description"
                    label="Description"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="editedItem.hours"
                    label="Hours"
                    type="number"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" variant="text" @click="close" class="dialog-cancel">Cancel</v-btn>
            <v-btn
              color="blue darken-1"
              variant="text"
              :disabled="!isFormValid"
              :loading="saving"
              @click="save"
             class="dialog-save">
              Save
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="sectionsDialog" max-width="960px">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span class="text-h5">
              Sections{{ selectedCourse?.number ? ` — ${selectedCourse.number}` : "" }}
            </span>
            <v-spacer></v-spacer>
            <v-btn color="primary" :disabled="!selectedCourse?.number" @click="openSectionDialog()">
              Add Section
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-alert v-if="sectionError" type="error" class="mb-4" variant="tonal">
              {{ sectionError }}
            </v-alert>
            <v-data-table
              :headers="sectionHeaders"
              :items="courseSections"
              :loading="sectionsLoading"
            >
              <template v-slot:item.actions="{ item }">
                <v-icon small class="mr-2" @click="openSectionDialog(item)">mdi-pencil</v-icon>
                <v-icon small @click="sectionToDelete = item; sectionDeleteDialog = true">mdi-delete</v-icon>
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="sectionsDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="sectionDialog" max-width="560px">
        <v-card>
          <v-card-title>
            <span class="text-h5">{{ sectionFormTitle }}</span>
          </v-card-title>
          <v-card-text>
            <v-select
              v-model="sectionItem.semesterId"
              :items="semesters"
              item-title="name"
              item-value="id"
              label="Semester"
              required
            ></v-select>
            <v-text-field v-model="sectionItem.courseSection" label="Section" required></v-text-field>
            <v-text-field v-model="sectionItem.courseDescription" label="Description"></v-text-field>
            <v-text-field v-model="sectionItem.accountId" label="Account ID"></v-text-field>
            <v-text-field v-model="sectionItem.sectionCode" label="Section Code"></v-text-field>
            <v-text-field v-model="sectionItem.canvasSISCourseID" label="Canvas SIS Course ID"></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeSectionDialog" class="dialog-cancel">Cancel</v-btn>
            <v-btn
              color="primary"
              variant="text"
              :disabled="!isSectionFormValid"
              :loading="sectionsSaving"
              @click="saveSection"
             class="dialog-save">
              Save
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="sectionDeleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete Section</v-card-title>
          <v-card-text>
            Are you sure you want to delete section
            {{ sectionToDelete?.courseSection }}? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="sectionDeleteDialog = false" class="dialog-cancel">Cancel</v-btn>
            <v-btn color="error" variant="text" @click="confirmDeleteSection">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="400px">
        <v-card>
          <v-card-title class="text-h5">Delete Course</v-card-title>
          <v-card-text>
            Are you sure you want to delete this course? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey darken-1" variant="text" @click="deleteDialog = false" class="dialog-cancel">Cancel</v-btn>
            <v-btn color="error" variant="text" @click="confirmDelete">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
