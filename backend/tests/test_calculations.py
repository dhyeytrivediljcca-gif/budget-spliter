"""
Unit tests for the financial calculation engine.

Run: cd backend && python -m pytest tests/ -v
"""
import pytest
from app.services.calculations import (
    rupees_to_paise,
    paise_to_rupees,
    calculate_equal_split,
    validate_custom_split,
    calculate_percentage_split,
    compute_balances,
    suggest_settlements,
)


# ─── Conversion ──────────────────────────────────────────────────────────────

def test_rupees_to_paise_integer():
    assert rupees_to_paise(100) == 10000
    assert rupees_to_paise(0) == 0


def test_rupees_to_paise_decimal():
    assert rupees_to_paise(99.99) == 9999
    assert rupees_to_paise(0.01) == 1
    assert rupees_to_paise(300.50) == 30050


def test_paise_to_rupees():
    assert paise_to_rupees(10000) == 100.0
    assert paise_to_rupees(30050) == 300.5


# ─── Equal Split ─────────────────────────────────────────────────────────────

def test_equal_split_two_persons_even():
    result = calculate_equal_split(20000, ["A", "B"])
    assert result == {"A": 10000, "B": 10000}
    assert sum(result.values()) == 20000


def test_equal_split_three_persons_even():
    # 300 INR = 30000 paise, splits evenly
    result = calculate_equal_split(30000, ["A", "B", "C"])
    assert result == {"A": 10000, "B": 10000, "C": 10000}
    assert sum(result.values()) == 30000


def test_equal_split_three_persons_remainder():
    # 10001 paise / 3 = 3333 remainder 2 → first two get 3334
    result = calculate_equal_split(10001, ["A", "B", "C"])
    assert result["A"] == 3334
    assert result["B"] == 3334
    assert result["C"] == 3333
    assert sum(result.values()) == 10001


def test_equal_split_single_member():
    result = calculate_equal_split(5000, ["A"])
    assert result == {"A": 5000}


def test_equal_split_remainder_one():
    # 100 paise / 3 = 33 remainder 1 → A gets 34
    result = calculate_equal_split(100, ["A", "B", "C"])
    assert result["A"] == 34
    assert result["B"] == 33
    assert result["C"] == 33
    assert sum(result.values()) == 100


def test_equal_split_empty_members():
    with pytest.raises(ValueError):
        calculate_equal_split(10000, [])


def test_equal_split_zero_amount():
    with pytest.raises(ValueError):
        calculate_equal_split(0, ["A", "B"])


def test_equal_split_negative_amount():
    with pytest.raises(ValueError):
        calculate_equal_split(-100, ["A", "B"])


# ─── Custom Split ─────────────────────────────────────────────────────────────

def test_custom_split_valid():
    splits = {"A": 10000, "B": 20000}
    validate_custom_split(30000, splits)  # should not raise


def test_custom_split_mismatch():
    splits = {"A": 10000, "B": 15000}
    with pytest.raises(ValueError, match="does not match"):
        validate_custom_split(30000, splits)


def test_custom_split_negative_share():
    splits = {"A": -100, "B": 30100}
    with pytest.raises(ValueError, match="non-negative"):
        validate_custom_split(30000, splits)


def test_custom_split_exact_match():
    splits = {"A": 30000}
    validate_custom_split(30000, splits)


# ─── Percentage Split ─────────────────────────────────────────────────────────

def test_percentage_split_equal():
    result = calculate_percentage_split(30000, {"A": 33.33, "B": 33.33, "C": 33.34})
    assert sum(result.values()) == 30000


def test_percentage_split_fifty_fifty():
    result = calculate_percentage_split(10000, {"A": 50.0, "B": 50.0})
    assert result == {"A": 5000, "B": 5000}
    assert sum(result.values()) == 10000


def test_percentage_split_invalid_total():
    with pytest.raises(ValueError, match="sum to 100"):
        calculate_percentage_split(10000, {"A": 50.0, "B": 40.0})


# ─── Balance Computation ──────────────────────────────────────────────────────

def test_balance_two_person_equal_split():
    """Dhyey pays 300, split equally with A."""
    expenses = [
        ("dhyey", 30000, {"dhyey": 15000, "A": 15000}),
    ]
    balances = compute_balances(expenses, [])
    # dhyey paid 30000, share=15000 → net = +15000
    assert balances["dhyey"] == 15000
    # A paid 0, share=15000 → net = -15000
    assert balances["A"] == -15000
    # Conservation: sum = 0
    assert sum(balances.values()) == 0


