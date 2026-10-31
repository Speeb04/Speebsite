let greetCity = CITIES[0];
const factEl = document.getElementById("city-fact");

function pickFact(city, avoid) {
    if (city.facts.length < 2) return city.facts[0];
    let fact;
    do {
        fact = city.facts[Math.floor(Math.random() * city.facts.length)];
    } while (fact === avoid);
    return fact;
}

let greetFact = pickFact(greetCity);

// based on the visitor's own system clock
function greetingWord() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 18) return "Good afternoon";
    return "Good evening";
}

// the time in the city currently on screen
function cityTime(city) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: city.tz,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date());
}

// only the greeting line updates every second
function renderGreeting() {
    document.getElementById("greeting").textContent =
        `${greetingWord()}! It's ${cityTime(greetCity)} in ${greetCity.short}.`;
}

window.showGreetingFor = (city) => {
    greetCity = city;
    greetFact = pickFact(city);
    factEl.textContent = greetFact;
    renderGreeting();
};

renderGreeting();
factEl.textContent = greetFact;
setInterval(renderGreeting, 1000);

// ---- rotating facts ----
const FACT_INTERVAL_MS = 10000;   // how often the fact changes
const FACT_FADE_MS = 600;         // length of each fade
const FACT_OPACITY = 0.85;        // matches .city-fact in the CSS
let swapping = false;

async function swapFact() {
    if (swapping) return;
    swapping = true;

    const out = factEl.animate(
        [{ opacity: FACT_OPACITY }, { opacity: 0 }],
        { duration: FACT_FADE_MS, easing: "ease", fill: "forwards" }
    );
    await out.finished;

    greetFact = pickFact(greetCity, greetFact);
    factEl.textContent = greetFact;

    const inn = factEl.animate(
        [{ opacity: 0 }, { opacity: FACT_OPACITY }],
        { duration: FACT_FADE_MS, easing: "ease", fill: "forwards" }
    );
    out.cancel();               // hand control to the fade-in with no flicker
    await inn.finished;
    inn.cancel();               // release back to the CSS opacity

    swapping = false;
}

setInterval(swapFact, FACT_INTERVAL_MS);