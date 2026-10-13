import { apiRequest } from "@/lib/api/client";
import type {
  LoanAccount,
  LoanApplication,
  LoanApplicationDocument,
  LoanHistory,
} from "@/lib/domain";

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

export function listLoanApplicationsPage(query: { q?: string; page?: number; pageSize?: number } = {}) {
  return apiRequest<LoanPage<LoanApplication>>(`/loans/applications?${loanListParams(query)}`);
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
