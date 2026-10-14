import { apiRequest, getApiToken } from "@/lib/api/client";
import type {
  LoanAccount,
  LoanApplication,
  LoanApplicationDocument,
  LoanHistory,
} from "@/lib/domain";
import { compressLoanDocument } from "@/lib/loan-document";

type LoanPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

function loanListParams(query: { q?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  });
  if (query.q?.trim()) params.set("q", query.q.trim());
  return params;
}

export function listLoanAccountsPage(query: { q?: string; page?: number; pageSize?: number } = {}) {
  return apiRequest<LoanPage<LoanAccount>>(`/loans/accounts?${loanListParams(query)}`);
}

export function getLoanAccount(id: string) {
  return apiRequest<LoanAccount>(`/loans/accounts/${encodeURIComponent(id)}`);
}

export function listLoanApplicationsPage(
  query: { q?: string; page?: number; pageSize?: number; statusId?: number } = {},
) {
  const params = loanListParams(query);
  if (query.statusId != null && query.statusId > 0) {
    params.set("statusId", String(query.statusId));
  }
  return apiRequest<LoanPage<LoanApplication>>(`/loans/applications?${params}`);
}

/** Mill staff: approve or reject a reviewing application. */
export function decideLoanApplication(
  id: string,
  decision: "approve" | "reject",
  note = "",
) {
  return apiRequest<LoanApplication>(`/loans/applications/${encodeURIComponent(id)}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
}

export function getLoanApplication(id: string) {
  return apiRequest<LoanApplication>(`/loans/applications/${encodeURIComponent(id)}`);
}

export function listLoanHistoryPage(query: { q?: string; page?: number; pageSize?: number } = {}) {
  return apiRequest<LoanPage<LoanHistory>>(`/loans/history?${loanListParams(query)}`);
}

export function getLoanHistory(id: string) {
  return apiRequest<LoanHistory>(`/loans/history/${encodeURIComponent(id)}`);
}

export function setLoanApplicationDocumentAttached(applicationId: string, kindId: number, attached: boolean) {
  return apiRequest<LoanApplicationDocument>(
    `/loans/applications/${encodeURIComponent(applicationId)}/documents/${kindId}`,
    { method: "PATCH", body: JSON.stringify({ attached }) },
  );
}

/** Upload PDF/image via Next → Supabase (`loan-documents`), then save public URL. */
export async function uploadLoanDocument(applicationId: string, kindId: number, file: File) {
  const token = getApiToken();
  if (!token) throw new Error("ต้องเข้าสู่ระบบก่อน");

  const prepared = await compressLoanDocument(file);

  const form = new FormData();
  form.set("applicationId", applicationId);
  form.set("kindId", String(kindId));
  form.set("file", prepared);

  const response = await fetch("/api/loan-document", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "อัปโหลดเอกสารไม่สำเร็จ");
  }
  return body as LoanApplicationDocument;
}
