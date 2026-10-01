import apiClient from "./services.js";

const dateKey = (value) => {
  const match = String(value ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : "";
};

export const sortSemestersByDateDesc = (semesters) =>
  [...(semesters || [])].sort((a, b) => {
    const startCompare = dateKey(b.startDate).localeCompare(dateKey(a.startDate));
    if (startCompare) return startCompare;
    return dateKey(b.endDate).localeCompare(dateKey(a.endDate));
  });

export default {
  sortSemestersByDateDesc,
  getAll() {
    return apiClient.get(`/semesters`).then((response) => {
      if (Array.isArray(response.data)) {
        response.data = sortSemestersByDateDesc(response.data);
      }
      return response;
    });
  },
  get(id) {
    return apiClient.get(`/semesters/${id}`);
  },
  create(data) {
    return apiClient.post(`/semesters`, data);
  },
  update(id, data) {
    return apiClient.put(`/semesters/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/semesters/${id}`);
  },
}; 