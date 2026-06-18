import { ProjectsManager } from "./classes/ProjectsManager";
import type { Project } from "./classes/Project";
import type { IProject, ProjectStatus } from "./classes/Project";

const projectImage1 = new URL("./assets/mp9tdjw6-image.png", import.meta.url).href;
const projectImage2 = new URL("./assets/mp9tjoks-image.png", import.meta.url).href;
const projectImage3 = new URL("./assets/mp9tmqe0-image.png", import.meta.url).href;

export type ProjectView = "card" | "list";
export type StandardTabId = "bep" | "naming" | "cde";
export type BadgeTone = "ok" | "warn" | "danger" | "neutral";

export interface ProjectDisplay {
  code: string;
  label: string;
  estimatedCompletion: string;
  startDateLabel: string;
  finishDateLabel: string;
  statusLabel: string;
  statusTone: Extract<BadgeTone, "ok" | "warn">;
  progress: number;
  image: string;
}

export interface AppProject extends Project {
  display: ProjectDisplay;
}

export interface StatItem {
  label: string;
  value: string;
  tone?: BadgeTone;
}

export interface ModelFile {
  name: string;
  loaded: boolean;
}

export interface ClashRecord {
  id: string;
  status: string;
  statusTone: Extract<BadgeTone, "ok" | "warn">;
  severity: string;
  severityTone: BadgeTone;
  disciplines: string;
  assignedTo: string;
  dateFound: string;
}

export interface DocumentRecord {
  drawingNumber: string;
  title: string;
  revision: string;
  status: "Approved" | "Pending" | "In Review";
  owner: string;
  dueDate: string;
  overdue?: boolean;
}

export interface ProjectMember {
  email: string;
  role: "Admin" | "Member";
  status: "Active";
}

export interface StandardCard {
  kicker: string;
  title: string;
  body: string;
}

