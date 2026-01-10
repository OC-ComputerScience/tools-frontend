import apiClient from "./services.js";

export default {
  getAllMeetingTimes(params = {}) {
    return apiClient.get("meetingTimes", { params });
  },
  getMeetingTimeBySectionId(sectionId) {
    return apiClient.get(`meetingTimes/section/${sectionId}`);
  },
  getMeetingTime(id) {
    return apiClient.get(`meetingTimes/${id}`);
  },
  createMeetingTime(meetingTime) {
    return apiClient.post("meetingTimes", meetingTime);
  },
  updateMeetingTime(id, meetingTime) {
    return apiClient.put(`meetingTimes/${id}`, meetingTime);
  },
  deleteMeetingTime(id) {
    return apiClient.delete(`meetingTimes/${id}`);
  },
  deleteMeetingTimeBySectionId(sectionId) {
    return apiClient.delete(`meetingTimes/section/${sectionId}`);
  },
  importMeetingTimesCSV(file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("meetingTimes/import", formData);
  },
};

