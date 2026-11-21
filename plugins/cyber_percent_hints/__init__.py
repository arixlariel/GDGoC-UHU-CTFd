"""
GDGoC UHU Cyber Trainer — Scoring & Hints Server Plugin for CTFd 3.8+

Behavior (persisted permanently in CTFd's database across logouts & restarts):
1. Unlimited submissions per challenge (`max_attempts = 0`).
2. Each incorrect submission on a challenge deducts 5 points from the maximum
   points obtainable for THAT challenge (never subtracting from already-earned
   points on other challenges, and floored at 0 for that challenge).
3. Unlocking a hint NEVER subtracts from a user's existing score; instead,
   each unlocked hint applies a percentage deduction rounded to multiples of 5%
   to THAT challenge's value when the user solves it.
"""

from sqlalchemy import event
from CTFd.models import Awards, Challenges, Fails, Hints, Solves, Unlocks, db


FAIL_PENALTY_POINTS = 5


def _round_mult5(pct: int) -> int:
    pct = max(0, min(95, int(pct or 0)))
    return int(round(pct / 5.0) * 5)


def load(app):
    """Apply fail (-5 pts/fail) and hint (% mult-of-5) deductions upon solve."""

    @event.listens_for(Solves, "after_insert")
    def apply_challenge_penalties(mapper, connection, target):
        challenge = Challenges.query.filter_by(id=target.challenge_id).first()
        if not challenge or not challenge.value:
            return

        # 1. Count all persisted incorrect submissions by this user on this challenge
        fail_count = (
            Fails.query.filter_by(
                challenge_id=target.challenge_id,
                user_id=target.user_id,
            ).count()
        )
        fail_deduction = fail_count * FAIL_PENALTY_POINTS

        # 2. Compute unlocked hint percentage penalty (rounded to multiples of 5%)
        hint_ids = [
            h.id for h in Hints.query.filter_by(challenge_id=target.challenge_id).all()
        ]
        hint_pct = 0
        if hint_ids:
            unlocks = (
                Unlocks.query.filter(
                    Unlocks.type == "hints",
                    Unlocks.target.in_(hint_ids),
                    Unlocks.user_id == target.user_id,
                ).all()
            )
            if unlocks:
                unlocked_ids = {u.target for u in unlocks}
                hints = Hints.query.filter(Hints.id.in_(unlocked_ids)).all()
                hint_pct = min(95, sum(_round_mult5(h.cost) for h in hints))

        hint_deduction = int(round(challenge.value * (hint_pct / 100.0)))

        # Cap total deduction at challenge.value so user never loses previously earned points
        total_deduction = min(int(challenge.value), fail_deduction + hint_deduction)
        if total_deduction <= 0:
            return

        parts = []
        if fail_deduction > 0:
            parts.append(f"{fail_count} fails (-{fail_deduction} pts)")
        if hint_deduction > 0:
            parts.append(f"hints (-{hint_pct}%)")

        award = Awards(
            user_id=target.user_id,
            team_id=target.team_id,
            name=f"Challenge penalty: {challenge.name}",
            description=f"{challenge.name}: " + ", ".join(parts),
            value=-total_deduction,
            category=challenge.category,
            icon="shield",
        )
        db.session.add(award)
