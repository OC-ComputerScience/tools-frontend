<script setup>
import ocLogo from "/oc-logo-white.png";
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import Utils from "../config/utils";
import AuthServices from "../services/authServices";
import MenuOptionServices from "../services/menuOptionServices";
import UserServices from "../services/userServices";
import { useRouter } from "vue-router";

const router = useRouter();
const user = ref(null);
const title = ref("Tools");
const initials = ref("");
const name = ref("");
const logoURL = ref("");
const allMenuOptions = ref([]);
const menuOptionsEl = ref(null);
const barHeight = ref(64);
let menuObserver;

const resetMenu = async () => {
  user.value = null;
  user.value = Utils.getStore("user");
  if (user.value) {
    initials.value = user.value.fName[0] + user.value.lName[0];
    name.value = user.value.fName + " " + user.value.lName;
    
    // If user doesn't have roles, refresh user data
    if (!user.value.roles || !Array.isArray(user.value.roles)) {
      try {
        const response = await UserServices.getUser(user.value.id || user.value.userId);
        if (response.data && response.data.roles) {
          user.value = { ...user.value, roles: response.data.roles };
          Utils.setStore("user", user.value);
        }
      } catch (error) {
        console.error("Error refreshing user data:", error);
      }
    }
    
    loadMenuOptions();
  }
};

const loadMenuOptions = () => {
  if (!user.value || !user.value.roles || !Array.isArray(user.value.roles) || user.value.roles.length === 0) {
    return;
  }

  MenuOptionServices.getAllMenuOptions()
    .then((response) => {
      allMenuOptions.value = response.data || [];
    })
    .catch((error) => {
      console.error("Error loading menu options:", error);
      allMenuOptions.value = [];
    });
};

// Compute accessible menu options based on user roles
const accessibleMenuOptions = computed(() => {
  if (!user.value || !user.value.roles || !Array.isArray(user.value.roles) || user.value.roles.length === 0) {
    console.log("MenuBar: No user roles available", { user: user.value });
    return [];
  }

  if (allMenuOptions.value.length === 0) {
    console.log("MenuBar: No menu options loaded");
    return [];
  }

  const userRoleIds = user.value.roles.map((role) => role.id);
  console.log("MenuBar: User role IDs", userRoleIds);
  console.log("MenuBar: All menu options", allMenuOptions.value);

  // Filter menu options that have at least one role matching user's roles
  const accessible = allMenuOptions.value.filter((menuOption) => {
    if (!menuOption.roles || menuOption.roles.length === 0) {
      return false; // Menu option with no roles is not accessible
    }
    const hasAccess = menuOption.roles.some((role) => userRoleIds.includes(role.id));
    if (hasAccess) {
      console.log("MenuBar: Accessible menu option", menuOption.option, "with roles", menuOption.roles.map(r => r.name));
    }
    return hasAccess;
  });

  console.log("MenuBar: Accessible menu options count", accessible.length);

  // Sort alphabetically by option name
  return accessible.sort((a, b) => {
    return a.option.localeCompare(b.option);
  });
});

const syncBarHeight = () => {
  const menu = menuOptionsEl.value;
  if (!menu) {
    barHeight.value = 64;
    return;
  }
  const next = Math.max(64, menu.scrollHeight + 16);
  if (next !== barHeight.value) barHeight.value = next;
};

const menuLink = (menuOption) => {
  if (menuOption.routeName && router.hasRoute(menuOption.routeName)) {
    return { to: { name: menuOption.routeName } };
  }
  return {};
};

// Check if user is Admin
const isAdminUser = computed(() => {
  if (!user.value) return false;
  if (user.value.isAdmin === true) return true;
  if (user.value.roles && Array.isArray(user.value.roles)) {
    return user.value.roles.some(
      (role) =>
        role.id === 1 ||
        (role.name || "").toLowerCase() === "admin"
    );
  }
  return false;
});

const isDeanUser = computed(() => {
  if (!user.value?.roles || !Array.isArray(user.value.roles)) return false;
  return user.value.roles.some((role) => (role.name || "").toLowerCase() === "dean");
});

// Admin -> dashboard, Dean -> deanDashboard, Faculty -> facultyDashboard
const defaultRoute = computed(() => {
  if (!user.value) return { name: "login" };
  if (isAdminUser.value) return { name: "dashboard" };
  if (isDeanUser.value) return { name: "deanDashboard" };
  return { name: "facultyDashboard" };
});

const logout = () => {
  AuthServices.logoutUser(user.value)
    .then((response) => {
      Utils.removeItem("user");
      router.push({ name: "login" });
    })
    .catch((error) => {
      console.log("error", error);
    });
};

// Watch for user changes to reload menu options
watch(() => user.value, () => {
  if (user.value) {
    loadMenuOptions();
  }
});

watch(menuOptionsEl, (el) => {
  menuObserver?.disconnect();
  if (!el) {
    barHeight.value = 64;
    return;
  }
  menuObserver = new ResizeObserver(() => syncBarHeight());
  menuObserver.observe(el);
  syncBarHeight();
});

watch(accessibleMenuOptions, () => nextTick(syncBarHeight));

onMounted(() => {
  logoURL.value = ocLogo;
  resetMenu();
});

onBeforeUnmount(() => {
  menuObserver?.disconnect();
});
</script>

<template>
  <div>
    <v-app-bar class="app-menu-bar" :height="barHeight">
      <router-link :to="defaultRoute">
        <v-img
          class="mx-2"
          :src="logoURL"
          height="50"
          width="50"
          contain
        ></v-img>
      </router-link>
      <v-toolbar-title class="title">
        {{ title }}
      </v-toolbar-title>
      <div
        v-if="user && accessibleMenuOptions.length > 0"
        ref="menuOptionsEl"
        class="menu-options"
      >
        <v-btn
          v-for="menuOption in accessibleMenuOptions"
          :key="menuOption.id"
          class="mx-2"
          v-bind="menuLink(menuOption)"
        >
          {{ menuOption.option }}
        </v-btn>
      </div>
      <v-menu bottom min-width="200px" offset-y v-if="user">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon class="profile-button" color="primary">
            <v-avatar v-if="user" class="profile-button" color="primary">
              <span class="profile-initials">{{ initials }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-card>
          <v-card-text>
            <div class="mx-auto text-center">
              <v-avatar class="profile-button mt-2 mb-2" color="primary">
                <span class="profile-initials">{{ initials }}</span>
              </v-avatar>
              <h3>{{ name }}</h3>
              <p class="text-caption mt-1">
                {{ user.email }}
              </p>
              <p v-if="user.isAdmin" class="text-caption mt-1">Admin</p>
              <v-divider class="my-3"></v-divider>
              <v-btn depressed text @click="logout"> Logout </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-menu>
    </v-app-bar>
  </div>
</template>

<style>
.app-menu-bar .v-toolbar__content {
  overflow: visible !important;
  height: auto !important;
  align-items: center;
}

.app-menu-bar .v-toolbar-title {
  flex: 0 0 auto;
  font-family: "Standard CT", "StandardCT", sans-serif;
  font-size: 28px !important;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: uppercase;
}

.menu-options {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  align-self: flex-start;
  min-width: 0;
  row-gap: 4px;
}

.menu-options .v-btn {
  font-weight: 700;
}

.v-app-bar .profile-button.v-btn,
.v-avatar.profile-button {
  border-radius: 50% !important;
  background-color: #811429 !important;
  color: #ffffff !important;
}

.profile-initials {
  color: #ffffff !important;
  font-weight: 700;
}
</style>
