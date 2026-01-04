import apiClient from "./services.js";
import Utils from "../config/utils.js";

export default {
  uploadTranscript(file, transcriptId) {
    console.log('Uploading file for transcript:', transcriptId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("transcriptId", transcriptId.toString());
    formData.append("filename", `transcript-${transcriptId}.pdf`);

    // Get auth token
    let user = Utils.getStore("user");
    let authHeader = "";
    if (user && user.token) {
      authHeader = "Bearer " + user.token;
    }

    return apiClient.post(`/transcript/upload/${transcriptId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "Accept": "application/json",
        "Authorization": authHeader
      },
      transformRequest: [(data) => data]
    });
  },

  processOCR(transcriptId) {
    return apiClient.get(`/transcript/ocr/${transcriptId}`);
  }
}; 