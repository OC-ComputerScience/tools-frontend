<script setup>
import ocLogo from "/oc-logo-white.png";
import { ref, onMounted, computed, watch } from "vue";
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

// Get default route based on user
const defaultRoute = computed(() => {
  if (!user.value) return { name: "login" };
  return { name: "dashboard" };
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

onMounted(() => {
  logoURL.value = ocLogo;
  resetMenu();
});
</script>

<template>
  <div>
    <v-app-bar app>
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
      <v-spacer></v-spacer>
      <div v-if="user && accessibleMenuOptions.length > 0">
        <v-btn
          v-for="menuOption in accessibleMenuOptions"
          :key="menuOption.id"
          class="mx-2"
          :to="{ name: menuOption.routeName }"
        >
          {{ menuOption.option }}
        </v-btn>
      </div>
      <v-menu bottom min-width="200px" rounded offset-y v-if="user">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon x-large>
            <v-avatar v-if="user" color="secondary">
              <span class="accent--text font-weight-bold">{{ initials }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-card>
          <v-card-text>
            <div class="mx-auto text-center">
              <v-avatar color="secondary" class="mt-2 mb-2">
                <span class="accent--text font-weight-bold">{{
                  initials
                }}</span>
              </v-avatar>
              <h3>{{ name }}</h3>
              <p class="text-caption mt-1">
                {{ user.email }}
              </p>
              <p v-if="user.isAdmin" class="text-caption mt-1">Admin</p>
              <v-divider class="my-3"></v-divider>
              <v-btn depressed rounded text @click="logout"> Logout </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-menu>
    </v-app-bar>
  </div>
</template>
