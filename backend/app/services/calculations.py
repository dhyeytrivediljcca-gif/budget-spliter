"""
Financial calculation engine for RoomieSplit.

All amounts are in INTEGER PAISE (1 INR = 100 paise).
Never use floating-point for authoritative money calculations.
"""
from decimal import Decimal
from typing import List, Dict


def rupees_to_paise(rupees: float | int | str) -> int:
    """Convert rupees (can be decimal) to integer paise, rounding half-up."""
    return int((Decimal(str(rupees)) * Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP"))


def paise_to_rupees(paise: int) -> float:
    """Convert paise to rupees float for display only."""
    return paise / 100.0


def calculate_equal_split(
    total_paise: int,
    member_ids: List[str],
) -> Dict[str, int]:
    """
    Divide total_paise equally among members.

    Remainder paise are distributed one paise at a time to the first N members
    to ensure sum == total_paise (deterministic rounding).

    Returns: {member_id: share_paise}
    """
    if total_paise <= 0:
        raise ValueError("Total amount must be positive")
    if not member_ids:
        raise ValueError("At least one member required")

    n = len(member_ids)
    base_share = total_paise // n
    remainder = total_paise % n

    shares: Dict[str, int] = {}
    for i, mid in enumerate(member_ids):
        shares[mid] = base_share + (1 if i < remainder else 0)

    assert sum(shares.values()) == total_paise, "Split does not sum to total"
    return shares


def validate_custom_split(
    total_paise: int,
    splits: Dict[str, int],
) -> None:
    """
    Validate that custom splits sum exactly to the total.
    Raises ValueError on mismatch or negative values.
    """
    if any(v < 0 for v in splits.values()):
        raise ValueError("Share amounts must be non-negative")
    total_splits = sum(splits.values())
    if total_splits != total_paise:
        diff = total_splits - total_paise
        raise ValueError(
            f"Custom split total ({total_splits} paise) does not match "
            f"expense total ({total_paise} paise). Difference: {diff} paise."
        )


def calculate_percentage_split(
    total_paise: int,
    member_percentages: Dict[str, float],
) -> Dict[str, int]:
    """
    Split by percentage. Percentages must sum to 100.
    Distributes remainder paise deterministically.
    """
    if abs(sum(member_percentages.values()) - 100.0) > 0.001:
        raise ValueError("Percentages must sum to 100")

    # Use integer arithmetic: compute each share and then fix rounding
    raw_paise: Dict[str, Decimal] = {
        mid: Decimal(str(pct / 100)) * total_paise
        for mid, pct in member_percentages.items()
    }
    floored = {mid: int(v) for mid, v in raw_paise.items()}
    remainder = total_paise - sum(floored.values())

    # Distribute remainder by fractional part descending, then alphabetical
    def sort_key(item):
        mid, raw = item
        frac = raw_paise[mid] - floored[mid]
        return (-frac, mid)

    sorted_members = sorted(floored.items(), key=sort_key)
    shares: Dict[str, int] = dict(floored)
    for i, (mid, _) in enumerate(sorted_members):
        if i < remainder:
            shares[mid] += 1
        else:
            break

    assert sum(shares.values()) == total_paise
    return shares


def compute_balances(
    expenses: list,        # list of (payer_id, total_paise, shares: dict[member_id, paise])
    repayments: list,      # list of (debtor_id, creditor_id, amount_paise, confirmed=True)
) -> Dict[str, int]:
    """
    Compute net balance for every participant.

    Convention:
      positive  → member should RECEIVE money
      negative  → member OWES money
      zero      → settled

    Formula per member:
      balance = total_paid_paise - total_share_paise + net_repayments

    For repayments (only confirmed ones affect balances):
      debtor's balance increases (debt reduced)
      creditor's balance decreases (receivable reduced)

    Net of all balances should be 0.
    """
    balances: Dict[str, int] = {}

    for payer_id, total_paise, shares in expenses:
        # Payer gets credit for the full amount
        balances[payer_id] = balances.get(payer_id, 0) + total_paise
        # Each member's share is debited
        for member_id, share_paise in shares.items():
            balances[member_id] = balances.get(member_id, 0) - share_paise

    for debtor_id, creditor_id, amount_paise, confirmed in repayments:
        if not confirmed:
            continue
        # Debtor pays → their debt reduces (balance goes up)
        balances[debtor_id] = balances.get(debtor_id, 0) + amount_paise
        # Creditor receives → their receivable reduces (balance goes down)
        balances[creditor_id] = balances.get(creditor_id, 0) - amount_paise

    return balances


def suggest_settlements(balances: Dict[str, int]) -> List[Dict]:
    """
    Generate minimal settlement transfers using a greedy algorithm.

    Returns list of {from_id, to_id, amount_paise} where amount > 0.
    Total transfers should sum to 0 (debtors pay creditors exactly).
    """
    debtors = sorted(
        [(mid, -bal) for mid, bal in balances.items() if bal < 0],
        key=lambda x: -x[1],
    )
    creditors = sorted(
        [(mid, bal) for mid, bal in balances.items() if bal > 0],
        key=lambda x: -x[1],
    )

    settlements = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]

        transfer = min(debt, credit)
        if transfer > 0:
            settlements.append({
                "from_id": debtor_id,
                "to_id": creditor_id,
                "amount_paise": transfer,
            })

        debtors[i] = (debtor_id, debt - transfer)
        creditors[j] = (creditor_id, credit - transfer)

        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return settlements
