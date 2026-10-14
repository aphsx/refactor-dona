export type LoanLookup = { id: number; code: string; name: string };

export type LoanAccount = {
  id: string;
  farmerId: string | null;
  name: string;
  tel: string;
  nationalId: string;
  creditLimit: number;
  balance: number;
  installmentMonths: number;
  nextDue: string | null;
  lastDue: string | null;
  statusId: number;
  status: LoanLookup;
};

export type LoanApplicationDocument = {
  kindId: number;
  code: string;
  name: string;
  attached: boolean;
  /** Present when API sends it; otherwise inferred from kind id. */
  required?: boolean;
  /** Public Supabase URL (or legacy path) when a file was uploaded. */
  storagePath?: string | null;
};

/** Wireframe: 4 จำเป็น — บัตร / ทะเบียนบ้าน / โฉนด / บัตรผู้ค้ำ (ทะเบียนสมรสไม่บังคับ) */
export const LOAN_REQUIRED_DOCUMENT_KIND_IDS = new Set([1101, 1102, 1104, 1105]);

/** Application under review — shown on รออนุมัติ. */
export const LOAN_APPLICATION_STATUS_REVIEWING_ID = 902;

export function isLoanDocumentRequired(doc: Pick<LoanApplicationDocument, "kindId" | "required">) {
  if (typeof doc.required === "boolean") return doc.required;
  return LOAN_REQUIRED_DOCUMENT_KIND_IDS.has(doc.kindId);
}

export function loanRequiredDocumentProgress(documents: LoanApplicationDocument[]) {
  const required = documents.filter((doc) => isLoanDocumentRequired(doc));
  return {
    attached: required.filter((doc) => doc.attached).length,
    total: required.length || LOAN_REQUIRED_DOCUMENT_KIND_IDS.size,
  };
}

export type LoanApplication = {
  id: string;
  farmerId: string | null;
  farmerName: string;
  tel: string;
  nationalId: string;
  requestedAmount: number;
  purpose: string;
  submittedOn: string;
  statusId: number;
  status: LoanLookup;
  documents: LoanApplicationDocument[];
};

export type LoanHistory = {
  id: string;
  farmerId: string | null;
  farmerName: string;
  tel: string;
  nationalId: string;
  amount: number;
  purpose: string;
  approvedOn: string | null;
  transferredOn: string | null;
  resultId: number;
  result: LoanLookup;
  note: string;
};
