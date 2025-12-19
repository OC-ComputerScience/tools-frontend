<script setup>
import UserServices from "../services/userServices";
import { ref, onMounted } from "vue";

const users = ref([]);
const message = ref("Manage Users");
const dialog = ref(false);
const editedUser = ref({});

const retrieveUsers = () => {
  UserServices.getAllUsers()
    .then((response) => {
      users.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading users";
    });
};

const openDialog = (user) => {
  editedUser.value = { ...user };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editedUser.value = {};
};

const saveUser = () => {
  UserServices.updateUser(editedUser.value.id, editedUser.value)
    .then(() => {
      message.value = "User updated successfully";
      closeDialog();
      retrieveUsers();
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error updating user";
    });
};

onMounted(() => {
  retrieveUsers();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Manage Users</v-toolbar-title>
      </v-toolbar>
      <br />
      
      <v-card>
        <v-card-title>Users</v-card-title>
        <v-card-text>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left">ID</th>
              <th class="text-left">First Name</th>
              <th class="text-left">Last Name</th>
              <th class="text-left">Email</th>
              <th class="text-left">Admin</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.fName }}</td>
              <td>{{ user.lName }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.isAdmin ? 'Yes' : 'No' }}</td>
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
      <v-dialog v-model="dialog" max-width="500px">
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
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" @click="saveUser">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

