<script setup>
import { ref, onMounted } from "vue";
import SectionServices from "../services/sectionServices";
import SemesterServices from "../services/semesterServices";
import UserServices from "../services/userServices";
import AssignedCourseServices from "../services/assignedCourseServices";
import Utils from "../config/utils.js";

const user = Utils.getStore("user");
const totalCourses = ref(0);
const totalSemesters = ref(0);
const totalUsers = ref(0);
const totalAssignments = ref(0);
const selectedSemester = ref(null);
const selectedUser = ref(null);
const semesters = ref([]);
const users = ref([]);
const coursesWithCount = ref([]);
const message = ref("");
const assignmentDialogs = ref({});

const retrieveStats = () => {
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data;
      totalSemesters.value = response.data.length;
      if (response.data.length > 0) {
        selectedSemester.value = response.data[0].id;
        loadCoursesWithCount();
      }
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading semesters";
    });

  UserServices.getAllUsers()
    .then((response) => {
      // Add fullName property for display
      users.value = response.data.map((user) => ({
        ...user,
        fullName: `${user.fName} ${user.lName}`,
      }));
      totalUsers.value = response.data.length;
    })
    .catch(() => {});

  // Get total courses across all terms (no semesterId filter)
  SectionServices.getAllSections()
    .then((response) => {
      totalCourses.value = response.data.length;
    })
    .catch((e) => {
      console.error("Error loading all courses:", e);
    });

  // Get total assignments across all terms (no filters)
  AssignedCourseServices.getAllAssignedCourses({})
    .then((response) => {
      // The transformResponse in services.js parses JSON and returns it
      // So response.data should be the array directly from the backend
      const assignments = response.data;

      if (Array.isArray(assignments)) {
        totalAssignments.value = assignments.length;
      } else {
        console.error(
          "Unexpected response format for assigned courses:",
          assignments
        );
        totalAssignments.value = 0;
      }
    })
    .catch((error) => {
      console.error("Error loading assigned courses:", error);
      if (error.response) {
        console.error("Error response:", error.response.data);
      }
      totalAssignments.value = 0;
    });
};

