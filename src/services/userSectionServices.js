import apiClient from "./services.js";

const UserSectionServices = {
  // Create a new user-section assignment
  create: (data) => {
    return apiClient.post("userSections", data);
  },

  // Get all user-section assignments
  getAll: () => {
    return apiClient.get("userSections");
  },

  // Get all sections for a specific user
  getSectionsByUser: (userId) => {
    return apiClient.get(`userSections/user/${userId}`);
  },

  // Get all users for a specific section
  getUsersBySection: (sectionId) => {
    return apiClient.get(`userSections/section/${sectionId}`);
  },

  // Delete a user-section assignment by id
  delete: (id) => {
    return apiClient.delete(`userSections/${id}`);
  },

  // Delete a user-section assignment by userId and sectionId
  deleteByUserAndSection: (userId, sectionId) => {
    return apiClient.delete(`userSections/user/${userId}/section/${sectionId}`);
  },
  // Import user sections from CSV
  importCSV: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("userSections/import", formData);
  },
};

export default UserSectionServices;

