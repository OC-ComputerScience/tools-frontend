<script setup>
import { ref, onMounted, computed, watch } from "vue";
import TermServices from "../services/termServices";
import SectionServices from "../services/sectionServices";
import MeetingTimeServices from "../services/meetingTimeServices";
import UserServices from "../services/userServices";
import jsPDF from "jspdf";

const terms = ref([]);
const users = ref([]);
const selectedTerm = ref(null);
const selectedUser = ref(null);
const coursePrefix1 = ref("");
const coursePrefix2 = ref("");
const courses = ref([]);
const meetingTimes = ref([]);
const message = ref("Select a term and course prefix(es) to view schedule");
const uniquePrefixes = ref([]);
const showOfficeHoursDialog = ref(false);
const officeHours = ref([]);
const newOfficeHour = ref({
  days: [], // Array of selected days
  startTime: "",
  endTime: "",
  type: "Office Hours", // Default type
  name: "", // Optional custom name
});

// Color schemes for the two prefixes
const prefix1Color = {
  background: "#e3f2fd",
  border: "#2196f3",
};
const prefix2Color = {
  background: "#fff3e0",
  border: "#ff9800",
};

const daysOfWeek = [
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
];

const retrieveTerms = () => {
  TermServices.getAllTerms()
    .then((response) => {
      terms.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading terms";
    });
};

const retrieveUsers = () => {
  UserServices.getAllUsers()
    .then((response) => {
      users.value = response.data;
    })
    .catch((e) => {
      console.error("Error loading users:", e);
    });
};

const retrieveCourses = async () => {
  if (!selectedTerm.value) {
    courses.value = [];
    uniquePrefixes.value = [];
    meetingTimes.value = [];
    return;
  }

  try {
    const params = {
      termId: selectedTerm.value,
    };

    // Add userId filter if a user is selected
    if (selectedUser.value) {
      params.userId = selectedUser.value;
    }

    const response = await SectionServices.getAllSections(params);

    courses.value = response.data;

    // Extract unique course prefixes (first 4 characters)
    const prefixes = new Set();
    courses.value.forEach((course) => {
      if (course.courseNumber && course.courseNumber.length >= 4) {
        prefixes.add(course.courseNumber.substring(0, 4).toUpperCase());
      }
    });
    uniquePrefixes.value = Array.from(prefixes).sort();

    // If a prefix is selected or a user is selected, load meeting times
    if (coursePrefix1.value || coursePrefix2.value || selectedUser.value) {
      await loadMeetingTimes();
    } else {
      // Update message when courses are loaded but no prefixes or user selected
      message.value = `Loaded ${courses.value.length} course(s). Select course prefix(es) or a user to view schedule.`;
    }
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading courses";
  }
};

const loadMeetingTimes = async () => {
  if (!selectedTerm.value) {
    meetingTimes.value = [];
    message.value = "Select a term to view schedule";
    return;
  }

  // If user is selected, don't require prefix - show all courses for that user
  // Otherwise, require at least one prefix
  if (!selectedUser.value && !coursePrefix1.value && !coursePrefix2.value) {
    meetingTimes.value = [];
    message.value = "Select course prefix(es) or a user to view schedule";
    return;
  }

  // Filter courses by prefixes (if prefixes are selected)
  // If user is selected but no prefixes, show all courses for that user
  const filteredCourses = courses.value.filter((course) => {
    // If prefixes are selected, filter by prefixes
    if (coursePrefix1.value || coursePrefix2.value) {
      if (!course.courseNumber || course.courseNumber.length < 4) return false;
      const prefix = course.courseNumber.substring(0, 4).toUpperCase();
      return (
        (coursePrefix1.value && prefix === coursePrefix1.value.toUpperCase()) ||
        (coursePrefix2.value && prefix === coursePrefix2.value.toUpperCase())
      );
    }
    // If no prefixes but user is selected, show all courses
    return true;
  });

  if (filteredCourses.length === 0) {
    meetingTimes.value = [];
    if (selectedUser.value) {
      message.value = "No courses found for selected user";
    } else {
      message.value = "No courses found for selected prefix(es)";
    }
    return;
  }

  // Load meeting times for all filtered courses
  try {
    const allMeetingTimes = [];
    for (const course of filteredCourses) {
      try {
        const response = await MeetingTimeServices.getMeetingTimeBySectionId(
          course.id
        );
        if (response.data && Array.isArray(response.data)) {
          // Determine which prefix this course belongs to (if prefixes are selected)
          let prefixIndex = null;
          if (coursePrefix1.value || coursePrefix2.value) {
            const coursePrefix = course.courseNumber
              .substring(0, 4)
              .toUpperCase();
            if (
              coursePrefix1.value &&
              coursePrefix === coursePrefix1.value.toUpperCase()
            ) {
              prefixIndex = 1;
            } else if (
              coursePrefix2.value &&
              coursePrefix === coursePrefix2.value.toUpperCase()
            ) {
              prefixIndex = 2;
            }

            // Skip if course doesn't match any selected prefix
            if (!prefixIndex) continue;
          } else {
            // If no prefixes selected but user is selected, use default prefixIndex (1)
            prefixIndex = 1;
          }

          // Backend includes section data, but merge with our course to ensure user info is included
          response.data.forEach((mt) => {
            // Merge section data - prioritize user info from our course object
            const mergedSection = {
              ...(mt.section || {}),
              ...course,
              // Ensure user info is included from the course we fetched
              user: course.user || mt.section?.user,
            };
            allMeetingTimes.push({
              ...mt,
              section: mergedSection,
              prefixIndex: prefixIndex,
            });
          });
        }
      } catch (e) {
        // Course might not have meeting times, continue
        console.log(`No meeting times for course ${course.id}`);
      }
    }
    meetingTimes.value = allMeetingTimes;
    const prefix1Count = allMeetingTimes.filter(
      (mt) => mt.prefixIndex === 1
    ).length;
    const prefix2Count = allMeetingTimes.filter(
      (mt) => mt.prefixIndex === 2
    ).length;
    message.value = `Loaded ${allMeetingTimes.length} meeting time(s) for ${filteredCourses.length} course(s) (Prefix 1: ${prefix1Count}, Prefix 2: ${prefix2Count})`;
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading meeting times";
  }
};

