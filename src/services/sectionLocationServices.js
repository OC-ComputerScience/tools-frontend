import apiClient from "./services.js";

export default {
  getAllSectionLocations(params = {}) {
    return apiClient.get("sectionLocations", { params });
  },
  getSectionLocationsBySectionId(sectionId) {
    return apiClient.get(`sectionLocations/section/${sectionId}`);
  },
  getSectionLocation(id) {
    return apiClient.get(`sectionLocations/${id}`);
  },
  createSectionLocation(sectionLocation) {
    return apiClient.post("sectionLocations", sectionLocation);
  },
  updateSectionLocation(id, sectionLocation) {
    return apiClient.put(`sectionLocations/${id}`, sectionLocation);
  },
  deleteSectionLocation(id) {
    return apiClient.delete(`sectionLocations/${id}`);
  },
  deleteSectionLocationsBySectionId(sectionId) {
    return apiClient.delete(`sectionLocations/section/${sectionId}`);
  },
  importSectionLocationsCSV(file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("sectionLocations/import", formData);
  },
};
