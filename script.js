// ============================================================
//  STAMPLOCKER — MAIN APPLICATION LOGIC
//  Camera → Canvas Clipping (perforated) → Preview → GAS Save
// ============================================================

const SCRIPT_URL = "YOUR_WEB_APP_URL_HERE";

// ---- DOM handles (assigned on boot) ----
const $ = id => document.getElementById(id);
let screens, video, canvas, ctx, previewImg, captionEl, loader, flash, bookScroll, liveTs, perfPath;
let countdownEl, stampEffectEl, shutterSound;

// ---- state ----
let stream = null;
let facing = 'environment';
let base64 = null;
let currentZoom = 1;
let isCapturing = false;

// ---- Rectangle parameters (relative to SVG 1000×1500 viewBox) ----
const HOLE = { x: 156.95, y: 436.35, w: 686.07, h: 627.26 };   // Dimensions increased by another 10% (cumulative +21% from original)

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Bind DOM after elements exist
    screens    = { camera: $('screen-camera'), preview: $('screen-preview'), book: $('screen-book') };
    video      = $('camera-feed');
    canvas     = $('stamp-canvas');
    ctx        = canvas.getContext('2d');
    previewImg = $('preview-img');
    captionEl  = $('caption');
    loader     = $('loader');
    flash      = $('flash');
    bookScroll = $('book-scroll');
    liveTs     = $('live-ts');
    perfPath   = $('perf-path');
    countdownEl = $('countdown');
    stampEffectEl = $('stamp-effect');
    shutterSound = $('shutter-sound');

    generatePerforatedPath();      // Build the SVG + remember the geometry
    buildSVGOverlay();             // Compose the viewfinder mask
    positionFrameOverlay();        // Place stamp_frame.png over the hole
    startCamera();
    wireEvents();
    tickTimestamp();

    // Re-position frame overlay on window resize
    window.addEventListener('resize', positionFrameOverlay);
});

/**
 * Position the stamp_frame.png overlay to match the SVG hole exactly.
 */
function positionFrameOverlay() {
    const frameEl = $('frame-overlay');
    if (!frameEl) return;
    
    // Scale the overlay to be 1.3x the size of the clipping hole
    const scale = 1.3;
    const overW = HOLE.w * scale;
    const overH = HOLE.h * scale;
    const overX = HOLE.x - (overW - HOLE.w) / 2;
    const overY = HOLE.y - (overH - HOLE.h) / 2;

    frameEl.style.left   = (overX / 1000 * 100) + '%';
    frameEl.style.top    = (overY / 1500 * 100) + '%';
    frameEl.style.width  = (overW / 1000 * 100) + '%';
    frameEl.style.height = (overH / 1500 * 100) + '%';
}

// ============================================================
//  SVG VIEWFINDER
//  Draws a thick opaque bezel with a perforated rectangular hole
// ============================================================
function generatePerforatedPath() {
    // Build a path string describing the stamp-edge rectangle
    const d = perforatedRectPathData(HOLE.x, HOLE.y, HOLE.w, HOLE.h);
    perfPath.setAttribute('d', d);
}

function buildSVGOverlay() {
    const svg = $('viewfinder-svg');
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
    const ns = 'http://www.w3.org/2000/svg';

    const holeD = perfPath.getAttribute('d');

    // 1. Dark outer bezel
    const mask = document.createElementNS(ns, 'path');
    const outerRect = `M0,0 L1000,0 L1000,1500 L0,1500 Z`;
    mask.setAttribute('d', outerRect + ' ' + holeD);
    mask.setAttribute('fill-rule', 'evenodd');
    mask.setAttribute('fill', 'rgba(0,0,0,0.55)');
    svg.appendChild(mask);

    // 2. The vintage stamp paper (with the hole cut out for the camera)
    const frame = document.createElementNS(ns, 'path');
    frame.setAttribute('fill', '#f5efe4'); // cream paper matching capture output
    frame.setAttribute('filter', 'drop-shadow(0 5px 15px rgba(0,0,0,0.4))');
    
    // The margin inside the stamp where the photo actually sits
    const pad = HOLE.w * 0.09;
    const innerRectPath = `M ${HOLE.x + pad},${HOLE.y + pad} 
                           L ${HOLE.x + HOLE.w - pad},${HOLE.y + pad} 
                           L ${HOLE.x + HOLE.w - pad},${HOLE.y + HOLE.h - pad} 
                           L ${HOLE.x + pad},${HOLE.y + HOLE.h - pad} Z`;
    
    frame.setAttribute('d', holeD + ' ' + innerRectPath);
    frame.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(frame);

    // No extra borders drawn. The pure stamp look will rely on CSS 3D shadows.
}

