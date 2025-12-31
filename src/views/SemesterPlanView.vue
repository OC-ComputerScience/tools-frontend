<script setup>
import { ref, onMounted, computed, watch } from "vue";
import TermServices from "../services/termServices";
import SectionServices from "../services/sectionServices";
import MeetingTimeServices from "../services/meetingTimeServices";
import MajorServices from "../services/majorServices";
import SemesterPlanServices from "../services/semesterPlanServices";
import CourseServices from "../services/courseServices";

const terms = ref([]);
const majors = ref([]);
const selectedMajor = ref(null);
const selectedSemester = ref(null);
const selectedTerm = ref(null);
const semesterPlans = ref([]);
const courses = ref([]);
const sections = ref([]);
const meetingTimes = ref([]);
const message = ref("Select major, semester, and term to view schedule");
const semesterNumbers = ref([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); // Common semester numbers
const hide100AndAbove = ref(true); // Filter out sections with section numbers 100 and greater (default: checked)
const hiddenSectionIds = ref(new Set()); // Track hidden section IDs

// Color palette for different course prefixes
const prefixColors = [
  { background: "#e3f2fd", border: "#2196f3" }, // Blue
  { background: "#fff3e0", border: "#ff9800" }, // Orange
  { background: "#f3e5f5", border: "#9c27b0" }, // Purple
  { background: "#e8f5e9", border: "#4caf50" }, // Green
  { background: "#fce4ec", border: "#e91e63" }, // Pink
  { background: "#fff9c4", border: "#fbc02d" }, // Yellow
  { background: "#e0f2f1", border: "#009688" }, // Teal
  { background: "#fff8e1", border: "#ffc107" }, // Amber
];

// Map to store prefix to color index
const prefixColorMap = ref(new Map());

const daysOfWeek = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
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

const retrieveMajors = () => {
  MajorServices.getAllMajors()
    .then((response) => {
      majors.value = response.data;
    })
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading majors";
    });
};

const retrieveSemesterPlans = async () => {
  if (!selectedMajor.value || !selectedSemester.value) {
    semesterPlans.value = [];
    courses.value = [];
    return;
  }

  try {
    const response = await SemesterPlanServices.getAllSemesterPlans({
      majorId: selectedMajor.value,
      semesterNumber: selectedSemester.value,
    });

    semesterPlans.value = response.data;
    
    // Extract unique course IDs and load course details
    const courseIds = [...new Set(response.data.map((sp) => sp.courseId))];
    
    if (courseIds.length === 0) {
      courses.value = [];
      message.value = "No courses found in semester plan for selected major and semester";
      return;
    }

    // Load course details to get course numbers
    const coursePromises = courseIds.map((id) => CourseServices.getCourse(id));
    const courseResponses = await Promise.all(coursePromises);
    courses.value = courseResponses
      .map((res) => res.data)
      .filter((course) => course != null);

    message.value = `Loaded ${semesterPlans.value.length} course(s) in semester plan`;

    // If term is also selected, load sections
    if (selectedTerm.value) {
      await loadSections();
    }
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading semester plans";
    console.error("Error loading semester plans:", e);
  }
};

