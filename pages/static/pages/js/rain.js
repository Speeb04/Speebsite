const RAIN_MOBILE = document.body.classList.contains("mobile");
const DIM = document.body.classList.contains("mobile") ? 0.1 : 0;
const canvas = document.getElementById("rain");
const ctx = canvas.getContext("2d");

const bg = new Image();
const bgCanvas = document.createElement("canvas");   // background, sampled by each drop
const bgCtx = bgCanvas.getContext("2d");
const layer = document.createElement("canvas");      // permanent droplets are painted here once
const layerCtx = layer.getContext("2d");

// ---- settings you can tweak ----
const DENSITY = document.body.classList.contains("mobile") ? 1000 : 700;                   // fewer drops on phones
const MAX_DROPLET_DENSITY = document.body.classList.contains("mobile") ? 100 : 75;
const LIVE_FRACTION = 0.003;      // share of drops big enough to slide
const MIN_LIVE_RADIUS = 12;
const MAX_RADIUS = 18;           // radius of the largest possible drop
const SPEED = 4;                 // animation speed multiplier
const WIGGLE = 0.1;                // 0 = straight down, 1 = default, 2 = very windy path
const TRAIL_LENGTH = 12;         // how many frames of trail follow a sliding drop
const TRAIL_ALPHA = 0;        // how visible the trail is at its brightest (0 turns it off)     // faint wet streak behind sliding drops (0 turns it off)
const FILL_SECONDS = 20;         // how long the window takes to go from clear to fully rainy
// ---------------------------------

let drops = [];       // live drops: redrawn every frame, can slide
let droplets = 0;     // number of permanent droplets painted so far
let maxDroplets = 0;
let ready = false;
let remaining = 0;    // drops still waiting to appear
let spawnPerFrame = 0;
let pending = 0;

function buildBackground() {
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
    const w = bg.width * scale;
    const h = bg.height * scale;
    bgCtx.drawImage(bg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

    bgCtx.fillStyle = `rgba(0, 0, 0, ${DIM})`;      // darken it the same amount as the CSS
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

function newDrop(x, y, r) {
    return {
        x, y, r,
        h: (Math.random() - 0.5) * 0.6,  // heading: 0 = straight down (radians)
        w: 0,                            // how quickly the heading is changing
        speed: 0,
        vtMod: 1,                        // slowly drifting speed variation
        s: 0,                            // 0 = resting, 1 = fully stretched into a teardrop
        sliding: false,
        gap: 0,
        nextGap: 6 + Math.random() * 8,
        trail: [],
        // per-drop irregularity so no two outlines match
        p1: Math.random() * 6.28,
        p2: Math.random() * 6.28,
        p3: Math.random() * 6.28,
        amp: 0.5 + Math.random(),
        wide: 0.9 + Math.random() * 0.2,
    };
}

function makeDrop(anywhere = true) {
    // skewed so most live drops are modest and only a few reach MAX_RADIUS
    const r = MIN_LIVE_RADIUS + Math.pow(Math.random(), 5) * (MAX_RADIUS - MIN_LIVE_RADIUS);
    return newDrop(
        Math.random() * canvas.width,
        anywhere ? Math.random() * canvas.height : -MAX_RADIUS * 2,
        r
    );
}

function paintDroplet(x, y, r) {
    drawDrop(layerCtx, newDrop(x, y, r));
    droplets++;
}

// start from a clear window; the rain builds up over FILL_SECONDS
function initDrops() {
    layer.width = canvas.width;      // also clears the layer
    layer.height = canvas.height;
    drops = [];
    droplets = 0;

    const total = Math.floor((canvas.width * canvas.height) / DENSITY);
    maxDroplets = Math.floor((canvas.width * canvas.height) / MAX_DROPLET_DENSITY);

    remaining = total;
    pending = 0;
    spawnPerFrame = total / (Math.max(1, FILL_SECONDS) * 60);
}

function spawnOne() {
    if (Math.random() < LIVE_FRACTION) {
        drops.push(makeDrop());
    } else {
        paintDroplet(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            1.5 + Math.random() * 3
        );
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (ready) {
        buildBackground();
        initDrops();
    }
}

// on phones, the address bar sliding in and out changes the height; don't wipe the rain for that
let lastW = window.innerWidth;
let lastH = window.innerHeight;
window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (RAIN_MOBILE && w === lastW && Math.abs(h - lastH) < 150) return;
    lastW = w;
    lastH = h;
    resize();
});

// Outline of a drop: an irregular blob, fuller at the bottom, with a short
// tapered tail behind it when it is moving.
function shapePath(d) {
    const p = new Path2D();
    const n = d.r < 6 ? 16 : 28;
    const ch = Math.cos(d.h);
    const sh = Math.sin(d.h);

    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const st = Math.sin(t);
        const ct = Math.cos(t);
        const base = d.r * (1 + d.amp * (
            0.07 * Math.sin(2 * t + d.p1) +
            0.05 * Math.sin(3 * t + d.p2) +
            0.03 * Math.sin(5 * t + d.p3)
        ));
        const tail = Math.max(0, -st);                      // 1 at the very back
        const lx = base * ct * d.wide * (1 - 0.3 * d.s * tail);
        const ly = base * st * (1 + 0.07 * Math.max(0, st) + 0.15 * d.s + 0.55 * d.s * tail * tail);

        // rotate from the drop's own axes into screen coordinates
        const px = d.x + lx * ch + ly * sh;
        const py = d.y - lx * sh + ly * ch;
        if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
    }
    p.closePath();
    return p;
}

