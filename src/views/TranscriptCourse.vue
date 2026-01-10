<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import TranscriptCourseServices from "../services/transcriptCourseServices";
import UniversityTranscriptServices from "../services/universityTranscriptServices";
import UniversityCourseServices from "../services/universityCourseServices";
import CourseServices from "../services/courseServices";
import SemesterServices from "../services/semesterServices";
import UploadServices from "../services/transcriptServices";
import apiClient from "../services/services.js";
import PDFViewer from "./PDFViewer.vue";

const route = useRoute();
const transcriptId = computed(() => route.params.id);
const dialog = ref(false);
const loading = ref(false);
const transcriptCourses = ref([]);
const universityTranscripts = ref([]);
const universityCourses = ref([]);
const courses = ref([]);
const semesters = ref([]);
const currentTranscript = ref(null);
const statusOptions = ["UnMatched", "Matched", "Approved"];
const editedIndex = ref(-1);
const editedItem = ref({
  universityTranscriptId: null,
  courseNumber: "",
  courseDescription: "",
  courseHours: 0,
  universityCourseId: null,
  courseId: null,
  semesterId: null,
  status: "UnMatched",
  grade: "",
});
const defaultItem = {
  universityTranscriptId: null,
  courseNumber: "",
  courseDescription: "",
  courseHours: 0,
  universityCourseId: null,
  courseId: null,
  semesterId: null,
  status: "Pending",
  grade: "",
};

const ocrDialog = ref(false);
const ocrResults = ref(null);
const ocrLoading = ref(false);

const confirmDialog = ref(false);
const confirmAction = ref(null);
const confirmMessage = ref("");
const confirmTitle = ref("");

const snackbar = ref(false);
const snackbarMessage = ref("");
const snackbarColor = ref("success");

const pdfDialog = ref(false);
const currentPdfUrl = ref("");

// Track selected courses for each transcript course row
const selectedCourseIds = ref({});

const headers = [
  { title: "Course\nNumber", key: "courseNumber", width: "80px" },
  { title: "Course\nDescription", key: "courseDescription", width: "150px" },
  { title: "Course\nHours", key: "courseHours", width: "60px" },
  {
    title: "University\nCourse\nNumber",
    key: "universityCourse.courseNumber",
    width: "80px",
  },
  {
    title: "University\nCourse",
    key: "universityCourse.courseName",
    width: "120px",
  },
  { title: "Course\nSelection", key: "courseSelection", width: "350px" },
  { title: "Semester", key: "semester.name", width: "80px" },
  { title: "Grade", key: "grade", width: "60px" },
  { title: "Status", key: "status", width: "80px" },
  { title: "Status\nChanged\nDate", key: "statusChangedDate", width: "100px" },
  { title: "Actions", key: "actions", sortable: false, width: "80px" },
];

const formTitle = computed(() => {
  return editedIndex.value === -1
    ? "New Transcript Course"
    : "Edit Transcript Course";
});

