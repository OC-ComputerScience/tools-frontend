<script setup>
import { ref, onMounted, computed, watch } from "vue";
import TermServices from "../services/termServices";
import SectionServices from "../services/sectionServices";
import MeetingTimeServices from "../services/meetingTimeServices";
import UserServices from "../services/userServices";

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

    // If a prefix is selected, filter and load meeting times
    if (coursePrefix1.value || coursePrefix2.value) {
      await loadMeetingTimes();
    } else {
      // Update message when courses are loaded but no prefixes selected
      message.value = `Loaded ${courses.value.length} course(s). Select course prefix(es) to view schedule.`;
    }
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading courses";
  }
};

const loadMeetingTimes = async () => {
  if (!selectedTerm.value || (!coursePrefix1.value && !coursePrefix2.value)) {
    meetingTimes.value = [];
    if (!selectedTerm.value) {
      message.value = "Select a term and course prefix(es) to view schedule";
    } else {
      message.value = "Select course prefix(es) to view schedule";
    }
    return;
  }

  // Filter courses by prefixes
  const filteredCourses = courses.value.filter((course) => {
    if (!course.courseNumber || course.courseNumber.length < 4) return false;
    const prefix = course.courseNumber.substring(0, 4).toUpperCase();
    return (
      (coursePrefix1.value && prefix === coursePrefix1.value.toUpperCase()) ||
      (coursePrefix2.value && prefix === coursePrefix2.value.toUpperCase())
    );
  });

  if (filteredCourses.length === 0) {
    meetingTimes.value = [];
    message.value = "No courses found for selected prefix(es)";
    return;
  }

  // Load meeting times for all filtered courses
  try {
    const allMeetingTimes = [];
    for (const course of filteredCourses) {
      try {
        const response = await MeetingTimeServices.getMeetingTimeByCourseId(
          course.id
        );
        if (response.data && Array.isArray(response.data)) {
          // Determine which prefix this course belongs to
          const coursePrefix = course.courseNumber.substring(0, 4).toUpperCase();
          let prefixIndex = null;
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

          // Backend includes course data, but merge with our course to ensure user info is included
          response.data.forEach((mt) => {
            // Merge course data - prioritize user info from our course object
            const mergedCourse = {
              ...(mt.course || {}),
              ...course,
              // Ensure user info is included from the course we fetched
              user: course.user || mt.course?.user,
            };
            allMeetingTimes.push({
              ...mt,
              course: mergedCourse,
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
    const prefix1Count = allMeetingTimes.filter((mt) => mt.prefixIndex === 1)
      .length;
    const prefix2Count = allMeetingTimes.filter((mt) => mt.prefixIndex === 2)
      .length;
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
    message.value = "Select a term and course prefix(es) to view schedule";
  }
});

// Watch for changes in course prefixes
watch([coursePrefix1, coursePrefix2], () => {
  if ((coursePrefix1.value || coursePrefix2.value) && selectedTerm.value) {
    loadMeetingTimes();
  } else {
    meetingTimes.value = [];
    // Update message when prefixes are cleared
    if (selectedTerm.value && courses.value.length > 0) {
      message.value = `Loaded ${courses.value.length} course(s). Select course prefix(es) to view schedule.`;
    } else if (selectedTerm.value) {
      message.value = "Select course prefix(es) to view schedule";
    } else {
      message.value = "Select a term and course prefix(es) to view schedule";
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
                :items="users.map(u => ({ 
                  title: `${u.fName} ${u.lName} (${u.email})`, 
                  value: u.id 
                }))"
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
                :disabled="!selectedTerm || uniquePrefixes.length === 0"
                clearable
              ></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="coursePrefix2"
                :items="uniquePrefixes"
                label="Course Prefix 2 (first 4 characters)"
                :disabled="!selectedTerm || uniquePrefixes.length === 0"
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

      <v-card v-if="selectedTerm && (coursePrefix1 || coursePrefix2) && meetingTimes.length > 0">
        <v-card-title>Weekly Schedule</v-card-title>
        <v-card-text>
          <div style="overflow-x: auto">
            <v-table fixed-header style="min-width: 800px">
              <thead>
                <tr>
                  <th class="text-left" style="width: 100px; position: sticky; left: 0; background-color: white; z-index: 1;">Time</th>
                  <th
                    v-for="day in daysOfWeek"
                    :key="day.key"
                    class="text-left"
                    style="min-width: 150px;"
                  >
                    {{ day.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="slot in timeSlots" :key="`${slot.hour}-${slot.minute}`">
                  <td
                    class="font-weight-bold text-caption"
                    style="position: sticky; left: 0; background-color: white; z-index: 1;"
                  >
                    {{ slot.display }}
                  </td>
                  <td
                    v-for="day in daysOfWeek"
                    :key="day.key"
                    style="min-height: 40px; vertical-align: top; padding: 4px;"
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
                      }"
                    >
                      <div class="font-weight-bold">
                        {{ mt.course?.courseNumber }}-{{
                          mt.course?.courseSection
                        }}
                      </div>
                      <div class="text-caption" style="font-size: 10px;">
                        {{ formatTime(mt.startTime) }}-{{
                          formatTime(mt.endTime)
                        }}
                      </div>
                      <div
                        v-if="mt.course?.user?.lName"
                        class="text-caption mt-1"
                        style="font-size: 10px; font-weight: 500;"
                      >
                        {{ mt.course.user.lName }}
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
        v-else-if="selectedTerm && (coursePrefix1 || coursePrefix2) && meetingTimes.length === 0"
        class="mt-4"
      >
        <v-card-text>
          <div class="text-center">
            No meeting times found for the selected term and course prefix.
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