/**
 * Returns an SVG path-data string for a rectangle with concave semi-circle bites.
 * The bites face INWARD (toward the center of the rectangle).
 */
function perforatedRectPathData(x, y, w, h) {
    const r = 20;      // Huge holes for prominent teeth
    const gap = 64;    // Wide spacing
    const nx = Math.floor(w / gap);
    const ny = Math.floor(h / gap);
    const stepX = w / nx;
    const stepY = h / ny;

    let d = `M ${x},${y}`;

    // Top: Left to Right -> Inside is DOWN (CW)
    for (let i = 0; i < nx; i++) {
        const cx = x + i * stepX + stepX / 2;
        d += ` L ${cx - r},${y} A ${r},${r} 0 0 1 ${cx + r},${y}`;
    }
    d += ` L ${x + w},${y}`;

    // Right: Top to Bottom -> Inside is LEFT (CW)
    for (let i = 0; i < ny; i++) {
        const cy = y + i * stepY + stepY / 2;
        d += ` L ${x + w},${cy - r} A ${r},${r} 0 0 1 ${x + w},${cy + r}`;
    }
    d += ` L ${x + w},${y + h}`;

    // Bottom: Right to Left -> Inside is UP (CW)
    for (let i = nx - 1; i >= 0; i--) {
        const cx = x + i * stepX + stepX / 2;
        d += ` L ${cx + r},${y + h} A ${r},${r} 0 0 1 ${cx - r},${y + h}`;
    }
    d += ` L ${x},${y + h}`;

    // Left: Bottom to Top -> Inside is RIGHT (CW)
    for (let i = ny - 1; i >= 0; i--) {
        const cy = y + i * stepY + stepY / 2;
        d += ` L ${x},${cy + r} A ${r},${r} 0 0 1 ${x},${cy - r}`;
    }
    d += ` Z`;
    return d;
}

// ============================================================
//  CAMERA
// ============================================================
async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        video.srcObject = stream;
    } catch (e) {
        console.error(e);
        alert('Cannot access camera.');
    }
}

function flipCamera() {
    facing = facing === 'environment' ? 'user' : 'environment';
    currentZoom = 1;
    startCamera().then(() => applyZoom(1));
}

/**
 * Apply zoom level.
 * Tries hardware zoom first (via MediaStreamTrack constraints).
 * Falls back to CSS transform on the video element.
 */
function applyZoom(level) {
    currentZoom = level;
    // Update UI chips
    document.querySelectorAll('.zoom-chip').forEach(c => {
        c.classList.toggle('active', Number(c.dataset.zoom) === level);
    });

    // Try hardware zoom first
    if (stream) {
        const track = stream.getVideoTracks()[0];
        if (track) {
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            if (caps.zoom) {
                const maxHW = caps.zoom.max || 1;
                const clampedZoom = Math.min(level, maxHW);
                track.applyConstraints({ advanced: [{ zoom: clampedZoom }] }).catch(() => {});
                // If hardware zoom covers it fully, skip CSS zoom
                if (clampedZoom >= level) {
                    video.style.transform = 'none';
                    return;
                }
                // Otherwise use CSS for the remaining factor
                const cssZoom = level / clampedZoom;
                video.style.transform = `scale(${cssZoom})`;
                return;
            }
        }
    }
    // Pure CSS fallback
    video.style.transform = level === 1 ? 'none' : `scale(${level})`;
}

function setZoom(level) {
    applyZoom(level);
}

function tickTimestamp() {
    const fmt = () => {
        const d = new Date();
        return d.toLocaleString('en-US', { month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).toUpperCase();
    };
    liveTs.textContent = fmt();
    setInterval(() => liveTs.textContent = fmt(), 1000);
}

// ============================================================
//  CAPTURE (THE IMPORTANT PART)
//  1. 3-second countdown
//  2. Play sound & trigger visual stamp effect
//  3. Map the SVG hole to video pixels
// ============================================================
function capture() {
    if (isCapturing) return;
    isCapturing = true;

    let timeLeft = 3;
    countdownEl.classList.remove('hide');
    countdownEl.textContent = timeLeft;

    const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownEl.textContent = timeLeft;
        } else {
            clearInterval(timer);
            countdownEl.classList.add('hide');
            executeCapture();
        }
    }, 1000);
}

