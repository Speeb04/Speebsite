const IS_MOBILE = document.body.classList.contains("mobile");

const items = Array.from(document.querySelectorAll(".interest"));
const pics = Array.from(document.querySelectorAll(".interest-pics img"));

// desktop stages: 0..C-1 = cities, C..C+N-1 = interests, C+N = music
// mobile stages: C-1 = intro, C..C+N-1 = interests, C+N = music
const C = CITIES.length;
const N = items.length;
const FINAL = C + N;
const LAST = IS_MOBILE ? FINAL + 1 : FINAL;   // phones get one extra slide for outreach
const MIN_STAGE = IS_MOBILE ? C - 1 : 0;

let stage = MIN_STAGE;
let locked = false;
const RAIN_FADE_MS = 500;     // the rain fades out on its own, before anything else moves
const PHOTO_FADE_MS = 900;    // matches the CSS for .bg-layer

// load the photos up front so the crossfade is smooth
if (!IS_MOBILE) CITIES.forEach((c) => { new Image().src = c.bg; });
pics.forEach((p) => { new Image().src = p.src; });

const layers = [document.getElementById("bg-a"), document.getElementById("bg-b")];
let front = 0;

const firstBg = IS_MOBILE ? MOBILE_BG : CITIES[0].bg;
layers[0].style.backgroundImage = `url("${firstBg}")`;
layers[0].classList.add("active", "front");

function crossfadeTo(url) {
    const prev = layers[front];
    const next = layers[1 - front];
    next.style.backgroundImage = `url("${url}")`;
    prev.classList.remove("front");
    next.classList.add("front", "active");
    setTimeout(() => prev.classList.remove("active"), PHOTO_FADE_MS);
    front = 1 - front;
}

// highlight one interest and show its picture
function setActive(i) {
    items.forEach((el, k) => el.classList.toggle("active", k === i));
    pics.forEach((el, k) => el.classList.toggle("active", k === i));
}
setActive(0);
if (IS_MOBILE) window.setRainBackground(MOBILE_BG);   // makes sure the drops refract the phone wallpaper

// phones open on the intro slide
if (IS_MOBILE) {
    document.body.classList.add("m-intro");
}

// ---- scroll indicator (desktop only; hidden on phones by mobile.css) ----
const bar = document.getElementById("scrollbar");
const thumb = document.getElementById("scrollbar-thumb");
const BAR_IDLE_MS = 1500;   // how long it stays visible after the last movement on the city slides
let barTimer;

function updateBar() {
    const slides = LAST - MIN_STAGE + 1;          // phones have no city slides before the intro
    const share = 100 / slides;                   // one slide's share of the track
    thumb.style.height = share + "%";
    thumb.style.top = (stage - MIN_STAGE) * share + "%";
    bar.classList.toggle("pinned", IS_MOBILE || stage >= C);   // always visible on phones
}

// show it, then let it fade after a moment of inactivity
function poke() {
    bar.classList.add("show");
    clearTimeout(barTimer);
    barTimer = setTimeout(() => bar.classList.remove("show"), BAR_IDLE_MS);
}

["mousemove", "wheel", "touchstart", "touchmove", "keydown"].forEach((evt) => {
    window.addEventListener(evt, poke, { passive: true });
});

updateBar();
poke();   // visible briefly when the page loads

// ---- switching between cities (desktop only) ----
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function switchCity(city) {
    document.body.classList.add("switching");        // text and card fade out

    // 1. the rain fades out on its own, while the old photo is still showing
    await window.setRainVisible(false, RAIN_FADE_MS);
    window.clearRain();

    // 2. only now does the photo crossfade and the text change
    crossfadeTo(city.bg);
    document.getElementById("location").textContent = city.name;
    window.showGreetingFor(city);
    await window.showWeatherFor(city);
    document.body.classList.remove("switching");

    // 3. once the new photo is fully in place, the rain restarts from clear
    await wait(PHOTO_FADE_MS);
    window.setRainBackground(city.bg);
    await window.setRainVisible(true, RAIN_FADE_MS);
}

// one place that decides which classes the page has, based only on the current stage
function applyStage() {
    const b = document.body.classList;
    b.toggle("ended", stage >= C);
    b.toggle("finished", stage >= FINAL);
    b.toggle("m-intro", IS_MOBILE && stage === C - 1);
    b.toggle("m-outreach", IS_MOBILE && stage === LAST);
    if (stage >= C && stage < FINAL) setActive(stage - C);
}

function goTo(target) {
    target = Math.max(MIN_STAGE, Math.min(LAST, target));   // no wrapping around
    if (locked || target === stage) return;
    locked = true;

    const from = stage;
    stage = target;
    const betweenCities = !IS_MOBILE && from < C && stage < C;
    updateBar();

    if (betweenCities) {
        switchCity(CITIES[stage]);
    } else {
        applyStage();
    }

    // ignore extra scrolling until the whole sequence is done
    const lockMs = betweenCities ? RAIN_FADE_MS + PHOTO_FADE_MS + RAIN_FADE_MS + 300 : 800;
    setTimeout(() => { locked = false; }, lockMs);
}

// ---- input ----

// mouse wheel / trackpad: one step per scroll gesture
let lastWheel = 0;
window.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) < 10) return;
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (gap < 120) return;   // still part of the same swipe or its momentum
    goTo(stage + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

// touch swipe
let touchY = null;
window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener("touchend", (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 40) goTo(stage + (dy > 0 ? 1 : -1));
});

// keyboard
window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "PageDown", " "].includes(e.key)) goTo(stage + 1);
    if (["ArrowUp", "PageUp"].includes(e.key)) goTo(stage - 1);
});

// ---- hide the scroll caret when the browser is fullscreen ----
function updateFullscreen() {
    const apiFull = !!document.fullscreenElement
        || window.matchMedia("(display-mode: fullscreen)").matches;
    const sizeFull =
        Math.abs(window.outerWidth - screen.width) <= 24 &&
        Math.abs(window.outerHeight - screen.height) <= 24;
    const full = apiFull || sizeFull;

    document.body.classList.toggle("is-fullscreen", full);
    const hint = document.querySelector(".scroll-hint");
    if (hint) {
        hint.style.opacity = full ? "0" : "";   // an empty string hands control back to the CSS
        hint.style.visibility = full ? "hidden" : "";
    }
}

updateFullscreen();
window.addEventListener("resize", () => {
    updateFullscreen();
    setTimeout(updateFullscreen, 300);   // the browser can finish resizing after the event fires
});
document.addEventListener("fullscreenchange", updateFullscreen);
setInterval(updateFullscreen, 1000);     // safety net