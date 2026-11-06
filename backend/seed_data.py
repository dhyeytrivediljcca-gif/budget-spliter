"""
Database Seeding Script for RoomieSplit.

Populates SQLite / Postgres database with realistic roommate dummy data:
- 1 Leader / Admin user (Arjun Sharma)
- 3 Roommates (Rohan Verma, Priya Nair, Kabir Mehta)
- 1 Shared Flat ("Flat 402 - Green Park") with ₹25,000 monthly budget
- 7 realistic shared expenses across all categories with equal & custom splits
- 2 repayments (1 confirmed, 1 pending)
- Active invitation token for instant joining
"""
import hashlib
from datetime import datetime, timedelta
from app.core.database import SessionLocal, Base, engine
from app.models.user import (
    Profile, Room, RoomMember, RoomInvitation,
    Expense, ExpenseShare, Repayment
)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def seed():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing data cleanly
        db.query(ExpenseShare).delete()
        db.query(Expense).delete()
        db.query(Repayment).delete()
        db.query(RoomInvitation).delete()
        db.query(RoomMember).delete()
        db.query(Room).delete()
        db.query(Profile).delete()
        db.commit()

        print("[Seed] Cleared existing records.")

        # 1. Profiles
        leader = Profile(
            id="leader-admin-001",
            display_name="Arjun Sharma (Leader / Admin)",
            avatar_url=None,
            created_at=datetime.utcnow() - timedelta(days=60),
        )
        roomie1 = Profile(
            id="roommate-rohan-002",
            display_name="Rohan Verma",
            avatar_url=None,
            created_at=datetime.utcnow() - timedelta(days=55),
        )
        roomie2 = Profile(
            id="roommate-priya-003",
            display_name="Priya Nair",
            avatar_url=None,
            created_at=datetime.utcnow() - timedelta(days=50),
        )
        roomie3 = Profile(
            id="roommate-kabir-004",
            display_name="Kabir Mehta",
            avatar_url=None,
            created_at=datetime.utcnow() - timedelta(days=45),
        )

        db.add_all([leader, roomie1, roomie2, roomie3])
        db.commit()
        print("[Seed] Created 4 roommate profiles.")

        # 2. Room ("Flat 402 - Green Park", budget ₹25,000 = 2500000 paise)
        room = Room(
            id="room-flat-402",
            name="Flat 402 - Green Park",
            currency="INR",
            monthly_budget_paise=2500000,  # ₹25,000
            budget_start_day=1,
            created_by=leader.id,
            created_at=datetime.utcnow() - timedelta(days=45),
            is_active=True,
        )
        db.add(room)
        db.commit()
        print("[Seed] Created Flat 402.")

        # 3. Memberships
        memberships = [
            RoomMember(
                id="mem-1", room_id=room.id, user_id=leader.id,
                role="leader", status="active",
                joined_at=datetime.utcnow() - timedelta(days=45)
            ),
            RoomMember(
                id="mem-2", room_id=room.id, user_id=roomie1.id,
                role="member", status="active",
                joined_at=datetime.utcnow() - timedelta(days=40)
            ),
            RoomMember(
                id="mem-3", room_id=room.id, user_id=roomie2.id,
                role="member", status="active",
                joined_at=datetime.utcnow() - timedelta(days=35)
            ),
            RoomMember(
                id="mem-4", room_id=room.id, user_id=roomie3.id,
                role="member", status="active",
                joined_at=datetime.utcnow() - timedelta(days=30)
            ),
        ]
        db.add_all(memberships)
        db.commit()
        print("[Seed] Added members to room.")

        # 4. Invitation Token (token: FLAT402JOIN)
        raw_token = "FLAT402JOIN"
        invite = RoomInvitation(
            id="inv-demo-1",
            room_id=room.id,
            token_hash=hash_token(raw_token),
            created_by=leader.id,
            expires_at=datetime.utcnow() + timedelta(days=30),
            created_at=datetime.utcnow(),
        )
        db.add(invite)
        db.commit()
        print(f"[Seed] Created active invite token: {raw_token}")

        # 5. Shared Expenses (Current month transactions)
        all_ids = [leader.id, roomie1.id, roomie2.id, roomie3.id]
        now = datetime.utcnow()

        expenses_data = [
            {
                "title": "Monthly ACT Fibernet WiFi (300 Mbps)",
                "category": "utilities",
                "amount": 120000,  # ₹1,200
                "paid_by": leader.id,
                "days_ago": 18,
                "merchant": "ACT Fibernet",
                "note": "Split equally across 4 roommates",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Swiggy Instamart Monthly Kitchen Groceries",
                "category": "groceries",
                "amount": 480000,  # ₹4,800
                "paid_by": leader.id,
                "days_ago": 15,
                "merchant": "Swiggy Instamart",
                "note": "Atta, Dal, Oil, Spices & Staples",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Fresh Vegetables & Fruits - Local Mandi",
                "category": "vegetables",
                "amount": 160000,  # ₹1,600
                "paid_by": roomie1.id,
                "days_ago": 12,
                "merchant": "Green Mandi Sector 4",
                "note": "Potatoes, Onions, Tomatoes & Apples",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Bisleri 20L Water Cans (10x Cans)",
                "category": "drinking_water",
                "amount": 80000,  # ₹800
                "paid_by": roomie3.id,
                "days_ago": 9,
                "merchant": "Bisleri Water Supply",
                "note": "10 cans for the month",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Amul Milk & Curd Bi-weekly Supply",
                "category": "milk_dairy",
                "amount": 140000,  # ₹1,400
                "paid_by": roomie2.id,
                "days_ago": 7,
                "merchant": "Amul Dairy Outlet",
                "note": "Milk & Paneer for 2 weeks",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Bathroom & Kitchen Cleaning Supplies",
                "category": "household_supplies",
                "amount": 120000,  # ₹1,200
                "paid_by": leader.id,
                "days_ago": 4,
                "merchant": "DMart Ready",
                "note": "Detergent, Harpic, Colin, Trash bags",
                "split_type": "equal",
                "members": all_ids,
            },
            {
                "title": "Weekend Flat Biryani Party (Custom Split)",
                "category": "other",
                "amount": 280000,  # ₹2,800
                "paid_by": leader.id,
                "days_ago": 2,
                "merchant": "Meghana Foods",
                "note": "Kabir had extra dessert, Rohan had starter",
                "split_type": "custom",
                "custom_shares": {
                    leader.id: 70000,    # ₹700
                    roomie1.id: 80000,   # ₹800
                    roomie2.id: 50000,   # ₹500
                    roomie3.id: 80000,   # ₹800
                },
            },
        ]

        for item in expenses_data:
            exp_date = now - timedelta(days=item["days_ago"])
            exp = Expense(
                room_id=room.id,
                title=item["title"],
                category=item["category"],
                total_amount_paise=item["amount"],
                currency="INR",
                paid_by=item["paid_by"],
                created_by=item["paid_by"],
                expense_date=exp_date,
                sharing_method=item["split_type"],
                description=item["note"],
                merchant_name=item["merchant"],
                status="active",
                created_at=exp_date,
            )
            db.add(exp)
            db.flush()

            if item["split_type"] == "equal":
                share_per = item["amount"] // len(item["members"])
                rem = item["amount"] % len(item["members"])
                for idx, mid in enumerate(item["members"]):
                    share_val = share_per + (1 if idx < rem else 0)
                    db.add(ExpenseShare(
                        expense_id=exp.id,
                        member_id=mid,
                        share_amount_paise=share_val
                    ))
            elif item["split_type"] == "custom":
                for mid, share_val in item["custom_shares"].items():
                    db.add(ExpenseShare(
                        expense_id=exp.id,
                        member_id=mid,
                        share_amount_paise=share_val
                    ))

        db.commit()
        print(f"[Seed] Added {len(expenses_data)} realistic shared expenses.")

        # 6. Repayments (1 confirmed, 1 pending)
        rep1 = Repayment(
            room_id=room.id,
            debtor_id=roomie1.id,
            creditor_id=leader.id,
            amount_paise=100000,  # ₹1,000 paid back
            payment_method="upi",
            reference_note="UPI Ref: 412093847291 - WiFi & Mandi partial",
            status="confirmed",
            recorded_by=roomie1.id,
            confirmed_by=leader.id,
            paid_at=now - timedelta(days=3),
            confirmed_at=now - timedelta(days=2),
            created_at=now - timedelta(days=3),
        )
        rep2 = Repayment(
            room_id=room.id,
            debtor_id=roomie3.id,
            creditor_id=leader.id,
            amount_paise=80000,  # ₹800 pending confirmation
            payment_method="upi",
            reference_note="GPay transferred for Biryani & Groceries",
            status="pending",
            recorded_by=roomie3.id,
            confirmed_by=None,
            paid_at=now - timedelta(hours=6),
            created_at=now - timedelta(hours=6),
        )
        db.add_all([rep1, rep2])
        db.commit()
        print("[Seed] Added 2 repayments (1 confirmed, 1 pending).")

        print("\n=== SUCCESS: Database populated with rich demo data! ===")
        print("------------------------------------------------------------")
        print("LEADER / ADMIN ACCOUNT:")
        print("   Email:    admin@roomiesplit.com")
        print("   Password: admin123")
        print("   Name:     Arjun Sharma (Leader / Admin)")
        print("\nROOMMATE ACCOUNTS:")
        print("   1. Rohan Verma: rohan@roomiesplit.com (Password: rohan123)")
        print("   2. Priya Nair:  priya@roomiesplit.com (Password: priya123)")
        print("   3. Kabir Mehta: kabir@roomiesplit.com (Password: kabir123)")
        print("\nFLAT DETAILS:")
        print("   Name:   Flat 402 - Green Park")
        print("   Budget: Rs 25,000 / month")
        print(f"   Invite: {raw_token}")
        print("------------------------------------------------------------")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