const loadSections = async () => {
  if (!selectedTerm.value || courses.value.length === 0) {
    sections.value = [];
    meetingTimes.value = [];
    if (!selectedTerm.value) {
      message.value = "Select term to view schedule";
    } else {
      message.value = "No courses in semester plan to match";
    }
    return;
  }

  try {
    // Load all sections for the selected term
    const response = await SectionServices.getAllSections({
      termId: selectedTerm.value,
    });

    const allSections = response.data;

    // Filter sections to match course numbers from semester plan courses
    // Course model has: code (e.g., "CSCI") and number (e.g., "101")
    // Section model has: courseNumber (e.g., "CSCI101", "CSCI 101", or just "101")
    const courseNumbers = courses.value.map((c) => {
      // Build full course number from code + number in multiple formats
      const code = (c.code || '').toUpperCase().trim();
      const number = (c.number || '').trim();
      return {
        full: `${code}${number}`,           // "CSCI101"
        withSpace: `${code} ${number}`,      // "CSCI 101"
        numberOnly: number,                  // "101"
        codeOnly: code,                      // "CSCI"
      };
    });
    
    console.log('Semester plan course numbers:', courseNumbers);
    console.log('All sections course numbers:', allSections.map(s => s.courseNumber));
    
    sections.value = allSections.filter((section) => {
      if (!section.courseNumber) return false;
      
      const sectionNum = (section.courseNumber || '').toUpperCase().trim().replace(/\s+/g, '');
      
      // Check if section's courseNumber matches any course number from semester plan
      return courseNumbers.some((cn) => {
        // Normalize all formats by removing spaces for comparison
        const fullNum = cn.full.toUpperCase().replace(/\s+/g, '');
        const withSpaceNum = cn.withSpace.toUpperCase().replace(/\s+/g, '');
        const numberOnlyNum = cn.numberOnly.toUpperCase().trim();
        
        // Direct match (normalized)
        if (sectionNum === fullNum || sectionNum === withSpaceNum) return true;
        
        // Match by course number only (e.g., section "CSCI101" matches plan "101" if section ends with it)
        if (numberOnlyNum && sectionNum.endsWith(numberOnlyNum)) {
          // Also check that the prefix matches (e.g., "CSCI101" ends with "101" and starts with "CSCI")
          const sectionPrefix = sectionNum.substring(0, sectionNum.length - numberOnlyNum.length);
          if (sectionPrefix === cn.codeOnly || sectionPrefix === '') {
            return true;
          }
        }
        
        // Match if section number contains the full course number (normalized)
        if (sectionNum.includes(fullNum) || fullNum.includes(sectionNum)) return true;
        
        // Match if section number contains the course number part
        if (numberOnlyNum && sectionNum.includes(numberOnlyNum)) {
          // Check if it's a valid match (section should start with the code)
          if (sectionNum.startsWith(cn.codeOnly)) return true;
        }
        
        return false;
      });
    });
    
    console.log('Filtered sections:', sections.value.map(s => ({ id: s.id, courseNumber: s.courseNumber })));

    if (sections.value.length === 0) {
      meetingTimes.value = [];
      message.value = `No sections found in term ${selectedTerm.value} matching semester plan courses`;
      return;
    }

    // Load meeting times for all matching sections
    await loadMeetingTimes();
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading sections";
    console.error("Error loading sections:", e);
  }
};

const loadMeetingTimes = async () => {
  if (sections.value.length === 0) {
    meetingTimes.value = [];
    return;
  }

  try {
    // First, extract unique prefixes from sections and assign colors
    const uniquePrefixes = new Set();
    sections.value.forEach((section) => {
      if (section.courseNumber && section.courseNumber.length >= 4) {
        const prefix = section.courseNumber.substring(0, 4).toUpperCase();
        uniquePrefixes.add(prefix);
      }
    });
    
    // Assign color index to each prefix
    prefixColorMap.value.clear();
    let colorIndex = 0;
    Array.from(uniquePrefixes).sort().forEach((prefix) => {
      prefixColorMap.value.set(prefix, colorIndex % prefixColors.length);
      colorIndex++;
    });

    const allMeetingTimes = [];
    for (const section of sections.value) {
      try {
        const response = await MeetingTimeServices.getMeetingTimeBySectionId(
          section.id
        );
        if (response.data && Array.isArray(response.data)) {
          // Get the prefix for this section
          const sectionPrefix = section.courseNumber && section.courseNumber.length >= 4
            ? section.courseNumber.substring(0, 4).toUpperCase()
            : null;
          
          response.data.forEach((mt) => {
            // Merge section data - prioritize user info
            // Backend returns mt.section (alias from meetingTime controller)
            const mergedSection = {
              ...(mt.section || {}),
              ...section,
              user: section.user || mt.section?.user,
            };
            allMeetingTimes.push({
              ...mt,
              section: mergedSection,
              prefix: sectionPrefix, // Store prefix for color lookup
            });
          });
        }
      } catch (e) {
        // Section might not have meeting times, continue
        console.log(`No meeting times for section ${section.id}`);
      }
    }
    meetingTimes.value = allMeetingTimes;
    message.value = `Loaded ${allMeetingTimes.length} meeting time(s) for ${sections.value.length} section(s)`;
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading meeting times";
    console.error("Error loading meeting times:", e);
  }
};

