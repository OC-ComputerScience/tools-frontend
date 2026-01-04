<script setup>
import { ref, computed, onMounted } from "vue";
import UniversityCourseServices from "../services/universityCourseServices";
import UniversityServices from "../services/universityServices";
import CourseServices from "../services/courseServices";
import SemesterServices from "../services/semesterServices";

const dialog = ref(false);
const loading = ref(false);
const universityCourses = ref([]);
const universities = ref([]);
const courses = ref([]);
const semesters = ref([]);
const universityFilter = ref("");
const filteredCourses = computed(() => {
  if (!universityFilter.value) return universityCourses.value;
  return universityCourses.value.filter((course) =>
    course.university?.name
      ?.toLowerCase()
      .includes(universityFilter.value.toLowerCase())
  );
});
const editedIndex = ref(-1);
const editedItem = ref({
  universityId: null,
  courseNumber: "",
  courseName: "",
  courseDescription: "",
  courseHours: null,
  courseId: null,
  effectiveDate: null,
});
const defaultItem = {
  universityId: null,
  courseNumber: "",
  courseName: "",
  courseDescription: "",
  courseHours: null,
  courseId: null,
  effectiveDate: null,
};

const formErrors = ref({
  universityId: false,
  courseNumber: false,
  courseName: false,
  courseHours: false,
  courseId: false,
  effectiveDate: false,
});

const isFormValid = computed(() => {
  return Boolean(
    editedItem.value.universityId &&
      editedItem.value.courseNumber &&
      editedItem.value.courseName &&
      editedItem.value.courseDescription &&
      editedItem.value.courseHours &&
      editedItem.value.courseId &&
      editedItem.value.effectiveDate
  );
});

const headers = [
  { title: "University", key: "university.name", sortable: true },
  { title: "Course Number", key: "courseNumber", sortable: true },
  { title: "Course Name", key: "courseName", sortable: true },
  { title: "Course Description", key: "courseDescription", sortable: true },
  { title: "Course Hours", key: "courseHours", sortable: true },
  { title: "Course Number", key: "course.number", sortable: true },
  { title: "Course", key: "course.description", sortable: true },
  { title: "Effective Date", key: "effectiveDate", sortable: true },
  { title: "Actions", key: "actions", sortable: false },
];

const formTitle = computed(() => {
  return editedIndex.value === -1
    ? "New University Course"
    : "Edit University Course";
});

const initialize = () => {
  loading.value = true;

  UniversityCourseServices.getAll()
    .then((response) => {
      universityCourses.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching university courses:", error);
    });

  UniversityServices.getAll()
    .then((response) => {
      universities.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching universities:", error);
    });

  CourseServices.getAllCourses()
    .then((response) => {
      courses.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching courses:", error);
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
  editedIndex.value = universityCourses.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  const index = universityCourses.value.indexOf(item);
  if (confirm("Are you sure you want to delete this university course?")) {
    UniversityCourseServices.delete(item.id)
      .then((response) => {
        universityCourses.value.splice(index, 1);
      })
      .catch((error) => {
        console.error("Error deleting university course:", error);
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
    UniversityCourseServices.update(editedItem.value.id, editedItem.value)
      .then((response) => {
        // Find the university and course data
        const university = universities.value.find(
          (u) => u.id === editedItem.value.universityId
        );
        const course = courses.value.find(
          (c) => c.id === editedItem.value.courseId
        );
        // Create a new object with the related data
        const updatedItem = {
          ...response.data,
          university: university,
          course: course,
        };
        Object.assign(universityCourses.value[editedIndex.value], updatedItem);
        close();
      })
      .catch((error) => {
        console.error("Error updating university course:", error);
      });
  } else {
    // Create
    UniversityCourseServices.create(editedItem.value)
      .then((response) => {
        // Find the university and course data
        const university = universities.value.find(
          (u) => u.id === editedItem.value.universityId
        );
        const course = courses.value.find(
          (c) => c.id === editedItem.value.courseId
        );
        // Create a new object with the related data
        const newItem = {
          ...response.data,
          university: university,
          course: course,
        };
        universityCourses.value.push(newItem);
        close();
      })
      .catch((error) => {
        console.error("Error creating university course:", error);
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
        <h1>University Courses</h1>
        <v-btn color="primary" @click="openDialog()"
          >Add University Course</v-btn
        >
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-text-field
          v-model="universityFilter"
          label="Filter by University"
          prepend-icon="mdi-magnify"
          clearable
        ></v-text-field>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="filteredCourses"
          :loading="loading"
          class="elevation-1"
        >
          <template v-slot:item.actions="{ item }">
            <v-icon small class="mr-2" @click="editItem(item)">
              mdi-pencil
            </v-icon>
            <v-icon small @click="deleteItem(item)"> mdi-delete </v-icon>
          </template>
          <template v-slot:[`item.effectiveDate`]="{ item }">
            {{
              item.effectiveDate
                ? new Date(item.effectiveDate).toLocaleDateString()
                : "N/A"
            }}
          </template>
          <template v-slot:[`item.course.number`]="{ item }">
            {{ item.course ? (item.course.code ? `${item.course.code} ${item.course.number}` : item.course.number) : "N/A" }}
          </template>
          <template v-slot:[`item.course.description`]="{ item }">
            {{ item.course ? item.course.description : "N/A" }}
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
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.courseNumber"
                  label="Course Number"
                  required
                  :error="formErrors.courseNumber"
                  :error-messages="
                    formErrors.courseNumber ? 'Course Number is required' : ''
                  "
                  @input="formErrors.courseNumber = false"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.courseName"
                  label="Course Name"
                  required
                  :error="formErrors.courseName"
                  :error-messages="
                    formErrors.courseName ? 'Course Name is required' : ''
                  "
                  @input="formErrors.courseName = false"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="editedItem.courseDescription"
                  label="Course Description"
                  required
                ></v-textarea>
              </v-col>
              <v-col cols="12" sm="6" md="6">
                <v-text-field
                  v-model="editedItem.courseHours"
                  label="Course Hours"
                  type="number"
                  required
                  :error="formErrors.courseHours"
                  :error-messages="
                    formErrors.courseHours ? 'Course Hours is required' : ''
                  "
                  @input="formErrors.courseHours = false"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-autocomplete
                  v-model="editedItem.courseId"
                  :items="courses"
                  :item-title="
                    (item) => `${item.code} ${item.number} - ${item.description}`
                  "
                  item-value="id"
                  label="Course"
                  required
                  :error="formErrors.courseId"
                  :error-messages="
                    formErrors.courseId ? 'Course is required' : ''
                  "
                  @update:model-value="formErrors.courseId = false"
                  :filter="
                    (item, queryText) => {
                      const text = (
                        item.code +
                        ' ' +
                        item.number +
                        ' ' +
                        item.description
                      ).toLowerCase();
                      const query = queryText.toLowerCase();
                      return text.includes(query);
                    }
                  "
                  clearable
                ></v-autocomplete>
              </v-col>
              <v-col cols="12" sm="6" md="6">
                <v-text-field
                  v-model="editedItem.effectiveDate"
                  label="Effective Date"
                  type="date"
                  required
                  :error="formErrors.effectiveDate"
                  :error-messages="
                    formErrors.effectiveDate ? 'Effective Date is required' : ''
                  "
                  @input="formErrors.effectiveDate = false"
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
  </v-container>
</template>

<style scoped>
.v-data-table :deep(th) {
  font-weight: bold !important;
}
</style>
