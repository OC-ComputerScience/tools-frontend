<script setup>
import UserServices from "../services/userServices";
import RoleServices from "../services/roleServices";
import { ref, onMounted, computed } from "vue";

const users = ref([]);
const roles = ref([]);
const message = ref("Manage Users");
const dialog = ref(false);
const editedUser = ref({});
const selectedRoleIds = ref([]);
const searchTerm = ref("");
const selectedRoleFilter = ref(null);
const importDialog = ref(false);
const importFile = ref(null);
const importResults = ref(null);
const importing = ref(false);

const retrieveUsers = () => {
  UserServices.getAllUsers()
    .then((response) => {
      users.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading users";
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

const openDialog = (user) => {
  editedUser.value = { ...user };
  // Extract role IDs from the user's roles array
  selectedRoleIds.value = user.roles
    ? user.roles.map((role) => role.id)
    : [];
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedUser.value = {};
  selectedRoleIds.value = [];
};

const saveUser = () => {
  // Extract only the fields we want to update, excluding roles array
  const { roles, ...userFields } = editedUser.value;
  
  // Include roleIds in the update request
  const userUpdate = {
    ...userFields,
    roleIds: selectedRoleIds.value,
  };
  
  UserServices.updateUser(editedUser.value.id, userUpdate)
    .then(() => {
      message.value = "User updated successfully";
      closeDialog();
      retrieveUsers();
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error updating user";
    });
};

// Filter users based on search term and role
const filteredUsers = computed(() => {
  let filtered = users.value;
  
  // Filter by name
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase().trim();
    filtered = filtered.filter((user) => {
      const fullName = `${user.fName} ${user.lName}`.toLowerCase();
      const firstName = user.fName?.toLowerCase() || "";
      const lastName = user.lName?.toLowerCase() || "";
      
      return (
        fullName.includes(term) ||
        firstName.includes(term) ||
        lastName.includes(term)
      );
    });
  }
  
  // Filter by role
  if (selectedRoleFilter.value) {
    filtered = filtered.filter((user) => {
      if (!user.roles || user.roles.length === 0) {
        return false; // User has no roles, exclude if filtering by role
      }
      return user.roles.some((role) => role.id === selectedRoleFilter.value);
    });
  }
  
  return filtered;
});

const openImportDialog = () => {
  importDialog.value = true;
  importFile.value = null;
  importResults.value = null;
};

const closeImportDialog = () => {
  importDialog.value = false;
  importFile.value = null;
  importResults.value = null;
};


const importUsers = async () => {
  if (!importFile.value) {
    message.value = "Please select a CSV file";
    return;
  }

  // Validate file extension
  if (!importFile.value.name || !importFile.value.name.endsWith('.csv')) {
    message.value = "Please select a CSV file";
    return;
  }

  importing.value = true;
  importResults.value = null;

  try {
    const response = await UserServices.importUsersCSV(importFile.value);
    importResults.value = {
      added: response.data.added || 0,
      updated: response.data.updated || 0,
      skipped: response.data.skipped || 0,
      errors: response.data.errors || [],
    };
    let statusMessage = `Import completed: ${importResults.value.added} added, ${importResults.value.updated} updated`;
    if (importResults.value.skipped > 0) {
      statusMessage += `, ${importResults.value.skipped} skipped`;
    }
    message.value = statusMessage;
    
    // Refresh user list
    await retrieveUsers();
  } catch (e) {
    message.value = e.response?.data?.message || "Error importing users";
    importResults.value = {
      added: 0,
      updated: 0,
      skipped: 0,
      errors: [e.response?.data?.message || "Unknown error"],
    };
  } finally {
    importing.value = false;
  }
};

onMounted(() => {
  retrieveUsers();
  retrieveRoles();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Users</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openImportDialog">
          <v-icon left>mdi-upload</v-icon>
          Import CSV
        </v-btn>
      </v-toolbar>
      <br />
      
      <v-card>
        <v-card-title>Users</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="searchTerm"
                label="Search by Name"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                clearable
                hide-details
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedRoleFilter"
                :items="roles"
                item-title="name"
                item-value="id"
                label="Filter by Role"
                variant="outlined"
                density="compact"
                clearable
                prepend-inner-icon="mdi-filter"
                hide-details
              ></v-select>
            </v-col>
          </v-row>
          <b class="mt-2 d-block">{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">First Name</th>
              <th class="text-left">Last Name</th>
              <th class="text-left">Email</th>
              <th class="text-left">Admin</th>
              <th class="text-left">Roles</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.fName }}</td>
              <td>{{ user.lName }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.isAdmin ? 'Yes' : 'No' }}</td>
              <td>
                <span v-if="user.roles && user.roles.length > 0">
                  {{ user.roles.map(r => r.name).join(', ') }}
                </span>
                <span v-else>None</span>
              </td>
              <td>
                <v-icon small class="mx-2" @click="openDialog(user)">
                  mdi-pencil
                </v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
      
      <!-- Edit Dialog -->
      <v-dialog v-model="dialog" max-width="600px">
        <v-card>
          <v-card-title>Edit User</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedUser.fName"
              label="First Name"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedUser.lName"
              label="Last Name"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedUser.email"
              label="Email"
              required
              disabled
            ></v-text-field>
            <v-checkbox
              v-model="editedUser.isAdmin"
              label="Admin"
            ></v-checkbox>
            <div class="mt-4">
              <div class="text-body-2 font-weight-medium mb-2">Roles</div>
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
            <v-btn color="primary" @click="saveUser">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Import CSV Dialog -->
      <v-dialog v-model="importDialog" max-width="600px">
        <v-card>
          <v-card-title>Import Users from CSV</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <p class="text-body-2">
                CSV file must contain columns: <strong>user_id</strong> (or id), <strong>first_name</strong> (or fname/firstName), 
                <strong>last_name</strong> (or lname/lastName), <strong>email</strong>
              </p>
              <p class="text-body-2 text-caption mt-2">
                If user_id exists, the user will be updated. If user_id doesn't exist or is empty, a new user will be created.
              </p>
              <p class="text-body-2 text-caption mt-2">
                <strong>Note:</strong> Records with email addresses containing "@eagles.oc.edu" will be skipped.
              </p>
            </div>
            
            <v-file-input
              v-model="importFile"
              label="Select CSV File"
              accept=".csv"
              prepend-icon="mdi-file-document"
              variant="outlined"
              show-size
            ></v-file-input>

            <div v-if="importResults" class="mt-4">
              <v-alert type="success" variant="tonal" class="mb-2">
                <div><strong>Users Added:</strong> {{ importResults.added }}</div>
                <div><strong>Users Updated:</strong> {{ importResults.updated }}</div>
                <div v-if="importResults.skipped > 0"><strong>Users Skipped:</strong> {{ importResults.skipped }} (emails containing @eagles.oc.edu)</div>
              </v-alert>
              
              <v-alert v-if="importResults.errors && importResults.errors.length > 0" type="warning" variant="tonal">
                <div><strong>Errors:</strong></div>
                <ul class="mt-2">
                  <li v-for="(error, index) in importResults.errors" :key="index">{{ error }}</li>
                </ul>
              </v-alert>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeImportDialog">Close</v-btn>
            <v-btn 
              color="primary" 
              @click="importUsers" 
              :disabled="!importFile || importing"
              :loading="importing"
            >
              Import
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