function drawDrop(c, d) {
    const path = shapePath(d);
    const ext = d.r * (1 + 0.7 * d.s);   // how far the shape reaches, tail included

    // refraction: a zoomed-out, upside-down patch of the background
    const zoom = 3;
    const sw = ext * 2 * zoom;
    c.save();
    c.clip(path);
    c.translate(d.x, d.y);
    c.rotate(Math.PI);
    c.drawImage(bgCanvas, d.x - sw / 2, d.y - sw / 2, sw, sw, -ext, -ext, ext * 2, ext * 2);
    c.restore();

    // darker edge
    const g = c.createRadialGradient(d.x, d.y, d.r * 0.5, d.x, d.y, ext);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    c.fillStyle = g;
    c.fill(path);

    // bright rim along the bottom
    c.beginPath();
    c.ellipse(d.x, d.y, d.r * 0.7, d.r * 0.8, 0, Math.PI * 0.15, Math.PI * 0.85);
    c.strokeStyle = "rgba(255, 255, 255, 0.35)";
    c.lineWidth = Math.max(d.r * 0.15, 0.6);
    c.stroke();

    // specular highlight
    c.beginPath();
    c.ellipse(d.x - d.r * 0.3, d.y - d.r * 0.4, d.r * 0.2, d.r * 0.12, -0.5, 0, Math.PI * 2);
    c.fillStyle = "rgba(255, 255, 255, 0.8)";
    c.fill();
}