const initialize = async () => {
  loading.value = true;

  // Get the current transcript
  await UniversityTranscriptServices.get(transcriptId.value)
    .then((response) => {
      currentTranscript.value = response.data;
      editedItem.value.universityTranscriptId = currentTranscript.value.id;
    })
    .catch((error) => {
      console.error("Error fetching transcript:", error);
    });

  // Get transcript courses for this transcript using the new service
  await TranscriptCourseServices.getByTranscriptId(transcriptId.value)
    .then((response) => {
      transcriptCourses.value = response.data;
      // Initialize selected course IDs with existing courseId if present
      transcriptCourses.value.forEach((tc) => {
        if (tc.courseId) {
          selectedCourseIds.value[tc.id] = tc.courseId;
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching transcript courses:", error);
    });

  UniversityCourseServices.getByUniversityId(
    currentTranscript.value.universityId
  )
    .then((response) => {
      universityCourses.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching university courses:", error);
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
  editedIndex.value = transcriptCourses.value.indexOf(item);
  editedItem.value = Object.assign({}, item);
  dialog.value = true;
};

const deleteItem = (item) => {
  showConfirmDialog(
    "Delete Course",
    "Are you sure you want to delete this transcript course?",
    async () => {
      const index = transcriptCourses.value.indexOf(item);
      await TranscriptCourseServices.delete(item.id);
      transcriptCourses.value.splice(index, 1);
    }
  );
};

const deleteAllCourses = async () => {
  showConfirmDialog(
    "Delete All Courses",
    "Are you sure you want to delete all courses for this transcript?",
    async () => {
      try {
        loading.value = true;
        const coursesToDelete = transcriptCourses.value.filter(
          (course) =>
            course.universityTranscriptId === parseInt(transcriptId.value)
        );

        for (const course of coursesToDelete) {
          await TranscriptCourseServices.delete(course.id);
        }

        await initialize();
        showSnackbar("All courses deleted successfully");
      } catch (error) {
        console.error("Error deleting all courses:", error);
        showSnackbar("Error deleting courses. Please try again.", "error");
      } finally {
        loading.value = false;
      }
    }
  );
};

const approveAllCourses = async () => {
  showConfirmDialog(
    "Approve All Courses",
    "Are you sure you want to approve all matched courses for this transcript?",
    async () => {
      try {
        loading.value = true;
        const coursesToApprove = transcriptCourses.value.filter(
          (course) =>
            course.universityTranscriptId === parseInt(transcriptId.value) &&
            course.status === "Matched"
        );

        if (coursesToApprove.length === 0) {
          showSnackbar("No matched courses to approve", "info");
          return;
        }

        for (const course of coursesToApprove) {
          const updateData = {
            universityTranscriptId: course.universityTranscriptId,
            courseNumber: course.courseNumber,
            courseDescription: course.courseDescription,
            courseHours: course.courseHours,
            universityCourseId: course.universityCourseId,
            courseId: course.courseId,
            semesterId: course.semesterId,
            grade: course.grade,
            status: "Approved",
            statusChangedDate: new Date().toISOString(),
          };

          await TranscriptCourseServices.update(course.id, updateData);
        }

        await initialize();
        showSnackbar(
          `${coursesToApprove.length} courses approved successfully`
        );
      } catch (error) {
        console.error("Error approving all courses:", error);
        showSnackbar("Error approving courses. Please try again.", "error");
      } finally {
        loading.value = false;
      }
    }
  );
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = () => {
  if (editedIndex.value > -1) {
    // Update
    const updateData = { ...editedItem.value };
    // If status has changed, update the statusChangedDate
    if (
      transcriptCourses.value[editedIndex.value].status !==
      editedItem.value.status
    ) {
      updateData.statusChangedDate = new Date().toISOString();
    }

    TranscriptCourseServices.update(editedItem.value.id, updateData)
      .then((response) => {
        // Find the related data
        const universityTranscript = currentTranscript.value;
        const universityCourse = universityCourses.value.find(
          (c) => c.id === editedItem.value.universityCourseId
        );
        const course = courses.value.find(
          (c) => c.id === editedItem.value.courseId
        );
        const semester = semesters.value.find(
          (s) => s.id === editedItem.value.semesterId
        );
        // Create a new object with the related data
        const updatedItem = {
          ...response.data,
          universityTranscript: universityTranscript,
          universityCourse: universityCourse,
          course: course,
          semester: semester,
        };
        Object.assign(transcriptCourses.value[editedIndex.value], updatedItem);
        close();
      })
      .catch((error) => {
        console.error("Error updating transcript course:", error);
      });
  } else {
    // Create
    const createData = { ...editedItem.value };
    // Set initial statusChangedDate for new items
    createData.statusChangedDate = new Date().toISOString();

    TranscriptCourseServices.create(createData)
      .then((response) => {
        // Find the related data
        const universityTranscript = currentTranscript.value;
        const universityCourse = universityCourses.value.find(
          (c) => c.id === editedItem.value.universityCourseId
        );
        const course = courses.value.find(
          (c) => c.id === editedItem.value.courseId
        );
        const semester = semesters.value.find(
          (s) => s.id === editedItem.value.semesterId
        );
        // Create a new object with the related data
        const newItem = {
          ...response.data,
          universityTranscript: universityTranscript,
          universityCourse: universityCourse,
          course: course,
          semester: semester,
        };
        transcriptCourses.value.push(newItem);
        close();
      })
      .catch((error) => {
        console.error("Error creating transcript course:", error);
      });
  }
};

const openDialog = () => {
  editedItem.value = Object.assign({}, defaultItem);
  editedItem.value.universityTranscriptId = parseInt(transcriptId.value);
  editedIndex.value = -1;
  dialog.value = true;
};

const matchCourses = async () => {
  try {
    loading.value = true;
    const transcriptId = route.params.id;
    console.log("Matching courses for transcript:", transcriptId);

    // Get the current transcript first to get its university ID
    const currentTranscriptResponse = await UniversityTranscriptServices.get(
      transcriptId
    );
    const currentTranscript = currentTranscriptResponse.data;
    console.log("Current transcript:", currentTranscript);

    // Get all transcript courses for this transcript - make backend request for this specifically
    const transcriptCoursesResponse = await TranscriptCourseServices.getAll();
    const currentTranscriptCourses = transcriptCoursesResponse.data.filter(
      (course) => course.universityTranscriptId === parseInt(transcriptId)
    );
    console.log("Current transcript courses:", currentTranscriptCourses);

    // Get all courses
    const coursesResponse = await CourseServices.getAllCourses();
    const allCourses = coursesResponse.data;
    console.log("Courses:", allCourses);

    // Process each transcript course
    for (const transcriptCourse of currentTranscriptCourses) {
      console.log("\nProcessing course:", transcriptCourse.courseNumber);

      // Find matching university course by course number
      const matchingUniversityCourse = findMatchingUniversityCourse(
        transcriptCourse.courseNumber,
        universityCourses
      );
      console.log("Matching university course:", matchingUniversityCourse);

      if (matchingUniversityCourse) {
        // Find the course from the university course
        const matchedCourse = matchingUniversityCourse.course;

        console.log("Matching course:", matchedCourse);

        if (matchedCourse) {
          try {
            // Create update data with only the necessary fields
            const updateData = {
              universityTranscriptId: transcriptCourse.universityTranscriptId,
              courseNumber: transcriptCourse.courseNumber,
              courseDescription: transcriptCourse.courseDescription,
              courseHours: transcriptCourse.courseHours,
              universityCourseId: matchingUniversityCourse.id,
              courseId: matchedCourse.id,
              semesterId: transcriptCourse.semesterId,
              grade: transcriptCourse.grade,
              status: "Matched",
              statusChangedDate: new Date().toISOString(),
            };
            console.log("Updating with data:", updateData);

            const response = await TranscriptCourseServices.update(
              transcriptCourse.id,
              updateData
            );
            console.log("Update response:", response);

            if (response && response.data) {
              // Create the updated item with all necessary relations
              const updatedItem = {
                ...response.data,
                course: matchedCourse,
                universityCourse: matchingUniversityCourse,
                universityTranscript: currentTranscript,
              };
              console.log("Created updated item:", updatedItem);

              // Update the local transcript courses array
              const index = transcriptCourses.value.findIndex(
                (tc) => tc.id === transcriptCourse.id
              );
              if (index !== -1) {
                console.log("Updating index:", index);
                transcriptCourses.value[index] = updatedItem;
                console.log(
                  "Updated local array:",
                  transcriptCourses.value[index]
                );
              } else {
                console.log(
                  "Could not find index for course:",
                  transcriptCourse.id
                );
              }
            } else {
              console.error("Invalid response from update:", response);
            }
          } catch (updateError) {
            console.error("Error updating course:", updateError);
          }
        } else {
          console.log(
            "No matching course found for university course:",
            matchingUniversityCourse
          );
        }
      } else {
        console.log(
          "No matching university course found for:",
          transcriptCourse.courseNumber
        );
      }
    }

    // Force a refresh of the data
    await initialize();

    // Show success message
    showSnackbar("Courses matched successfully");
  } catch (error) {
    console.error("Error matching courses:", error);
    showSnackbar("Error matching courses. Please try again.", "error");
  } finally {
    loading.value = false;
  }
};

const approveItem = async (item) => {
  // Don't allow approval of unmatched courses
  if (item.status === "UnMatched") {
    return;
  }
  
  try {
    // Toggle between Approved and Matched
    const newStatus = item.status === "Approved" ? "Matched" : "Approved";
    
    const updateData = {
      universityTranscriptId: item.universityTranscriptId,
      courseNumber: item.courseNumber,
      courseDescription: item.courseDescription,
      courseHours: item.courseHours,
      universityCourseId: item.universityCourseId,
      courseId: item.courseId,
      semesterId: item.semesterId,
      grade: item.grade,
      status: newStatus,
      statusChangedDate: new Date().toISOString(),
    };

    const response = await TranscriptCourseServices.update(item.id, updateData);
    if (response && response.data) {
      const index = transcriptCourses.value.findIndex(
        (tc) => tc.id === item.id
      );
      if (index !== -1) {
        transcriptCourses.value[index] = {
          ...response.data,
          course: item.course,
          universityCourse: item.universityCourse,
          universityTranscript: item.universityTranscript,
          semester: item.semester,
        };
      }
    }
  } catch (error) {
    console.error("Error toggling approval status:", error);
    alert("Error updating course approval status. Please try again.");
  }
};

const processOCR = async () => {
  if (!currentTranscript.value) return;

  ocrLoading.value = true;
  try {
    const response = await UploadServices.processOCR(
      currentTranscript.value.id
    );
    ocrResults.value = response.data;
    ocrDialog.value = true;
  } catch (error) {
    console.error("Error processing OCR:", error);
    alert("Error processing OCR. Please try again.");
  } finally {
    ocrLoading.value = false;
  }
};

const findClosestSemester = (courseSemester) => {
  if (!courseSemester || !semesters.value.length) return null;

  // Try both formats: "FALL 1983" and "1983 FALL"
  let term, year;
  const parts = courseSemester.split(" ");

  if (parts.length === 2) {
    // Check if first part is a year (4 digits)
    if (/^\d{4}$/.test(parts[0])) {
      // Format: "1983 FALL"
      [year, term] = parts;
    } else {
      // Format: "FALL 1983"
      [term, year] = parts;
    }
  } else {
    return null;
  }

  if (!year || !term) return null;

  // Find semesters that match the year
  const matchingYearSemesters = semesters.value.filter((s) =>
    s.name.includes(year)
  );
  if (!matchingYearSemesters.length) return null;

  // Map full terms to their abbreviations
  const termMap = {
    FALL: "FA",
    SPRING: "SP",
    SUMMER: "SU",
    WINTER: "WI",
  };

  // Convert term to uppercase for comparison
  const upperTerm = term ? term.toUpperCase() : "";

  // Find the semester that matches both year and term (including abbreviations)
  const exactMatch = matchingYearSemesters.find((s) => {
    const semesterName = s.name ? s.name.toUpperCase() : "";
    // Check for both full term and abbreviated term
    return (
      semesterName.includes(upperTerm) ||
      (termMap[upperTerm] && semesterName.includes(termMap[upperTerm]))
    );
  });

  if (exactMatch) return exactMatch;

  // If no exact match, return the first semester from the matching year
  return matchingYearSemesters[0];
};

const findMatchingUniversityCourse = (
  courseNumber,
  courses = universityCourses.value
) => {
  console.log("courses", courses);
  if (!courseNumber || !courses.length) return null;

  // Normalize the input course number by removing spaces, hyphens, and converting to uppercase
  const normalizeCourseNumber = (num) => {
    if (!num) return "";
    return num.replace(/[\s-]/g, "").toUpperCase();
  };

  const normalizedInput = normalizeCourseNumber(courseNumber);

  // Try to find an exact match first
  const exactMatch = courses.find(
    (uc) => normalizeCourseNumber(uc.courseNumber) === normalizedInput
  );
  if (exactMatch) return exactMatch;

  // If no exact match, try to find a partial match
  return courses.find(
    (uc) =>
      normalizeCourseNumber(uc.courseNumber).includes(normalizedInput) ||
      normalizedInput.includes(normalizeCourseNumber(uc.courseNumber))
  );
};

const addOcrCourses = async () => {
  if (!ocrResults.value || !currentTranscript.value) return;

  loading.value = true;
  try {
    ocrResults.value.courses.forEach(async (course) => {
      const matchingSemester = findClosestSemester(course.semester);
      const matchingUniversityCourse = findMatchingUniversityCourse(
        course.courseNumber
      );
      console.log("course", course);
      console.log("matcht", matchingUniversityCourse);

      // Only set universityCourseId and courseId if we have a match
      const courseData = {
        universityTranscriptId: currentTranscript.value.id,
        courseNumber: course.courseNumber,
        courseDescription: course.courseName,
        courseHours: course.hours,
        semesterId: matchingSemester?.id || null,
        universityCourseId: matchingUniversityCourse
          ? matchingUniversityCourse.id
          : null,
        courseId: matchingUniversityCourse?.course
          ? matchingUniversityCourse.course.id
          : null,
        grade: course.grade,
        status: matchingUniversityCourse ? "Matched" : "UnMatched",
        statusChangedDate: new Date().toISOString(),
      };

      const response = await TranscriptCourseServices.create(courseData);

      // Add the created course to the transcriptCourses array with proper relations
      const newCourse = {
        ...response.data,
        universityCourse: matchingUniversityCourse || null,
        course: matchingUniversityCourse?.course || null,
        semester: matchingSemester || null,
        universityTranscript: currentTranscript.value,
      };

      transcriptCourses.value.push(newCourse);
      
      // Initialize selected course ID if courseId is present
      if (newCourse.courseId) {
        selectedCourseIds.value[newCourse.id] = newCourse.courseId;
      }
    });

    showSnackbar("Courses added successfully");
    ocrDialog.value = false;
  } catch (error) {
    console.error("Error adding OCR courses:", error);
    showSnackbar("Error adding courses. Please try again.", "error");
  } finally {
    loading.value = false;
  }
};

const calculateTotalHours = (courses) => {
  return courses.reduce(
    (total, course) => total + (parseFloat(course.hours) || 0),
    0
  );
};

const calculateGPA = (courses) => {
  const gradePoints = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
    P: 0.0,
  };

  let totalPoints = 0;
  let totalHours = 0;

  courses.forEach((course) => {
    const hours = parseFloat(course.hours) || 0;
    const grade = course.grade ? course.grade.toUpperCase() : "";
    const points = gradePoints[grade] || 0;

    totalPoints += points * hours;
    totalHours += hours;
  });

  return totalHours > 0 ? totalPoints / totalHours : 0;
};

const showConfirmDialog = (title, message, action) => {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmAction.value = action;
  confirmDialog.value = true;
};

// Handle course selection in table dropdown
const handleTableCourseSelect = (item, courseId) => {
  if (courseId) {
    selectedCourseIds.value[item.id] = courseId;
    // Update the status to "Matched" when a course is selected
    const index = transcriptCourses.value.findIndex(tc => tc.id === item.id);
    if (index !== -1) {
      transcriptCourses.value[index].status = "Matched";
    }
  } else {
    delete selectedCourseIds.value[item.id];
    // Optionally reset status when course is cleared
    const index = transcriptCourses.value.findIndex(tc => tc.id === item.id);
    if (index !== -1 && transcriptCourses.value[index].status === "Matched") {
      transcriptCourses.value[index].status = "Unmatched";
    }
  }
};

// Get selected course for a transcript course item
const getSelectedCourse = (item) => {
  const courseId = selectedCourseIds.value[item.id];
  if (!courseId) return null;
  return courses.value.find((c) => c.id === courseId);
};

// Get row props based on grade
const getRowProps = ({ item }) => {
  const grade = item.grade?.toUpperCase()?.trim();
  const isGreyRow = !['A', 'B', 'C', 'D'].includes(grade);
  return {
    class: {
      'grey-row': isGreyRow,
    },
    style: isGreyRow ? { backgroundColor: '#e0e0e0' } : {},
  };
};

// Save all selected courses
const saveSelectedCourses = async () => {
  loading.value = true;
  try {
    const updatePromises = [];
    
    for (const [transcriptCourseId, courseId] of Object.entries(selectedCourseIds.value)) {
      const transcriptCourse = transcriptCourses.value.find((tc) => tc.id === parseInt(transcriptCourseId));
      if (transcriptCourse && courseId) {
        const updateData = {
          ...transcriptCourse,
          courseId: courseId,
          status: "Matched", // Ensure status is set to Matched
        };
        updatePromises.push(
          TranscriptCourseServices.update(transcriptCourseId, updateData)
        );
      }
    }

    await Promise.all(updatePromises);
    snackbarMessage.value = `Successfully updated ${updatePromises.length} transcript course(s)`;
    snackbarColor.value = "success";
    snackbar.value = true;
    
    // Reload the data
    await initialize();
  } catch (error) {
    console.error("Error saving selected courses:", error);
    snackbarMessage.value = "Error saving selected courses. Please try again.";
    snackbarColor.value = "error";
    snackbar.value = true;
  } finally {
    loading.value = false;
  }
};

const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value();
  }
  confirmDialog.value = false;
};

const showSnackbar = (message, color = "success") => {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
};

const customFilter = (item, queryText, itemText) => {
  const textOne = item.raw.courseNumber?.toLowerCase() || "";
  const textTwo = item.raw.courseName?.toLowerCase() || "";
  const searchText = queryText.toLowerCase();

  return textOne.includes(searchText) || textTwo.includes(searchText);
};

const handleCourseSelect = (selectedCourse) => {
  if (selectedCourse) {
    editedItem.value.courseId = selectedCourse.id;
  } else {
    editedItem.value.courseId = null;
  }
};

const handleUniversityCourseSelect = (selectedCourse) => {
  if (selectedCourse) {
    editedItem.value.universityCourseId = selectedCourse.id;
    // If the university course has a course, set it automatically
    if (selectedCourse.course?.id) {
      editedItem.value.courseId = selectedCourse.course.id;
    }
  } else {
    editedItem.value.universityCourseId = null;
  }
};

const formatCourseDisplay = (course) => {
  return `${course.courseNumber} - ${course.courseName}`;
};

const viewTranscript = () => {
  if (currentTranscript.value) {
    // Get the base URL from the API client and remove the /transcript/ suffix
    const baseUrl = apiClient.defaults.baseURL.replace("/transcript/", "");
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = `${baseUrl}/data/transcripts/transcript-${currentTranscript.value.id}.pdf?t=${timestamp}`;
    currentPdfUrl.value = url;
    pdfDialog.value = true;
  }
};

onMounted(() => {
  initialize();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Transcript Courses</h1>
        <div v-if="currentTranscript" class="mb-4">
          <div class="d-flex align-center">
            <div>
              <h2>Transcript: {{ currentTranscript.OCIdNumber }}</h2>
              <p>Student: {{ currentTranscript.name }}</p>
              <p>University: {{ currentTranscript.university?.name }}</p>
            </div>
            <v-btn color="primary" class="ml-4" @click="viewTranscript">
              <v-icon left>mdi-file-pdf-box</v-icon>
              View Transcript
            </v-btn>
          </div>
        </div>
        <div class="d-flex align-center">
          <v-btn color="primary" @click="openDialog()" class="mr-2">
            Add Transcript Course
          </v-btn>
          <v-btn
            color="info"
            @click="processOCR"
            :loading="ocrLoading"
            :disabled="!currentTranscript"
            class="mr-2"
          >
            <v-icon left>mdi-text-recognition</v-icon>
            Process OCR
          </v-btn>
          <v-btn
            color="error"
            @click="deleteAllCourses"
            :loading="loading"
            class="ml-2"
          >
            <v-icon left>mdi-delete-sweep</v-icon>
            Delete All Courses
          </v-btn>
          <v-btn
            color="success"
            @click="approveAllCourses"
            :loading="loading"
            class="ml-2"
          >
            <v-icon left>mdi-check-all</v-icon>
            Approve All
          </v-btn>
          <v-btn
            color="primary"
            @click="saveSelectedCourses"
            :loading="loading"
            :disabled="Object.keys(selectedCourseIds).length === 0"
            class="ml-2"
          >
            <v-icon left>mdi-content-save</v-icon>
            Save Course Selections
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="transcriptCourses"
          :loading="loading"
          density="compact"
          class="elevation-1 compact-table"
          :row-props="getRowProps"
        >
          <template v-slot:item.actions="{ item }">
            <v-icon
              small
              class="mr-2"
              :color="item.status === 'Approved' ? 'success' : 'grey'"
              :class="{ 'cursor-not-allowed': item.status === 'UnMatched', 'cursor-pointer': item.status !== 'UnMatched' }"
              :style="{ opacity: item.status === 'UnMatched' ? 0.3 : 1, pointerEvents: item.status === 'UnMatched' ? 'none' : 'auto' }"
              @click="approveItem(item)"
            >
              mdi-check-circle
            </v-icon>
            <v-icon small class="mr-2" @click="editItem(item)">
              mdi-pencil
            </v-icon>
            <v-icon small @click="deleteItem(item)"> mdi-delete </v-icon>
          </template>
          <template v-slot:[`item.statusChangedDate`]="{ item }">
            {{
              item.statusChangedDate
                ? new Date(item.statusChangedDate).toLocaleDateString()
                : "N/A"
            }}
          </template>
          <template v-slot:[`item.courseSelection`]="{ item }">
            <v-autocomplete
              :model-value="selectedCourseIds[item.id]"
              :items="courses"
              :item-title="(c) => {
                const number = c.number || '';
                const description = c.description || '';
                return `${number} - ${description}`;
              }"
              item-value="id"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              class="compact-autocomplete"
              @update:model-value="(value) => handleTableCourseSelect(item, value)"
              :filter="
                (item, queryText) => {
                  const code = (item.code || '').toLowerCase();
                  const number = (item.number || '').toLowerCase();
                  const description = (item.description || '').toLowerCase();
                  const text = `${code} ${number} ${description}`;
                  const query = queryText.toLowerCase();
                  return text.includes(query);
                }
              "
            ></v-autocomplete>
          </template>
          <template v-slot:[`item.universityCourse.courseNumber`]="{ item }">
            {{ item.universityCourse?.courseNumber || 'N/A' }}
          </template>
          <template v-slot:[`item.universityCourse.courseName`]="{ item }">
            {{ item.universityCourse?.courseName || 'N/A' }}
          </template>
          <template v-slot:[`item.semester.name`]="{ item }">
            {{ item.semester?.name || 'N/A' }}
          </template>
        </v-data-table>
      </v-col>
    </v-row>

    <!-- OCR Results Dialog -->
    <v-dialog v-model="ocrDialog" max-width="800px">
      <v-card>
        <v-card-title class="text-h5">
          OCR Results
          <v-spacer></v-spacer>
          <v-btn icon @click="ocrDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text v-if="ocrResults">
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-card class="mb-4" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 mb-2">Student Information</div>
                    <div>
                      <strong>Name:</strong> {{ ocrResults.studentName }}
                    </div>
                    <div>
                      <strong>University:</strong> {{ ocrResults.university }}
                    </div>
                    <div class="mt-2">
                      <strong>Total Hours:</strong>
                      {{ calculateTotalHours(ocrResults.courses) }}
                    </div>
                    <div>
                      <strong>GPA:</strong>
                      {{ calculateGPA(ocrResults.courses).toFixed(2) }}
                    </div>
                  </v-card-text>
                </v-card>

                <v-card variant="outlined">
                  <v-card-text>
                    <div class="text-h6 mb-2">
                      Courses ({{ ocrResults.courses.length }})
                    </div>
                    <v-table>
                      <thead>
                        <tr>
                          <th>Course Number</th>
                          <th>Course Name</th>
                          <th>Semester</th>
                          <th>Hours</th>
                          <th>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="course in ocrResults.courses"
                          :key="course.courseNumber"
                        >
                          <td>{{ course.courseNumber }}</td>
                          <td>{{ course.courseName }}</td>
                          <td>{{ course.semester }}</td>
                          <td>{{ course.hours }}</td>
                          <td>{{ course.grade }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            @click="addOcrCourses"
            :loading="loading"
            :disabled="!ocrResults || !ocrResults.courses.length"
          >
            Add Courses to Transcript
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
                  v-model="editedItem.courseNumber"
                  label="Course Number"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="editedItem.courseDescription"
                  label="Course Description"
                  required
                ></v-textarea>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.courseHours"
                  label="Course Hours"
                  type="number"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-autocomplete
                  v-model="editedItem.universityCourseId"
                  :items="universityCourses"
                  :item-title="
                    (item) => `${item.courseNumber} - ${item.courseName}`
                  "
                  item-value="id"
                  label="University Course"
                  :filter="
                    (item, queryText) => {
                      const text = (
                        item.courseNumber +
                        ' ' +
                        item.courseName
                      ).toLowerCase();
                      const query = queryText.toLowerCase();
                      return text.includes(query);
                    }
                  "
                  return-object
                  clearable
                  @update:model-value="handleUniversityCourseSelect"
                ></v-autocomplete>
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
                  return-object
                  clearable
                  @update:model-value="handleCourseSelect"
                ></v-autocomplete>
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="editedItem.semesterId"
                  :items="semesters"
                  item-title="name"
                  item-value="id"
                  label="Semester"
                  required
                ></v-select>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.grade"
                  label="Grade"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="editedItem.status"
                  :items="statusOptions"
                  label="Status"
                  required
                ></v-select>
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

    <v-dialog v-model="confirmDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">
          {{ confirmTitle }}
        </v-card-title>

        <v-card-text>
          {{ confirmMessage }}
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="confirmDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn color="primary" variant="text" @click="handleConfirm">
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      timeout="3000"
      location="top"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- PDF Viewer Dialog -->
    <PDFViewer v-model="pdfDialog" :path="currentPdfUrl" />
  </v-container>
</template>

<style scoped>
.compact-table :deep(th) {
  padding: 0 2px !important;
  white-space: normal !important;
  font-size: 0.8rem !important;
  line-height: 1.1 !important;
  height: auto !important;
  min-height: 32px !important;
  vertical-align: middle !important;
}
.compact-table :deep(td) {
  padding: 0 2px !important;
  white-space: nowrap;
  font-size: 0.8rem !important;
}
.compact-table :deep(.v-data-table__wrapper) {
  overflow-x: auto;
}
.compact-table :deep(.v-data-table__wrapper table) {
  border-spacing: 0;
  border-collapse: collapse;
}
.compact-table :deep(.v-data-table__wrapper table td),
.compact-table :deep(.v-data-table__wrapper table th) {
  border: none;
  margin: 0;
  padding: 0 2px !important;
}
.compact-table :deep(.v-data-table__wrapper table tr) {
  border-bottom: thin solid rgba(0, 0, 0, 0.12);
}
.compact-table :deep(.v-data-table__wrapper table tr td),
.compact-table :deep(.v-data-table__wrapper table tr th) {
  height: 32px !important;
}
.compact-table :deep(.v-data-table__wrapper table tr td:not(:last-child)),
.compact-table :deep(.v-data-table__wrapper table tr th:not(:last-child)) {
  padding-right: 2px !important;
}
.compact-table :deep(.v-data-table__wrapper table tr th) {
  background-color: rgb(var(--v-theme-surface)) !important;
  font-weight: bold !important;
}
.compact-table :deep(tbody tr.grey-row) {
  background-color: #e0e0e0 !important;
}
.compact-table :deep(tbody tr.grey-row td) {
  background-color: #e0e0e0 !important;
}
.compact-table :deep(tbody tr.grey-row:hover) {
  background-color: #d5d5d5 !important;
}
.compact-table :deep(tbody tr.grey-row:hover td) {
  background-color: #d5d5d5 !important;
}
.compact-autocomplete :deep(.v-field__input),
.compact-autocomplete :deep(.v-select__selection) {
  font-size: 0.8rem !important;
}
</style>
