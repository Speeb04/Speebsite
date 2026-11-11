const RAIN_MOBILE = document.body.classList.contains("mobile");
const DIM = document.body.classList.contains("mobile") ? 0.1 : 0;
const canvas = document.getElementById("rain");
const ctx = canvas.getContext("2d");

const bg = new Image();
const bgCanvas = document.createElement("canvas");   // background, sampled by each drop
const bgCtx = bgCanvas.getContext("2d");
const layer = document.createElement("canvas");      // permanent droplets are painted here once
const layerCtx = layer.getContext("2d");
let bgPattern = null;                                 // the background, for refracting streaks

// ---- settings you can tweak ----
const DENSITY = document.body.classList.contains("mobile") ? 1000 : 450;   // lower = more droplets (was 700)                   // fewer drops on phones
const MAX_DROPLET_DENSITY = document.body.classList.contains("mobile") ? 100 : 75;
const LIVE_FRACTION = 0.002;      // share of drops big enough to slide
const MIN_LIVE_RADIUS = 10;      // smallest sliding drop
const MAX_RADIUS = 18;           // radius of the largest possible drop
const BIG_DROP_CHANCE = 0.1;     // share of sliding drops that are big (0.1 = 1 in 10); the rest are small
const BIG_MIN_RADIUS = 13;       // big drops are between this and MAX_RADIUS
const SMALL_SPREAD = 1.5;        // small drops are between MIN_LIVE_RADIUS and MIN_LIVE_RADIUS + this
const SIZE_SPEED_POWER = 1;      // how much faster big drops are than small ones (1 = proportional; was 2.2)
const STUTTER = 2;               // 0 = smooth sliding, 1 = normal stick-and-slip, 2 = very jerky
const DOT_MIN = 1.2;             // the tiny resting droplets on the glass: smallest radius
const DOT_MAX = 3.5;             //   ...largest radius (was 6)
const DOT_SKEW = 2.2;            // higher = more of the droplets are near DOT_MIN
const SIMPLE_BELOW = 2;          // droplets smaller than this are drawn as simple beads
                                 // (full refraction at sub-pixel sizes causes speckle/grid artifacts)
const SPEED = 4;                // animation speed multiplier
const WIND = 0.12;               // drift angle in radians: + blows right, - blows left, 0 = straight down (0.12 ≈ 7°)
const WIND_VARIATION = 0.05;     // how much each drop's drift angle differs from the others
const WIGGLE = 0.5;              // how much each drop wanders off its line: 0 = perfectly straight, 1 = a lot
const WIGGLE_SPEED = 1;          // how often the wandering changes direction (higher = more often)
const KEEP_SIZE = true;          // drops keep their size and run all the way down (false = they shrink and stop)
const TRAIL_LENGTH = 12;         // how many frames of trail follow a sliding drop
const TRAIL_ALPHA = 0;        // how visible the trail is at its brightest (0 turns it off)     // faint wet streak behind sliding drops (0 turns it off)
const FILL_SECONDS = 5;          // how long the window takes to go from clear to fully rainy

// look of the drops (softer, more like a photo of a rainy window)
const EDGE_DARKNESS = 0.16;      // dark edge around each drop (was 0.35)
const RIM_BRIGHTNESS = 0;        // drawn bright rim along the bottom (was 0.35; 0 = off, looks more real)
const SHINE = 0.22;              // specular highlight (was 0.8)
const GLOW = 0.06;               // drops pick up a little light from the scene
const STRETCH = 0.25;            // 0 = round drops, higher = taller, more irregular drops