// short fading trail that follows a sliding drop (not permanent)
function drawTrail(c, d) {
    const t = d.trail;
    for (let i = 1; i < t.length; i++) {
        const k = i / t.length;   // 0 at the old end, 1 next to the drop
        c.beginPath();
        c.moveTo(t[i - 1].x, t[i - 1].y);
        c.lineTo(t[i].x, t[i].y);
        c.strokeStyle = "rgba(255, 255, 255, " + TRAIL_ALPHA * k + ")";
        c.lineWidth = Math.max(1, d.r * 0.5 * k);
        c.lineCap = "round";
        c.stroke();
    }
}

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer, 0, 0);   // permanent droplets, in one cheap draw

    // new drops appear gradually until the window reaches full density
    if (remaining > 0) {
        pending += spawnPerFrame;
        while (pending >= 1 && remaining > 0) {
            spawnOne();
            pending--;
            remaining--;
        }
    }

    drops.forEach((d, i) => {
        // heavier drops are more likely to break free and start sliding
        if (!d.sliding && Math.random() < 0.0006 * d.r) {
            d.sliding = true;
        }

        if (d.sliding) {
            // terminal velocity grows with size; the real speed eases toward it
            d.vtMod = Math.min(1.3, Math.max(0.7, d.vtMod + (Math.random() - 0.5) * 0.06));
            const vt = SPEED * 0.12 * d.r * d.vtMod;
            d.speed += (vt - d.speed) * 0.05;

            // heading behaves like a damped spring pulled toward "straight down",
            // nudged by random imperfections in the glass: a wiggling path
            const step = d.speed / 3;
            const jitter = (WIGGLE * 0.12) / (1 + d.r * 0.12);
            d.w += (-0.04 * d.h - 0.08 * d.w + (Math.random() - 0.5) * jitter) * step;
            d.h += d.w * step;
            if (Math.abs(d.h) > 0.7) {
                d.h = Math.sign(d.h) * 0.7;
                d.w = 0;
            }

            d.x += Math.sin(d.h) * d.speed;
            d.y += Math.cos(d.h) * d.speed;
            d.s = Math.min(1, d.speed / (SPEED * 1.5));   // faster = more stretched

            d.trail.push({ x: d.x, y: d.y });
            if (d.trail.length > TRAIL_LENGTH) d.trail.shift();

            // leave a tiny permanent droplet behind every few pixels of travel
            d.gap += d.speed;
            if (d.gap > d.nextGap && droplets < maxDroplets) {
                const dr = 0.6 + Math.random() * 1.2;
                const back = d.r * (0.8 + d.s);
                const side = (Math.random() - 0.5) * d.r * 0.4;
                paintDroplet(
                    d.x - Math.sin(d.h) * back + Math.cos(d.h) * side,
                    d.y - Math.cos(d.h) * back - Math.sin(d.h) * side,
                    dr
                );
                d.r = Math.sqrt(Math.max(d.r * d.r - dr * dr * 0.5, 0)); // loses water
                d.gap = 0;
                d.nextGap = 6 + Math.random() * 8;
            }
        }

        // a drop that has run out of water settles as one last small droplet
        if (d.r < 3.5) {
            if (d.y > 0 && d.y < canvas.height && droplets < maxDroplets) {
                d.s = 0;
                drawDrop(layerCtx, d);
                droplets++;
            }
            drops[i] = makeDrop(false);
            return;
        }

        const reach = d.r * 1.7;
        if (d.y > canvas.height + reach || d.x < -reach || d.x > canvas.width + reach) {
            drops[i] = makeDrop(false);
            return;
        }

        drawTrail(ctx, d);
        drawDrop(ctx, d);
    });

    requestAnimationFrame(update);
}

let started = false;
bg.onload = () => {
    ready = true;
    resize();                      // rebuilds the background and restarts from a clear window
    if (!started) {
        started = true;
        update();
    }
};
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
bg.src = RAIN_MOBILE ? MOBILE_BG : CITIES[0].bg;   // the wallpaper on phones, Vancouver otherwise

// ---- functions used by scene.js ----

// load a new photo; the rain then restarts from a clear window
window.setRainBackground = (url) => { bg.src = url; };

// instantly remove every drop, live or permanent
window.clearRain = () => {
    drops = [];
    droplets = 0;
    remaining = 0;
    pending = 0;
    layerCtx.clearRect(0, 0, layer.width, layer.height);
};

// fade the rain canvas in or out; inline styles beat any stylesheet rule
window.setRainVisible = (visible, ms = 500) => {
    canvas.style.transition = `opacity ${ms}ms ease`;
    canvas.style.opacity = visible ? "1" : "0";
    return new Promise((resolve) => setTimeout(() => {
        if (visible) {                   // hand control back to the stylesheet afterwards,
            canvas.style.opacity = "";   // so the black screen can still hide the rain
            canvas.style.transition = "";
        }
        resolve();
    }, ms));
};