def test_balance_three_person_equal_split():
    """Example from spec: Dhyey pays 300, three-way split."""
    expenses = [
        ("dhyey", 30000, {"dhyey": 10000, "A": 10000, "B": 10000}),
    ]
    balances = compute_balances(expenses, [])
    assert balances["dhyey"] == 20000   # should receive 200
    assert balances["A"] == -10000      # owes 100
    assert balances["B"] == -10000      # owes 100
    assert sum(balances.values()) == 0


def test_balance_multiple_payers():
    """Multiple purchases by different members."""
    expenses = [
        ("A", 20000, {"A": 10000, "B": 10000}),
        ("B", 10000, {"A": 5000, "B": 5000}),
    ]
    balances = compute_balances(expenses, [])
    # A: paid=20000, share=15000 → +5000
    assert balances["A"] == 5000
    # B: paid=10000, share=15000 → -5000
    assert balances["B"] == -5000
    assert sum(balances.values()) == 0


def test_balance_payer_not_beneficiary():
    """Payer buys only for others, not themselves."""
    expenses = [
        ("A", 10000, {"B": 5000, "C": 5000}),
    ]
    balances = compute_balances(expenses, [])
    assert balances["A"] == 10000   # paid, not a beneficiary
    assert balances["B"] == -5000
    assert balances["C"] == -5000
    assert sum(balances.values()) == 0


def test_balance_confirmed_repayment():
    """Repayment reduces balances correctly."""
    expenses = [
        ("dhyey", 30000, {"dhyey": 10000, "A": 10000, "B": 10000}),
    ]
    repayments = [
        ("A", "dhyey", 10000, True),  # A pays dhyey 100
    ]
    balances = compute_balances(expenses, repayments)
    assert balances["dhyey"] == 10000   # was +20000, received 10000 → +10000
    assert balances["A"] == 0           # was -10000, paid 10000 → 0
    assert balances["B"] == -10000
    assert sum(balances.values()) == 0


def test_balance_unconfirmed_repayment_ignored():
    """Pending repayments must not affect balances."""
    expenses = [
        ("dhyey", 30000, {"dhyey": 10000, "A": 10000, "B": 10000}),
    ]
    repayments = [
        ("A", "dhyey", 10000, False),  # pending, not confirmed
    ]
    balances = compute_balances(expenses, repayments)
    assert balances["dhyey"] == 20000
    assert balances["A"] == -10000


def test_balance_full_settlement():
    """Full settlement → all balances zero."""
    expenses = [
        ("A", 10000, {"A": 5000, "B": 5000}),
    ]
    repayments = [
        ("B", "A", 5000, True),
    ]
    balances = compute_balances(expenses, repayments)
    assert balances["A"] == 0
    assert balances["B"] == 0


def test_balance_conservation_always_zero():
    """Net of all balances must always sum to zero."""
    expenses = [
        ("A", 15000, {"A": 5000, "B": 5000, "C": 5000}),
        ("B", 9000, {"A": 3000, "B": 3000, "C": 3000}),
        ("C", 6000, {"B": 3000, "C": 3000}),
    ]
    repayments = [
        ("B", "A", 2000, True),
    ]
    balances = compute_balances(expenses, repayments)
    assert sum(balances.values()) == 0


def test_no_expenses_zero_balances():
    balances = compute_balances([], [])
    assert balances == {}


# ─── Settlement Suggestions ───────────────────────────────────────────────────

def test_settlement_two_party():
    balances = {"A": -10000, "B": 10000}
    settlements = suggest_settlements(balances)
    assert len(settlements) == 1
    assert settlements[0]["from_id"] == "A"
    assert settlements[0]["to_id"] == "B"
    assert settlements[0]["amount_paise"] == 10000


def test_settlement_three_party_spec():
    """A owes Dhyey 100, B owes Dhyey 100 → 2 transfers."""
    balances = {"dhyey": 20000, "A": -10000, "B": -10000}
    settlements = suggest_settlements(balances)
    assert len(settlements) == 2
    for s in settlements:
        assert s["to_id"] == "dhyey"
        assert s["amount_paise"] == 10000


def test_settlement_already_settled():
    balances = {"A": 0, "B": 0}
    settlements = suggest_settlements(balances)
    assert settlements == []


def test_settlement_amount_conservation():
    """Total transferred = sum of all positive balances."""
    balances = {"A": -10000, "B": -5000, "C": 8000, "D": 7000}
    settlements = suggest_settlements(balances)
    total_transferred = sum(s["amount_paise"] for s in settlements)
    total_owed = sum(-v for v in balances.values() if v < 0)
    assert total_transferred == total_owed
