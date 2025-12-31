import { createRouter, createWebHistory } from "vue-router";

import Login from "./views/Login.vue";
import FacultyCoursesList from "./views/FacultyCoursesList.vue";
import AdminDashboard from "./views/AdminDashboard.vue";
import AdminImport from "./views/AdminImport.vue";
import AdminTermsList from "./views/AdminTermsList.vue";
import AdminUsersList from "./views/AdminUsersList.vue";
import AdminCoursesList from "./views/AdminCoursesList.vue";
import AdminRolesList from "./views/AdminRolesList.vue";
import AdminMenuOptionsList from "./views/AdminMenuOptionsList.vue";
import ScheduleView from "./views/ScheduleView.vue";
import SemesterPlanView from "./views/SemesterPlanView.vue";

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
      path: "/faculty/courses",
      name: "facultyCourses",
      component: FacultyCoursesList,
    },
    {
      path: "/admin",
      name: "adminDashboard",
      component: AdminDashboard,
    },
    {
      path: "/admin/import",
      name: "adminImport",
      component: AdminImport,
    },
    {
      path: "/admin/terms",
      name: "adminTerms",
      component: AdminTermsList,
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
      path: "/schedule",
      name: "schedule",
      component: ScheduleView,
    },
    {
      path: "/semester-plan",
      name: "semesterPlan",
      component: SemesterPlanView,
    },
  ],
});

export default router;

