from django.shortcuts import render
import logging

from django.http import JsonResponse

from .spotify import get_top

logger = logging.getLogger(__name__)


def spotify_top(request):
    try:
        return JsonResponse(get_top())
    except Exception:
        logger.exception("Spotify request failed")
        return JsonResponse({"error": "unavailable"}, status=503)

def home(request):
    return render(request, "pages/home.html")