// tails: big sliding drops stretch into one long drop; the top pinches off into droplets
const STREAK_MIN_RADIUS = 11;    // drops at least this big can grow a tail...
const TAIL_MIN_SPEED = 0.6;      // ...if they're fast: speed score 0-1 from size and pace (higher = only the very fastest)
const TAIL_CHANCE = 0.85;        // ...and this share of those fast drops actually do (lower = fewer tails)
const STREAK_WIPE = 1.6;         // width of the channel the drop wipes through the droplets
const TAIL_LENGTH = 7;           // tail length when the drop starts sliding, in drop radii
const LONG_TAIL_CHANCE = 0.25;   // share of tails that are long ones
const LONG_TAIL_STRETCH = [1.6, 2.6];   // how much longer those are than normal
const TAIL_MIN_LENGTH = 2;       // shortest the tail gets, in drop radii
const TAIL_SHRINK = 0.6;         // how quickly the tail shortens: it's mostly gone after this share of the screen height
const TAIL_WIDTH = 0.9;          // width where the tail leaves the drop, relative to the drop's radius
const TAIL_TOP_WIDTH = 0.36;     // width further up the tail
const TAIL_NECK = 1.3;           // how quickly the drop narrows into its tail (in drop radii)
const TAIL_BULGE = 0.22;         // how much the very top swells before it pinches off
const TAIL_BUMPS = 1;            // irregular, lumpy edges along the tail: 0 = smooth tube, 1 = natural, 2 = very lumpy
const TAIL_LUMP_CHANCE = 0.08;   // how often water gathers into a bulge (or thins out) along the tail
const REFILL_DELAY = 2;          // seconds before new droplets start landing in a wiped channel
const REFILL_SECONDS = 25;       // ...and how long the channel takes to fill back in

const BEAD_SIZE = 0.35;          // size of the droplets the tail leaves behind, relative to the drop (was 0.55)
const BEAD_EVERY = 7;            // distance the drop travels between those droplets, in drop radii (higher = fewer)
const TRAIL_DROPLET_GAP = [30, 70];   // small (tail-less) drops leave a tiny droplet every this many pixels
const WIPE_PATH = true;          // sliding drops clear the droplets in their path (and absorb resting drops)
const MAX_BEADS = 400;           // oldest pinched-off droplets drip away once there are more than this

// new sliding drops land anywhere on the glass instead of starting above the screen
const LAND_ANYWHERE = true;
const SLOW_DROP_CHANCE = 0.35;   // share of drops that are noticeably slower than the rest
const SLOW_DROP_PACE = [0.35, 0.65];   // speed range for those slow drops (share of normal speed)
const NORMAL_DROP_PACE = [0.85, 1.15]; // speed range for everyone else
const LAND_START_SPEED = 0.6;    // landed drops start sliding right away, at this share of their full speed
// ---------------------------------

let drops = [];       // live drops: redrawn every frame, can slide
let droplets = 0;     // number of permanent droplets painted so far
let maxDroplets = 0;
let ready = false;
let remaining = 0;    // drops still waiting to appear
let spawnPerFrame = 0;
let pending = 0;
let landings = [];    // droplets waiting to land in wiped channels: {x, y, r, at}
let beads = [];       // beads left by wet tracks, oldest first: {x, y, r}

function randomDotRadius() {
    return DOT_MIN + Math.pow(Math.random(), DOT_SKEW) * (DOT_MAX - DOT_MIN);
}

function buildBackground() {
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
    const w = bg.width * scale;
    const h = bg.height * scale;
    bgCtx.drawImage(bg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

    bgCtx.fillStyle = `rgba(0, 0, 0, ${DIM})`;      // darken it the same amount as the CSS
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgPattern = null;                                 // rebuilt from the new background on next use
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
        nextGap: TRAIL_DROPLET_GAP[0] + Math.random() * (TRAIL_DROPLET_GAP[1] - TRAIL_DROPLET_GAP[0]),
        trail: [],
        stick: 0,                        // frames left caught on the glass (stutter)
        // per-drop irregularity so no two outlines match
        p1: Math.random() * 6.28,
        p2: Math.random() * 6.28,
        p3: Math.random() * 6.28,
        amp: 0.5 + Math.random() * (1 + STRETCH * 2),
        wide: 1 - STRETCH * Math.random(),    // narrower = taller-looking drop
    };
}

