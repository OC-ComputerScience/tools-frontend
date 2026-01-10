<script setup>
import SectionServices from "../services/sectionServices";
import SemesterServices from "../services/semesterServices";
import AssignedCourseServices from "../services/assignedCourseServices";
import UserServices from "../services/userServices";
import UserSectionServices from "../services/userSectionServices";
import { ref, onMounted } from "vue";

const courses = ref([]);
const semesters = ref([]);
const users = ref([]);
const selectedSemester = ref(null);
const selectedFaculty = ref(null);
const message = ref("Select a semester to view courses");
const totalSections = ref(0);
const totalAssignments = ref(0);
const facultyWithNoAssignments = ref(0);
const facultyWithAssignments = ref(0);

const retrieveSemesters = () => {
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data;
      if (response.data.length > 0) {
        selectedSemester.value = response.data[0].id;
        retrieveCourses();
      }
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading semesters";
    });
};

const retrieveUsers = () => {
  UserServices.getAllUsers()
    .then((response) => {
      // Add fullName property for display
      users.value = response.data.map((user) => ({
        ...user,
        fullName: `${user.fName} ${user.lName}`,
      }));
    })
    .catch((e) => {
      console.error("Error loading users:", e);
    });
};

const exportAssignedCourses = async () => {
  if (!selectedSemester.value) {
    alert("Please select a semester first");
    return;
  }

  try {
    // Get the selected term details
    const selectedSemesterData = semesters.value.find(t => t.id === selectedSemester.value);
    if (!selectedSemesterData) {
      alert("Semester not found");
      return;
    }

    // Get all sections for the selected semester with their semester info
    const sectionsResponse = await SectionServices.getAllSections({ semesterId: selectedSemester.value });
    const sections = sectionsResponse.data || [];
    const sectionIds = sections.map(s => s.id);

    if (sectionIds.length === 0) {
      alert("No sections found for the selected semester");
      return;
    }

    // Create a map of section ID to section data for quick lookup
    const sectionMap = new Map();
    sections.forEach(s => {
      sectionMap.set(s.id, s);
    });

    // Get all assigned courses (basic info)
    const allAssignedCoursesResponse = await AssignedCourseServices.getAllAssignedCourses({});
    const allAssignedCourses = allAssignedCoursesResponse.data || [];
    
    // Filter to only assigned courses for sections in the selected semester
    const semesterAssignedCourses = allAssignedCourses.filter(ac => sectionIds.includes(ac.sectionId));

    if (semesterAssignedCourses.length === 0) {
      alert("No assigned courses found for the selected semester");
      return;
    }

    // Get unique assigned section IDs to fetch their details with term info
    const assignedSectionIds = [...new Set(semesterAssignedCourses.map(ac => ac.assignedSectionId))];
    
    // Fetch all assigned sections with their term info
    const assignedSectionsResponses = await Promise.all(
      assignedSectionIds.map(id => SectionServices.getSection(id))
    );
    
    // Create a map of assigned section ID to section data with term
    const assignedSectionMap = new Map();
    assignedSectionsResponses.forEach(response => {
      if (response.data) {
        assignedSectionMap.set(response.data.id, response.data);
      }
    });

    // Build CSV data
    const csvRows = [];
    
    // CSV Header
    csvRows.push(['course_id', 'export_filename', 'term_id', 'short_name', 'long_name', 'accountId'].join(','));

    // CSV Data rows
    semesterAssignedCourses.forEach((assignedCourse) => {
      // Get the original section
      const section = sectionMap.get(assignedCourse.sectionId);
      if (!section) return;

      // Get the assigned section with semester info
      const assignedSection = assignedSectionMap.get(assignedCourse.assignedSectionId);
      if (!assignedSection) return;

      const sectionSemester = section.semester || selectedSemesterData;
      const assignedSectionSemester = assignedSection.semester || { name: '' };

      // course_id: <semester name>_<course number>_<section number>
      const courseId = `${sectionSemester.name}_${section.courseNumber}_${section.courseSection}`;

      // export_filename: ArchiveFile_<assigned course semester name>_<assigned course number>-<assigned course section number>.zip
      const exportFilename = `ArchiveFile_${assignedSectionSemester.name}_${assignedSection.courseNumber}-${assignedSection.courseSection}.zip`;

      // term_id: <semester name>
      const semesterId = sectionSemester.name;

      // short_name: <course number>-<section number>
      const shortName = `${section.courseNumber}-${section.courseSection}`;

      // long_name: <course description>
      const longName = section.courseDescription || '';

      // Escape commas and quotes in CSV values
      const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      csvRows.push([
        escapeCsvValue(courseId),
        escapeCsvValue(exportFilename),
        escapeCsvValue(semesterId),
        escapeCsvValue(shortName),
        escapeCsvValue(longName),
        escapeCsvValue(section.accountId || '')
      ].join(','));
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `canvas_migration_${selectedSemesterData.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting assigned courses:', error);
    alert('Error exporting assigned courses. Please check the console for details.');
  }
};

const retrieveCourses = async () => {
  if (!selectedSemester.value) {
    courses.value = [];
    totalSections.value = 0;
    totalAssignments.value = 0;
    facultyWithNoAssignments.value = 0;
    facultyWithAssignments.value = 0;
    return;
  }

  try {
    // Get all sections for the semester
    const params = { semesterId: selectedSemester.value };
    const allSectionsResponse = await SectionServices.getSectionsWithCount(params);
    let allSections = allSectionsResponse.data || [];

    // If faculty is selected, filter sections using user_sections join table
    if (selectedFaculty.value) {
      const userSectionsResponse = await UserSectionServices.getSectionsByUser(selectedFaculty.value);
      const userSections = userSectionsResponse.data || [];
      const userSectionIds = new Set(userSections.map(s => s.id));
      
      // Filter to only sections assigned to this faculty
      allSections = allSections.filter(s => userSectionIds.has(s.id));
    }

    courses.value = allSections.sort((a, b) => {
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
    calculateStats();
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading courses";
  }
};

const calculateStats = async () => {
  if (!selectedSemester.value) {
    totalSections.value = 0;
    totalAssignments.value = 0;
    facultyWithNoAssignments.value = 0;
    facultyWithAssignments.value = 0;
    return;
  }

  try {
    // Get sections for the selected semester (and faculty if selected)
    const sectionParams = { semesterId: selectedSemester.value };
    const allSectionsResponse = await SectionServices.getAllSections(sectionParams);
    let allSections = allSectionsResponse.data || [];

    // If faculty is selected, filter sections using user_sections join table
    if (selectedFaculty.value) {
      const userSectionsResponse = await UserSectionServices.getSectionsByUser(selectedFaculty.value);
      const userSections = userSectionsResponse.data || [];
      const userSectionIds = new Set(userSections.map(s => s.id));
      allSections = allSections.filter(s => userSectionIds.has(s.id));
    }

    totalSections.value = allSections.length;

    // Get all assignments for sections in this semester
    const assignedCoursesResponse = await AssignedCourseServices.getAllAssignedCourses({});
    const allAssignments = assignedCoursesResponse.data || [];
    
    // Filter assignments to only those for sections in the filtered list
    const sectionIds = allSections.map(s => s.id);
    const termAssignments = allAssignments.filter(ac => sectionIds.includes(ac.sectionId));
    totalAssignments.value = termAssignments.length;

    // Calculate faculty with assignments and faculty with no assignments
    if (selectedFaculty.value) {
      // For a single faculty, check if they have any assignments
      const sectionIdsWithAssignments = [...new Set(termAssignments.map(ac => ac.sectionId))];
      const hasAssignments = allSections.some(s => sectionIdsWithAssignments.includes(s.id));
      facultyWithAssignments.value = hasAssignments ? 1 : 0;
      facultyWithNoAssignments.value = hasAssignments ? 0 : 1;
    } else {
      // Get all sections for the semester to calculate this stat
      const allTermSections = allSections;
      
      // Get all user_sections for sections in this semester to find faculty
      const allSectionIds = allTermSections.map(s => s.id);
      const allUserSectionsResponse = await UserSectionServices.getAll();
      const allUserSections = allUserSectionsResponse.data || [];
      
      // Filter user_sections to only those for sections in this semester
      const semesterUserSections = allUserSections.filter(us => allSectionIds.includes(us.sectionId));
      
      // Get unique faculty IDs from user_sections
      const facultyIds = [...new Set(semesterUserSections.map(us => us.userId))];
      
      // Get section IDs that have assignments
      const allTermAssignments = allAssignments.filter(ac => allSectionIds.includes(ac.sectionId));
      const sectionIdsWithAssignments = [...new Set(allTermAssignments.map(ac => ac.sectionId))];
      
      // Find faculty who have at least one section with assignments
      // Get user_sections for sections that have assignments
      const userSectionsWithAssignments = semesterUserSections.filter(us => sectionIdsWithAssignments.includes(us.sectionId));
      const facultyWithAssignmentsSet = new Set(userSectionsWithAssignments.map(us => us.userId));
      
      // Faculty with assignments = count of unique faculty who have at least one assignment
      facultyWithAssignments.value = facultyWithAssignmentsSet.size;
      
      // Faculty with no assignments = total faculty - faculty with assignments
      facultyWithNoAssignments.value = facultyIds.length - facultyWithAssignmentsSet.size;
    }
  } catch (error) {
    console.error("Error calculating stats:", error);
    totalSections.value = 0;
    totalAssignments.value = 0;
    facultyWithNoAssignments.value = 0;
    facultyWithAssignments.value = 0;
  }
};

onMounted(() => {
  retrieveSemesters();
  retrieveUsers();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Course Migration</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Select Semester and Faculty</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedSemester"
                :items="semesters"
                item-title="name"
                item-value="id"
                label="Semester"
                @update:model-value="retrieveCourses"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedFaculty"
                :items="users"
                item-title="fullName"
                item-value="id"
                label="Faculty (optional)"
                clearable
                @update:model-value="retrieveCourses"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <br />

      <v-row v-if="selectedSemester">
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Total Sections</v-card-title>
            <v-card-text>
              <h2>{{ totalSections }}</h2>
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
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Faculty with Assignments</v-card-title>
            <v-card-text>
              <h2>{{ facultyWithAssignments }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card>
            <v-card-title>Faculty with No Assignments</v-card-title>
            <v-card-text>
              <h2>{{ facultyWithNoAssignments }}</h2>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <br v-if="selectedSemester" />

      <v-card v-if="selectedSemester">
        <v-card-title>
          <span>Courses for Selected Semester</span>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            @click="exportAssignedCourses"
          >
            Export Assigned Courses
          </v-btn>
        </v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">Course Number</th>
              <th class="text-left">Section</th>
              <th class="text-left">Description</th>
              <th class="text-left">Status</th>
              <th class="text-left">Assignment Count</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in courses" :key="course.id">
              <td>{{ course.courseNumber }}</td>
              <td>{{ course.courseSection }}</td>
              <td>{{ course.courseDescription }}</td>
              <td>{{ course.assignedCourse ? "Assigned" : "Not Assigned" }}</td>
              <td>{{ course.assignedCourse ? 1 : 0 }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-container>
  </div>
</template>
