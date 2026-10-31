import os
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from django.core.management.base import BaseCommand

REDIRECT_URI = "http://127.0.0.1:8000/callback"


class Command(BaseCommand):
    help = "One-time Spotify authorization: prints a refresh token."

    def handle(self, *args, **options):
        cid = os.environ["SPOTIFY_CLIENT_ID"]
        secret = os.environ["SPOTIFY_CLIENT_SECRET"]

        url = "https://accounts.spotify.com/authorize?" + urlencode({
            "client_id": cid,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": "user-top-read",
        })
        print("\n1. Open this URL and approve access:\n\n" + url + "\n")
        print("2. Your browser will land on a page that fails to load. That's expected.")
        pasted = input("3. Paste the full URL from the address bar here: ").strip()

        code = parse_qs(urlparse(pasted).query)["code"][0]
        r = requests.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI},
            auth=(cid, secret),
            timeout=10,
        )
        r.raise_for_status()
        print("\nAdd this line to your .env file:\n")
        print("SPOTIFY_REFRESH_TOKEN=" + r.json()["refresh_token"])