function makeDrop(anywhere = true) {
    // two groups: mostly small drops, a few big ones, almost nothing in between
    const r = Math.random() < BIG_DROP_CHANCE
        ? BIG_MIN_RADIUS + Math.random() * (MAX_RADIUS - BIG_MIN_RADIUS)
        : MIN_LIVE_RADIUS + Math.random() * SMALL_SPREAD;
    const landed = anywhere || LAND_ANYWHERE;
    const d = newDrop(
        Math.random() * canvas.width,
        landed ? Math.random() * canvas.height : -MAX_RADIUS * 2,
        r
    );
    d.targetR = r;
    d.drift = WIND + (Math.random() - 0.5) * 2 * WIND_VARIATION;   // this drop's own drift angle
    d.h = d.drift;
    const [lo, hi] = Math.random() < SLOW_DROP_CHANCE ? SLOW_DROP_PACE : NORMAL_DROP_PACE;
    d.pace = lo + Math.random() * (hi - lo);                        // this drop's own steady speed
    // only fast drops get a tail: speed comes from size and pace, scored 0..1
    const speedScore = Math.pow(r / MAX_RADIUS, SIZE_SPEED_POWER) * d.pace / NORMAL_DROP_PACE[1];
    d.streaks = r >= STREAK_MIN_RADIUS && speedScore >= TAIL_MIN_SPEED && Math.random() < TAIL_CHANCE;
    if (!anywhere) {
        // a fresh drop lands at full size and starts sliding straight away
        d.sliding = true;
        d.speed = SPEED * 0.12 * MAX_RADIUS * Math.pow(r / MAX_RADIUS, SIZE_SPEED_POWER) * d.pace * LAND_START_SPEED;
    }
    d.tail = [];                                       // path behind the drop, oldest (top) first
    const stretch = Math.random() < LONG_TAIL_CHANCE
        ? LONG_TAIL_STRETCH[0] + Math.random() * (LONG_TAIL_STRETCH[1] - LONG_TAIL_STRETCH[0])
        : 0.8 + Math.random() * 0.4;
    d.tailStart = TAIL_LENGTH * r * stretch;
    d.tailLen = d.tailStart;                           // current tail length, shrinks as it travels
    d.traveled = 0;
    d.sincePinch = 0;
    d.nextPinch = BEAD_EVERY * r * (0.7 + Math.random() * 0.6);
    return d;
}

function paintDroplet(x, y, r) {
    drawDrop(layerCtx, newDrop(x, y, r));
    droplets++;
}

// start from a clear window; the rain builds up over FILL_SECONDS
function initDrops() {
    layer.width = canvas.width;      // also clears the layer
    layer.height = canvas.height;
    landings = [];
    beads = [];
    bgPattern = null;                // the background may have changed (resize, multi-monitor)
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
            randomDotRadius()
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
    if (d.r < SIMPLE_BELOW) {
        // too small for refraction to show: a soft, slightly tall bead catching the light
        c.beginPath();
        c.ellipse(d.x, d.y, d.r * d.wide, d.r, 0, 0, Math.PI * 2);
        c.fillStyle = "rgba(0, 0, 0, 0.12)";
        c.fill();
        c.beginPath();
        c.ellipse(d.x - d.r * 0.2, d.y - d.r * 0.25, d.r * 0.5 * d.wide, d.r * 0.55, 0, 0, Math.PI * 2);
        c.fillStyle = "rgba(255, 255, 255, 0.28)";
        c.fill();
        return;
    }

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

    // a little extra light, like the drop is gathering glow from the scene
    c.fillStyle = `rgba(255, 255, 255, ${GLOW})`;
    c.fill(path);

    // soft darker edge
    const g = c.createRadialGradient(d.x, d.y, d.r * 0.6, d.x, d.y, ext);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, `rgba(0, 0, 0, ${EDGE_DARKNESS})`);
    c.fillStyle = g;
    c.fill(path);

    // optional bright rim along the bottom
    if (RIM_BRIGHTNESS > 0) {
    c.beginPath();
    c.ellipse(d.x, d.y, d.r * 0.7 * d.wide, d.r * 0.8, d.h, Math.PI * 0.15, Math.PI * 0.85);
    c.strokeStyle = `rgba(255, 255, 255, ${RIM_BRIGHTNESS})`;
    c.lineWidth = Math.max(d.r * 0.12, 0.8);
    c.stroke();
    }

    // soft highlight
    c.beginPath();
    c.ellipse(d.x - d.r * 0.3, d.y - d.r * 0.4, d.r * 0.14, d.r * 0.09, -0.5, 0, Math.PI * 2);
    c.fillStyle = `rgba(255, 255, 255, ${SHINE})`;
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