// Watch for changes in major or semester
watch([selectedMajor, selectedSemester], () => {
  // Reset hidden list when selection criteria changes
  hiddenSectionIds.value.clear();
  
  if (selectedMajor.value && selectedSemester.value) {
    retrieveSemesterPlans();
  } else {
    semesterPlans.value = [];
    courses.value = [];
    sections.value = [];
    meetingTimes.value = [];
    message.value = "Select major and semester to view schedule";
  }
});

// Watch for changes in term
watch(selectedTerm, () => {
  // Reset hidden list when term changes
  hiddenSectionIds.value.clear();
  
  if (selectedTerm.value && courses.value.length > 0) {
    loadSections();
  } else {
    sections.value = [];
    meetingTimes.value = [];
    if (selectedMajor.value && selectedSemester.value) {
      message.value = "Select term to view schedule";
    }
  }
});

// Helper function to format time
const formatTime = (time) => {
  if (!time) return "";
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
const timeSlots = computed(() => {
  const slots = [];
  for (let hour = 8; hour <= 22; hour++) {
    slots.push({ hour, minute: 0, display: formatHour(hour, 0) });
    if (hour < 22) {
      slots.push({ hour, minute: 30, display: formatHour(hour, 30) });
    }
  }
  return slots;
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

// Helper function to get color for a meeting based on its prefix
const getMeetingColor = (mt) => {
  if (!mt || !mt.prefix) return prefixColors[0]; // Default to first color
  const colorIndex = prefixColorMap.value.get(mt.prefix);
  return prefixColors[colorIndex !== undefined ? colorIndex : 0];
};

// Helper function to get section number value (extracts numeric part)
const getSectionNumberValue = (sectionNumber) => {
  if (!sectionNumber) return 0;
  // Extract numeric part from section number (e.g., "001" -> 1, "100" -> 100, "A" -> 0)
  const match = sectionNumber.toString().match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

// Helper function to hide a section
const hideSection = (sectionId) => {
  if (sectionId) {
    hiddenSectionIds.value.add(sectionId);
  }
};

// Helper function to show a hidden section
const showSection = (sectionId) => {
  if (sectionId) {
    hiddenSectionIds.value.delete(sectionId);
  }
};

// Helper function to get hidden sections info for display
const getHiddenSections = computed(() => {
  return sections.value
    .filter((s) => hiddenSectionIds.value.has(s.id))
    .map((s) => ({
      id: s.id,
      courseNumber: s.courseNumber,
      courseSection: s.courseSection,
      courseDescription: s.courseDescription,
    }));
});

// Helper function to get meeting times for a specific day and time slot
// Only show meeting in the slot where it starts
const getMeetingTimesForSlot = (dayKey, slot) => {
  return meetingTimes.value.filter((mt) => {
    if (!mt[dayKey]) return false;

    // Filter out hidden sections
    if (hiddenSectionIds.value.has(mt.section?.id)) return false;

    // Filter out sections with section numbers >= 100 if checkbox is checked
    if (hide100AndAbove.value) {
      const sectionNum = getSectionNumberValue(mt.section?.courseSection);
      if (sectionNum >= 100) return false;
    }

    const startMinutes = timeToMinutes(mt.startTime);
    const slotStartMinutes = slotToMinutes(slot.hour, slot.minute);
    const slotEndMinutes = slotStartMinutes + 30; // 30-minute slot

    // Show meeting only in the slot where it starts
    return startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes;
  });
};

onMounted(() => {
  retrieveTerms();
  retrieveMajors();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Semester Plan Schedule</v-toolbar-title>
      </v-toolbar>
      <br />

      <v-card>
        <v-card-title>Select Major, Semester, and Term</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedMajor"
                :items="majors"
                item-title="description"
                item-value="id"
                label="Select Major"
              ></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedSemester"
                :items="semesterNumbers"
                label="Select Semester Number"
                :disabled="!selectedMajor"
              ></v-select>
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="selectedTerm"
                :items="terms"
                item-title="termName"
                item-value="id"
                label="Select Term"
                :disabled="!selectedMajor || !selectedSemester"
              ></v-select>
            </v-col>
          </v-row>
          <div class="mt-2">
            <b>{{ message }}</b>
          </div>
        </v-card-text>
      </v-card>

      <br />

      <!-- Hidden Courses List -->
      <v-card
        v-if="selectedMajor && selectedSemester && selectedTerm && getHiddenSections.length > 0"
        class="mb-4"
      >
        <v-card-title>Hidden Courses</v-card-title>
        <v-card-text>
          <div class="d-flex flex-wrap gap-2">
            <v-chip
              v-for="section in getHiddenSections"
              :key="section.id"
              closable
              @click:close="showSection(section.id)"
              color="grey"
              variant="outlined"
            >
              {{ section.courseNumber }}-{{ section.courseSection }}
              <span v-if="section.courseDescription" class="ml-1 text-caption">
                ({{ section.courseDescription }})
              </span>
            </v-chip>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        v-if="selectedMajor && selectedSemester && selectedTerm && meetingTimes.length > 0"
      >
        <v-card-title>Weekly Schedule</v-card-title>
        <v-card-text>
          <div class="mb-3">
            <v-checkbox
              v-model="hide100AndAbove"
              label="Hide section numbers 100 and above"
              density="compact"
              hide-details
            ></v-checkbox>
          </div>
          <div style="overflow-x: auto">
            <v-table fixed-header style="min-width: 800px">
              <thead>
                <tr>
                  <th
                    class="text-left"
                    style="
                      width: 100px;
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
                      <v-icon
                        size="12"
                        color="grey-darken-2"
                        style="position: absolute; top: 2px; right: 2px; cursor: pointer; z-index: 10;"
                        @click.stop="hideSection(mt.section?.id)"
                      >
                        mdi-close
                      </v-icon>
                      <v-tooltip location="top" max-width="300">
                        <template v-slot:activator="{ props }">
                          <v-icon
                            v-bind="props"
                            size="12"
                            color="grey-darken-1"
                            style="position: absolute; top: 2px; left: 2px; cursor: help;"
                          >
                            mdi-information
                          </v-icon>
                        </template>
                        <div style="font-size: 12px; line-height: 1.6">
                          <div><strong>Course:</strong> {{ mt.section?.courseNumber }}-{{ mt.section?.courseSection }}</div>
                          <div v-if="mt.section?.courseDescription">
                            <strong>Description:</strong> {{ mt.section.courseDescription }}
                          </div>
                          <div v-if="mt.section?.user">
                            <strong>Instructor:</strong> {{ mt.section.user.fName }} {{ mt.section.user.lName }}
                          </div>
                          <div v-if="mt.section?.user?.email">
                            <strong>Email:</strong> {{ mt.section.user.email }}
                          </div>
                          <div v-if="mt.section?.term">
                            <strong>Term:</strong> {{ mt.section.term.termName }}
                          </div>
                          <div>
                            <strong>Time:</strong> {{ formatTime(mt.startTime) }}-{{ formatTime(mt.endTime) }}
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
                      <div class="font-weight-bold" style="padding-left: 16px;">
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
        v-else-if="selectedMajor && selectedSemester && selectedTerm && meetingTimes.length === 0"
        class="mt-4"
      >
        <v-card-text>
          <div class="text-center">
            No sections found for the selected semester plan in the selected term.
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

