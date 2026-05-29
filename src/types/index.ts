/* ─── Core Entity Types ─── */

export interface Employee {
  employee_number: string;
  first_name: string;
  last_name: string;
  supervisor: string;
  division: 'INJ' | 'MFG' | string;
  hire_date: string;
  phone: string;
  shift: '1st' | '2nd' | '3rd' | string;
  perm_temp: 'PERM' | 'TEMP' | string;
  department: string;
  EmpKey: string;
  email: string;
}

export interface Assignment {
  AssignmentID: string;
  EmpKey: string;
  TopicID: string;
  DateAssigned: string;
  AssignDate?: string;       // AppSheet alias for DateAssigned
  AssignMode: 'People' | 'Department' | string;
  DueDate: string;
  Status: 'Completed' | 'Assigned' | string;
  RequestID?: string;
  BatchID?: string;          // AppSheet alias for RequestID
  IsActive?: boolean | string;  // Optional — missing means active
}

export interface AssignRequest {
  RequestID: string;
  AssignMode: 'People' | 'Department' | string;
  TopicID: string;
  SelectedEmployees: string;
  SelectedPeople: string;
  SelectedDepartment: string;
  SelectedDivision: string;
  RequestBy: string;
  RequestAt: string;
  DueDate: string;
}

export interface QuizQuestion {
  QuestionID: string;
  TopicID: string;
  QuestionText: string;
  ChoiceA: string;
  ChoiceB: string;
  ChoiceC: string;
  ChoiceD: string;
  CorrectChoice: string;
}

export interface QuizResponse {
  ResponseID: string;
  AssignmentID: string;
  EmpKey: string;
  QuestionID: string;
  SelectedAnswer: string;
  IsCorrect: boolean | string;
  DateTime: string;
}

export interface Session {
  SessionID: string;
  DeviceID: string;
  DeviceUser: string;
  LoggedInEmpKey: string;
  InputDivision: string;
  LoggedInAt: string;
  LoggedOutAt: string;
  InputEmployeeNumber: string;
}

export interface CheckMissing {
  EmpKey: string;
  division: string;
  perm_temp: string;
  first_name: string;
  last_name: string;
  [topicId: string]: string | number; // RMKT00001: 1 | 0 | 'No sent' | 'Sick Leave'
}

export interface SummaryRow {
  TopicID: string;
  Assigned: number;
  Completed: number;
  Total: number;
  Variance: number;
}

/* ─── Topic Mapping ─── */

export interface TopicMeta {
  name: string;
  category: string;
  requiredBy: string[];   // department names or 'all'
  frequency: 'annual' | 'biannual' | 'one-time' | 'quarterly' | string;
}

/** Raw Topic row from AppSheet Topics table */
export interface Topic {
  TopicID: string;
  Title: string;
  Description?: string;
  Seq?: number;
  Status?: string;
  CreatedByEmail?: string;
  MaterialLink?: string;
}

/* ─── Compliance Status ─── */

export enum ComplianceStatus {
  COMPLETED   = 'Completed',
  PENDING     = 'Pending',
  OVERDUE     = 'Overdue',
  NOT_ASSIGNED = 'Not Assigned',
  EXEMPT      = 'Exempt',
  SICK_LEAVE  = 'Sick Leave',
  NOT_SENT    = 'Not Sent',
  INACTIVE    = 'Inactive',
}

/* ─── Alerts ─── */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'TRAINING_DUE_SOON'
  | 'TRAINING_OVERDUE'
  | 'LOW_QUIZ_SCORE'
  | 'DEPARTMENT_BELOW_THRESHOLD'
  | 'INACTIVE_STILL_ASSIGNED';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  relatedIds?: string[];
  affectedCount?: number;
  department?: string;
  topicId?: string;
  timestamp: Date;
}

/* ─── Insights ─── */

export type InsightCategory = 'risk' | 'attention' | 'followup' | 'failure';

export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  description: string;
  severity: AlertSeverity;
  data: Record<string, unknown>;
  suggestedAction: string;
}

/* ─── Roles ─── */

export enum Role {
  ADMIN      = 'admin',
  SUPERVISOR = 'supervisor',
  VIEWER     = 'viewer',
  EMPLOYEE   = 'employee',
}

/* ─── Analytics Snapshot ─── */

export interface AnalyticsSnapshot {
  completionRate: number;
  overdueCount: number;
  highRiskDepartments: DepartmentStat[];
  missingRequired: MissingTraining[];
  avgQuizScore: number;
  mostFailedTopic: { topicId: string; name: string; failRate: number };
  weeklyCompleted: number;
  departmentBreakdown: DepartmentStat[];
  divisionBreakdown: DivisionStat[];
  topicBreakdown: TopicStat[];
  supervisorSummary: SupervisorStat[];
  totalEmployees: number;
  totalTopics: number;
  totalAssignments: number;
}

export interface DepartmentStat {
  department: string;
  completed: number;
  total: number;
  rate: number;
  overdue: number;
}

export interface DivisionStat {
  division: string;
  completed: number;
  total: number;
  rate: number;
}

export interface TopicStat {
  topicId: string;
  name: string;
  assigned: number;
  completed: number;
  overdue: number;
  pending: number;
  rate: number;
}

export interface SupervisorStat {
  supervisor: string;
  employeeCount: number;
  missingCount: number;
  overdueCount: number;
  employees: string[];
}

export interface MissingTraining {
  empKey: string;
  employeeName: string;
  department: string;
  missingTopics: string[];
}

/* ─── Data Store ─── */

export type DataSourceType = 'appsheet' | 'google' | 'sample' | 'auto';

export interface DataMeta {
  source: DataSourceType;
  loadedAt: Date | null;
  errors: DataError[];
  cached: boolean;
}

export interface DataError {
  source: DataSourceType;
  table: string;
  message: string;
  status?: number;
}

export interface ValidationIssue {
  category: string;
  severity: 'error' | 'warning';
  message: string;
  recordId?: string;
  field?: string;
}

export interface AppData {
  employees: Employee[];
  assignments: Assignment[];
  assignRequests: AssignRequest[];
  quizQuestions: QuizQuestion[];
  quizResponses: QuizResponse[];
  sessions: Session[];
  checkMissing: CheckMissing[];
  summary: SummaryRow[];
}

export interface Filters {
  dateRange: { start: string; end: string } | null;
  department: string;
  division: string;
  shift: string;
  supervisor: string;
  topic: string[];
  status: string;
  search: string;
}
