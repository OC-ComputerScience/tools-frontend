<script setup>
import MenuOptionServices from "../services/menuOptionServices";
import RoleServices from "../services/roleServices";
import { ref, onMounted } from "vue";

const menuOptions = ref([]);
const roles = ref([]);
const message = ref("Manage Menu Options");
const dialog = ref(false);
const editedMenuOption = ref({});
const selectedRoleIds = ref([]);
const defaultMenuOption = ref({ option: "", routeName: "" });

const retrieveMenuOptions = () => {
  MenuOptionServices.getAllMenuOptions()
    .then((response) => {
      menuOptions.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading menu options";
    });
};

const retrieveRoles = () => {
  RoleServices.getAllRoles()
    .then((response) => {
      roles.value = response.data;
    })
    .catch((e) => {
      console.error("Error loading roles:", e);
    });
};

const openDialog = (menuOption = null) => {
  editedMenuOption.value = menuOption ? { ...menuOption } : { ...defaultMenuOption.value };
  // Extract role IDs from the menuOption's roles array
  selectedRoleIds.value = menuOption && menuOption.roles
    ? menuOption.roles.map((role) => role.id)
    : [];
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedMenuOption.value = { ...defaultMenuOption.value };
  selectedRoleIds.value = [];
};

const saveMenuOption = () => {
  if (!editedMenuOption.value.option || !editedMenuOption.value.routeName) {
    message.value = "Option and route name are required";
    return;
  }

  // Extract only the fields we want to update, excluding roles array
  const { roles, ...menuOptionFields } = editedMenuOption.value;
  
  // Include roleIds in the update request
  const menuOptionUpdate = {
    ...menuOptionFields,
    roleIds: selectedRoleIds.value,
  };

  if (editedMenuOption.value.id) {
    MenuOptionServices.updateMenuOption(editedMenuOption.value.id, menuOptionUpdate)
      .then(() => {
        message.value = "Menu option updated successfully";
        closeDialog();
        retrieveMenuOptions();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error updating menu option";
      });
  } else {
    // For create, we don't need roleIds in the initial create, handle separately if needed
    const createData = {
      option: menuOptionFields.option,
      routeName: menuOptionFields.routeName,
    };
    
    MenuOptionServices.createMenuOption(createData)
      .then((response) => {
        // If roles are selected, update the newly created menu option with roles
        if (selectedRoleIds.value.length > 0 && response.data.id) {
          const updateWithRoles = {
            ...createData,
            roleIds: selectedRoleIds.value,
          };
          return MenuOptionServices.updateMenuOption(response.data.id, updateWithRoles);
        }
        return Promise.resolve(response);
      })
      .then(() => {
        message.value = "Menu option created successfully";
        closeDialog();
        retrieveMenuOptions();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error creating menu option";
      });
  }
};

const deleteMenuOption = (menuOption) => {
  if (confirm(`Are you sure you want to delete ${menuOption.option}?`)) {
    MenuOptionServices.deleteMenuOption(menuOption.id)
      .then(() => {
        message.value = "Menu option deleted successfully";
        retrieveMenuOptions();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error deleting menu option";
      });
  }
};

onMounted(() => {
  retrieveMenuOptions();
  retrieveRoles();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Menu Options</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Menu Option</v-btn>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Menu Options</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">Option</th>
              <th class="text-left">Route Name</th>
              <th class="text-left">Roles</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="menuOption in menuOptions" :key="menuOption.id">
              <td>{{ menuOption.id }}</td>
              <td>{{ menuOption.option }}</td>
              <td>{{ menuOption.routeName }}</td>
              <td>
                <span v-if="menuOption.roles && menuOption.roles.length > 0">
                  {{ menuOption.roles.map(r => r.name).join(', ') }}
                </span>
                <span v-else>None</span>
              </td>
              <td>
                <v-icon small class="mx-2" @click="openDialog(menuOption)">
                  mdi-pencil
                </v-icon>
                <v-icon small class="mx-2" @click="deleteMenuOption(menuOption)">
                  mdi-trash-can
                </v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Edit/Create Dialog -->
      <v-dialog v-model="dialog" max-width="600px">
        <v-card>
          <v-card-title>
            {{ editedMenuOption.id ? "Edit Menu Option" : "Create Menu Option" }}
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedMenuOption.option"
              label="Option"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedMenuOption.routeName"
              label="Route Name"
              required
            ></v-text-field>
            <div class="mt-4">
              <div class="text-body-2 font-weight-medium mb-2">Assign Roles</div>
              <div style="max-height: 200px; overflow-y: auto;">
                <v-checkbox
                  v-for="role in roles"
                  :key="role.id"
                  v-model="selectedRoleIds"
                  :value="role.id"
                  :label="`${role.name} - ${role.description}`"
                  density="compact"
                  hide-details
                ></v-checkbox>
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" @click="saveMenuOption">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

