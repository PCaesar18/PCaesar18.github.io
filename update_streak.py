# update_streak.py
import os
import json
import requests


def get_streak(username: str) -> int:
    """
    Fetch streak using Duolingo's public API.
    Does NOT require authentication.
    """
    if not username:
        raise ValueError("DUO_USER (Duolingo username) is not set")

    # This is the public endpoint described in various posts.
    url = (
        "https://www.duolingo.com/2017-06-30/users"
        f"?username={username}"
        "&fields=streak,streakData%7BcurrentStreak,previousStreak%7D%7D"
    )

    resp = requests.get(
        url,
        headers={
            # Being a bit polite; some endpoints behave better with a UA.
            "User-Agent": "duo-streak-github-widget/1.0",
            "Accept": "application/json",
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    users = data.get("users") or []
    if not users:
        raise RuntimeError(f"No user data returned for username={username!r}")

    user = users[0]

    # Streak can live in several places, so we take the max.
    candidates = []

    base_streak = user.get("streak")
    if isinstance(base_streak, int):
        candidates.append(base_streak)

    streak_data = user.get("streakData") or {}
    current = streak_data.get("currentStreak") or {}
    previous = streak_data.get("previousStreak") or {}

    for st in (current, previous):
        if isinstance(st, dict):
            length = st.get("length")
            if isinstance(length, int):
                candidates.append(length)

    if not candidates:
        return 0

    return max(candidates)


def main():
    username = os.environ.get("DUO_USER")  # passed from GitHub Actions
    streak = get_streak(username)

    data = {"streak": streak}

    with open("duo-streak.json", "w") as f:
        json.dump(data, f)

    print("Updated duo-streak.json:", data)


if __name__ == "__main__":
    main()