function executeCapture() {
    // 1. Initial visual stamp start (The 3s rise-and-slam animation)
    stampEffectEl.classList.remove('hide');
    stampEffectEl.classList.add('animate');
    
    // 2. The 'Slam' moment (at 80% of 3s animation = 2400ms)
    setTimeout(() => {
        // Sound
        shutterSound.currentTime = 0;
        shutterSound.play().catch(e => console.warn("Sound blocked"));

        // Screen shake
        screens.camera.classList.add('shake');
        
        // Flash
        flash.classList.add('fire');
        setTimeout(() => flash.classList.remove('fire'), 180);

        // Perform the actual image processing
        performCanvasDrawing();
        
        // Remove shake after it finishes
        setTimeout(() => screens.camera.classList.remove('shake'), 300);
    }, 2400);

    // 3. Complete animation and show preview
    setTimeout(() => {
        stampEffectEl.classList.remove('animate');
        stampEffectEl.classList.add('hide');
        showScreen('preview');
        isCapturing = false;
    }, 3200);
}

function performCanvasDrawing() {
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    const svgRect = $('viewfinder-svg').getBoundingClientRect();
    const containerW = svgRect.width;
    const containerH = svgRect.height;

    const pad = HOLE.w * 0.09;
    const innerX = HOLE.x + pad;
    const innerY = HOLE.y + pad;
    const innerW = HOLE.w - pad * 2;
    const innerH = HOLE.h - pad * 2;

    const fracX = innerX / 1000;
    const fracY = innerY / 1500;
    const fracW = innerW / 1000;
    const fracH = innerH / 1500;

    const holeScreenX = containerW * fracX;
    const holeScreenY = containerH * fracY;
    const holeScreenW = containerW * fracW;
    const holeScreenH = containerH * fracH;

    const vidRatio = vW / vH;
    const containerRatio = containerW / containerH;

    let renderedW, renderedH, cropX, cropY;
    if (vidRatio > containerRatio) {
        renderedH = containerH;
        renderedW = containerH * vidRatio;
        cropX = (renderedW - containerW) / 2;
        cropY = 0;
    } else {
        renderedW = containerW;
        renderedH = containerW / vidRatio;
        cropX = 0;
        cropY = (renderedH - containerH) / 2;
    }

    const bufferScale = vW / renderedW;
    let sX = (holeScreenX + cropX) * bufferScale;
    let sY = (holeScreenY + cropY) * bufferScale;
    let sW = holeScreenW * bufferScale;
    let sH = holeScreenH * bufferScale;

    if (currentZoom > 1) {
        const zoomedW = sW / currentZoom;
        const zoomedH = sH / currentZoom;
        sX = sX + (sW - zoomedW) / 2;
        sY = sY + (sH - zoomedH) / 2;
        sW = zoomedW;
        sH = zoomedH;
    }

    const PHOTO_W = 900;
    const photoRatio = sH / sW;
    const PHOTO_H = Math.round(PHOTO_W * photoRatio);
    const MARGIN = Math.round(PHOTO_W * 0.08); 
    const cW = PHOTO_W + MARGIN * 2;
    const cH = PHOTO_H + MARGIN * 2;

    canvas.width  = cW;
    canvas.height = cH;
    ctx.clearRect(0, 0, cW, cH);

    buildCanvasPerforatedPath(ctx, 0, 0, cW, cH);
    ctx.clip();

    ctx.fillStyle = '#f5efe4';
    ctx.fillRect(0, 0, cW, cH);

    ctx.save();
    if (facing === 'user') {
        ctx.translate(cW, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sX, sY, sW, sH, MARGIN, MARGIN, PHOTO_W, PHOTO_H);
    ctx.restore();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(44, 30, 18, 0.12)';
    ctx.strokeRect(MARGIN, MARGIN, PHOTO_W, PHOTO_H);

    base64 = canvas.toDataURL('image/png');
    previewImg.src = base64;
}

/**
 * Draws the perforated rectangle clip path on a Canvas2D context.
 * Uses beginPath / arc / lineTo exactly as specified.
 */
function buildCanvasPerforatedPath(ctx, x, y, w, h) {
    const r = 28; 
    const gap = 90; 
    const nx = Math.floor(w / gap);
    const ny = Math.floor(h / gap);
    const stepX = w / nx;
    const stepY = h / ny;

    ctx.beginPath();
    ctx.moveTo(x, y);

    // Top (Left to Right) CCW is true
    for (let i = 0; i < nx; i++) {
        const cx = x + i * stepX + stepX / 2;
        ctx.lineTo(cx - r, y);
        ctx.arc(cx, y, r, Math.PI, 0, true);
    }
    ctx.lineTo(x + w, y);

    // Right (Top to Bottom) CCW is true
    for (let i = 0; i < ny; i++) {
        const cy = y + i * stepY + stepY / 2;
        ctx.lineTo(x + w, cy - r);
        ctx.arc(x + w, cy, r, -Math.PI/2, Math.PI/2, true);
    }
    ctx.lineTo(x + w, y + h);

    // Bottom (Right to Left) CCW is true
    for (let i = nx - 1; i >= 0; i--) {
        const cx = x + i * stepX + stepX / 2;
        ctx.lineTo(cx + r, y + h);
        ctx.arc(cx, y + h, r, 0, Math.PI, true);
    }
    ctx.lineTo(x, y + h);

    // Left (Bottom to Top) CCW is true
    for (let i = ny - 1; i >= 0; i--) {
        const cy = y + i * stepY + stepY / 2;
        ctx.lineTo(x, cy + r);
        ctx.arc(x, cy, r, Math.PI/2, -Math.PI/2, true);
    }
    ctx.closePath();
}

// ============================================================
//  NAVIGATION
// ============================================================
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    if (name === 'book') loadGallery();
}