// A big sliding drop collects the droplets in its path (wiping a channel that
// slowly fills back in), and its body stretches out behind it into a long drop.
function addStreak(d, fromX, fromY) {
    const dx = d.x - fromX, dy = d.y - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) return;
    const now = performance.now();
    if (!WIPE_PATH && !d.streaks) return;

    // wipe the droplets out of the channel (big drops a little wider than they are)
    const wipe = d.r * (d.streaks ? STREAK_WIPE : 1.4);
    layerCtx.save();
    layerCtx.globalCompositeOperation = "destination-out";
    layerCtx.lineCap = "round";
    layerCtx.lineWidth = wipe;
    layerCtx.beginPath();
    layerCtx.moveTo(fromX, fromY);
    layerCtx.lineTo(d.x, d.y);
    layerCtx.stroke();
    layerCtx.restore();

    // schedule new droplets to land in the wiped area later, at the normal density
    const expected = (len * wipe) / DENSITY;
    let n = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    while (n-- > 0) {
        const t = Math.random();
        landings.push({
            x: fromX + dx * t + (Math.random() - 0.5) * wipe,
            y: fromY + dy * t,
            r: randomDotRadius(),
            at: now + (REFILL_DELAY + Math.random() * REFILL_SECONDS) * 1000,
        });
    }

    if (!d.streaks) return;              // only big drops grow a tail
    d.sincePinch += len;
    d.traveled += len;
    // the tail shortens as the drop travels down the window
    const minLen = TAIL_MIN_LENGTH * d.r;
    d.tailLen = minLen + (d.tailStart - minLen) * Math.exp(-d.traveled / (canvas.height * TAIL_SHRINK));

    // grow the tail: remember where the drop has been, every few pixels along the glass
    // (not once per frame, so fast drops get just as much detail as slow ones),
    // with uneven edges and the odd lump
    const SPACING = 3;
    const last = d.tail[d.tail.length - 1] || { x: fromX, y: fromY };
    const gap = Math.hypot(d.x - last.x, d.y - last.y);
    const steps = Math.floor(gap / SPACING);
    for (let k = 1; k <= steps; k++) {
        const px = last.x + (d.x - last.x) * (k * SPACING / gap);
        const py = last.y + (d.y - last.y) * (k * SPACING / gap);
        d.edgeL = (d.edgeL || 0) * 0.78 + (Math.random() - 0.5) * 0.55 * TAIL_BUMPS;
        d.edgeR = (d.edgeR || 0) * 0.78 + (Math.random() - 0.5) * 0.55 * TAIL_BUMPS;
        if (!d.lumpLeft && Math.random() < TAIL_LUMP_CHANCE * TAIL_BUMPS) {
            d.lumpLen = 3 + Math.floor(Math.random() * 4);    // lump length, in tail points (3px each)
            d.lumpLeft = d.lumpLen;
            // mostly bulges where water gathers, sometimes a thin neck where it's stretched
            d.lumpAmp = (Math.random() < 0.7 ? 0.45 + Math.random() * 0.5 : -(0.25 + Math.random() * 0.2))
                        * Math.min(TAIL_BUMPS, 1.5);
            d.lumpTilt = (Math.random() - 0.5) * 0.6;          // lumps lean a little to one side
        }
        let lump = 0, tilt = 0;
        if (d.lumpLeft) {
            const phase = (d.lumpLen - d.lumpLeft + 0.5) / d.lumpLen;
            lump = d.lumpAmp * Math.sin(Math.PI * phase);
            tilt = d.lumpTilt * lump;
            d.lumpLeft--;
        }
        d.tail.push({
            x: px, y: py,
            l: d.edgeL * 0.8 + lump + tilt,     // left edge pushed out (+) or in (-)
            r: d.edgeR * 0.8 + lump - tilt,     // right edge
        });
    }
    trimTail(d);

    // the top end of the tail leaves a droplet behind every so often as it slides past
    if (d.sincePinch >= d.nextPinch && d.tail.length) {
        const top = d.tail[0], next = d.tail[1] || { x: d.x, y: d.y };
        const ang = Math.atan2(next.x - top.x, next.y - top.y);
        leaveDroplet(top.x, top.y, d.r * BEAD_SIZE * (0.8 + Math.random() * 0.4), ang);
        d.sincePinch = 0;
        d.nextPinch = BEAD_EVERY * d.r * (0.7 + Math.random() * 0.6);
    }
}

