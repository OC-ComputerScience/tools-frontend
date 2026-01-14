import apiClient from "./services.js";

export default {
  uploadTranscript(file, transcriptId) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("transcriptId", transcriptId);

    return apiClient.post("/transcript/transcript/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  processOCR(transcriptId) {
    return apiClient.get(`/transcript/transcript/ocr/${transcriptId}`);
  }
}; 