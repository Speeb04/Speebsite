import os

import requests
from django.core.cache import cache

TOKEN_URL = "https://accounts.spotify.com/api/token"
API = "https://api.spotify.com/v1"


def get_access_token():
    token = cache.get("spotify_access_token")
    if token:
        return token
    r = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": os.environ["SPOTIFY_REFRESH_TOKEN"],
        },
        auth=(os.environ["SPOTIFY_CLIENT_ID"], os.environ["SPOTIFY_CLIENT_SECRET"]),
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    cache.set("spotify_access_token", data["access_token"], data.get("expires_in", 3600) - 120)
    return data["access_token"]


def _get(path, params):
    r = requests.get(
        f"{API}{path}",
        params=params,
        headers={"Authorization": f"Bearer {get_access_token()}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["items"]


def _image(images):
    if not images:
        return None
    return images[1]["url"] if len(images) > 1 else images[0]["url"]   # the ~300px one


def get_top():
    data = cache.get("spotify_top")
    if data:
        return data

    tracks = _get("/me/top/tracks", {"time_range": "short_term", "limit": 5})
    artists = _get("/me/top/artists", {"time_range": "short_term", "limit": 5})

    data = {
        "tracks": [
            {
                "name": t["name"],
                "artist": ", ".join(a["name"] for a in t["artists"]),
                "image": _image(t["album"]["images"]),
                "url": t["external_urls"].get("spotify"),
            }
            for t in tracks
        ],
        "artists": [
            {
                "name": a["name"],
                "image": _image(a.get("images", [])),
                "url": a["external_urls"].get("spotify"),
            }
            for a in artists
        ],
    }
    cache.set("spotify_top", data, 60 * 60)   # refresh at most once an hour
    return data