// total length of the tail, from its top down to the drop
function tailLength(d) {
    let L = 0, px = d.x, py = d.y;
    for (let i = d.tail.length - 1; i >= 0; i--) {
        L += Math.hypot(d.tail[i].x - px, d.tail[i].y - py);
        px = d.tail[i].x; py = d.tail[i].y;
    }
    return L;
}

// a properly shaped droplet left on the glass (slightly tall, like it just separated)
function leaveDroplet(x, y, r, heading) {
    const b = newDrop(x, y, r);
    b.h = heading || 0;
    b.s = 0.2;
    b.wide = 0.85 + Math.random() * 0.1;
    drawDrop(layerCtx, b);
    beads.push({ x, y, r });
}

// keep the tail at its current length: the top end slides along behind the drop.
// The cut is made part-way along a segment, so the top glides instead of stepping.
function trimTail(d) {
    let L = tailLength(d);
    while (d.tail.length > 1 && L > d.tailLen) {
        const a = d.tail[0], b = d.tail[1];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        const extra = L - d.tailLen;
        if (extra >= seg) {
            d.tail.shift();
            L -= seg;
        } else {
            const t = extra / seg;              // move the top point partway toward the next one
            a.x += (b.x - a.x) * t;
            a.y += (b.y - a.y) * t;
            a.l += ((b.l || 0) - (a.l || 0)) * t;
            a.r += ((b.r || 0) - (a.r || 0)) * t;
            L = d.tailLen;
        }
    }
}

// when a tailed drop leaves or runs out of water, its tail breaks up into droplets
function dumpTail(d) {
    if (!d.tail || d.tail.length < 2) return;
    const br = d.r * BEAD_SIZE * 0.85;
    let acc = 0;
    for (let i = 1; i < d.tail.length; i++) {
        acc += Math.hypot(d.tail[i].x - d.tail[i - 1].x, d.tail[i].y - d.tail[i - 1].y);
        if (acc > br * 2.6) {
            acc = 0;
            const p = d.tail[i];
            if (p.y > -br && p.y < canvas.height + br) leaveDroplet(p.x, p.y, br * (0.85 + Math.random() * 0.3), 0);
        }
    }
    d.tail = [];
}

