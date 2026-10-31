from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/spotify/top/", views.spotify_top, name="spotify_top"),
]