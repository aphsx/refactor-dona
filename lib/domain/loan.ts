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
};

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
