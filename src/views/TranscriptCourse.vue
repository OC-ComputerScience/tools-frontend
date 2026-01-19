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
const loading = ref(false); // General loading state (for initialize, etc.)
const deleteAllLoading = ref(false);
const approveAllLoading = ref(false);
const matchGenericsLoading = ref(false);
const saveChangesLoading = ref(false);
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
  permanentAssignment: false,
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
  permanentAssignment: false,
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
  // Track permanent assignment changes for each transcript course row
  const permanentAssignmentChanges = ref({});
  // Track semester changes for courses that don't have a semester
  const semesterChanges = ref({});
  // Track courses that were automatically matched during import (not manually selected)
  // This is used to prevent yellow styling on auto-matched generic courses
  const autoMatchedCourses = ref(new Set());
  // Track the original auto-matched course ID for each transcript course
  // Key: transcriptCourseId, Value: original auto-matched courseId
  const originalAutoMatchedCourseIds = ref({});

const headers = [
  { title: "Semester", key: "semester.name", width: "80px" },
  { title: "Course\nNumber", key: "courseNumber", width: "80px" },
  { title: "Course\nDescription", key: "courseDescription", width: "150px" },
  { title: "Hours", key: "courseHours", width: "60px" },
  { title: "Grade", key: "grade", width: "60px" },
  {
    title: "Univ\nCourse\nNumber",
    key: "universityCourse.courseNumber",
    width: "80px",
  },
  {
    title: "Univ\nCourse",
    key: "universityCourse.courseName",
    width: "120px",
  },
  { title: "Course\nSelection", key: "courseSelection", width: "350px" },
  { title: "Permanent\nAssignment", key: "permanentAssignment", width: "100px" },
  { title: "Status", key: "status", width: "80px" },
  { title: "Actions", key: "actions", sortable: false, width: "80px" },
];

const formTitle = computed(() => {
  return editedIndex.value === -1
    ? "New Transcript Course"
    : "Edit Transcript Course";
});

const totalHours = computed(() => {
  const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'P', 'P*', 'S'];
  return transcriptCourses.value.reduce(
    (total, course) => {
      const grade = course.grade?.toUpperCase()?.trim();
      const isPassing = validGrades.includes(grade);
      return isPassing ? total + (parseFloat(course.courseHours) || 0) : total;
    },
    0
  );
});

const sortedTranscriptCourses = computed(() => {
    return [...transcriptCourses.value].sort((a, b) => {
      // Null semesters go to the top
      if (!a.semester && !b.semester) {
        return 0; // Both null, maintain order
      }
      if (!a.semester) {
        return -1; // a is null, comes first
      }
      if (!b.semester) {
        return 1; // b is null, comes first
      }
      
      // Both have semesters, sort by start date
      const dateA = a.semester.startDate ? new Date(a.semester.startDate) : new Date(0);
      const dateB = b.semester.startDate ? new Date(b.semester.startDate) : new Date(0);
      return dateA - dateB; // Sort ascending (oldest first)
    });
  });

  // Sort semesters by start date for dropdowns
  const sortedSemesters = computed(() => {
    return [...semesters.value].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
      const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
      return dateA - dateB; // Sort ascending (oldest first)
    });
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
          
          // Check if this course was auto-matched from universityCourse lookup
          // If it has both universityCourseId and courseId, and they match, it was auto-matched
          if (tc.universityCourseId && tc.universityCourse && tc.universityCourse.course) {
            const universityCourseMatchedId = tc.universityCourse.course.id;
            // If the courseId matches the universityCourse's course, it was auto-matched
            if (universityCourseMatchedId === tc.courseId) {
              autoMatchedCourses.value.add(tc.id);
              originalAutoMatchedCourseIds.value[tc.id] = tc.courseId;
            }
          }
        }
      });
      // Clear any pending permanent assignment changes
      permanentAssignmentChanges.value = {};
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

  await SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching semesters:", error);
    });
  
  loading.value = false;
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
      // Refresh transcript to get updated status
      await UniversityTranscriptServices.get(transcriptId.value)
        .then((response) => {
          currentTranscript.value = response.data;
        })
        .catch((error) => {
          console.error("Error refreshing transcript:", error);
        });
    }
  );
};

