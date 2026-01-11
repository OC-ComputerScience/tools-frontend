<script setup>
import SectionServices from "../services/sectionServices";
import SemesterServices from "../services/semesterServices";
import AssignedCourseServices from "../services/assignedCourseServices";
import Utils from "../config/utils.js";
import { ref, onMounted, nextTick } from "vue";

const user = Utils.getStore("user");
const courses = ref([]);
const semesters = ref([]);
const selectedSemester = ref(null);
const message = ref("Select a semester to view your courses");
const assignmentDialogs = ref({});

const retrieveSemesters = () => {
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading semesters";
    });
};

const retrieveCourses = async () => {
  if (!selectedSemester.value) {
    courses.value = [];
    return;
  }

  try {
    const response = await SectionServices.getSectionsByUserEmail(user.email, {
      semesterId: selectedSemester.value,
    });

    // The backend now includes assignedCourse data in the response
    // Handle it as an array (hasMany relationship) but take the first one if it exists
    courses.value = response.data
      .map((course) => {
        // If assignedCourse is an array, take the first one; if it's already an object, use it
        if (
          course.assignedCourse &&
          Array.isArray(course.assignedCourse) &&
          course.assignedCourse.length > 0
        ) {
          course.assignedCourse = course.assignedCourse[0];
        } else if (
          course.assignedCourse &&
          !Array.isArray(course.assignedCourse)
        ) {
          // Already a single object, keep it
          course.assignedCourse = course.assignedCourse;
        } else {
          // No assigned course
          course.assignedCourse = null;
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
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading courses";
  }
};

const loadAssignedCourse = (courseId) => {
  AssignedCourseServices.getAssignedCourseBySectionId(courseId)
    .then((response) => {
      // Find the course index for direct array update
      const courseIndex = courses.value.findIndex((c) => c.id === courseId);
      if (courseIndex !== -1) {
        // Handle response - axios transformResponse already parsed it
        // The backend sends the data directly, so response.data should contain it
        // But if backend sends null, response.data might be null
        const assignedData = response.data;

        console.log(
          "Loaded assigned course data:",
          assignedData,
          "for courseId:",
          courseId
        );

        if (assignedData && assignedData !== null && assignedData !== "null") {
          // Update the course object with the assigned course data
          // Create a new object to ensure Vue reactivity detects the change
          const updatedCourse = {
            ...courses.value[courseIndex],
            assignedCourse: assignedData,
          };
          courses.value[courseIndex] = updatedCourse;
        } else {
          // Clear assignment if null/empty response
          const updatedCourse = {
            ...courses.value[courseIndex],
            assignedCourse: null,
          };
          courses.value[courseIndex] = updatedCourse;
        }
      }
    })
    .catch((error) => {
      // Log error for debugging
      console.log(
        "Error loading assigned course for courseId",
        courseId,
        ":",
        error
      );
      const courseIndex = courses.value.findIndex((c) => c.id === courseId);
      if (courseIndex !== -1) {
        const updatedCourse = {
          ...courses.value[courseIndex],
          assignedCourse: null,
        };
        courses.value[courseIndex] = updatedCourse;
      }
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
  return (
    course.semester || semesters.value.find((s) => s.id === course.semesterId)
  );
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
      await retrieveCourses();
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

const loadCoursesForSemester = async (course, semesterId) => {
  if (!semesterId) {
    course.availableCourses = [];
    return;
  }

  try {
    console.log(`Loading courses for semester ${semesterId}, filtering by courseNumber: ${course.courseNumber}`);
    const response = await SectionServices.getAllSections({ semesterId: semesterId });
    console.log(`Received ${response.data?.length || 0} sections from API`);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error("Invalid response data format:", response);
      course.availableCourses = [];
      return;
    }

    // Filter courses to only show those matching the current course's courseNumber
    // Transform items to include a title property for display
    const matchingCourses = response.data.filter((c) => c.courseNumber === course.courseNumber);
    console.log(`Filtered to ${matchingCourses.length} courses matching courseNumber: ${course.courseNumber}`);
    console.log(`Available courseNumbers in semester:`, [...new Set(response.data.map(c => c.courseNumber))]);
    
    course.availableCourses = matchingCourses.map((c) => ({
      ...c,
      title: `${c.courseNumber} - Section ${c.courseSection}: ${c.courseDescription || 'No description'}`,
    }));
    course.selectedCourseForAssignment = null;
    
    if (course.availableCourses.length === 0 && response.data.length > 0) {
      console.warn(`No courses found matching courseNumber "${course.courseNumber}". Available course numbers:`, 
        [...new Set(response.data.map(c => c.courseNumber))]);
    }
  } catch (error) {
    console.error("Error loading courses for semester:", error);
    course.availableCourses = [];
    message.value = `Error loading courses: ${error.response?.data?.message || error.message || "Unknown error"}`;
  }
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
    // Wait for the assignment to be created
    await AssignedCourseServices.createAssignedCourse(assignedCourse);

    message.value = "Course assigned successfully";
    assignmentDialogs.value[course.id] = false;

    // Clear selection state
    course.selectedSemesterForAssignment = null;
    course.selectedCourseForAssignment = null;
    course.availableCourses = [];

    // Reload the courses list for the current semester
    // This will include the newly assigned course data from the backend
    await retrieveCourses();
  } catch (e) {
    message.value = e.response?.data?.message || "Error assigning course";
    console.error("Error assigning course:", e);
  }
};

const removeAssignment = async (course) => {
  if (!course.assignedCourse && !course.assignedCourseInfo) return;

  try {
    // Use deleteAssignedCourseByCourseId to ensure we delete the correct assignment
    // This deletes by the courseId, which is more reliable than using the assignedCourse.id
    await AssignedCourseServices.deleteAssignedCourseBySectionId(course.id);
    message.value = "Assignment removed successfully";

    // Reload the courses list for the current semester
    // This will refresh the assigned course data from the backend
    await retrieveCourses();
  } catch (e) {
    message.value = e.response?.data?.message || "Error removing assignment";
  }
};

onMounted(() => {
  retrieveSemesters();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Import Courses</v-toolbar-title>
      </v-toolbar>
      <br />

      <!-- Instructions -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="text-body-1">
            Canvas currently has courses loaded for Fall 2026 back to Spring
            2023. First, for each course you teach in Fall 2026, assign a
            Blackboard course in a previous semester that you want to have
            imported into it.
          </div>
          <br />
          <div class="text-body-1">
            If there are courses that you taught in a previous semester that you
            don't teach in Fall 2026, you can also select the past semester and
            assign the Blackboard course from that semester to import into the
            Canvas course so the course data is available for the future.
          </div>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-title>Select Semester for Canvas Courses</v-card-title>
        <v-card-text>
          <v-select
            v-model="selectedSemester"
            :items="semesters"
            item-title="name"
            item-value="id"
            label="Semester"
            @update:model-value="retrieveCourses"
          ></v-select>
        </v-card-text>
      </v-card>

      <br />

      <v-card v-if="selectedSemester">
        <v-card-title>Canvas Courses for Selected Semester</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">Course Number</th>
              <th class="text-left">Section</th>
              <th class="text-left">Description</th>
              <th class="text-left">Assigned Import</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in courses" :key="course.id">
              <td>
                <div style="display: flex; align-items: center; gap: 4px">
                  {{ course.courseNumber }}
                  <v-tooltip location="top" max-width="300">
                    <template v-slot:activator="{ props }">
                      <v-icon
                        v-bind="props"
                        size="16"
                        color="grey-darken-1"
                        style="cursor: help"
                      >
                        mdi-information
                      </v-icon>
                    </template>
                    <div style="font-size: 12px; line-height: 1.6">
                      <div>
                        <strong>Course:</strong> {{ course.courseNumber }}-{{
                          course.courseSection
                        }}
                      </div>
                      <div v-if="course.courseDescription">
                        <strong>Description:</strong>
                        {{ course.courseDescription }}
                      </div>
                      <div v-if="course.user">
                        <strong>Instructor:</strong> {{ course.user.fName }}
                        {{ course.user.lName }}
                      </div>
                      <div v-if="course.user?.email">
                        <strong>Email:</strong> {{ course.user.email }}
                      </div>
                      <div v-if="course.semester">
                        <strong>Semester:</strong> {{ course.semester.name }}
                      </div>
                      <div v-if="course.semester?.startDate">
                        <strong>Start Date:</strong>
                        {{ course.semester.startDate }}
                      </div>
                      <div v-if="course.assignedCourse">
                        <strong>Assigned To:</strong>
                        {{
                          course.assignedCourse.assignedSection?.courseNumber
                        }}-{{
                          course.assignedCourse.assignedSection?.courseSection
                        }}
                        <span
                          v-if="course.assignedCourse.assignedSection?.semester"
                        >
                          ({{
                            course.assignedCourse.assignedSection.semester.name
                          }})</span
                        >
                      </div>
                    </div>
                  </v-tooltip>
                </div>
              </td>
              <td>{{ course.courseSection }}</td>
              <td>{{ course.courseDescription }}</td>
              <td>
                <span v-if="course.assignedCourse">
                  {{ course.assignedCourse.assignedSection?.courseNumber }}-{{
                    course.assignedCourse.assignedSection?.courseSection
                  }}
                  ({{ course.assignedCourse.assignedSection?.semester?.name }})
                </span>
                <span v-else>None</span>
              </td>
              <td>
                <v-btn
                  small
                  color="primary"
                  :disabled="
                    course.assignedCourse &&
                    isSemesterInPast(getCourseSemester(course))
                  "
                  @click="openAssignmentDialog(course)"
                >
                  {{ course.assignedCourse ? "Change" : "Assign" }}
                </v-btn>
                <v-btn
                  v-if="course.assignedCourse"
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
        v-for="course in courses"
        :key="course.id"
        v-model="assignmentDialogs[course.id]"
        max-width="600px"
      >
        <v-card>
          <v-card-title>Assign Blackboard Course to Import</v-card-title>
          <v-card-text>
            <!-- Instruction Text -->
            <div class="mb-4 text-body-2">
              Select the Blackboard semester and course that you want imported
              into the course below.
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