// the tail is drawn as part of the drop: same refraction, edges and highlight
function drawTail(c, d) {
    if (!d.tail || d.tail.length < 1) return;
    const pts = d.tail.concat([{ x: d.x, y: d.y }]);
    const n = pts.length;

    // distance of each point from the drop, for the taper
    const dist = new Array(n).fill(0);
    for (let i = n - 2; i >= 0; i--) dist[i] = dist[i + 1] + Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    const L = dist[0] || 1;

    const widthAt = (i) => {
        // smooth teardrop: wide where it leaves the drop, narrowing quickly into a neck,
        // then a gently wavering tail that swells again at the top before it pinches off
        const neck = Math.exp(-dist[i] / (d.r * TAIL_NECK));
        const fromTop = dist[0] - dist[i];
        const bulge = TAIL_BULGE * Math.exp(-Math.pow(fromTop / (d.r * 1.1), 2));
        const base = TAIL_TOP_WIDTH + (TAIL_WIDTH - TAIL_TOP_WIDTH) * neck;
        return d.r * (base + bulge) * (1 + 0.05 * Math.sin(dist[i] * 0.12 + d.p1));
    };

    const left = [], right = [];
    for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const w = widthAt(i);
        // the bumps fade out where the tail meets the drop, so the join stays smooth
        // the bumps fade out where the tail meets the drop and at the rounded top, so both stay smooth
        const nearDrop = Math.min(1, dist[i] / (d.r * 1.5));
        const nearTop = Math.min(1, (dist[0] - dist[i]) / (d.r * 1.2));
        const bump = nearDrop * nearTop;
        const wl = w * Math.max(0.35, 1 + (pts[i].l || 0) * bump);
        const wr = w * Math.max(0.35, 1 + (pts[i].r || 0) * bump);
        left.push({ x: pts[i].x - ty * wl, y: pts[i].y + tx * wl });
        right.push({ x: pts[i].x + ty * wr, y: pts[i].y - tx * wr });
    }

    // one smooth outline: up the left side, round over the top, down the right side
    const wTop = widthAt(0);
    const t0x = pts[Math.min(1, n - 1)].x - pts[0].x, t0y = pts[Math.min(1, n - 1)].y - pts[0].y;
    const angL = Math.atan2(left[0].y - pts[0].y, left[0].x - pts[0].x);
    const path = new Path2D();
    const curveThrough = (pp, i0, step, end) => {
        // quadratic curves through midpoints: rounds off the bumps
        for (let i = i0; i !== end; i += step) {
            const a = pp[i], b = pp[i + step];
            path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        path.lineTo(pp[end].x, pp[end].y);
    };
    path.moveTo(left[n - 1].x, left[n - 1].y);
    if (n > 2) curveThrough(left, n - 2, -1, 0); else path.lineTo(left[0].x, left[0].y);
    path.arc(pts[0].x, pts[0].y, wTop, angL, angL + Math.PI, false); // rounded top
    if (n > 2) curveThrough(right, 1, 1, n - 1); else path.lineTo(right[n - 1].x, right[n - 1].y);
    path.closePath();

    // refraction like a sideways lens: the scene flipped and squeezed left-to-right across
    // the tail, but not top-to-bottom, so every part of the tail shows the colours around it
    let cx = 0;
    for (const p of pts) cx += p.x;
    cx /= n;
    c.save();
    c.clip(path, "nonzero");
    c.translate(cx, 0);
    c.scale(-1 / 3, 1);
    c.translate(-cx, 0);
    c.drawImage(bgCanvas, 0, 0);
    c.restore();

    // the same glow and soft dark edge the drop has
    c.save();
    c.clip(path, "nonzero");
    c.fillStyle = `rgba(255, 255, 255, ${GLOW})`;
    c.fill(path);
    // soft dark edge, built up in a few faint layers so it shades gradually
    c.lineJoin = "round";
    for (const [w, a] of [[0.9, 0.3], [0.55, 0.35], [0.28, 0.4], [0.12, 0.45]]) {
        c.strokeStyle = `rgba(0, 0, 0, ${EDGE_DARKNESS * a})`;
        c.lineWidth = d.r * w;
        c.stroke(path);
    }

    // a thin highlight running along one side, like on the drop
    c.beginPath();
    for (let i = 0; i < n; i++) {
        const w = widthAt(i) * 0.45;
        const x = pts[i].x - w, y = pts[i].y;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(255, 255, 255, ${SHINE * 0.3})`;
    c.lineWidth = Math.max(1, d.r * 0.07);
    c.lineJoin = "round";
    c.stroke();
    c.restore();
}

// droplets landing in channels that big drops wiped clean
function landDroplets() {
    if (!landings.length) return;
    const now = performance.now();
    const waiting = [];
    for (const l of landings) {
        if (now < l.at) { waiting.push(l); continue; }
        drawDrop(layerCtx, newDrop(l.x, l.y, l.r));
        if (l.bead) beads.push({ x: l.x, y: l.y, r: l.r });
    }
    landings = waiting;

    // keep the number of beads steady: the oldest ones drip away
    if (beads.length > MAX_BEADS) {
        layerCtx.save();
        layerCtx.globalCompositeOperation = "destination-out";
        while (beads.length > MAX_BEADS) {
            const b = beads.shift();
            layerCtx.beginPath();
            layerCtx.ellipse(b.x, b.y, b.r * 1.3, b.r * 1.6, 0, 0, Math.PI * 2);
            layerCtx.fill();
        }
        layerCtx.restore();
    }
}

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    landDroplets();               // refill channels wiped by big drops
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
        // absorbed by a sliding drop: a new drop lands somewhere else instead
        if (d.absorbed) {
            drops[i] = makeDrop(false);
            return;
        }

        // heavier drops are more likely to break free and start sliding
        if (!d.sliding && Math.random() < 0.0004 * d.r + 0.001) {
            d.sliding = true;
        }

        if (d.sliding) {
            // terminal velocity grows faster than size: big drops race, small ones crawl
            d.vtMod = Math.min(1.4, Math.max(0.6, d.vtMod + (Math.random() - 0.5) * 0.1));
            const size = d.r / MAX_RADIUS;               // 0..1
            const vt = SPEED * 0.12 * MAX_RADIUS * Math.pow(size, SIZE_SPEED_POWER) * (d.pace || 1) * d.vtMod;

            if (d.stick > 0) {
                // caught on the glass: brake hard and hold for a moment
                d.stick--;
                d.speed *= 0.8;
            } else {
                // surge back up quickly after a catch, ease down gently
                d.speed += (vt - d.speed) * (d.speed < vt ? 0.12 : 0.05);

                // small drops catch often and long; big ones only hiccup now and then
                const smallness = 1 - size;
                const catchChance = STUTTER * (0.004 + 0.015 * smallness);
                if (Math.random() < catchChance) {
                    d.stick = 2 + Math.floor(Math.random() * (5 + 12 * smallness) * Math.min(STUTTER, 2));
                }
            }

            // follows its drift line but slowly wanders off it: mostly further downwind,
            // now and then a little back the other way (independent of SPEED, so no zigzag)
            const drift = d.drift === undefined ? WIND : d.drift;
            if (d.wander === undefined || Math.random() < 0.015 * WIGGLE_SPEED) {
                const amp = WIGGLE * 0.5 / (1 + d.r * 0.03);                  // big drops wander a bit less
                const side = Math.sign(WIND || 1);                              // downwind direction
                d.wander = side * amp * (Math.random() * 1.3 - 0.3);           // mostly downwind, a little upwind
            }
            const aim = drift + d.wander;
            d.w = d.w * 0.85 + (aim - d.h) * 0.012 + (Math.random() - 0.5) * 0.004 * WIGGLE;
            d.h += d.w;

            const fromX = d.x, fromY = d.y;
            d.x += Math.sin(d.h) * d.speed;
            d.y += Math.cos(d.h) * d.speed;
            addStreak(d, fromX, fromY);

            // run into a resting drop: absorb it (it is replaced by a new drop somewhere else)
            if (WIPE_PATH) {
                for (const o of drops) {
                    if (o !== d && !o.sliding && !o.absorbed &&
                        Math.hypot(o.x - d.x, o.y - d.y) < d.r + o.r * 0.6) o.absorbed = true;
                }
            }
            d.s = Math.min(1, d.speed / (SPEED * 1.5));   // faster = more stretched

            d.trail.push({ x: d.x, y: d.y });
            if (d.trail.length > TRAIL_LENGTH) d.trail.shift();

            // leave a tiny permanent droplet behind every few pixels of travel
            // (big streaking drops leave beads from their wet track instead)
            d.gap += d.speed;
            if (!d.streaks && d.gap > d.nextGap && droplets < maxDroplets) {
                const dr = 0.6 + Math.random() * 1.2;
                const back = d.r * (0.8 + d.s);
                const side = (Math.random() - 0.5) * d.r * 0.4;
                paintDroplet(
                    d.x - Math.sin(d.h) * back + Math.cos(d.h) * side,
                    d.y - Math.cos(d.h) * back - Math.sin(d.h) * side,
                    dr
                );
                if (!KEEP_SIZE) d.r = Math.sqrt(Math.max(d.r * d.r - dr * dr * 0.5, 0)); // loses water
                d.gap = 0;
                d.nextGap = TRAIL_DROPLET_GAP[0] + Math.random() * (TRAIL_DROPLET_GAP[1] - TRAIL_DROPLET_GAP[0]);
            }
        }

        // a drop that has run out of water settles as one last small droplet
        if (d.r < 3.5) {
            dumpTail(d);
            if (d.y > 0 && d.y < canvas.height && droplets < maxDroplets) {
                d.s = 0;
                drawDrop(layerCtx, d);
                droplets++;
            }
            drops[i] = makeDrop(false);
            return;
        }

        // gone off screen (wait for a tail to follow it out)
        const reach = d.r * 1.7;
        const topY = d.tail && d.tail.length ? d.tail[0].y : d.y;
        if (topY > canvas.height + reach || d.x < -reach || d.x > canvas.width + reach) {
            dumpTail(d);
            drops[i] = makeDrop(false);
            return;
        }

        drawTrail(ctx, d);
        if (d.streaks) drawTail(ctx, d);
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
    landings = [];
    beads = [];
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