const loadCoursesWithCount = () => {
  if (!selectedSemester.value) return;

  const params = { semesterId: selectedSemester.value };
  // Only add userId if a user is explicitly selected (not null/undefined/empty string)
  if (
    selectedUser.value !== null &&
    selectedUser.value !== undefined &&
    selectedUser.value !== "" &&
    selectedUser.value !== 0
  ) {
    params.userId = selectedUser.value;
  }

  SectionServices.getSectionsWithCount(params)
    .then((response) => {
      coursesWithCount.value = response.data
        .map((course) => {
          // Initialize assignment-related properties
          if (!course.availableSemesters) {
            course.availableSemesters = null;
          }
          if (!course.selectedSemesterForAssignment) {
            course.selectedSemesterForAssignment = null;
          }
          if (!course.selectedCourseForAssignment) {
            course.selectedCourseForAssignment = null;
          }
          if (!course.availableCourses) {
            course.availableCourses = [];
          }
          return course;
        })
        .sort((a, b) => {
          // Sort by courseNumber first, then by courseSection in ascending order
          const courseNumberCompare = a.courseNumber.localeCompare(
            b.courseNumber,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );
          if (courseNumberCompare !== 0) {
            return courseNumberCompare;
          }
          // If courseNumbers are the same, sort by courseSection
          return a.courseSection.localeCompare(b.courseSection, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });
      // Don't update totalCourses here - it's already set from all terms in retrieveStats
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading courses";
    });
};

// Helper function to check if a semester started in the past
const isSemesterInPast = (semester) => {
  if (!semester || !semester.startDate) return false;

  const startDate = new Date(semester.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate date comparison
  startDate.setHours(0, 0, 0, 0);

  return startDate < today;
};

// Helper function to get the semester for a course
const getCourseSemester = (course) => {
  return course.semester || semesters.value.find((s) => s.id === course.semesterId);
};

const openAssignmentDialog = async (course) => {
  // Check if course's semester started in the past
  const courseSemester = getCourseSemester(course);

  if (courseSemester && isSemesterInPast(courseSemester)) {
    // Auto-assign course to itself
    const assignedCourse = {
      sectionId: course.id,
      assignedSectionId: course.id,
    };

    try {
      await AssignedCourseServices.createAssignedCourse(assignedCourse);
      message.value = "Course assigned to itself successfully";
      await loadCoursesWithCount();

      // Update total assignments count
      AssignedCourseServices.getAllAssignedCourses({})
        .then((response) => {
          const assignments = response.data;
          if (Array.isArray(assignments)) {
            totalAssignments.value = assignments.length;
          }
        })
        .catch(() => {});
    } catch (e) {
      message.value = e.response?.data?.message || "Error assigning course";
      console.error("Error assigning course:", e);
    }
    return; // Don't show dialog
  }

  // Normal flow - show dialog
  assignmentDialogs.value[course.id] = true;
  if (!course.availableSemesters) {
    loadAvailableSemesters(course);
  }
};

const loadAvailableSemesters = (course) => {
  SemesterServices.getAll()
    .then((response) => {
      course.availableSemesters = response.data.filter(
        (s) => s.id !== course.semesterId
      );
      course.selectedSemesterForAssignment = null;
      course.availableCourses = [];
    })
    .catch(() => {
      course.availableSemesters = [];
    });
};

const loadCoursesForSemester = (course, semesterId) => {
  if (!semesterId) {
    course.availableCourses = [];
    return;
  }

  SectionServices.getAllSections({ semesterId: semesterId })
    .then((response) => {
      // Filter courses to only show those matching the current course's courseNumber
      // Transform items to include a title property for display
      course.availableCourses = response.data
        .filter((c) => c.courseNumber === course.courseNumber)
        .map((c) => ({
          ...c,
          title: `${c.courseNumber} - Section ${c.courseSection}: ${c.courseDescription}`,
        }));
      course.selectedCourseForAssignment = null;
    })
    .catch(() => {
      course.availableCourses = [];
    });
};

const assignCourse = async (course) => {
  if (!course.selectedCourseForAssignment) {
    message.value = "Please select a course to assign";
    return;
  }

  const assignedCourse = {
    sectionId: course.id,
    assignedSectionId: course.selectedCourseForAssignment,
  };

  try {
    await AssignedCourseServices.createAssignedCourse(assignedCourse);
    message.value = "Course assigned successfully";
    assignmentDialogs.value[course.id] = false;

    // Clear selection state
    course.selectedSemesterForAssignment = null;
    course.selectedCourseForAssignment = null;
    course.availableCourses = [];

    // Reload the courses list
    await loadCoursesWithCount();

    // Update total assignments count
    AssignedCourseServices.getAllAssignedCourses({})
      .then((response) => {
        const assignments = response.data;
        if (Array.isArray(assignments)) {
          totalAssignments.value = assignments.length;
        }
      })
      .catch(() => {});
  } catch (e) {
    message.value = e.response?.data?.message || "Error assigning course";
    console.error("Error assigning course:", e);
  }
};

const removeAssignment = async (course) => {
  if (
    !course.assignedSectionInfo &&
    !(course.assignedCourse && course.assignedCourse.length > 0) &&
    !(course.assignedCourse && course.assignedCourse.id)
  ) {
    message.value = "No assignment found to remove";
    return;
  }

  try {
    // Use deleteAssignedCourseByCourseId to ensure we delete the correct assignment
    // This deletes by the courseId, which is more reliable than trying to get the AssignedCourse record ID
    await AssignedCourseServices.deleteAssignedCourseBySectionId(course.id);
    message.value = "Assignment removed successfully";

    // Reload the courses list
    await loadCoursesWithCount();

    // Update total assignments count
    AssignedCourseServices.getAllAssignedCourses({})
      .then((response) => {
        const assignments = response.data;
        if (Array.isArray(assignments)) {
          totalAssignments.value = assignments.length;
        }
      })
      .catch(() => {});
  } catch (e) {
    message.value = e.response?.data?.message || "Error removing assignment";
  }
};

onMounted(() => {
  retrieveStats();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Admin Import</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-row>
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Total Terms</v-card-title>
            <v-card-text>
              <h2>{{ totalTerms }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Total Users</v-card-title>
            <v-card-text>
              <h2>{{ totalUsers }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Total Courses</v-card-title>
            <v-card-text>
              <h2>{{ totalCourses }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Total Assignments</v-card-title>
            <v-card-text>
              <h2>{{ totalAssignments }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <br />

      <v-card>
        <v-card-title>Courses by Semester</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedSemester"
                :items="semesters"
                item-title="name"
                item-value="id"
                label="Select Semester"
                @update:model-value="loadCoursesWithCount"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedUser"
                :items="users"
                item-title="fullName"
                item-value="id"
                label="Select Faculty (optional)"
                clearable
                @update:model-value="loadCoursesWithCount"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>
        <v-table v-if="selectedSemester">
          <thead>
            <tr>
              <th class="text-left">Course Number</th>
              <th class="text-left">Section</th>
              <th class="text-left">Description</th>
              <th class="text-left">Faculty</th>
              <th class="text-left">Assigned Course</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in coursesWithCount" :key="course.id">
              <td>{{ course.courseNumber }}</td>
              <td>{{ course.courseSection }}</td>
              <td>{{ course.courseDescription }}</td>
              <td>{{ course.user?.fName }} {{ course.user?.lName }}</td>
              <td>
                <span v-if="course.assignedSectionInfo">
                  {{ course.assignedSectionInfo.semester?.name }}
                  {{ course.assignedSectionInfo.courseNumber }}-{{
                    course.assignedSectionInfo.courseSection
                  }}
                </span>
                <span
                  v-else-if="
                    course.assignedCourse && course.assignedCourse.length > 0
                  "
                >
                  <!-- Fallback: try to get info from assignedCourse array directly -->
                  <span v-if="course.assignedCourse[0]?.assignedSection">
                    {{ course.assignedCourse[0].assignedSection.semester?.name }}
                    {{
                      course.assignedCourse[0].assignedSection.courseNumber
                    }}-{{
                      course.assignedCourse[0].assignedSection.courseSection
                    }}
                  </span>
                  <span v-else>Has assignment but info missing</span>
                </span>
                <span v-else>None</span>
              </td>
              <td>
                <v-btn
                  small
                  color="primary"
                  :disabled="
                    (course.assignedSectionInfo ||
                      (course.assignedCourse &&
                        course.assignedCourse.length > 0)) &&
                    isTermInPast(getCourseTerm(course))
                  "
                  @click="openAssignmentDialog(course)"
                >
                  {{
                    course.assignedSectionInfo ||
                    (course.assignedCourse && course.assignedCourse.length > 0)
                      ? "Change"
                      : "Assign"
                  }}
                </v-btn>
                <v-btn
                  v-if="
                    course.assignedSectionInfo ||
                    (course.assignedCourse && course.assignedCourse.length > 0)
                  "
                  small
                  color="error"
                  class="ml-2"
                  @click="removeAssignment(course)"
                >
                  Remove
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Assignment Dialog -->
      <v-dialog
        v-for="course in coursesWithCount"
        :key="course.id"
        v-model="assignmentDialogs[course.id]"
        max-width="600px"
      >
        <v-card>
          <v-card-title>Assign Blackboard Course to Import</v-card-title>
          <v-card-text>
            <!-- Instruction Text -->
            <div class="mb-4 text-body-2">
              Select the Blackboard semester and course that you want imported into
              the course below.
            </div>

            <!-- Course Context Information -->
            <div class="mb-4">
              <div class="text-subtitle-1 font-weight-bold mb-2">
                Canvas Course to import into:
              </div>
              <div class="text-body-2">
                <div>
                  <strong>Semester:</strong> {{ course.semester?.name }}
                </div>
                <div>
                  <strong>Course:</strong> {{ course.courseNumber }}-{{
                    course.courseSection
                  }}
                </div>
                <div><strong>Name:</strong> {{ course.courseDescription }}</div>
              </div>
            </div>
            <v-divider class="mb-4"></v-divider>

            <v-select
              v-model="course.selectedSemesterForAssignment"
              :items="course.availableSemesters || []"
              item-title="name"
              item-value="id"
              label="Select Semester"
              @update:model-value="loadCoursesForSemester(course, $event)"
            ></v-select>

            <v-select
              v-if="course.selectedSemesterForAssignment"
              v-model="course.selectedCourseForAssignment"
              :items="course.availableCourses || []"
              item-title="title"
              item-value="id"
              label="Select Course"
            ></v-select>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="assignmentDialogs[course.id] = false"
              >Cancel</v-btn
            >
            <v-btn color="primary" @click="assignCourse(course)">Assign</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

