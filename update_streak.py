# update_streak.py
import os
import json
from duolingo import Duolingo

def main():
    username = os.environ["DUO_USER"]
    password = os.environ["DUO_PASS"]

    lingo = Duolingo(username, password)
    info = lingo.get_streak_info()

    data = {
        "streak": info["site_streak"],
        "daily_goal": info.get("daily_goal"),
        "streak_extended_today": info.get("streak_extended_today"),
    }

    # Write next to index.html (root of repo)
    with open("duo-streak.json", "w") as f:
        json.dump(data, f)

    print("Updated duo-streak.json:", data)

if __name__ == "__main__":
    main()
