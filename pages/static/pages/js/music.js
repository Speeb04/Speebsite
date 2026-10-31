function makeRow(item, primary, secondary, round) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url || "#";
    a.target = "_blank";
    a.rel = "noopener";

    const art = document.createElement("div");
    art.className = "music-art" + (round ? " round" : "");
    if (item.image) {
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = "";
        art.appendChild(img);
    }

    const text = document.createElement("div");
    text.className = "music-text";
    const p1 = document.createElement("span");
    p1.className = "music-primary";
    p1.textContent = primary;
    text.appendChild(p1);
    if (secondary) {
        const p2 = document.createElement("span");
        p2.className = "music-secondary";
        p2.textContent = secondary;
        text.appendChild(p2);
    }

    a.append(art, text);
    li.appendChild(a);
    return li;
}

async function loadMusic() {
    try {
        const res = await fetch("/api/spotify/top/");
        if (!res.ok) throw new Error("Spotify unavailable");
        const data = await res.json();

        const tracks = document.getElementById("music-tracks");
        const artists = document.getElementById("music-artists");
        data.tracks.forEach((t) => tracks.appendChild(makeRow(t, t.name, t.artist, false)));
        data.artists.forEach((a) => artists.appendChild(makeRow(a, a.name, "", true)));
    } catch (err) {
        console.error(err);
        document.getElementById("music").style.display = "none";
    }
}

loadMusic();