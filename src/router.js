import { createRouter, createWebHistory } from "vue-router";

import Login from "./views/Login.vue";
import FacultyCoursesList from "./views/FacultyCoursesList.vue";
import FacultyDashboard from "./views/FacultyDashboard.vue";
import AdminDashboard from "./views/AdminDashboard.vue";
import AdminImport from "./views/AdminImport.vue";
import AdminUsersList from "./views/AdminUsersList.vue";
import AdminCoursesList from "./views/AdminCoursesList.vue";
import AdminRolesList from "./views/AdminRolesList.vue";
import AdminMenuOptionsList from "./views/AdminMenuOptionsList.vue";
import AdminPrefixKeywordsList from "./views/AdminPrefixKeywordsList.vue";
import ScheduleView from "./views/ScheduleView.vue";
import SemesterPlanView from "./views/SemesterPlanView.vue";
import University from './views/University.vue';
import UniversityCourse from './views/UniversityCourse.vue';
import UniversityOutcome from './views/UniversityOutcome.vue';
import Department from './views/Department.vue';
import College from './views/College.vue';
import DepartmentOutcome from './views/DepartmentOutcome.vue';
import DepartmentAssessment from './views/DepartmentAssessment.vue';
import CoreAssessment from './views/CoreAssessment.vue';
import CollegeOutcome from './views/CollegeOutcome.vue';
import UniversityAssessment from './views/UniversityAssessment.vue';
import Assignment from './views/Assignment.vue';
import AssessmentScore from './views/AssessmentScore.vue';
import ImportCanvasGrades from './views/ImportCanvasGrades.vue';
import UniversityTranscript from './views/UniversityTranscript.vue';
import TranscriptCourse from './views/TranscriptCourse.vue';
import Semester from './views/Semester.vue';
import Catalog from './views/Catalog.vue';
import Course from './views/Course.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      alias: "/login",
      name: "login",
      component: Login,
    },
    {
      path: "/faculty",
      name: "facultyDashboard",
      component: FacultyDashboard,
    },
    {
      path: "/faculty/courses",
      name: "facultyCourses",
      component: FacultyCoursesList,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: AdminDashboard,
    },
    {
      path: "/admin",
      name: "adminDashboard",
      redirect: { name: "dashboard" },
    },
    {
      path: "/admin/import",
      name: "adminImport",
      component: AdminImport,
    },
    {
      path: "/admin/users",
      name: "adminUsers",
      component: AdminUsersList,
    },
    {
      path: "/admin/courses",
      name: "adminCourses",
      component: AdminCoursesList,
    },
    {
      path: "/admin/roles",
      name: "adminRoles",
      component: AdminRolesList,
    },
    {
      path: "/admin/menu-options",
      name: "adminMenuOptions",
      component: AdminMenuOptionsList,
    },
    {
      path: "/admin/prefix-keywords",
      name: "adminPrefixKeywords",
      component: AdminPrefixKeywordsList,
    },
    {
      path: "/schedule",
      name: "schedule",
      component: ScheduleView,
    },
    {
      path: "/semester-plan",
      name: "semesterPlan",
      component: SemesterPlanView,
    },
    {
      path: '/universities',
      name: 'Universities',
      component: University
    },
    {
      path: '/university-courses',
      name: 'University Courses',
      component: UniversityCourse
    },
    {
      path: '/university-outcomes',
      name: 'University Outcomes',
      component: UniversityOutcome
    },
    {
      path: '/departments',
      name: 'Departments',
      component: Department
    },
    {
      path: '/colleges',
      name: 'Colleges',
      component: College
    },
    {
      path: '/department-outcomes',
      name: 'Department Outcomes',
      component: DepartmentOutcome
    },
    {
      path: '/department-assessment',
      name: 'Department Assessment',
      component: DepartmentAssessment
    },
    {
      path: '/core-assessment',
      name: 'Core Assessment',
      component: CoreAssessment
    },
    {
      path: '/college-assessment',
      name: 'College Assessment',
      component: CollegeOutcome
    },
    {
      path: '/university-assessment',
      name: 'University Assessment',
      component: UniversityAssessment
    },
    {
      path: '/assignments',
      name: 'Assignments',
      component: Assignment
    },
    {
      path: '/assessment-scores',
      name: 'Assessment Scores',
      component: AssessmentScore
    },
    {
      path: '/import-canvas-grades',
      name: 'Import Canvas Grades',
      component: ImportCanvasGrades
    },
    {
      path: '/transcripts',
      name: 'Transcripts',
      component: UniversityTranscript
    },
    {
      path: '/transcript-courses/:id',
      name: 'Transcript Courses',
      component: TranscriptCourse,
      props: true
    },
    {
      path: '/semesters',
      name: 'Semesters',
      component: Semester
    },
    {
      path: '/catalogs',
      name: 'Catalogs',
      component: Catalog
    },
    {
      path: '/courses',
      name: 'Courses',
      component: Course
    }
  ],
});

export default router;

