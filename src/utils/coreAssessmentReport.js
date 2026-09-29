import jsPDFImport from "jspdf";

const jsPDF = jsPDFImport.jsPDF || jsPDFImport;

const margin = 12;
const pageBottom = 12;
const lineHeight = 4.2;
const tableWidth = 252;

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

const scoreText = (score, description) => {
  if (score == null || score === "") return "";
  return description ? `${score} - ${description}` : String(score);
};

const scorePercent = (item, key) => {
  const total = Number(item?.gradeCount);
  const count = Number(item?.[key]);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(count)) return "";
  return `${Math.round((count / total) * 1000) / 10}%`;
};

const sectionLabel = (assignment) => {
  if (!assignment?.courseSection) return "";
  const description = assignment.courseDescription ? ` ${assignment.courseDescription}` : "";
  return `${assignment.courseNumber}-${assignment.courseSection}${description}`;
};

const cellText = (value) => (value == null ? "" : String(value));

const ensureSpace = (doc, y, needed, redrawHeader) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - pageBottom) return y;
  doc.addPage();
  return redrawHeader(margin);
};

const drawTable = (doc, startY, columns) => {
  const width = columns.reduce((sum, column) => sum + column.width, 0);
  let y = startY;

  const drawHeader = (headerY) => {
    const headerHeight = 8;
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, headerY, width, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = margin;
    columns.forEach((column) => {
      const lines = doc.splitTextToSize(column.title, column.width - 2);
      doc.text(lines, x + 1, headerY + 3.4);
      x += column.width;
    });
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, headerY + headerHeight, margin + width, headerY + headerHeight);
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
      doc.line(margin, y + rowHeight, margin + width, y + rowHeight);
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

const withDistribution = (fixedColumns, scoreColumns) => {
  const fixedWidth = fixedColumns.reduce((sum, column) => sum + column.width, 0);
  const remaining = Math.max(tableWidth - fixedWidth, 0);
  if (!scoreColumns.length || remaining <= 0) return fixedColumns;
  const each = remaining / scoreColumns.length;
  return [
    ...fixedColumns,
    ...scoreColumns.map((column) => ({
      title: String(column.title),
      key: column.key,
      width: each,
    })),
  ];
};

export const buildCoreAssessmentPdf = ({
  universityName = "",
  provostName = "",
  semesterName = "",
  semesterStartDate = "",
  outcomes = [],
  assessmentOutcomes = [],
}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Core Assessment Report", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(11);
  const headingLines = [
    universityName,
    provostName ? `Provost: ${provostName}` : "Provost:",
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
  const scoreColumns =
    activeAssessmentOutcomes.find((outcome) => outcome.scoreColumns?.length)?.scoreColumns || [];

  y = drawSection(
    doc,
    y,
    "1. University Outcomes",
    `These are the learning outcomes for the ${universityName} for ${semesterName} semester. These outcomes represent the main learning the university expects students to achieve through its core curriculum. Each outcome is listed with its level and description. These outcomes are assessed by core assessment assignments.`
  );
  y = drawTable(doc, y, [
    { title: "Number", key: "number", width: 22 },
    { title: "Name", key: "name", width: 70 },
    { title: "Level", key: "level", width: 32 },
    { title: "Description", key: "description", width: 128 },
  ])(
    activeOutcomes.map((outcome) => ({
      number: outcome.number,
      name: outcome.name,
      level: levelLabel(outcome.level),
      description: outcome.description || "",
    }))
  );
  y += 8;

  y = drawSection(
    doc,
    y,
    "2. Assessment Scores",
    `These are the Core Curriculum Assessment Scores for ${universityName} for ${semesterName}. Each outcome receives an Assessment Score based on the student scores on the core assessment assignments assigned to the outcome. The Assessment Score is the average student assignment score for that outcome after the student assignment score is converted to the Assessment Score scale. Student Scores is the number of student assignment scores included in the average.`
  );
  const scoreRows = (activeAssessmentOutcomes.length ? activeAssessmentOutcomes : activeOutcomes).map((outcome) => {
    const assessment = assessmentByOutcomeId.get(Number(outcome.id)) || outcome;
    const row = {
      outcome: outcomeLabel(outcome),
      averageScore: scoreText(assessment.averageScore, assessment.scoreDescription),
      gradeCount: assessment.gradeCount == null ? "" : String(assessment.gradeCount),
    };
    scoreColumns.forEach((column) => {
      row[column.key] = scorePercent(assessment, column.key);
    });
    return row;
  });
  y = drawTable(
    doc,
    y,
    withDistribution(
      [
        { title: "University Outcome", key: "outcome", width: 110 },
        { title: "Assessment Score", key: "averageScore", width: 48 },
        { title: "Student Scores", key: "gradeCount", width: 28 },
      ],
      scoreColumns
    )
  )(scoreRows);
  y += 8;

  y = drawSection(
    doc,
    y,
    "3. Assignments Used for Assessment",
    `These are the core assessment assignments for ${universityName} for ${semesterName}. Each row is an assignment used for a university outcome, with the section, department, assessment score, student scores, and score distribution.`
  );
  const assignmentRows = [];
  const sourceOutcomes = activeAssessmentOutcomes.length ? activeAssessmentOutcomes : activeOutcomes;
  sourceOutcomes.forEach((outcome) => {
    (outcome.assignments || []).forEach((assignment) => {
      const row = {
        outcome: outcomeLabel(outcome),
        section: sectionLabel(assignment),
        department: assignment.department || "",
        name: assignment.name || "",
        averageScore: assignment.averageScore == null ? "" : String(assignment.averageScore),
        gradeCount: assignment.gradeCount == null ? "" : String(assignment.gradeCount),
      };
      scoreColumns.forEach((column) => {
        row[column.key] = scorePercent(assignment, column.key);
      });
      assignmentRows.push(row);
    });
  });
  drawTable(
    doc,
    y,
    withDistribution(
      [
        { title: "University Outcome", key: "outcome", width: 36 },
        { title: "Section", key: "section", width: 36 },
        { title: "Department", key: "department", width: 32 },
        { title: "Assignment", key: "name", width: 36 },
        { title: "Assessment Score", key: "averageScore", width: 28 },
        { title: "Student Scores", key: "gradeCount", width: 24 },
      ],
      scoreColumns
    )
  )(assignmentRows);

  return doc;
};