// Watch for changes in selected term
watch(selectedTerm, () => {
  if (selectedTerm.value) {
    retrieveCourses();
  } else {
    courses.value = [];
    uniquePrefixes.value = [];
    meetingTimes.value = [];
    coursePrefix1.value = "";
    coursePrefix2.value = "";
    message.value = "Select a term and course prefix(es) to view schedule";
  }
});

// Watch for changes in selected user
watch(selectedUser, () => {
  if (selectedTerm.value) {
    retrieveCourses();
  } else {
    meetingTimes.value = [];
    message.value = "Select a term to view schedule";
  }
});

// Watch for changes in course prefixes
watch([coursePrefix1, coursePrefix2], () => {
  if (selectedTerm.value) {
    // If prefixes or user is selected, load meeting times
    if (coursePrefix1.value || coursePrefix2.value || selectedUser.value) {
      loadMeetingTimes();
    } else {
      meetingTimes.value = [];
      // Update message when prefixes are cleared
      if (courses.value.length > 0) {
        message.value = `Loaded ${courses.value.length} course(s). Select course prefix(es) or a user to view schedule.`;
      } else {
        message.value = "Select course prefix(es) or a user to view schedule";
      }
    }
  }
});

// Helper function to format time
const formatTime = (time) => {
  if (!time) return "";
  // Handle both "HH:MM:SS" and "HH:MM" formats
  const timeStr = time.toString();
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  return timeStr;
};

// Generate time slots (8 AM to 10 PM, in 30-minute increments)
// Only include slots that have meeting times
const timeSlots = computed(() => {
  const slots = [];
  for (let hour = 8; hour <= 22; hour++) {
    slots.push({ hour, minute: 0, display: formatHour(hour, 0) });
    if (hour < 22) {
      slots.push({ hour, minute: 30, display: formatHour(hour, 30) });
    }
  }

  // Filter to only include slots that have at least one meeting time in any day
  return slots.filter((slot) => {
    return daysOfWeek.some((day) => {
      const meetingsForSlot = getMeetingTimesForSlot(day.key, slot);
      return meetingsForSlot.length > 0;
    });
  });
});

// Computed property to determine if prefixes can be selected
// User selection is optional - prefixes are available when term is selected and courses are loaded
const prefixesEnabled = computed(() => {
  return selectedTerm.value && uniquePrefixes.value.length > 0;
});

