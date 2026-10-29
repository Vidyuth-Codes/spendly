export type LoanDirection = 'lent' | 'borrowed';

export type LoanPayment = { id: string; amount_paise: number; paid_on: string; created_at: string };

export type Loan = {
  id: string;
  person: string;
  direction: LoanDirection;
  amount_paise: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
  payments: LoanPayment[];
};

export type LoanBalance = {
  paidPaise: number;
  remainingPaise: number;
  settled: boolean;
  /** 0..1 share already repaid. */
  ratio: number;
};

export function loanBalance(loan: Loan): LoanBalance {
  const paidPaise = Math.min(
    loan.amount_paise,
    loan.payments.reduce((sum, p) => sum + p.amount_paise, 0),
  );
  const remainingPaise = loan.amount_paise - paidPaise;
  return {
    paidPaise,
    remainingPaise,
    settled: remainingPaise === 0,
    ratio: loan.amount_paise > 0 ? paidPaise / loan.amount_paise : 0,
  };
}

export type LoanSummary = {
  /** Still owed to you by others. */
  owedToYouPaise: number;
  /** Still owed by you to others. */
  youOwePaise: number;
  /** owedToYou - youOwe: positive means people owe you overall. */
  netPaise: number;
  openCount: number;
};

export function summarizeLoans(loans: Loan[]): LoanSummary {
  let owedToYouPaise = 0;
  let youOwePaise = 0;
  let openCount = 0;
  for (const loan of loans) {
    const b = loanBalance(loan);
    if (b.settled) continue;
    openCount++;
    if (loan.direction === 'lent') owedToYouPaise += b.remainingPaise;
    else youOwePaise += b.remainingPaise;
  }
  return { owedToYouPaise, youOwePaise, netPaise: owedToYouPaise - youOwePaise, openCount };
}

/** Open loans first (newest first), settled ones after. */
export function sortLoans(loans: Loan[]): Loan[] {
  return [...loans].sort((a, b) => {
    const sa = loanBalance(a).settled ? 1 : 0;
    const sb = loanBalance(b).settled ? 1 : 0;
    return sa - sb || b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at);
  });
}
