<script setup>
import { ref, onMounted } from "vue";
import CourseServices from "../services/courseServices";
import TermServices from "../services/termServices";
import UserServices from "../services/userServices";
import AssignedCourseServices from "../services/assignedCourseServices";
import Utils from "../config/utils.js";

const user = Utils.getStore("user");
const totalCourses = ref(0);
const totalTerms = ref(0);
const totalUsers = ref(0);
const totalAssignments = ref(0);
const selectedTerm = ref(null);
const selectedUser = ref(null);
const terms = ref([]);
const users = ref([]);
const coursesWithCount = ref([]);
const message = ref("");
const assignmentDialogs = ref({});

const retrieveStats = () => {
  TermServices.getAllTerms()
    .then((response) => {
      terms.value = response.data;
      totalTerms.value = response.data.length;
      if (response.data.length > 0) {
        selectedTerm.value = response.data[0].id;
        loadCoursesWithCount();
      }
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading terms";
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

  // Get total courses across all terms (no termId filter)
  CourseServices.getAllCourses()
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
  if (!selectedTerm.value) return;

  const params = { termId: selectedTerm.value };
  // Only add userId if a user is explicitly selected (not null/undefined/empty string)
  if (
    selectedUser.value !== null &&
    selectedUser.value !== undefined &&
    selectedUser.value !== "" &&
    selectedUser.value !== 0
  ) {
    params.userId = selectedUser.value;
  }

  CourseServices.getCoursesWithCount(params)
    .then((response) => {
      coursesWithCount.value = response.data
        .map((course) => {
          // Initialize assignment-related properties
          if (!course.availableTerms) {
            course.availableTerms = null;
          }
          if (!course.selectedTermForAssignment) {
            course.selectedTermForAssignment = null;
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

// Helper function to check if a term started in the past
const isTermInPast = (term) => {
  if (!term || !term.startDate) return false;

  const startDate = new Date(term.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate date comparison
  startDate.setHours(0, 0, 0, 0);

  return startDate < today;
};

// Helper function to get the term for a course
const getCourseTerm = (course) => {
  return course.term || terms.value.find((t) => t.id === course.termId);
};

const openAssignmentDialog = async (course) => {
  // Check if course's term started in the past
  const courseTerm = getCourseTerm(course);

  if (courseTerm && isTermInPast(courseTerm)) {
    // Auto-assign course to itself
    const assignedCourse = {
      courseId: course.id,
      assignedCourseId: course.id,
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
  if (!course.availableTerms) {
    loadAvailableTerms(course);
  }
};

const loadAvailableTerms = (course) => {
  TermServices.getAllTerms()
    .then((response) => {
      course.availableTerms = response.data.filter(
        (t) => t.id !== course.termId
      );
      course.selectedTermForAssignment = null;
      course.availableCourses = [];
    })
    .catch(() => {
      course.availableTerms = [];
    });
};

const loadCoursesForTerm = (course, termId) => {
  if (!termId) {
    course.availableCourses = [];
    return;
  }

  CourseServices.getAllCourses({ termId: termId })
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
    courseId: course.id,
    assignedCourseId: course.selectedCourseForAssignment,
  };

  try {
    await AssignedCourseServices.createAssignedCourse(assignedCourse);
    message.value = "Course assigned successfully";
    assignmentDialogs.value[course.id] = false;

    // Clear selection state
    course.selectedTermForAssignment = null;
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
    !course.assignedCourseInfo &&
    !(course.assignedCourse && course.assignedCourse.length > 0) &&
    !(course.assignedCourse && course.assignedCourse.id)
  ) {
    message.value = "No assignment found to remove";
    return;
  }

  try {
    // Use deleteAssignedCourseByCourseId to ensure we delete the correct assignment
    // This deletes by the courseId, which is more reliable than trying to get the AssignedCourse record ID
    await AssignedCourseServices.deleteAssignedCourseByCourseId(course.id);
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
        <v-toolbar-title>Admin Dashboard</v-toolbar-title>
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
        <v-card-title>Courses by Term</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedTerm"
                :items="terms"
                item-title="termName"
                item-value="id"
                label="Select Term"
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
        <v-table v-if="selectedTerm">
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
                <span v-if="course.assignedCourseInfo">
                  {{ course.assignedCourseInfo.term?.termName }}
                  {{ course.assignedCourseInfo.courseNumber }}-{{
                    course.assignedCourseInfo.courseSection
                  }}
                </span>
                <span
                  v-else-if="
                    course.assignedCourse && course.assignedCourse.length > 0
                  "
                >
                  <!-- Fallback: try to get info from assignedCourse array directly -->
                  <span v-if="course.assignedCourse[0]?.assignedCourse">
                    {{ course.assignedCourse[0].assignedCourse.term?.termName }}
                    {{
                      course.assignedCourse[0].assignedCourse.courseNumber
                    }}-{{
                      course.assignedCourse[0].assignedCourse.courseSection
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
                    (course.assignedCourseInfo ||
                      (course.assignedCourse &&
                        course.assignedCourse.length > 0)) &&
                    isTermInPast(getCourseTerm(course))
                  "
                  @click="openAssignmentDialog(course)"
                >
                  {{
                    course.assignedCourseInfo ||
                    (course.assignedCourse && course.assignedCourse.length > 0)
                      ? "Change"
                      : "Assign"
                  }}
                </v-btn>
                <v-btn
                  v-if="
                    course.assignedCourseInfo ||
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
              Select the Blackboard term and course that you want imported into
              the course below.
            </div>

            <!-- Course Context Information -->
            <div class="mb-4">
              <div class="text-subtitle-1 font-weight-bold mb-2">
                Canvas Course to import into:
              </div>
              <div class="text-body-2">
                <div>
                  <strong>Semester:</strong> {{ course.term?.termName }}
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
              v-model="course.selectedTermForAssignment"
              :items="course.availableTerms || []"
              item-title="termName"
              item-value="id"
              label="Select Term"
              @update:model-value="loadCoursesForTerm(course, $event)"
            ></v-select>

            <v-select
              v-if="course.selectedTermForAssignment"
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
