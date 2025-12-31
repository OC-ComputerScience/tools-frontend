<script setup>
import RoleServices from "../services/roleServices";
import { ref, onMounted } from "vue";

const roles = ref([]);
const message = ref("Manage Roles");
const dialog = ref(false);
const editedRole = ref({});
const defaultRole = ref({ name: "", description: "" });

const retrieveRoles = () => {
  RoleServices.getAllRoles()
    .then((response) => {
      roles.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading roles";
    });
};

const openDialog = (role = null) => {
  editedRole.value = role ? { ...role } : { ...defaultRole.value };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedRole.value = { ...defaultRole.value };
};

const saveRole = () => {
  if (!editedRole.value.name || !editedRole.value.description) {
    message.value = "Name and description are required";
    return;
  }

  if (editedRole.value.id) {
    RoleServices.updateRole(editedRole.value.id, editedRole.value)
      .then(() => {
        message.value = "Role updated successfully";
        closeDialog();
        retrieveRoles();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error updating role";
      });
  } else {
    RoleServices.createRole(editedRole.value)
      .then(() => {
        message.value = "Role created successfully";
        closeDialog();
        retrieveRoles();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error creating role";
      });
  }
};

const deleteRole = (role) => {
  if (confirm(`Are you sure you want to delete ${role.name}?`)) {
    RoleServices.deleteRole(role.id)
      .then(() => {
        message.value = "Role deleted successfully";
        retrieveRoles();
      })
      .catch((e) => {
        message.value = e.response?.data?.message || "Error deleting role";
      });
  }
};

onMounted(() => {
  retrieveRoles();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Roles</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">Add Role</v-btn>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Roles</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">Name</th>
              <th class="text-left">Description</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td>{{ role.id }}</td>
              <td>{{ role.name }}</td>
              <td>{{ role.description }}</td>
              <td>
                <v-icon small class="mx-2" @click="openDialog(role)">
                  mdi-pencil
                </v-icon>
                <v-icon small class="mx-2" @click="deleteRole(role)">
                  mdi-trash-can
                </v-icon>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Edit/Create Dialog -->
      <v-dialog v-model="dialog" max-width="500px">
        <v-card>
          <v-card-title>
            {{ editedRole.id ? "Edit Role" : "Create Role" }}
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editedRole.name"
              label="Name"
              required
            ></v-text-field>
            <v-text-field
              v-model="editedRole.description"
              label="Description"
              required
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" @click="saveRole">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

