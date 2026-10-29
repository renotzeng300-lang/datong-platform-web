export type Role = 'director' | 'dept_lead' | 'business_owner' | 'staff' | 'eval_coordinator' | 'sysadmin';
export type Me = {
  user_id: string;
  person_id: string;
  name: string;
  title: string | null;
  department_id: string;
  employment_status: string;
  account_status: string;
  active: boolean;
  is_director: boolean;
  roles: { role: Role; department_id: string | null }[];
};
export type TaskRow = {
  id: string; case_id: string | null; title: string; department_id: string; department_name: string;
  owner_person_id: string | null; owner_name: string | null; coordinator_person_id: string | null; coordinator_name: string | null;
  reviewer_person_id: string | null; stage: string | null; deliverables: string | null; cross_support: string | null;
  start_on: string | null; due_on: string | null; next_followup_on: string | null; status: string; approval_status: string;
  approved_by: string | null; approved_at: string | null; completed_on: string | null; closed_on: string | null;
  priority: string; sensitivity: string; evidence_restricted: boolean; pdf_page: number | null; result_link: string | null;
  notes: string | null; source_sheet: string | null; source_row: number | null; source_status_raw: string | null;
  source_approval_raw: string | null; collaborator_names: string | null; indicator_ids: string[] | null;
  last_activity_at: string; is_overdue: boolean; due_in_7: boolean; due_in_14: boolean; days_to_due: number | null;
  needs_handoff: boolean; created_at: string; updated_at: string; created_by: string | null; closed_by: string | null;
  risk_category: string | null; risk_severity: string | null;
  latest_report_at: string | null; latest_next_action: string | null; latest_next_action_due_on: string | null;
  latest_support_type: string | null; latest_support_request: string | null;
};
export type ActionResult = { ok: boolean; message: string; code?: string } | null;