export interface RuleItem {
  code: string;
  title: string;
  note: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

export interface NamingRule {
  field: string;
  example: string;
  rule: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

export interface CdeTask {
  category: string;
  detail: string;
  responseBy: string;
  status: string;
  tone: Extract<BadgeTone, "ok" | "warn">;
}

const seedProjectData: Array<{ id: string; project: IProject; display: ProjectDisplay }> = [
  {
    id: "hxp-ii",
    project: {
      projectName: "Hospital Expansion Phase II",
      projectnumber: 2024001,
      description: "Select a BIM workspace to begin engineering operations.",
      status: "active",
      startDate: new Date("2024-01-12"),
      finishDate: new Date("2025-12-20"),
      members: ["admin@learnthatopen.com", "engineer@site.com"],
      files: {
        ifc: "Architectural.ifc",
        ifcURL: "",
        frag: "HXP-II.frag",
        fragURL: "",
        hasModel: true,
      },
      userRole: "developer",
    },
    display: {
      code: "HXP-II",
      label: "#PRJ-2024-001",
      estimatedCompletion: "Dec 2025",
      startDateLabel: "Jan 12, 2024",
      finishDateLabel: "Dec 20, 2025",
      statusLabel: "Active",
      statusTone: "ok",
      progress: 65,
      image: projectImage1,
    },
  },
  {
    id: "dtc-n",
    project: {
      projectName: "Data Center North Wing",
      projectnumber: 2024042,
      description: "Early coordination model for data hall expansion.",
      status: "pending",
      startDate: new Date("2024-02-05"),
      finishDate: new Date("2026-08-15"),
      members: ["admin@learnthatopen.com", "mep@site.com"],
      files: {
        ifc: "DataCenter.ifc",
        ifcURL: "",
        frag: "DTC-N.frag",
        fragURL: "",
        hasModel: true,
      },
      userRole: "engineer",
    },
    display: {
      code: "DTC-N",
      label: "#PRJ-2024-042",
      estimatedCompletion: "Aug 2026",
      startDateLabel: "Feb 05, 2024",
      finishDateLabel: "Aug 15, 2026",
      statusLabel: "Review",
      statusTone: "warn",
      progress: 12,
      image: projectImage2,
    },
  },
  {
    id: "bgt-s",
    project: {
      projectName: "Bridge Terrace South",
      projectnumber: 2023118,
      description: "Infrastructure and station terrace coordination.",
      status: "active",
      startDate: new Date("2023-05-20"),
      finishDate: new Date("2024-10-10"),
      members: ["admin@learnthatopen.com", "structural@site.com"],
      files: {
        ifc: "BridgeTerrace.ifc",
        ifcURL: "",
        frag: "BGT-S.frag",
        fragURL: "",
        hasModel: true,
      },
      userRole: "architect",
    },
    display: {
      code: "BGT-S",
      label: "#PRJ-2023-118",
      estimatedCompletion: "Oct 2024",
      startDateLabel: "May 20, 2023",
      finishDateLabel: "Oct 10, 2024",
      statusLabel: "Active",
      statusTone: "ok",
      progress: 94,
      image: projectImage3,
    },
  },
];

const projectDisplayById = new Map(seedProjectData.map((entry) => [entry.id, entry.display]));

export const projectsManager = new ProjectsManager();

for (const entry of seedProjectData) {
  projectsManager.newProject(entry.project, entry.id);
}

export const projects = projectsManager.list.map((project) => {
  return Object.assign(project, { display: projectDisplayById.get(project.id)! }) as AppProject;
});

export const getProjectById = (id?: string) => {
  return projects.find((project) => project.id === id) ?? projects[0];
};

export const workspaceTabs = ["Models", "Queries", "Viewer", "Smart Views", "Data", "GIS", "Google Sheet"];

export const modelFiles: ModelFile[] = [
  { name: "Architectural.ifc", loaded: true },
  { name: "Structural.ifc", loaded: true },
  { name: "MEP_Mechanical.ifc", loaded: false },
];

export const clashStats: StatItem[] = [
  { label: "Total Clashes", value: "1,284" },
  { label: "Active / Unresolved", value: "842", tone: "danger" },
  { label: "Critical Severity", value: "156" },
  { label: "Avg. Resolution Time", value: "4.2d" },
];

export const clashRecords: ClashRecord[] = [
  {
    id: "CL-482",
    status: "Open",
    statusTone: "warn",
    severity: "Critical",
    severityTone: "danger",
    disciplines: "ARC vs MEP",
    assignedTo: "J. Doe",
    dateFound: "2024-05-12",
  },
  {
    id: "CL-483",
    status: "Resolved",
    statusTone: "ok",
    severity: "Low",
    severityTone: "neutral",
    disciplines: "STR vs MEP",
    assignedTo: "A. Smith",
    dateFound: "2024-05-11",
  },
  {
    id: "CL-484",
    status: "In Review",
    statusTone: "warn",
    severity: "High",
    severityTone: "warn",
    disciplines: "ARC vs STR",
    assignedTo: "M. Ross",
    dateFound: "2024-05-10",
  },
];

export const documentStats: StatItem[] = [
  { label: "Approved", value: "142", tone: "ok" },
  { label: "Pending Review", value: "28", tone: "warn" },
  { label: "Rejected / Revise", value: "5", tone: "danger" },
  { label: "Overdue", value: "12", tone: "danger" },
];

export const documentRecords: DocumentRecord[] = [
  {
    drawingNumber: "A-101-PL",
    title: "Level 01 Floor Plan",
    revision: "04",
    status: "Approved",
    owner: "Architect",
    dueDate: "2024-06-01",
  },
  {
    drawingNumber: "S-205-DT",
    title: "Foundation Detail B",
    revision: "02",
    status: "Pending",
    owner: "Engineer",
    dueDate: "2024-05-10",
    overdue: true,
  },
  {
    drawingNumber: "M-401-SC",
    title: "HVAC Schematic",
    revision: "01",
    status: "In Review",
    owner: "MEP Lead",
    dueDate: "2024-05-20",
  },
];

export const projectMembers: ProjectMember[] = [
  { email: "admin@learnthatopen.com", role: "Admin", status: "Active" },
  { email: "engineer@site.com", role: "Member", status: "Active" },
];

export const standardFacts = [
  ["Project code", "HXP-II"],
  ["Project name", "Hospital Expansion Phase II"],
  ["Project owner", "City Health Authority"],
  ["Project type", "Healthcare building"],
  ["Consultant", "FEC, MITR"],
];

export const bimFacts = [
  ["BIM uses", "Design authoring, 3D coordination"],
  ["BIM goals", "Eliminate major conflicts"],
  ["Modeling / clash detection", "RVT2025 / Navisworks"],
  ["Collaboration platform", "ACC project hub"],
];

export const bepCards: StandardCard[] = [
  {
    kicker: "BIM uses",
    title: "Design authoring and 3D coordination",
    body: "Authoring discipline models remain separated until coordination sign-off. Published federations must include model version and package stage.",
  },
  {
    kicker: "Model goal",
    title: "Reduce major clashes before issue",
    body: "Critical and high clashes require owner, response date, and linked report before the package can move to review.",
  },
  {
    kicker: "Tools",
    title: "RVT2025 / Navisworks / ACC",
    body: "RVT is the authoring source, Navisworks is the coordination record, and ACC is the approved exchange platform.",
  },
];

export const bepRules: RuleItem[] = [
  {
    code: "01",
    title: "Model origin and coordinates locked",
    note: "Shared coordinates must be verified before first discipline upload.",
    status: "Current",
    tone: "ok",
  },
  {
    code: "02",
    title: "Viewer fields mapped for ACC data pane",
    note: "Use ExternalElementId first; Element ID is the fallback when mapping fails.",
    status: "Review",
    tone: "warn",
  },
  {
    code: "03",
    title: "Clash reports issued weekly",
    note: "MEP, structure, architecture, and specialist models must be included.",
    status: "Current",
    tone: "ok",
  },
];

export const namingCards: StandardCard[] = [
  {
    kicker: "Pattern",
    title: "HXP-ZZ-DR-A-0001-S2-P01",
    body: "Every issued document must include project, originator, type, discipline, number, status, and revision.",
  },
  {
    kicker: "Blocked state",
    title: "Missing discipline code",
    body: "Uploads without discipline, status, or revision are held in draft until corrected by the package owner.",
  },
  {
    kicker: "Active rule set",
    title: "ISO 19650 style control",
    body: "Names are validated against the project matrix before document status can move to shared or published.",
  },
];

export const namingRules: NamingRule[] = [
  { field: "Project code", example: "HXP", rule: "Must match active project code", status: "Valid", tone: "ok" },
  { field: "Originator", example: "ARC", rule: "Approved company code only", status: "Valid", tone: "ok" },
  { field: "Discipline", example: "A / S / M / E", rule: "Required before shared status", status: "Check", tone: "warn" },
  { field: "Revision", example: "P01 / C02", rule: "Preliminary or contract sequence", status: "Valid", tone: "ok" },
];

export const cdeCards: StandardCard[] = [
  {
    kicker: "Owner hub",
    title: "Client review and approvals",
    body: "SharePoint workspace for owner-facing packages, meeting records, and approval responses.",
  },
  {
    kicker: "Design team hub",
    title: "Consultant working exchange",
    body: "Controlled folders for WIP packages, discipline comments, and returned review actions.",
  },
  {
    kicker: "ACC model space",
    title: "Federated model coordination",
    body: "Approved source for model sharing, coordination views, issues, and Navisworks report records.",
  },
];

export const cdeTasks: CdeTask[] = [
  {
    category: "BIM",
    detail: "Update underground model from 2D shop drawings this week",
    responseBy: "MEP Base Building",
    status: "Open",
    tone: "warn",
  },
  {
    category: "BIM Design",
    detail: "Confirm equipment placement in PoE and telco coordination zone",
    responseBy: "MEP Data Hall",
    status: "Closed",
    tone: "ok",
  },
  {
    category: "Document",
    detail: "Upload for-construction drawing package to shared CDE folder",
    responseBy: "Document Control",
    status: "Open",
    tone: "warn",
  },
];

export const projectStatusToLabel: Record<ProjectStatus, string> = {
  pending: "Review",
  active: "Active",
  finished: "Finished",
};
