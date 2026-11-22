export type BillParticipant = {
  userId: string
  shareAmount: number
}

export type BillForBalance = {
  paidBy: string
  amount: number
  participants: BillParticipant[]
}

export type Debt = {
  from: string
  to: string
  amount: number
}

export type SettlementForBalance = {
  from: string
  to: string
  amount: number
}

/**
 * Hitung bersih saldo tiap user dari sekumpulan bill, lalu sederhanakan
 * menjadi daftar transfer minimal (netting). Contoh rantai:
 *   A→B 500, B→C 500  =>  A→C 500 (B netral).
 *
 * Aturan per bill untuk tiap peserta p:
 *   p sudah menanggung sebesar shareAmount (utang ke pembayar),
 *   sedangkan pembayar membayar `amount` penuh.
 * Saldo bersih p = total share - total yang ia bayarkan (sebagai paidBy).
 * Saldo > 0  => p berutang; saldo < 0 => p berpiutang.
 *
 * Settlements (pembayaran yang sudah dilakukan) mengurangi saldo:
 *   from membayar `amount` ke to  =>  saldo from -= amount, saldo to += amount.
 */
export function computeBalances(
  bills: BillForBalance[],
  settlements: SettlementForBalance[] = [],
): Map<string, number> {
  const balance = new Map<string, number>()

  function add(userId: string, delta: number): void {
    balance.set(userId, (balance.get(userId) ?? 0) + delta)
  }

  for (const bill of bills) {
    add(bill.paidBy, -bill.amount)
    for (const participant of bill.participants) {
      add(participant.userId, participant.shareAmount)
    }
  }

  for (const settlement of settlements) {
    add(settlement.from, -settlement.amount)
    add(settlement.to, settlement.amount)
  }

  return balance
}

/**
 * Ubah saldo bersih menjadi daftar transfer minimal (debtor -> creditor).
 * Angka dibulatkan ke 2 desimal; selisih < 0.01 diabaikan.
 */
export function computeDebts(
  bills: BillForBalance[],
  settlements: SettlementForBalance[] = [],
): Debt[] {
  const balances = computeBalances(bills, settlements)

  const debtors: { userId: string; amount: number }[] = []
  const creditors: { userId: string; amount: number }[] = []

  for (const [userId, raw] of balances) {
    const amount = round2(raw)
    if (amount > 0) debtors.push({ userId, amount })
    else if (amount < 0) creditors.push({ userId, amount: -amount })
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const debts: Debt[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const settled = Math.min(debtor.amount, creditor.amount)

    if (settled > 0.004) {
      debts.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: round2(settled),
      })
    }

    debtor.amount = round2(debtor.amount - settled)
    creditor.amount = round2(creditor.amount - settled)

    if (debtor.amount <= 0.004) i += 1
    if (creditor.amount <= 0.004) j += 1
  }

  return debts
}

/**
 * Saldo bersih satu user: positif = user berutang, negatif = berpiutang.
 * (Setelah memperhitungkan settlements.)
 */
export function netBalanceForUser(
  bills: BillForBalance[],
  settlements: SettlementForBalance[],
  userId: string,
): number {
  let balance = 0
  for (const bill of bills) {
    if (bill.paidBy === userId) balance -= bill.amount
    for (const participant of bill.participants) {
      if (participant.userId === userId) balance += participant.shareAmount
    }
  }
  for (const settlement of settlements) {
    if (settlement.from === userId) balance -= settlement.amount
    if (settlement.to === userId) balance += settlement.amount
  }
  return round2(balance)
}

export type BillStatusInput = BillForBalance & {
  id: string
  createdAt: string
}

export type BillStatus = 'paid' | 'unpaid'

/**
 * Tentukan status PAID/UNPAID untuk tiap bill, dari sudut pandang `userId`,
 * secara PER BILL (bukan per grup).
 *
 * Aturan:
 * - Hanya bill yang memuat `userId` sebagai peserta yang punya "bagian" baginya.
 * - Bagian user pada bill = share_amount-nya.
 * - Total pembayaran yang sudah dilakukan user di grup ini (settlements dengan
 *   from = userId) dialokasikan FIFO ke bill TERTUA lebih dulu.
 * - Bill berstatus 'unpaid' bila bagian user padanya belum tertutup penuh.
 * - Bill tanpa bagian user (mis. user adalah pembayar / bukan peserta)
 *   dianggap 'paid' (tidak ada yang perlu ia bayar).
 *
 * Fungsi murni, tanpa Supabase.
 */
export function billStatusesForUser(
  bills: BillStatusInput[],
  settlements: SettlementForBalance[],
  userId: string,
): Map<string, BillStatus> {
  const status = new Map<string, BillStatus>()

  // Total pembayaran user di grup (settlement dari user).
  let remainingPaid = round2(
    settlements
      .filter((settlement) => settlement.from === userId)
      .reduce((sum, settlement) => sum + settlement.amount, 0),
  )

  // Alokasikan pembayaran FIFO ke bill tertua lebih dulu.
  const ordered = [...bills].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  for (const bill of ordered) {
    const share = bill.participants.find(
      (participant) => participant.userId === userId,
    )
    const userShare = share ? round2(share.shareAmount) : 0

    if (userShare <= 0) {
      // Tidak ada bagian untuk user pada bill ini.
      status.set(bill.id, 'paid')
      continue
    }

    if (remainingPaid >= userShare) {
      remainingPaid = round2(remainingPaid - userShare)
      status.set(bill.id, 'paid')
    } else {
      // Tertutup sebagian (atau belum sama sekali) -> masih unpaid.
      remainingPaid = 0
      status.set(bill.id, 'unpaid')
    }
  }

  return status
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
