<script setup>
import SectionServices from "../services/sectionServices";
import SemesterServices from "../services/semesterServices";
import AssignedCourseServices from "../services/assignedCourseServices";
import UserServices from "../services/userServices";
import UserSectionServices from "../services/userSectionServices";
import { ref, computed, onMounted } from "vue";

const ITEMS_PER_PAGE = 25;

const courses = ref([]);
const currentPage = ref(1);
const itemsPerPage = ref(ITEMS_PER_PAGE);
const semesters = ref([]);
const users = ref([]);
const selectedSemester = ref(null);
const selectedFaculty = ref(null);
const message = ref("Select a semester to view courses");
const totalSections = ref(0);
const totalAssignments = ref(0);
const facultyWithNoAssignments = ref(0);
const facultyWithAssignments = ref(0);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(courses.value.length / itemsPerPage.value))
);

const paginatedCourses = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return courses.value.slice(start, start + itemsPerPage.value);
});

const retrieveSemesters = () => {
  SemesterServices.getAll()
    .then((response) => {
      semesters.value = response.data.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
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
  try {
    // Get ALL sections with assigned courses (no semester filter)
    const allSectionsResponse = await SectionServices.getSectionsWithCount({});
    const sections = allSectionsResponse.data || [];

    // Build export list: all assigned courses with notAssignmentNeeded=false, assignedSectionId, and !exported
    const toExport = [];
    sections.forEach((section) => {
      const assignedList = Array.isArray(section.assignedCourse) ? section.assignedCourse : (section.assignedCourse ? [section.assignedCourse] : []);
      assignedList.forEach((ac) => {
        if (!ac.notAssignmentNeeded && ac.assignedSectionId != null && ac.assignedSectionId !== '' && !ac.exported && ac.assignedSection) {
          toExport.push({ section, assignedCourse: ac, assignedSection: ac.assignedSection });
        }
      });
    });

    if (toExport.length === 0) {
      alert("No unexported assigned courses with a source course to export");
      return;
    }

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvRows = [['course_id', 'export_filename', 'term_id', 'short_name', 'long_name', 'accountId'].join(',')];
    const exportedAssignedCourseIds = [];

    toExport.forEach(({ section, assignedCourse, assignedSection }) => {
      const sectionSemester = section.semester || { name: '' };
      const assignedSectionSemester = assignedSection.semester || { name: '' };

      const courseId = `${sectionSemester.name}_${section.courseNumber}_${section.courseSection}`;
      const exportFilename = `ArchiveFile_${assignedSectionSemester.name}_${assignedSection.courseNumber}-${assignedSection.courseSection}.zip`;
      const semesterId = sectionSemester.name;
      const shortName = `${section.courseNumber}-${section.courseSection}`;
      const longName = section.courseDescription || '';

      csvRows.push([
        escapeCsvValue(courseId),
        escapeCsvValue(exportFilename),
        escapeCsvValue(semesterId),
        escapeCsvValue(shortName),
        escapeCsvValue(longName),
        escapeCsvValue(section.accountId || '')
      ].join(','));
      exportedAssignedCourseIds.push(assignedCourse.id);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'canvas_migration_assigned_courses.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await Promise.all(
      exportedAssignedCourseIds.map((acId) =>
        AssignedCourseServices.updateAssignedCourse(acId, { exported: true, exportedDate: today })
      )
    );
    if (selectedSemester.value) await retrieveCourses();
    await loadGlobalStats();
  } catch (error) {
    console.error('Error exporting assigned courses:', error);
    alert('Error exporting assigned courses. Please check the console for details.');
  }
};

const exportCanvasCourses = async () => {
  try {
    // Get all assigned courses with notAssignmentNeeded=false and !coursesExported (no semester filter)
    const allAssignedCoursesResponse = await AssignedCourseServices.getAllAssignedCourses({});
    const allAssignedCourses = allAssignedCoursesResponse.data || [];
    const toExport = allAssignedCourses.filter(
      ac => !ac.notAssignmentNeeded && !ac.coursesExported
    );

    if (toExport.length === 0) {
      alert("No assigned courses found that have not been exported as courses");
      return;
    }

    // Get all sections (with semester) for the section IDs we need
    const sectionIds = [...new Set(toExport.map(ac => ac.sectionId))];
    const sectionsResponse = await SectionServices.getAllSections({});
    const allSections = sectionsResponse.data || [];
    const sections = allSections.filter(s => sectionIds.includes(s.id));
    const sectionMap = new Map(sections.map(s => [s.id, s]));

    // Get user_sections for enrollment data
    const allUserSectionsResponse = await UserSectionServices.getAll();
    const allUserSections = allUserSectionsResponse.data || [];
    const sectionToUserIdMap = new Map();
    allUserSections.filter(us => sectionIds.includes(us.sectionId)).forEach(us => {
      if (!sectionToUserIdMap.has(us.sectionId)) {
        sectionToUserIdMap.set(us.sectionId, []);
      }
      sectionToUserIdMap.get(us.sectionId).push(us.userId);
    });

    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const coursesCsvRows = [['course_id', 'short_name', 'long_name', 'term_id', 'status', 'account_id', 'start_date', 'end_date'].join(',')];
    const enrollmentsCsvRows = [['course_id', 'user_id', 'role', 'section_id', 'status'].join(',')];

    toExport.forEach((assignedCourse) => {
      const section = sectionMap.get(assignedCourse.sectionId);
      if (!section) return;

      const sectionSemester = section.semester || { name: '', startDate: null, endDate: null };
      const courseId = `${sectionSemester.name}_${section.courseNumber}_${section.courseSection}`;

      coursesCsvRows.push([
        escapeCsvValue(courseId),
        escapeCsvValue(section.courseNumber || ''),
        escapeCsvValue(section.courseDescription || ''),
        escapeCsvValue(sectionSemester.name),
        escapeCsvValue('active'),
        escapeCsvValue(section.accountId || ''),
        escapeCsvValue(formatDate(sectionSemester.startDate)),
        escapeCsvValue(formatDate(sectionSemester.endDate))
      ].join(','));

      const userIds = sectionToUserIdMap.get(section.id) || [];
      userIds.forEach(userId => {
        enrollmentsCsvRows.push([
          escapeCsvValue(courseId),
          escapeCsvValue(userId),
          escapeCsvValue('teacher'),
          escapeCsvValue(''),
          escapeCsvValue('active')
        ].join(','));
      });
    });

    const coursesBlob = new Blob([coursesCsvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const coursesLink = document.createElement('a');
    coursesLink.setAttribute('href', URL.createObjectURL(coursesBlob));
    coursesLink.setAttribute('download', 'courses.csv');
    coursesLink.style.visibility = 'hidden';
    document.body.appendChild(coursesLink);
    coursesLink.click();
    document.body.removeChild(coursesLink);

    const enrollmentsBlob = new Blob([enrollmentsCsvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const enrollmentsLink = document.createElement('a');
    enrollmentsLink.setAttribute('href', URL.createObjectURL(enrollmentsBlob));
    enrollmentsLink.setAttribute('download', 'enrollments.csv');
    enrollmentsLink.style.visibility = 'hidden';
    document.body.appendChild(enrollmentsLink);
    enrollmentsLink.click();
    document.body.removeChild(enrollmentsLink);

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await Promise.all(
      toExport.map((ac) =>
        AssignedCourseServices.updateAssignedCourse(ac.id, {
          coursesExported: true,
          coursesExportedDate: today,
        })
      )
    );
    if (selectedSemester.value) await retrieveCourses();
    await loadGlobalStats();
  } catch (error) {
    console.error('Error exporting Canvas courses:', error);
    alert('Error exporting Canvas courses. Please check the console for details.');
  }
};

const loadGlobalStats = async () => {
  try {
    const [allSectionsResponse, allAssignmentsResponse] = await Promise.all([
      SectionServices.getAllSections({}),
      AssignedCourseServices.getAllAssignedCourses({})
    ]);
    const allSections = allSectionsResponse.data || [];
    const allAssignments = allAssignmentsResponse.data || [];

    totalSections.value = allSections.length;
    totalAssignments.value = allAssignments.filter((ac) => !ac.notAssignmentNeeded).length;

    try {
      const facultyStatsResponse = await UserSectionServices.getFacultyStats();
      const facultyStats = facultyStatsResponse.data || {};
      facultyWithAssignments.value = facultyStats.facultyWithAssignments ?? 0;
      facultyWithNoAssignments.value = facultyStats.facultyWithNoAssignments ?? 0;
    } catch (facultyError) {
      console.warn("Faculty stats endpoint failed, using fallback:", facultyError);
      const allUserSectionsResponse = await UserSectionServices.getAll();
      const allUserSections = allUserSectionsResponse.data || [];
      const allSectionIds = new Set(allSections.map((s) => Number(s.id)));
      const assignmentsToCount = allAssignments.filter((ac) => !ac.notAssignmentNeeded);
      const sectionIdsWithAssignments = new Set(assignmentsToCount.map((ac) => Number(ac.sectionId)));
      const getUserId = (us) => us.userId ?? us.user?.id;
      const facultyIds = new Set(
        allUserSections
          .filter((us) => allSectionIds.has(Number(us.sectionId ?? us.section?.id)))
          .map(getUserId)
          .filter((id) => id != null)
          .map((id) => Number(id))
      );
      const facultyWithAssignmentsSet = new Set(
        allUserSections
          .filter((us) => {
            const sid = Number(us.sectionId ?? us.section?.id);
            return !isNaN(sid) && sectionIdsWithAssignments.has(sid);
          })
          .map(getUserId)
          .filter((id) => id != null)
          .map((id) => Number(id))
      );
      facultyWithAssignments.value = facultyWithAssignmentsSet.size;
      facultyWithNoAssignments.value = facultyIds.size - facultyWithAssignmentsSet.size;
    }
  } catch (error) {
    console.error("Error loading global stats:", error);
    totalSections.value = 0;
    totalAssignments.value = 0;
    facultyWithNoAssignments.value = 0;
    facultyWithAssignments.value = 0;
  }
};

const retrieveCourses = async () => {
  if (!selectedSemester.value) {
    courses.value = [];
    currentPage.value = 1;
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

    // Filter to only courses that have an assignment with notAssignmentNeeded = false
    const hasCountedAssignment = (c) => {
      const list = Array.isArray(c.assignedCourse) ? c.assignedCourse : (c.assignedCourse ? [c.assignedCourse] : []);
      return list.some((ac) => !ac.notAssignmentNeeded);
    };
    allSections = allSections.filter(hasCountedAssignment);

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
    currentPage.value = 1;
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading courses";
  }
};

onMounted(async () => {
  retrieveSemesters();
  retrieveUsers();
  await loadGlobalStats();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Course Migration</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          @click="exportAssignedCourses"
          class="mr-2"
        >
          Export Assigned Courses
        </v-btn>
        <v-btn
          color="primary"
          @click="exportCanvasCourses"
        >
          Export Canvas Courses
        </v-btn>
      </v-toolbar>
      <br />

      <v-row>
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

      <v-card v-if="selectedSemester">
        <v-card-title>
          <span>Courses for Selected Semester</span>
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
              <th class="text-left">Faculty Last Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in paginatedCourses" :key="course.id">
              <td>{{ course.courseNumber }}</td>
              <td>{{ course.courseSection }}</td>
              <td>{{ course.courseDescription }}</td>
              <td>{{ (Array.isArray(course.assignedCourse) ? course.assignedCourse.length > 0 : !!course.assignedCourse) ? "Assigned" : "Not Assigned" }}</td>
              <td>{{ selectedFaculty ? (users.find(u => u.id === selectedFaculty)?.lName ?? '') : (course.facultyLastNames || course.user?.lName || '') }}</td>
            </tr>
          </tbody>
        </v-table>
        <v-pagination
          v-if="courses.length > itemsPerPage"
          v-model="currentPage"
          :length="totalPages"
          :total-visible="7"
          class="pa-4"
        ></v-pagination>
        <div v-if="courses.length > 0" class="pa-3 text-caption text-medium-emphasis">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, courses.length) }} of {{ courses.length }} courses
        </div>
      </v-card>
    </v-container>
  </div>
</template>
