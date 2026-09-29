import jsPDFImport from "jspdf";

const jsPDF = jsPDFImport.jsPDF || jsPDFImport;

const margin = 12;
const pageBottom = 12;
const lineHeight = 4.2;

const dateKey = (value) => {
  if (!value) return "";
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

const outcomeInEffect = (outcome, semesterStart) => {
  if (!semesterStart) return true;
  const start = dateKey(outcome.effectiveDate);
  const end = dateKey(outcome.endDate);
  if (start && start > semesterStart) return false;
  if (end && end < semesterStart) return false;
  return true;
};

const levelLabel = (level) => {
  if (level === "graduate") return "Graduate";
  if (level === "undergraduate") return "Undergraduate";
  return level || "";
};

const outcomeLabel = (outcome) => {
  if (!outcome) return "";
  return outcome.number ? `${outcome.number} - ${outcome.name}` : outcome.name || "";
};

const universityOutcomeLabel = (outcome) => {
  if (!outcome) return "";
  return outcome.number ? `${outcome.number} - ${outcome.name}` : outcome.name || "";
};

const scoreText = (score, description) => {
  if (score == null || score === "") return "";
  return description ? `${score} - ${description}` : String(score);
};

const assignmentIdFromRow = (row) => {
  const [assignmentId] = String(row?.id || "").split("-");
  const id = Number(assignmentId);
  return Number.isFinite(id) ? id : null;
};

const cellText = (value) => (value == null ? "" : String(value));

const ensureSpace = (doc, y, needed, redrawHeader) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - pageBottom) return y;
  doc.addPage();
  return redrawHeader(margin);
};

const drawTable = (doc, startY, columns) => {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  let y = startY;

  const drawHeader = (headerY) => {
    const headerHeight = 8;
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, headerY, tableWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = margin;
    columns.forEach((column) => {
      doc.text(column.title, x + 1.5, headerY + 5.2);
      x += column.width;
    });
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, headerY + headerHeight, margin + tableWidth, headerY + headerHeight);
    return headerY + headerHeight;
  };

  y = drawHeader(y);

  return (rows) => {
    if (!rows.length) {
      y = ensureSpace(doc, y, 8, drawHeader);
      doc.setFontSize(9);
      doc.text("None", margin + 1.5, y + 5);
      return y + 8;
    }

    rows.forEach((row) => {
      doc.setFontSize(8);
      const cellLines = columns.map((column) =>
        doc.splitTextToSize(cellText(row[column.key]), column.width - 3)
      );
      const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + 2.5;
      y = ensureSpace(doc, y, rowHeight, drawHeader);
      let x = margin;
      cellLines.forEach((lines, index) => {
        doc.text(lines, x + 1.5, y + lineHeight);
        x += columns[index].width;
      });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
      y += rowHeight;
    });
    return y;
  };
};

const drawSection = (doc, y, title, intro) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 36) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(intro, doc.internal.pageSize.getWidth() - margin * 2);
  doc.text(lines, margin, y);
  return y + lines.length * 4.6 + 3;
};