const deleteAllCourses = async () => {
  showConfirmDialog(
    "Delete All Courses",
    "Are you sure you want to delete all courses for this transcript?",
    async () => {
      try {
        deleteAllLoading.value = true;
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
        deleteAllLoading.value = false;
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
        approveAllLoading.value = true;
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

        // Refresh transcript to get updated status
        await UniversityTranscriptServices.get(transcriptId.value)
          .then((response) => {
            currentTranscript.value = response.data;
          })
          .catch((error) => {
            console.error("Error refreshing transcript:", error);
          });
        
        await initialize();
        showSnackbar(
          `${coursesToApprove.length} courses approved successfully`
        );
      } catch (error) {
        console.error("Error approving all courses:", error);
        showSnackbar("Error approving courses. Please try again.", "error");
      } finally {
        approveAllLoading.value = false;
      }
    }
  );
};

const close = () => {
  dialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  editedIndex.value = -1;
};

const save = async () => {
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
      .then(async (response) => {
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
        // Refresh transcript to get updated status
        await UniversityTranscriptServices.get(transcriptId.value)
          .then((response) => {
            currentTranscript.value = response.data;
          })
          .catch((error) => {
            console.error("Error refreshing transcript:", error);
          });
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
      .then(async (response) => {
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
        // Refresh transcript to get updated status
        await UniversityTranscriptServices.get(transcriptId.value)
          .then((response) => {
            currentTranscript.value = response.data;
          })
          .catch((error) => {
            console.error("Error refreshing transcript:", error);
          });
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

    // Get the current transcript first to get its university ID
    const currentTranscriptResponse = await UniversityTranscriptServices.get(
      transcriptId
    );
    const currentTranscript = currentTranscriptResponse.data;

    // Get all transcript courses for this transcript - make backend request for this specifically
    const transcriptCoursesResponse = await TranscriptCourseServices.getAll();
    const currentTranscriptCourses = transcriptCoursesResponse.data.filter(
      (course) => course.universityTranscriptId === parseInt(transcriptId)
    );

    // Get all courses
    const coursesResponse = await CourseServices.getAllCourses();
    const allCourses = coursesResponse.data;

    // Process each transcript course
    for (const transcriptCourse of currentTranscriptCourses) {
      // Find matching university course by course number
      const matchingUniversityCourse = findMatchingUniversityCourse(
        transcriptCourse.courseNumber,
        universityCourses
      );

      if (matchingUniversityCourse) {
        // Find the course from the university course
        const matchedCourse = matchingUniversityCourse.course;

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

            const response = await TranscriptCourseServices.update(
              transcriptCourse.id,
              updateData
            );

            if (response && response.data) {
              // Create the updated item with all necessary relations
              const updatedItem = {
                ...response.data,
                course: matchedCourse,
                universityCourse: matchingUniversityCourse,
                universityTranscript: currentTranscript,
              };

              // Update the local transcript courses array
              const index = transcriptCourses.value.findIndex(
                (tc) => tc.id === transcriptCourse.id
              );
              if (index !== -1) {
                transcriptCourses.value[index] = updatedItem;
              }
            } else {
              console.error("Invalid response from update:", response);
            }
          } catch (updateError) {
            console.error("Error updating course:", updateError);
          }
        }
      }
    }

    // Refresh transcript to get updated status
    await UniversityTranscriptServices.get(transcriptId.value)
      .then((response) => {
        currentTranscript.value = response.data;
      })
      .catch((error) => {
        console.error("Error refreshing transcript:", error);
      });

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
      // Refresh transcript to get updated status
      await UniversityTranscriptServices.get(transcriptId.value)
        .then((response) => {
          currentTranscript.value = response.data;
        })
        .catch((error) => {
          console.error("Error refreshing transcript:", error);
        });
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
  if (!courseSemester) {
    return null;
  }
  
  if (!semesters.value.length) {
    return null;
  }

  let term, year;

  // Try to extract year and term from various formats:
  // "FALL 1983", "1983 FALL", "Fall 2022", "2022FA", "FA2022", "2025SP", "SP2025", etc.
  
  // First, try to extract 4-digit year (might be at start or end)
  const yearMatch = courseSemester.match(/\b(\d{4})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Extract term (can be before or after year, or in formats like "2022FA")
  const upperSemester = courseSemester.toUpperCase().trim();
  
  // Check for combined format: "2022FA", "FA2022", "2025SP", "SP2025", etc.
  const combinedFormat = upperSemester.match(/^(\d{4})(FA|SP|SU|WI|FALL|SPRING|SUMMER|WINTER)$|^(FA|SP|SU|WI|FALL|SPRING|SUMMER|WINTER)(\d{4})$/);
  if (combinedFormat) {
    if (combinedFormat[1]) {
      // Format: "2022FA" - year is first group, term is second
      year = combinedFormat[1];
      term = combinedFormat[2];
    } else {
      // Format: "FA2022" - term is third group, year is fourth
      term = combinedFormat[3];
      year = combinedFormat[4];
    }
  } else {
    // Split format: "FALL 1983", "1983 FALL", "Fall 2022", etc.
    const parts = courseSemester.trim().split(/\s+/);
    
    if (parts.length >= 2) {
      // Check if first part is a year (4 digits)
      if (/^\d{4}$/.test(parts[0])) {
        // Format: "1983 FALL"
        year = parts[0];
        term = parts.slice(1).join(" "); // In case there are multiple words for term
      } else {
        // Format: "FALL 1983" or "Fall 2022"
        // Find year (4 digits) in the parts
        const yearPartIndex = parts.findIndex(p => /^\d{4}$/.test(p));
        if (yearPartIndex !== -1) {
          year = parts[yearPartIndex];
          term = parts.slice(0, yearPartIndex).join(" ") || parts.slice(yearPartIndex + 1).join(" ");
        } else {
          // No 4-digit year found, use first part as term and last part as year (might be 2-digit)
          term = parts[0];
          // Try to extract year from any part
          for (const part of parts) {
            const yearCandidate = part.match(/\b(\d{2,4})\b/);
            if (yearCandidate) {
              // Convert 2-digit year to 4-digit (assuming 20xx if 2-digit)
              if (yearCandidate[1].length === 2) {
                year = "20" + yearCandidate[1];
              } else {
                year = yearCandidate[1];
              }
              break;
            }
          }
        }
      }
    } else if (parts.length === 1) {
      // Single part - might be format like "Fall2022" or "2022Fall"
      const singleMatch = parts[0].match(/^(\d{4})(.+)$|^(.+)(\d{4})$/);
      if (singleMatch) {
        if (singleMatch[1]) {
          year = singleMatch[1];
          term = singleMatch[2];
        } else {
          term = singleMatch[3];
          year = singleMatch[4];
        }
      }
    }
  }

  if (!year) {
    return null;
  }

  // Normalize term to standard abbreviations
  const termMap = {
    FALL: "FA",
    SPRING: "SP",
    SUMMER: "SU",
    WINTER: "WI",
  };
  
  // If term was extracted, normalize it
  if (term) {
    const upperTerm = term.toUpperCase().trim();
    // Check if it's already an abbreviation
    if (termMap[upperTerm]) {
      term = termMap[upperTerm];
    } else if (upperTerm.length > 2) {
      // It's a full term name, convert to abbreviation
      for (const [fullTerm, abbrev] of Object.entries(termMap)) {
        if (upperTerm.includes(fullTerm) || fullTerm.includes(upperTerm)) {
          term = abbrev;
          break;
        }
      }
    }
  }

  // Find semesters that match the year - use word boundary to avoid partial matches
  const yearPattern = new RegExp(`\\b${year}\\b`);
  
  const matchingYearSemesters = semesters.value.filter((s) => {
    if (!s.name) return false;
    return yearPattern.test(s.name);
  });

  if (!matchingYearSemesters.length) {
    // Try case-insensitive search
    const yearPatternCI = new RegExp(year, 'i');
    const matchingYearSemestersCI = semesters.value.filter((s) =>
      s.name && yearPatternCI.test(s.name)
    );
    
    if (matchingYearSemestersCI.length > 0) {
      // Continue with case-insensitive matches
      const allMatchingSemesters = matchingYearSemestersCI;
      
      // If we have a term, try to find exact match
      if (term) {
        const upperTerm = term.toUpperCase();
        const exactMatch = allMatchingSemesters.find((s) => {
          const semesterName = s.name ? s.name.toUpperCase() : "";
          return (
            semesterName.includes(upperTerm) ||
            (termMap[upperTerm] && semesterName.includes(termMap[upperTerm])) ||
            Object.entries(termMap).some(([fullTerm, abbrev]) => 
              (upperTerm === abbrev && semesterName.includes(abbrev)) ||
              (upperTerm === fullTerm && semesterName.includes(fullTerm))
            )
          );
        });
        
        if (exactMatch) {
          return exactMatch;
        }
      }
      
      // Return first match if no exact term match
      return allMatchingSemesters[0];
    }
    
    return null;
  }

  // If we have a term, try to find exact match
  if (term) {
    const upperTerm = term.toUpperCase();
    const exactMatch = matchingYearSemesters.find((s) => {
      const semesterName = s.name ? s.name.toUpperCase() : "";
      // Check for both full term and abbreviated term
      return (
        semesterName.includes(upperTerm) ||
        (termMap[upperTerm] && semesterName.includes(termMap[upperTerm])) ||
        Object.entries(termMap).some(([fullTerm, abbrev]) => 
          (upperTerm === abbrev && semesterName.includes(abbrev)) ||
          (upperTerm === fullTerm && semesterName.includes(fullTerm))
        )
      );
    });

    if (exactMatch) {
      return exactMatch;
    }
  }

  // If no exact match, return the first semester from the matching year
  return matchingYearSemesters[0];
};

const findMatchingUniversityCourse = (
  courseNumber,
  courses = universityCourses.value
) => {
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
    // Ensure semesters are loaded before importing
    if (!semesters.value || semesters.value.length === 0) {
      await initialize();
    }
    
    // Import all courses, including those without semesters
    const importPromises = ocrResults.value.courses.map(async (course) => {
      // Try to find matching semester, but allow null if not found or empty
      // Handle various formats: course.semester could be a string, null, undefined, or empty
      let matchingSemester = null;
      const semesterValue = course.semester;
      
      // Check if semester exists and is not empty after trimming
      if (semesterValue && typeof semesterValue === 'string' && semesterValue.trim()) {
        matchingSemester = findClosestSemester(semesterValue.trim());
      } else if (semesterValue && typeof semesterValue !== 'string') {
        // If it's not a string, try converting to string
        const semesterStr = String(semesterValue).trim();
        if (semesterStr) {
          matchingSemester = findClosestSemester(semesterStr);
        }
      }
      
      const matchingUniversityCourse = findMatchingUniversityCourse(
        course.courseNumber
      );

      // Only set universityCourseId and courseId if we have a match
      // Import even if semester is missing - semesterId can be null
      const courseData = {
        universityTranscriptId: currentTranscript.value.id,
        courseNumber: course.courseNumber,
        courseDescription: course.courseName,
        courseHours: course.hours,
        semesterId: matchingSemester ? matchingSemester.id : null, // Allow null for courses without a term
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

      // If the response includes semester data, use it; otherwise use matchingSemester
      // The backend might return the semester object if it was included in the response
      const responseSemester = response.data.semester || matchingSemester;
      
      // Ensure semesterId is set correctly - use response data first, then matchingSemester
      let finalSemesterId = response.data.semesterId;
      if (!finalSemesterId && matchingSemester) {
        finalSemesterId = matchingSemester.id;
      }
      
      // Add the created course to the transcriptCourses array with proper relations
      const newCourse = {
        ...response.data,
        semesterId: finalSemesterId || null, // Explicitly set semesterId
        universityCourse: matchingUniversityCourse || null,
        course: matchingUniversityCourse?.course || null,
        semester: responseSemester || null,
        universityTranscript: currentTranscript.value,
      };

      transcriptCourses.value.push(newCourse);
      
      // Initialize selected course ID if courseId is present (from automatic lookup/match)
      if (newCourse.courseId) {
        selectedCourseIds.value[newCourse.id] = newCourse.courseId;
        // Mark this as an auto-matched course (not manually selected)
        // This prevents yellow styling for generic courses that were automatically matched
        autoMatchedCourses.value.add(newCourse.id);
        // Store the original auto-matched course ID
        originalAutoMatchedCourseIds.value[newCourse.id] = newCourse.courseId;
      }
      
      return newCourse;
    });
    
    // Wait for all courses to be imported (including those without terms)
    await Promise.all(importPromises);

    // Refresh transcript to get updated status
    await UniversityTranscriptServices.get(transcriptId.value)
      .then((response) => {
        currentTranscript.value = response.data;
      })
      .catch((error) => {
        console.error("Error refreshing transcript:", error);
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
    S: 0.0, // Satisfactory - pass/fail, counts as passing but not towards GPA
  };

  // Pass/fail grades (S, P, P*) should not count towards GPA hours
  const passFailGrades = ['S', 'P', 'P*'];

  let totalPoints = 0;
  let totalHours = 0;

  courses.forEach((course) => {
    const hours = parseFloat(course.hours) || 0;
    const grade = course.grade ? course.grade.toUpperCase() : "";
    
    // Skip pass/fail grades in GPA calculation (they count as passing for hours but not for GPA)
    if (passFailGrades.includes(grade)) {
      return; // Don't add to totalHours or totalPoints for GPA
    }

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
    // Check if this course was originally auto-matched and if the selected course matches
    const originalAutoMatchedCourseId = originalAutoMatchedCourseIds.value[item.id];
    if (originalAutoMatchedCourseId && originalAutoMatchedCourseId !== courseId) {
      // User selected a different course than the original auto-match, remove from auto-matched
      autoMatchedCourses.value.delete(item.id);
    } else if (!originalAutoMatchedCourseId) {
      // Course was never auto-matched, remove from auto-matched if it was there
      autoMatchedCourses.value.delete(item.id);
    }
    // If the selected course matches the original auto-matched course, keep it in autoMatchedCourses
    // Update the status to "Matched" when a course is selected
    const index = transcriptCourses.value.findIndex(tc => tc.id === item.id);
    if (index !== -1) {
      transcriptCourses.value[index].status = "Matched";
    }
  } else {
    delete selectedCourseIds.value[item.id];
    // Remove from auto-matched courses when course is cleared
    autoMatchedCourses.value.delete(item.id);
    delete originalAutoMatchedCourseIds.value[item.id];
    // Optionally reset status when course is cleared
    const index = transcriptCourses.value.findIndex(tc => tc.id === item.id);
    if (index !== -1 && transcriptCourses.value[index].status === "Matched") {
      transcriptCourses.value[index].status = "Unmatched";
    }
    // Automatically uncheck permanent assignment when course is cleared
    if (permanentAssignmentChanges.value && permanentAssignmentChanges.value[item.id] !== undefined) {
      permanentAssignmentChanges.value[item.id] = false;
      if (index !== -1) {
        transcriptCourses.value[index].permanentAssignment = false;
      }
    } else if (index !== -1 && transcriptCourses.value[index].permanentAssignment) {
      permanentAssignmentChanges.value[item.id] = false;
      transcriptCourses.value[index].permanentAssignment = false;
    }
  }
};

// Get selected course for a transcript course item
const getSelectedCourse = (item) => {
  const courseId = selectedCourseIds.value[item.id];
  if (!courseId) return null;
  return courses.value.find((c) => c.id === courseId);
};

// Check if a course is a generic course (pattern XXXX-001H or XXXX-003H)
// Only show yellow if the course was manually selected (not auto-matched during import)
// And if manually selected, only show yellow if it's different from the original auto-matched course
const isGenericCourse = (item) => {
  // Check both selectedCourseIds and item.courseId (prioritize selectedCourseIds for manual selections)
  const courseId = selectedCourseIds.value[item.id] || item.courseId;
  if (!courseId) return false;
  
  const course = courses.value.find((c) => c.id === courseId);
  if (!course) return false;
  
  // Check if course number matches generic pattern: XXXX-001H or XXXX-003H (where H is hours 1-9)
  // Pattern: prefix + "-" + "001" or "003" + single digit
  const courseNumber = course.number || '';
  const genericPattern = /^[A-Z]{2,4}-(001|003)[1-9]$/;
  const isGeneric = genericPattern.test(courseNumber);
  
  if (!isGeneric) return false;
  
  // Check if this course was auto-matched (from lookup or import)
  // If it was auto-matched and the selected course matches the original, don't show yellow
  
  // First, check if it's in our tracking (from import or initialization)
  const originalAutoMatchedCourseId = originalAutoMatchedCourseIds.value[item.id];
  if (originalAutoMatchedCourseId && originalAutoMatchedCourseId === courseId) {
    // The selected course matches the original auto-matched course, don't show yellow
    return false;
  }
  
  // Second, check if the courseId matches what would be auto-matched from universityCourse lookup
  // This handles cases where the course was auto-matched from the database but not tracked
  // We check if: item has universityCourseId, has universityCourse with course, and that course.id matches the selected courseId
  if (item.universityCourseId && item.universityCourse) {
    // Get the course ID from the universityCourse relationship
    const universityCourseMatchedId = item.universityCourse.course?.id || item.universityCourse.courseId;
    // Also check if item.courseId itself matches (the stored courseId from the database)
    const storedCourseId = item.courseId;
    
    // If the selected courseId matches either the universityCourse's course OR the stored courseId
    // AND the stored courseId matches what would be looked up, then it was auto-matched
    if ((universityCourseMatchedId === courseId) || (storedCourseId === courseId && storedCourseId === universityCourseMatchedId)) {
      // This course matches what would be auto-matched from the universityCourse lookup
      // Don't show yellow - it's effectively an auto-match
      // Also store it in our tracking for future reference
      if (!originalAutoMatchedCourseId) {
        originalAutoMatchedCourseIds.value[item.id] = courseId;
        autoMatchedCourses.value.add(item.id);
      }
      return false;
    }
  }
  
  // Third, check if item.courseId matches the current selection and if there's a universityCourseId
  // This is a fallback for cases where the relationship might not be fully loaded
  if (item.courseId === courseId && item.universityCourseId) {
    // If there's a universityCourseId, it was likely auto-matched from lookup
    // Don't show yellow if it matches the stored courseId
    // Also store it in our tracking
    if (!originalAutoMatchedCourseId) {
      originalAutoMatchedCourseIds.value[item.id] = courseId;
      autoMatchedCourses.value.add(item.id);
    }
    return false;
  }
  
  // If there's no match with auto-matched courses, show yellow (it's a manually selected generic course)
  return true;
};

// Get row props based on grade
const getRowProps = ({ item }) => {
  const grade = item.grade?.toUpperCase()?.trim();
  // Check if grade matches A, B, C, D with optional + or - (e.g., A+, A-, B, C+, D-), or P/P*/S
  const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'P', 'P*', 'S'];
  const isGreyRow = !validGrades.includes(grade);
  return {
    class: {
      'grey-row': isGreyRow,
    },
    style: isGreyRow ? { backgroundColor: '#e0e0e0' } : {},
  };
};

// Update permanent assignment (local only, doesn't save)
const updatePermanentAssignment = (item, value) => {
  if (!permanentAssignmentChanges.value) {
    permanentAssignmentChanges.value = {};
  }
  permanentAssignmentChanges.value[item.id] = value;
  // Update local display immediately
  const index = transcriptCourses.value.findIndex(
    (tc) => tc.id === item.id
  );
  if (index !== -1) {
    transcriptCourses.value[index].permanentAssignment = value;
  }
};

// Save all selected courses and permanent assignments
const saveSelectedCourses = async () => {
  saveChangesLoading.value = true;
  try {
    // Group all changes by course ID to avoid concurrent update conflicts
    const courseUpdates = new Map();
    
    // Collect course selection changes
    for (const [transcriptCourseId, courseId] of Object.entries(selectedCourseIds.value)) {
      const courseIdNum = parseInt(transcriptCourseId);
      const transcriptCourse = transcriptCourses.value.find((tc) => tc.id === courseIdNum);
      if (transcriptCourse && courseId) {
        if (!courseUpdates.has(courseIdNum)) {
          courseUpdates.set(courseIdNum, {
            transcriptCourse,
            changes: {}
          });
        }
        // Preserve existing status if it's "Approved", otherwise set to "Matched"
        const newStatus = transcriptCourse.status === "Approved" ? "Approved" : "Matched";
        courseUpdates.get(courseIdNum).changes.courseId = courseId;
        courseUpdates.get(courseIdNum).changes.status = newStatus;
      }
    }

    // Collect permanent assignment changes
    for (const [transcriptCourseId, permanentAssignment] of Object.entries(permanentAssignmentChanges.value)) {
      const courseIdNum = parseInt(transcriptCourseId);
      const transcriptCourse = transcriptCourses.value.find((tc) => tc.id === courseIdNum);
      if (transcriptCourse) {
        if (!courseUpdates.has(courseIdNum)) {
          courseUpdates.set(courseIdNum, {
            transcriptCourse,
            changes: {}
          });
        }
        courseUpdates.get(courseIdNum).changes.permanentAssignment = permanentAssignment;
      }
    }

    // Collect semester changes
    for (const [transcriptCourseId, semesterId] of Object.entries(semesterChanges.value)) {
      const courseIdNum = parseInt(transcriptCourseId);
      const transcriptCourse = transcriptCourses.value.find((tc) => tc.id === courseIdNum);
      if (transcriptCourse) {
        if (!courseUpdates.has(courseIdNum)) {
          courseUpdates.set(courseIdNum, {
            transcriptCourse,
            changes: {}
          });
        }
        courseUpdates.get(courseIdNum).changes.semesterId = semesterId || null; // Allow null to clear semester
      }
    }

    // Create a single update promise for each course with all its changes combined
    const updatePromises = Array.from(courseUpdates.entries()).map(([courseIdNum, { transcriptCourse, changes }]) => {
      const updateData = {
        ...transcriptCourse,
        ...changes
      };
      return TranscriptCourseServices.update(courseIdNum, updateData);
    });

    await Promise.all(updatePromises);
    
    // Clear the tracked changes
    selectedCourseIds.value = {};
    permanentAssignmentChanges.value = {};
    semesterChanges.value = {};
    
    // Refresh transcript to get updated status
    await UniversityTranscriptServices.get(transcriptId.value)
      .then((response) => {
        currentTranscript.value = response.data;
      })
      .catch((error) => {
        console.error("Error refreshing transcript:", error);
      });
    
    snackbarMessage.value = `Successfully updated ${updatePromises.length} transcript course(s)`;
    snackbarColor.value = "success";
    snackbar.value = true;
    
    // Reload the data
    await initialize();
  } catch (error) {
    console.error("Error saving changes:", error);
    snackbarMessage.value = "Error saving changes. Please try again.";
    snackbarColor.value = "error";
    snackbar.value = true;
  } finally {
    saveChangesLoading.value = false;
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

const getStatusColor = (status) => {
  switch (status) {
    case "Not Process":
      return "grey";
    case "In-Progress":
      return "orange";
    case "Completed":
      return "green";
    case "Exported":
      return "blue";
    default:
      return "grey";
  }
};

// Match unmatched courses with generic courses using Gemini
const matchGenericCourses = async () => {
  if (!transcriptId.value) {
    snackbarMessage.value = "No transcript selected";
    snackbarColor.value = "error";
    snackbar.value = true;
    return;
  }

  matchGenericsLoading.value = true;
  try {
    const response = await TranscriptCourseServices.matchGenericCourses(transcriptId.value);
    const matches = response.data.matches || [];

    if (matches.length === 0) {
      snackbarMessage.value = "No generic course matches found";
      snackbarColor.value = "info";
      snackbar.value = true;
      loading.value = false;
      return;
    }

    // Update selectedCourseIds with the matches
    matches.forEach((match) => {
      selectedCourseIds.value[match.transcriptCourseId] = match.courseId;
      // Update the status to "Matched" for these courses
      const index = transcriptCourses.value.findIndex(tc => tc.id === match.transcriptCourseId);
      if (index !== -1) {
        transcriptCourses.value[index].status = "Matched";
      }
    });

    snackbarMessage.value = `Found ${matches.length} generic course match(es). Click "Save Changes" to apply.`;
    snackbarColor.value = "success";
    snackbar.value = true;
  } catch (error) {
    console.error("Error matching generic courses:", error);
    snackbarMessage.value = error.response?.data?.message || "Error matching generic courses";
    snackbarColor.value = "error";
    snackbar.value = true;
  } finally {
    matchGenericsLoading.value = false;
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
          <div class="d-flex align-center justify-space-between">
            <div>
              <h2>Transcript: {{ currentTranscript.OCIdNumber }}</h2>
              <p>Student: {{ currentTranscript.name }}</p>
              <p>University: {{ currentTranscript.university?.name }}</p>
              <p><strong>Courses: {{ transcriptCourses.length }}</strong></p>
              <p><strong>Total Hours: {{ totalHours }}</strong></p>
            </div>
            <div class="d-flex align-center">
              <v-chip 
                :color="getStatusColor(currentTranscript.status)" 
                variant="flat"
                class="mr-4"
              >
                Status: {{ currentTranscript.status || 'Not Process' }}
              </v-chip>
              <v-btn color="primary" @click="viewTranscript">
                <v-icon left>mdi-file-pdf-box</v-icon>
                View Transcript
              </v-btn>
            </div>
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
            :loading="deleteAllLoading"
            class="ml-2"
          >
            <v-icon left>mdi-delete-sweep</v-icon>
            Delete All Courses
          </v-btn>
          <v-btn
            color="success"
            @click="approveAllCourses"
            :loading="approveAllLoading"
            class="ml-2"
          >
            <v-icon left>mdi-check-all</v-icon>
            Approve All
          </v-btn>
          <v-btn
            color="secondary"
            @click="matchGenericCourses"
            :loading="matchGenericsLoading"
            :disabled="!currentTranscript"
            class="ml-2"
          >
            <v-icon left>mdi-auto-fix</v-icon>
            Add Generics
          </v-btn>
          <v-btn
            color="primary"
            @click="saveSelectedCourses"
            :loading="saveChangesLoading"
              :disabled="Object.keys(selectedCourseIds).length === 0 && (!permanentAssignmentChanges || Object.keys(permanentAssignmentChanges.value || {}).length === 0) && (!semesterChanges || Object.keys(semesterChanges || {}).length === 0)"
            class="ml-2"
          >
            <v-icon left>mdi-content-save</v-icon>
            Save Changes
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="sortedTranscriptCourses"
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
              :disabled="item.status === 'Approved'"
              :class="[
                'compact-autocomplete',
                { 'generic-course': isGenericCourse(item) }
              ]"
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
          <template v-slot:[`item.permanentAssignment`]="{ item }">
            <div @click.stop @click.prevent="() => { 
              if (!item || item.id === undefined) return;
              const trackedValue = (permanentAssignmentChanges && permanentAssignmentChanges.value && permanentAssignmentChanges.value[item.id] !== undefined) 
                ? permanentAssignmentChanges.value[item.id] 
                : (item.permanentAssignment || false); 
              const hasCourse = item.courseId || selectedCourseIds[item.id];
              // Allow unchecking even without a course, but prevent checking without a course
              if (!hasCourse && !trackedValue) return;
              const newValue = !trackedValue; 
              updatePermanentAssignment(item, newValue); 
            }">
              <v-checkbox
                :model-value="(permanentAssignmentChanges && permanentAssignmentChanges.value && permanentAssignmentChanges.value[item.id] !== undefined) ? !!permanentAssignmentChanges.value[item.id] : !!(item && item.permanentAssignment)"
                :disabled="!(item.courseId || selectedCourseIds[item.id])"
                density="compact"
                hide-details
                readonly
              ></v-checkbox>
            </div>
          </template>
          <template v-slot:[`item.semester.name`]="{ item }">
            <v-select
              :model-value="semesterChanges[item.id] !== undefined ? semesterChanges[item.id] : (item.semester?.id || null)"
              :items="sortedSemesters"
              item-title="name"
              item-value="id"
              density="compact"
              variant="outlined"
              hide-details
              placeholder="Select Term"
              @update:model-value="(value) => semesterChanges[item.id] = value"
              style="min-width: 120px;"
            ></v-select>
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
                  :items="sortedSemesters"
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
              <v-col cols="12">
                <v-checkbox
                  v-model="editedItem.permanentAssignment"
                  label="Permanent Assignment"
                ></v-checkbox>
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

.generic-course :deep(.v-field__input) {
  background-color: #fff9c4 !important;
}

.generic-course :deep(.v-field) {
  background-color: #fff9c4 !important;
}

.generic-course :deep(.v-field__outline) {
  border-color: #fdd835 !important;
}
</style>