// ============================================================
//  SAVE TO GOOGLE APPS SCRIPT
// ============================================================
async function saveToBook() {
    if (SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") { alert("Set SCRIPT_URL first."); return; }
    loader.classList.remove('hide');
    try {
        // --- Nén ảnh để fit 50,000 ký tự của Google Sheets ---
        // Resize xuống khoảng 380px width
        const thumbCanvas = document.createElement('canvas');
        const tCtx = thumbCanvas.getContext('2d');
        const targetW = 380;
        const targetH = Math.round(targetW * (canvas.height / canvas.width));
        thumbCanvas.width = targetW;
        thumbCanvas.height = targetH;
        tCtx.drawImage(canvas, 0, 0, targetW, targetH);
        
        // Dùng JPEG chất lượng 0.5 để giảm dung lượng đáng kể
        const sheetSafeBase64 = thumbCanvas.toDataURL('image/jpeg', 0.5);

        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                imageBase64: sheetSafeBase64,
                caption: captionEl.value.trim(),
                timestamp: new Date().toISOString()
            })
        });
        captionEl.value = '';
        showScreen('book');
    } catch (e) { alert('Save failed.'); }
    finally { loader.classList.add('hide'); }
}

// ============================================================
//  GALLERY / SCRAPBOOK
// ============================================================
async function loadGallery() {
    if (SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
        bookScroll.innerHTML = '<div class="book-empty">No stamps yet.<br>Go capture a memory!</div>';
        return;
    }
    try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        renderBook(data);
    } catch (e) { console.error(e); }
}

function renderBook(data) {
    if (!data || !data.length) {
        bookScroll.innerHTML = '<div class="book-empty">No stamps yet.<br>Go capture a memory!</div>';
        return;
    }
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const groups = {};
    const now = new Date();
    const todayStr = now.toDateString();
    const yestDate = new Date(now); yestDate.setDate(now.getDate() - 1);
    const yestStr  = yestDate.toDateString();

    data.forEach(item => {
        const d = new Date(item.timestamp);
        const ds = d.toDateString();
        let label;
        if (ds === todayStr) label = 'Today';
        else if (ds === yestStr) label = 'Yesterday';
        else label = d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });
        (groups[label] ||= []).push(item);
    });

    let html = '';
    for (const [label, items] of Object.entries(groups)) {
        html += `<div class="date-label">${label}</div><div class="stamp-cluster">`;
        items.forEach(item => {
            const rot = (Math.random() * 6 - 3).toFixed(1);
            html += `<div class="stamp-card" style="transform:rotate(${rot}deg)">`;
            // Dùng trực tiếp dữ liệu base64 từ Sheet
            html += `<img src="${item.data}" loading="lazy">`;
            if (item.caption) html += `<p>${item.caption}</p>`;
            html += `</div>`;
        });
        html += `</div>`;
    }
    bookScroll.innerHTML = html;
}

// ============================================================
//  EVENT WIRING
// ============================================================
function wireEvents() {
    $('btn-shutter').addEventListener('click', capture);
    $('btn-flip').addEventListener('click', flipCamera);
    $('btn-gallery').addEventListener('click', () => showScreen('book'));
    $('btn-retake').addEventListener('click', () => { base64 = null; captionEl.value = ''; showScreen('camera'); });
    $('btn-save').addEventListener('click', saveToBook);
    $('btn-back').addEventListener('click', () => showScreen('camera'));

    // Zoom chips
    document.querySelectorAll('.zoom-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const level = Number(chip.dataset.zoom);
            setZoom(level);
        });
    });
}