// Helper function to format hour for display
const formatHour = (hour, minute) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHours = hour % 12 || 12;
  return `${displayHours}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

// Helper function to convert time string to minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(":");
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  return hours * 60 + minutes;
};

// Helper function to convert hour and minute to minutes since midnight
const slotToMinutes = (hour, minute) => {
  return hour * 60 + minute;
};

// Helper function to get meeting times for a specific day and time slot
// Only show meeting in the slot where it starts
const getMeetingTimesForSlot = (dayKey, slot) => {
  return meetingTimes.value.filter((mt) => {
    if (!mt[dayKey]) return false;

    const startMinutes = timeToMinutes(mt.startTime);
    const slotStartMinutes = slotToMinutes(slot.hour, slot.minute);
    const slotEndMinutes = slotStartMinutes + 30; // 30-minute slot

    // Show meeting only in the slot where it starts
    return startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes;
  });
};

// Helper function to get color for a meeting based on its prefix
const getMeetingColor = (mt) => {
  if (!mt || !mt.prefixIndex) return prefix1Color; // Default
  return mt.prefixIndex === 1 ? prefix1Color : prefix2Color;
};

// Helper function to convert hex color to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

// Function to open office hours dialog
const openPDFDialog = () => {
  if (
    !selectedUser.value ||
    !selectedTerm.value ||
    meetingTimes.value.length === 0
  ) {
    return;
  }
  // Reset office hours and new entry
  officeHours.value = [];
  newOfficeHour.value = {
    days: [],
    startTime: "",
    endTime: "",
    type: "Office Hours",
    name: "",
  };
  showOfficeHoursDialog.value = true;
};

// Function to add an office hour entry
const addOfficeHour = () => {
  if (
    !newOfficeHour.value.days ||
    newOfficeHour.value.days.length === 0 ||
    !newOfficeHour.value.startTime ||
    !newOfficeHour.value.endTime ||
    !newOfficeHour.value.type
  ) {
    return;
  }
  // Create a separate entry for each selected day
  newOfficeHour.value.days.forEach((day) => {
    officeHours.value.push({
      day: day,
      startTime: newOfficeHour.value.startTime,
      endTime: newOfficeHour.value.endTime,
      type: newOfficeHour.value.type,
      name: newOfficeHour.value.name,
    });
  });
  // Reset form
  newOfficeHour.value = {
    days: [],
    startTime: "",
    endTime: "",
    type: "Office Hours",
    name: "",
  };
};

// Function to remove an office hour entry
const removeOfficeHour = (index) => {
  officeHours.value.splice(index, 1);
};

// Function to generate PDF
const generatePDF = () => {
  if (
    !selectedUser.value ||
    !selectedTerm.value ||
    meetingTimes.value.length === 0
  ) {
    return;
  }

  // Close dialog
  showOfficeHoursDialog.value = false;

  // Get user and term information
  const selectedUserData = users.value.find((u) => u.id === selectedUser.value);
  const selectedTermData = terms.value.find((t) => t.id === selectedTerm.value);

  if (!selectedUserData || !selectedTermData) {
    return;
  }

  // Create PDF document (landscape orientation for schedule)
  const doc = new jsPDF("landscape", "mm", "a4");

  // Set font sizes
  const headingFontSize = 16;
  const subheadingFontSize = 12;
  const cellFontSize = 8;
  const timeFontSize = 7;

  // Get page width for centering (used for headings and table)
  const pageWidth = doc.internal.pageSize.getWidth();

  // Margins and spacing
  const margin = 10;
  const topMargin = 15;
  let yPos = topMargin;
  const rowHeight = 8;
  const colWidth = 35;
  const timeColWidth = 25;

  // Add heading (centered)
  doc.setFontSize(headingFontSize);
  doc.setFont(undefined, "bold");
  const userName = `${selectedUserData.fName} ${selectedUserData.lName}`;
  const userNameWidth = doc.getTextWidth(userName);
  doc.text(userName, (pageWidth - userNameWidth) / 2, yPos);
  yPos += 7;

  // Add term/subheading (centered)
  doc.setFontSize(subheadingFontSize);
  doc.setFont(undefined, "normal");
  const termText = `Term: ${selectedTermData.termName}`;
  const termWidth = doc.getTextWidth(termText);
  doc.text(termText, (pageWidth - termWidth) / 2, yPos);
  yPos += 10;

  // Create a color palette for courses
  const courseColors = [
    { background: "#e3f2fd", border: "#2196f3" }, // Blue
    { background: "#fff3e0", border: "#ff9800" }, // Orange
    { background: "#f3e5f5", border: "#9c27b0" }, // Purple
    { background: "#e8f5e9", border: "#4caf50" }, // Green
    { background: "#fce4ec", border: "#e91e63" }, // Pink
    { background: "#fff9c4", border: "#fbc02d" }, // Yellow
    { background: "#e0f2f1", border: "#009688" }, // Teal
    { background: "#fff8e1", border: "#ffc107" }, // Amber
    { background: "#ede7f6", border: "#673ab7" }, // Deep Purple
    { background: "#e1f5fe", border: "#00bcd4" }, // Cyan
    { background: "#f1f8e9", border: "#8bc34a" }, // Light Green
    { background: "#fff3e0", border: "#ff5722" }, // Deep Orange
    { background: "#fce4ec", border: "#c2185b" }, // Pink (darker)
    { background: "#e8eaf6", border: "#3f51b5" }, // Indigo
    { background: "#e0f7fa", border: "#0097a7" }, // Cyan (darker)
    { background: "#f9fbe7", border: "#827717" }, // Lime (darker)
  ];

  // Map each unique course to a color
  const courseColorMap = new Map();
  let colorIndex = 0;
  meetingTimes.value.forEach((mt) => {
    const courseKey = `${mt.section?.courseNumber}-${mt.section?.courseSection}`;
    if (!courseColorMap.has(courseKey)) {
      courseColorMap.set(
        courseKey,
        courseColors[colorIndex % courseColors.length]
      );
      colorIndex++;
    }
  });

  // Helper function to get color for a course
  const getCourseColor = (mt) => {
    const courseKey = `${mt.section?.courseNumber}-${mt.section?.courseSection}`;
    return courseColorMap.get(courseKey) || courseColors[0];
  };

  // Filter days: exclude Saturday and Sunday only if they have no meetings or office hours, keep all other days
  const daysWithMeetings = daysOfWeek.filter((day) => {
    // Always include Monday through Friday
    if (day.key !== "saturday" && day.key !== "sunday") {
      return true;
    }
    // For Saturday and Sunday, only include if they have meetings or office hours
    const hasMeetings = meetingTimes.value.some((mt) => mt[day.key] === true);
    const hasOfficeHours =
      officeHours.value &&
      officeHours.value.length > 0 &&
      officeHours.value.some((oh) => oh.day === day.key);
    return hasMeetings || hasOfficeHours;
  });

  const numDays = daysWithMeetings.length;

  // Calculate table width and centered start position
  const tableWidth = timeColWidth + colWidth * numDays;
  const startX = (pageWidth - tableWidth) / 2;

  // Table header
  let xPos = startX;

  // Draw table header background
  doc.setFillColor(240, 240, 240);
  doc.rect(startX, yPos - 5, timeColWidth + colWidth * numDays, rowHeight, "F");

  // Header row
  doc.setFontSize(cellFontSize);
  doc.setFont(undefined, "bold");
  doc.text("Time", xPos + 2, yPos);
  xPos += timeColWidth;

  daysWithMeetings.forEach((day) => {
    doc.text(day.label, xPos + 2, yPos);
    xPos += colWidth;
  });

  yPos += rowHeight;

  // Draw header border
  doc.setDrawColor(200, 200, 200);
  doc.line(
    startX,
    yPos - rowHeight,
    startX + timeColWidth + colWidth * numDays,
    yPos - rowHeight
  );
  doc.line(startX, yPos - rowHeight - 5, startX, yPos);
  doc.line(
    startX + timeColWidth,
    yPos - rowHeight - 5,
    startX + timeColWidth,
    yPos
  );

  xPos = startX + timeColWidth;
  daysWithMeetings.forEach(() => {
    doc.line(xPos, yPos - rowHeight - 5, xPos, yPos);
    xPos += colWidth;
  });
  doc.line(
    startX + timeColWidth + colWidth * numDays,
    yPos - rowHeight - 5,
    startX + timeColWidth + colWidth * numDays,
    yPos
  );

  // Generate time slots for PDF (1-hour slots, not 30-minute)
  // Start from 6 AM to include early office hours
  const pdfTimeSlots = [];
  for (let hour = 6; hour <= 22; hour++) {
    pdfTimeSlots.push({ hour, minute: 0, display: formatHour(hour, 0) });
  }

  // Filter to include slots with meetings or office hours
  const filteredPdfTimeSlots = pdfTimeSlots.filter((slot) => {
    const slotStartMinutes = slotToMinutes(slot.hour, slot.minute);
    const slotEndMinutes = slotStartMinutes + 60; // 1-hour slot

    // Check if slot has meetings (check both :00 and :30 within the hour)
    const hasMeetings = daysWithMeetings.some((day) => {
      return meetingTimes.value.some((mt) => {
        if (!mt[day.key]) return false;
        const startMinutes = timeToMinutes(mt.startTime);
        return (
          startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes
        );
      });
    });

    // Check if slot has office hours (check if office hour starts in this hour)
    const hasOfficeHours =
      officeHours.value &&
      officeHours.value.length > 0 &&
      officeHours.value.some((oh) => {
        const ohStartMinutes = timeToMinutes(oh.startTime);
        return (
          ohStartMinutes >= slotStartMinutes && ohStartMinutes < slotEndMinutes
        );
      });

    return hasMeetings || hasOfficeHours;
  });

  // Track items that span multiple slots to avoid drawing borders in the middle
  const activeSpans = new Map(); // key: `${day.key}-${itemId}`, value: { startSlotIndex, spanRows, color, item }

  // Helper function to calculate number of rows an item spans
  // Note: Each row in the PDF represents 1 hour (60 minutes), not 30 minutes
  const calculateSpanRows = (item, slotStartMinutes) => {
    let endMinutes;
    if (item.type === "officeHour") {
      endMinutes = timeToMinutes(item.data.endTime);
    } else {
      endMinutes = timeToMinutes(item.data.endTime);
    }

    // Calculate duration in minutes
    const durationMinutes = endMinutes - slotStartMinutes;

    // Calculate number of 1-hour (60-minute) slots
    // We want the item to end exactly at its end time, not extend past it
    // If end time is exactly on a slot boundary, that's the START of that slot
    // So the item should end at the END of the previous slot
    // Therefore, we use floor division (which naturally excludes the boundary slot)
    const slots = Math.floor(durationMinutes / 60);

    // However, if there's any remainder, we need to include one more slot
    // (the slot that contains the end time)
    const finalSlots = durationMinutes % 60 === 0 ? slots : slots + 1;

    return Math.max(1, finalSlots);
  };

  // Data rows
  doc.setFont(undefined, "normal");
  filteredPdfTimeSlots.forEach((slot, slotIndex) => {
    // Check if we need a new page
    if (yPos > 190) {
      doc.addPage("landscape");
      yPos = topMargin;
      // Clear active spans on new page
      activeSpans.clear();
    }

    xPos = startX;

    // Time column
    doc.setFontSize(timeFontSize);
    doc.setFont(undefined, "bold");
    doc.text(slot.display, xPos + 2, yPos);
    doc.setFont(undefined, "normal");
    xPos += timeColWidth;

    // Day columns (only for days with meetings)
    // Store the initial yPos for this slot row (before processing items)
    const slotRowStartYPos = yPos;

    // First, calculate the maximum number of items across all days for this slot
    const slotStartMinutes = slotToMinutes(slot.hour, slot.minute);
    const slotEndMinutes = slotStartMinutes + 60;
    let maxItemsInSlot = 1;
    daysWithMeetings.forEach((day) => {
      const officeHoursForSlot =
        officeHours.value && officeHours.value.length > 0
          ? officeHours.value.filter((oh) => {
              if (oh.day !== day.key) return false;
              const ohStartMinutes = timeToMinutes(oh.startTime);
              return (
                ohStartMinutes >= slotStartMinutes &&
                ohStartMinutes < slotEndMinutes
              );
            })
          : [];

      const meetingsForSlot = meetingTimes.value.filter((mt) => {
        if (!mt[day.key]) return false;
        const startMinutes = timeToMinutes(mt.startTime);
        return (
          startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes
        );
      });

      const totalItems = officeHoursForSlot.length + meetingsForSlot.length;
      if (totalItems > maxItemsInSlot) {
        maxItemsInSlot = totalItems;
      }
    });

    // Draw time column border for all rows (first row has label, additional rows are empty)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    for (let row = 0; row < maxItemsInSlot; row++) {
      doc.rect(
        startX,
        slotRowStartYPos - 4 + row * rowHeight,
        timeColWidth,
        rowHeight,
        "S"
      );
    }

    doc.setFontSize(cellFontSize);
    daysWithMeetings.forEach((day) => {
      // Check for office hours in this 1-hour slot (slotStartMinutes already calculated above)
      const officeHoursForSlot =
        officeHours.value && officeHours.value.length > 0
          ? officeHours.value.filter((oh) => {
              if (oh.day !== day.key) return false;
              const ohStartMinutes = timeToMinutes(oh.startTime);

              // Office hour starts in this 1-hour slot
              return (
                ohStartMinutes >= slotStartMinutes &&
                ohStartMinutes < slotEndMinutes
              );
            })
          : [];

      // Check for meetings in this 1-hour slot (meetings that start in this hour)
      const meetingsForSlot = meetingTimes.value.filter((mt) => {
        if (!mt[day.key]) return false;
        const startMinutes = timeToMinutes(mt.startTime);
        return (
          startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes
        );
      });

      // Combine meetings and office hours, prioritize office hours if both exist
      const itemsToDisplay = [];
      if (officeHoursForSlot.length > 0) {
        // Create unique IDs for office hours using index to handle multiple entries with same time
        officeHoursForSlot.forEach((oh, idx) => {
          itemsToDisplay.push({
            type: "officeHour",
            data: oh,
            id: `oh-${oh.day}-${oh.startTime}-${oh.endTime}-${idx}`,
          });
        });
      }
      if (meetingsForSlot.length > 0) {
        itemsToDisplay.push(
          ...meetingsForSlot.map((mt) => ({
            type: "meeting",
            data: mt,
            id: `mt-${mt.id}`,
          }))
        );
      }

      // Check if we're in the middle of a spanning item (from a previous slot)
      // Check if any of the items to display are already being tracked as active spans
      const activeSpanKeys = new Set();
      for (const [key, span] of activeSpans.entries()) {
        if (key.startsWith(`${day.key}-`)) {
          const spanEndSlot = span.startSlotIndex + span.spanRows - 1;
          if (slotIndex > span.startSlotIndex && slotIndex <= spanEndSlot) {
            activeSpanKeys.add(key);
          }
        }
      }

      // Filter out items that are already being tracked as active spans
      const newItemsToDisplay = itemsToDisplay.filter((item) => {
        const itemSpanKey = `${day.key}-${item.id}`;
        return !activeSpanKeys.has(itemSpanKey);
      });

      if (
        activeSpanKeys.size > 0 &&
        newItemsToDisplay.length === 0 &&
        itemsToDisplay.length === 0
      ) {
        // We're in the middle of spanning items from previous slots - skip this cell (spanning rectangles already drawn)
        // Just draw a minimal border for the cell grid
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.rect(xPos, yPos - 4, colWidth, rowHeight, "S");
      } else if (newItemsToDisplay.length > 0) {
        // Process each new item that starts in this slot
        newItemsToDisplay.forEach((item, itemIdx) => {
          const itemSpanKey = `${day.key}-${item.id}`;

          // Calculate yPos for this item's row (items are aligned across all days)
          const currentItemYPos = slotRowStartYPos + itemIdx * rowHeight;

          // Determine color based on item type
          let color;
          if (item.type === "officeHour") {
            // Always use yellow for office hours
            color = { background: "#fff9c4", border: "#fbc02d" };
          } else {
            color = getCourseColor(item.data);
          }

          // Calculate span rows based on current slot start time
          const slotStartMinutes = slotToMinutes(slot.hour, slot.minute);
          const spanRows = calculateSpanRows(item, slotStartMinutes);
          const actualRowHeight = rowHeight * spanRows;

          // Store span info for each item (adjust slotIndex for additional rows)
          if (spanRows > 1) {
            activeSpans.set(itemSpanKey, {
              startSlotIndex: itemIdx > 0 ? slotIndex + itemIdx : slotIndex,
              spanRows,
              color,
              item: item,
            });
          }

          // Convert hex to RGB
          const bgColor = hexToRgb(color.background);
          const borderColor = hexToRgb(color.border);

          if (bgColor) {
            doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
            doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
            doc.setLineWidth(0.5);
            // Draw rectangle spanning multiple rows if needed
            doc.rect(
              xPos,
              currentItemYPos - 4,
              colWidth,
              actualRowHeight,
              "FD"
            );
          }

          // Add content based on type (only in first row)
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, "bold");

          if (item.type === "officeHour") {
            // Display office hours - use custom name if provided, otherwise use type
            const displayName =
              item.data.name || item.data.type || "Office Hours";
            doc.text(
              displayName.substring(0, 15),
              xPos + 1,
              currentItemYPos - 1
            );
            doc.setFont(undefined, "normal");
            doc.setFontSize(6);
            const timeText = `${formatTime(item.data.startTime)}-${formatTime(
              item.data.endTime
            )}`;
            doc.text(timeText.substring(0, 15), xPos + 1, currentItemYPos + 2);
          } else {
            // Display course info
            const courseText = `${item.data.section?.courseNumber}-${item.data.section?.courseSection}`;
            doc.text(
              courseText.substring(0, 12),
              xPos + 1,
              currentItemYPos - 1
            );

            // Add time
            doc.setFont(undefined, "normal");
            doc.setFontSize(6);
            const timeText = `${formatTime(item.data.startTime)}-${formatTime(
              item.data.endTime
            )}`;
            doc.text(timeText.substring(0, 15), xPos + 1, currentItemYPos + 2);
          }

          doc.setFontSize(cellFontSize);

          // Draw cell border (spans multiple rows if needed)
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.rect(xPos, currentItemYPos - 4, colWidth, actualRowHeight, "S");
        });
      } else {
        // Empty cell - just draw border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.rect(xPos, yPos - 4, colWidth, rowHeight, "S");
      }

      xPos += colWidth;
    });

    // Draw borders for all day columns for all rows
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    for (let row = 0; row < maxItemsInSlot; row++) {
      let tempXPos = startX + timeColWidth;
      daysWithMeetings.forEach(() => {
        doc.rect(
          tempXPos,
          slotRowStartYPos - 4 + row * rowHeight,
          colWidth,
          rowHeight,
          "S"
        );
        tempXPos += colWidth;
      });
    }

    // Move yPos forward by the number of rows needed (1 row per item, minimum 1)
    yPos = slotRowStartYPos + rowHeight * maxItemsInSlot;

    // Clean up spans that have ended (after this slot)
    activeSpans.forEach((span, key) => {
      const spanEndSlot = span.startSlotIndex + span.spanRows - 1;
      if (slotIndex >= spanEndSlot) {
        activeSpans.delete(key);
      }
    });
  });

  // Save PDF
  const fileName = `Schedule_${selectedUserData.fName}_${selectedUserData.lName}_${selectedTermData.termName}.pdf`;
  doc.save(fileName);
};

onMounted(() => {
  retrieveTerms();
  retrieveUsers();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Course Schedule</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Select Term, User, and Course Prefixes</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="3">
              <v-select
                v-model="selectedTerm"
                :items="terms"
                item-title="termName"
                item-value="id"
                label="Select Term"
              ></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="selectedUser"
                :items="
                  users.map((u) => ({
                    title: `${u.fName} ${u.lName} (${u.email})`,
                    value: u.id,
                  }))
                "
                item-title="title"
                item-value="value"
                label="Select User (Optional)"
                :disabled="!selectedTerm"
                clearable
              ></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="coursePrefix1"
                :items="uniquePrefixes"
                label="Course Prefix 1 (first 4 characters)"
                :disabled="!prefixesEnabled"
                clearable
              ></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="coursePrefix2"
                :items="uniquePrefixes"
                label="Course Prefix 2 (first 4 characters)"
                :disabled="!prefixesEnabled"
                clearable
              ></v-select>
            </v-col>
          </v-row>
          <div class="mt-2">
            <b>{{ message }}</b>
          </div>
          <div v-if="coursePrefix1 || coursePrefix2" class="mt-2">
            <span v-if="coursePrefix1" class="mr-4">
              <span
                style="
                  display: inline-block;
                  width: 20px;
                  height: 20px;
                  background-color: #e3f2fd;
                  border-left: 4px solid #2196f3;
                  vertical-align: middle;
                  margin-right: 5px;
                "
              ></span>
              Prefix 1: {{ coursePrefix1 }}
            </span>
            <span v-if="coursePrefix2">
              <span
                style="
                  display: inline-block;
                  width: 20px;
                  height: 20px;
                  background-color: #fff3e0;
                  border-left: 4px solid #ff9800;
                  vertical-align: middle;
                  margin-right: 5px;
                "
              ></span>
              Prefix 2: {{ coursePrefix2 }}
            </span>
          </div>
        </v-card-text>
      </v-card>

      <br />

      <v-card
        v-if="
          selectedTerm &&
          (coursePrefix1 || coursePrefix2 || selectedUser) &&
          meetingTimes.length > 0
        "
      >
        <v-card-title>
          <span>Weekly Schedule</span>
          <v-spacer></v-spacer>
          <v-btn v-if="selectedUser" color="primary" @click="openPDFDialog">
            Generate PDF
          </v-btn>
        </v-card-title>
        <v-card-text>
          <div style="overflow-x: auto">
            <v-table fixed-header style="min-width: 800px; table-layout: fixed">
              <thead>
                <tr>
                  <th
                    class="text-left"
                    style="
                      min-width: 130px !important;
                      width: 130px !important;
                      position: sticky;
                      left: 0;
                      background-color: white;
                      z-index: 1;
                    "
                  >
                    Time
                  </th>
                  <th
                    v-for="day in daysOfWeek"
                    :key="day.key"
                    class="text-left"
                    style="min-width: 150px"
                  >
                    {{ day.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="slot in timeSlots"
                  :key="`${slot.hour}-${slot.minute}`"
                >
                  <td
                    class="font-weight-bold text-caption"
                    style="
                      min-width: 130px !important;
                      width: 130px !important;
                      position: sticky;
                      left: 0;
                      background-color: white;
                      z-index: 1;
                    "
                  >
                    {{ slot.display }}
                  </td>
                  <td
                    v-for="day in daysOfWeek"
                    :key="day.key"
                    style="min-height: 40px; vertical-align: top; padding: 4px"
                  >
                    <div
                      v-for="mt in getMeetingTimesForSlot(day.key, slot)"
                      :key="mt.id"
                      class="pa-2 mb-1"
                      :style="{
                        backgroundColor: getMeetingColor(mt).background,
                        borderLeft: `4px solid ${getMeetingColor(mt).border}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        lineHeight: '1.3',
                        position: 'relative',
                      }"
                    >
                      <v-tooltip location="top" max-width="300">
                        <template v-slot:activator="{ props }">
                          <v-icon
                            v-bind="props"
                            size="12"
                            color="grey-darken-1"
                            style="
                              position: absolute;
                              top: 2px;
                              left: 2px;
                              cursor: help;
                            "
                          >
                            mdi-information
                          </v-icon>
                        </template>
                        <div style="font-size: 12px; line-height: 1.6">
                          <div>
                            <strong>Course:</strong>
                            {{ mt.section?.courseNumber }}-{{
                              mt.section?.courseSection
                            }}
                          </div>
                          <div v-if="mt.section?.courseDescription">
                            <strong>Description:</strong>
                            {{ mt.section.courseDescription }}
                          </div>
                          <div v-if="mt.section?.user">
                            <strong>Instructor:</strong>
                            {{ mt.section.user.fName }}
                            {{ mt.section.user.lName }}
                          </div>
                          <div v-if="mt.section?.user?.email">
                            <strong>Email:</strong> {{ mt.section.user.email }}
                          </div>
                          <div v-if="mt.section?.term">
                            <strong>Term:</strong>
                            {{ mt.section.term.termName }}
                          </div>
                          <div>
                            <strong>Time:</strong>
                            {{ formatTime(mt.startTime) }}-{{
                              formatTime(mt.endTime)
                            }}
                          </div>
                          <div>
                            <strong>Days:</strong>
                            <span v-if="mt.monday"> Mon</span>
                            <span v-if="mt.tuesday"> Tue</span>
                            <span v-if="mt.wednesday"> Wed</span>
                            <span v-if="mt.thursday"> Thu</span>
                            <span v-if="mt.friday"> Fri</span>
                            <span v-if="mt.saturday"> Sat</span>
                            <span v-if="mt.sunday"> Sun</span>
                          </div>
                        </div>
                      </v-tooltip>
                      <div class="font-weight-bold" style="padding-left: 16px">
                        {{ mt.section?.courseNumber }}-{{
                          mt.section?.courseSection
                        }}
                      </div>
                      <div class="text-caption" style="font-size: 10px">
                        {{ formatTime(mt.startTime) }}-{{
                          formatTime(mt.endTime)
                        }}
                      </div>
                      <div
                        v-if="mt.section?.user?.lName"
                        class="text-caption mt-1"
                        style="font-size: 10px; font-weight: 500"
                      >
                        {{ mt.section.user.lName }}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        v-else-if="
          selectedTerm &&
          (coursePrefix1 || coursePrefix2 || selectedUser) &&
          meetingTimes.length === 0
        "
        class="mt-4"
      >
        <v-card-text>
          <div class="text-center">
            No meeting times found for the selected criteria.
          </div>
        </v-card-text>
      </v-card>

      <!-- Office Hours Dialog -->
      <v-dialog v-model="showOfficeHoursDialog" max-width="800px" persistent>
        <v-card>
          <v-card-title>
            <span>Enter Office Hours</span>
            <v-spacer></v-spacer>
            <v-btn
              icon="mdi-close"
              variant="text"
              @click="showOfficeHoursDialog = false"
            ></v-btn>
          </v-card-title>
          <v-card-text>
            <v-form>
              <v-row>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="newOfficeHour.days"
                    :items="daysOfWeek"
                    item-title="label"
                    item-value="key"
                    label="Day of Week"
                    multiple
                    chips
                  ></v-select>
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="newOfficeHour.startTime"
                    label="Start Time"
                    type="time"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="newOfficeHour.endTime"
                    label="End Time"
                    type="time"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="newOfficeHour.type"
                    :items="['Office Hours', 'Chapel', 'Other']"
                    label="Type"
                  ></v-select>
                </v-col>
                <v-col cols="12" v-if="newOfficeHour.type === 'Other'">
                  <v-text-field
                    v-model="newOfficeHour.name"
                    label="Description"
                    required
                  ></v-text-field>
                </v-col>
              </v-row>
              <v-btn
                color="primary"
                @click="addOfficeHour"
                :disabled="
                  !newOfficeHour.days ||
                  newOfficeHour.days.length === 0 ||
                  !newOfficeHour.startTime ||
                  !newOfficeHour.endTime ||
                  !newOfficeHour.type ||
                  (newOfficeHour.type === 'Other' && !newOfficeHour.name)
                "
              >
                Add Entry
              </v-btn>
            </v-form>

            <v-divider class="my-4"></v-divider>

            <div v-if="officeHours.length > 0">
              <h3>Entries:</h3>
              <v-list>
                <v-list-item v-for="(oh, index) in officeHours" :key="index">
                  <template v-slot:prepend>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      @click="removeOfficeHour(index)"
                    ></v-btn>
                  </template>
                  <v-list-item-title>
                    {{ daysOfWeek.find((d) => d.key === oh.day)?.label }}:
                    {{ formatTime(oh.startTime) }} -
                    {{ formatTime(oh.endTime) }}
                    <span v-if="oh.name || oh.type">
                      ({{ oh.name || oh.type }})</span
                    >
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="grey"
              variant="text"
              @click="showOfficeHoursDialog = false"
            >
              Cancel
            </v-btn>
            <v-btn color="primary" @click="generatePDF"> Generate PDF </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