export const buildDepartmentAssessmentPdf = ({
  universityName = "",
  collegeName = "",
  departmentName = "",
  chairName = "",
  semesterName = "",
  semesterStartDate = "",
  outcomes = [],
  assessmentOutcomes = [],
  assignments = [],
}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Department Assessment Report", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(11);
  const headingLines = [
    universityName,
    collegeName,
    departmentName,
    chairName ? `Department Chair: ${chairName}` : "Department Chair:",
  ];
  headingLines.forEach((line) => {
    doc.text(line || "", pageWidth / 2, y, { align: "center" });
    y += 6;
  });
  y += 4;

  const semesterStart = dateKey(semesterStartDate);
  const activeOutcomes = outcomes.filter((outcome) => outcomeInEffect(outcome, semesterStart));
  const activeOutcomeIds = new Set(activeOutcomes.map((outcome) => Number(outcome.id)));
  const activeAssessmentOutcomes = assessmentOutcomes.filter((outcome) =>
    activeOutcomeIds.has(Number(outcome.id))
  );
  const assessmentByOutcomeId = new Map(
    activeAssessmentOutcomes.map((outcome) => [Number(outcome.id), outcome])
  );
  const assignmentById = new Map(assignments.map((assignment) => [Number(assignment.id), assignment]));

  y = drawSection(
    doc,
    y,
    "1. Department Outcomes",
    `These are the learning outcomes for the ${departmentName} for ${semesterName} semester. These outcomes represent the main learning the department expects to happen by students in its majors. Each outcome is listed with its level, linked university outcomes, and description. These outcomes are assessed by assignments in the courses in this department.`
  );
  const outcomeColumns = [
    { title: "Number", key: "number", width: 22 },
    { title: "Name", key: "name", width: 52 },
    { title: "Level", key: "level", width: 32 },
    { title: "University Outcomes", key: "universityOutcomes", width: 70 },
    { title: "Description", key: "description", width: 76 },
  ];
  const writeOutcomes = drawTable(doc, y, outcomeColumns);
  y = writeOutcomes(
    activeOutcomes.map((outcome) => ({
      number: outcome.number,
      name: outcome.name,
      level: levelLabel(outcome.level),
      universityOutcomes: (outcome.universityOutcomes || []).map(universityOutcomeLabel).join("; "),
      description: outcome.description || "",
    }))
  );
  y += 8;

  y = drawSection(
    doc,
    y,
    "2. Assessment Scores",
    `These are the Assessment Scores for ${departmentName} for ${semesterName}. Each outcome receives an Assessment Score based on the student scores on the assignments assigned to the outcome. The Assessment Score is the average student assignment score for that outcome after the student assignment score is converted to the Assessment Score scale. Student Scores is the number of student assignment scores included in the average.`
  );
  const scoreColumns = [
    { title: "Outcome", key: "outcome", width: 140 },
    { title: "Assessment Score", key: "averageScore", width: 70 },
    { title: "Student Scores", key: "gradeCount", width: 42 },
  ];
  const writeScores = drawTable(doc, y, scoreColumns);
  const scoreRows = (activeAssessmentOutcomes.length ? activeAssessmentOutcomes : activeOutcomes).map((outcome) => {
    const assessment = assessmentByOutcomeId.get(Number(outcome.id)) || outcome;
    return {
      outcome: outcomeLabel(outcome),
      averageScore: scoreText(assessment.averageScore, assessment.scoreDescription),
      gradeCount: assessment.gradeCount == null ? "" : String(assessment.gradeCount),
    };
  });
  y = writeScores(scoreRows);
  y += 8;

  y = drawSection(
    doc,
    y,
    "3. Assignments Used for Assessment",
    "These are the assignments linked to the department outcomes and included in the assessment. Core assessment assignments are not included."
  );
  const assignmentColumns = [
    { title: "Outcome", key: "outcome", width: 32 },
    { title: "Course", key: "course", width: 32 },
    { title: "Section", key: "section", width: 26 },
    { title: "Assignment", key: "name", width: 38 },
    { title: "Total Points", key: "totalPoints", width: 22 },
    { title: "Description", key: "description", width: 44 },
    { title: "Assessment Score", key: "averageScore", width: 30 },
    { title: "Student Scores", key: "gradeCount", width: 28 },
  ];
  const writeAssignments = drawTable(doc, y, assignmentColumns);
  const assignmentRows = [];
  const sourceOutcomes = activeAssessmentOutcomes.length ? activeAssessmentOutcomes : activeOutcomes;
  sourceOutcomes.forEach((outcome) => {
    (outcome.assignments || []).forEach((row) => {
      const assignment = assignmentById.get(assignmentIdFromRow(row));
      const course = assignment?.course;
      const courseLabel = course
        ? course.description
          ? `${course.number} - ${course.description}`
          : course.number
        : row.courseNumber || "";
      const section = row.courseSection
        ? `${row.courseNumber || ""}-${row.courseSection}`
        : "";
      assignmentRows.push({
        outcome: outcomeLabel(outcome),
        course: courseLabel,
        section,
        name: assignment?.name || row.name || "",
        totalPoints: assignment?.totalPoints == null ? "" : String(assignment.totalPoints),
        description: assignment?.description || "",
        averageScore: row.averageScore == null ? "" : String(row.averageScore),
        gradeCount: row.gradeCount == null ? "" : String(row.gradeCount),
      });
    });
  });
  writeAssignments(assignmentRows);

  return doc;
};
