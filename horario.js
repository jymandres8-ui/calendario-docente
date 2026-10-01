/* =====================================================================
   CONFIGURACIÓN Y HORARIO  —  edita este archivo cuando cambie algo
   ===================================================================== */

const CONFIG = {
  inicioClases: "2026-09-01",   // primer día con clases (AAAA-MM-DD)
  finClases: "2027-06-30",      // último día con clases
  avisoClaseMin: 5,             // minutos antes de cada clase para avisar
  zonaHoraria: "America/Guayaquil",
};

// Horas de cada período (según aSc Horarios)
const PERIODOS = {
  1: ["07:00", "07:40"],
  2: ["07:40", "08:20"],
  3: ["08:20", "09:00"],
  4: ["09:00", "09:40"],
  5: ["09:40", "10:20"],
  6: ["10:40", "11:20"],
  7: ["11:20", "12:00"],
  8: ["12:00", "12:40"],
};
const RECREO = ["10:20", "10:40"];

const ASIGNATURAS = {
  ILU: { nombre: "Ilustración Digital Orientada a Diseño", corto: "Ilustración", color: "#2563eb" },
  TRG: { nombre: "Técnicas de Representación Gráfica", corto: "Téc. Repres.", color: "#7c3aed" },
  DCS: { nombre: "Diseño Creativo y Sostenible", corto: "Diseño Creat.", color: "#059669" },
  ACO: { nombre: "Acompañamiento en el Aula", corto: "Acomp. aula", color: "#d97706" },
};

// [día (0=lunes … 4=viernes), período inicial, período final, curso, asignatura]
const HORARIO = [
  // Lunes
  [0, 1, 2, "Segundo Técnico B", "ILU"],
  [0, 3, 4, "Primero Técnico B", "ILU"],
  // Martes
  [1, 1, 2, "Primero Técnico D", "TRG"],
  [1, 3, 3, "Segundo Técnico A", "DCS"],
  [1, 5, 5, "Segundo Técnico B", "DCS"],
  [1, 6, 6, "Segundo Técnico B", "DCS"],
  [1, 7, 8, "Primero Técnico A", "ILU"],
  // Miércoles
  [2, 1, 2, "Segundo Técnico B", "TRG"],
  [2, 5, 5, "Segundo Técnico B", "DCS"],
  [2, 7, 8, "Segundo Técnico C", "ILU"],
  // Jueves
  [3, 1, 2, "Segundo Técnico A", "ILU"],
  [3, 4, 4, "Segundo Técnico C", "DCS"],
  [3, 5, 5, "Segundo Técnico C", "TRG"],
  [3, 6, 6, "Segundo Técnico C", "TRG"],
  // Viernes
  [4, 1, 2, "Segundo Técnico A", "DCS"],
  [4, 4, 4, "Primero Técnico B", "ACO"],
  [4, 5, 5, "Segundo Técnico C", "DCS"],
  [4, 6, 6, "Segundo Técnico C", "DCS"],
];

// Tipos de actividad y su color
const TIPOS = {
  "Deber / Tarea": "#3b82f6",
  "Evaluación": "#ef4444",
  "Proyecto": "#0d9488",
  "Revisión de trabajos": "#8b5cf6",
  "Entrega de notas": "#f59e0b",
  "Reunión": "#64748b",
  "Tutoría": "#10b981",
  "Planificación": "#0ea5e9",
  "Otro": "#6b7280",
};

// Opciones de recordatorio (minutos antes; null = sin recordatorio)
const AVISOS = [
  ["Sin recordatorio", null],
  ["A la hora exacta", 0],
  ["5 minutos antes", 5],
  ["15 minutos antes", 15],
  ["30 minutos antes", 30],
  ["1 hora antes", 60],
  ["1 día antes", 1440],
];
