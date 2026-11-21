"""
GDGoC UHU Cyber Trainer — Percentage-Based Hint Deduction Plugin for CTFd 3.8+

Behavior:
- Unlocking a hint NEVER subtracts points from a user's existing score.
- Each hint's `cost` represents a percentage penalty rounded to the nearest multiple
  of 5% (e.g. 5, 10, 15, 20... capped at 95%) applied ONLY to the reward of THAT
  challenge when the user solves it.
- Upon solving a challenge for which the user unlocked hints, an automatic negative
  Award equal to `round(challenge.value * (penalty_pct / 100))` is recorded against
  that challenge while keeping unlock costs at 0 on the server.
"""

from sqlalchemy import event
from CTFd.models import Awards, Challenges, Hints, Solves, Unlocks, db


def _round_mult5(pct: int) -> int:
    pct = max(0, min(95, int(pct or 0)))
    return int(round(pct / 5.0) * 5)


def load(app):
    """Register solve hook so hint penalties apply only upon solving the challenge."""

    @event.listens_for(Solves, "after_insert")
    def apply_percent_hint_penalty(mapper, connection, target):
        challenge = Challenges.query.filter_by(id=target.challenge_id).first()
        if not challenge or not challenge.value:
            return

        hint_ids = [
            h.id for h in Hints.query.filter_by(challenge_id=target.challenge_id).all()
        ]
        if not hint_ids:
            return

        unlocks = (
            Unlocks.query.filter(
                Unlocks.type == "hints",
                Unlocks.target.in_(hint_ids),
                Unlocks.user_id == target.user_id,
            ).all()
        )
        if not unlocks:
            return

        unlocked_ids = {u.target for u in unlocks}
        hints = Hints.query.filter(Hints.id.in_(unlocked_ids)).all()
        # Interpret stored hint.cost (or custom pct) as percentage rounded to multiples of 5
        total_pct = min(95, sum(_round_mult5(h.cost) for h in hints))
        deduction = int(round(challenge.value * (total_pct / 100.0)))
        if deduction <= 0:
            return

        award = Awards(
            user_id=target.user_id,
            team_id=target.team_id,
            name=f"Hint penalty ({total_pct}%): {challenge.name}",
            description=f"Reduced reward for {challenge.name} by {total_pct}% due to unlocked hints",
            value=-deduction,
            category=challenge.category,
            icon="lightbulb",
        )
        db.session.add(award)
