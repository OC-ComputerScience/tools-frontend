import apiClient from "./services.js";

export default {
  getAllMeetingTimes(params = {}) {
    return apiClient.get("meetingTimes", { params });
  },
  getMeetingTimeByCourseId(courseId) {
    return apiClient.get(`meetingTimes/course/${courseId}`);
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
  deleteMeetingTimeByCourseId(courseId) {
    return apiClient.delete(`meetingTimes/course/${courseId}`);
  },
};
