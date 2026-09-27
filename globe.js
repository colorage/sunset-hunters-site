import { TAU, RAD, solarPosition, unitVector, rotate, dot, terminatorPoints, landPoints } from './globe-math.mjs';

const logo = document.createElement('img');
logo.className = 'brand-logo';
logo.src = 'LogotypeRectangle.svg';
logo.alt = 'Sunset Hunters Club';
document.querySelector('.brand').appendChild(logo);

const canvas = document.getElementById('globe'), ctx = canvas.getContext('2d');
const hint = document.querySelector('.globe-hint');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const fallback = { lat: 52.2297, lon: 21.0122, city: 'Warsaw, Poland' };
let locationData = fallback, rotation = -.28, tilt = .18, points = [];
let dragging = false, lastX = 0, lastY = 0, resumeAt = 0, previousFrame = 0;
let manuallyPaused = false, solarSecond = -1, sun, boundary;

const controls = document.createElement('div');
controls.className = 'globe-controls';
const pause = document.createElement('button');
pause.type = 'button';
pause.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateControls(); });
controls.appendChild(pause);
hint.before(controls);
canvas.tabIndex = 0;
canvas.setAttribute('aria-describedby', 'globe-instructions');
hint.id = 'globe-instructions';
function updateControls() {
  pause.textContent = manuallyPaused || reducedMotion.matches ? 'Rotate globe' : 'Pause rotation';
  pause.disabled = reducedMotion.matches;
  hint.textContent = 'Drag or use arrow keys to explore';
}
reducedMotion.addEventListener('change', updateControls);
updateControls();

function size() {
  const dpr = Math.min(devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Small lighting texture keeps the spherical day/night transition inexpensive.
const surface = document.createElement('canvas');
surface.width = surface.height = 160;
const surfaceCtx = surface.getContext('2d');
const surfaceImage = surfaceCtx.createImageData(160, 160);
const normals = [];
for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
  const nx = (x + .5 - 80) / 80, ny = (80 - y - .5) / 80, rr = nx * nx + ny * ny;
  if (rr <= 1) normals.push({ index: (y * 160 + x) * 4, x: nx, y: ny, z: Math.sqrt(1 - rr) });
}
function lightSurface(viewSun) {
  const pixels = surfaceImage.data;
  for (const n of normals) {
    const light = dot(n, viewSun);
    const day = Math.max(0, Math.min(1, (light + .1) / .35));
    const twilight = Math.exp(-Math.pow(light / .085, 2));
    const rim = Math.pow(1 - n.z, 3);
    pixels[n.index] = 8 + day * 7 + twilight * 24 + rim * 5;
    pixels[n.index + 1] = 15 + day * 11 + twilight * 11 + rim * 11;
    pixels[n.index + 2] = 29 + day * 18 + twilight * 5 + rim * 22;
    pixels[n.index + 3] = 255;
  }
  surfaceCtx.putImageData(surfaceImage, 0, 0);
}

function terminatorPath(radius, cx, cy) {
  const path = new Path2D();
  let previous;
  for (const point of boundary) {
    const current = rotate(point, rotation, tilt);
    if (previous) {
      // Clip each segment at the horizon; never connect across the hidden half.
      if ((previous.z >= 0) !== (current.z >= 0)) {
        const t = previous.z / (previous.z - current.z);
        const x = previous.x + (current.x - previous.x) * t;
        const y = previous.y + (current.y - previous.y) * t;
        if (previous.z >= 0) path.lineTo(cx + x * radius, cy - y * radius);
        else { path.moveTo(cx + x * radius, cy - y * radius); path.lineTo(cx + current.x * radius, cy - current.y * radius); }
      } else if (current.z >= 0) path.lineTo(cx + current.x * radius, cy - current.y * radius);
    } else if (current.z >= 0) path.moveTo(cx + current.x * radius, cy - current.y * radius);
    previous = current;
  }
  return path;
}

function draw(timestamp) {
  const elapsed = previousFrame ? Math.min(timestamp - previousFrame, 50) : 0;
  previousFrame = timestamp;
  if (!document.hidden) {
    if (!dragging && !manuallyPaused && !reducedMotion.matches && timestamp > resumeAt) rotation += elapsed * .000035;
    const now = new Date(), second = Math.floor(now.getTime() / 1000);
    if (second !== solarSecond) { solarSecond = second; sun = solarPosition(now).vector; boundary = terminatorPoints(sun); }
    const w = canvas.clientWidth, h = canvas.clientHeight, cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * .425;
    ctx.clearRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(cx, cy, radius * .96, cx, cy, radius * 1.16);
    halo.addColorStop(0, 'rgba(89,135,220,.16)');
    halo.addColorStop(.4, 'rgba(71,116,210,.05)');
    halo.addColorStop(1, 'rgba(71,116,210,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.clip();
    lightSurface(rotate(sun, rotation, tilt));
    ctx.drawImage(surface, cx - radius, cy - radius, radius * 2, radius * 2);
    for (const point of points) {
      const p = rotate(point, rotation, tilt);
      if (p.z <= 0) continue;
      const light = dot(point, sun);
      const day = Math.max(0, Math.min(1, (light + .08) / .22));
      const twilight = Math.exp(-Math.pow(light / .075, 2));
      const r = Math.round(105 + day * 108 + twilight * 34);
      const g = Math.round(131 + day * 62 - twilight * 15);
      const b = Math.round(190 - day * 45 - twilight * 38);
      ctx.fillStyle = `rgba(${r},${g},${b},${.5 + .5 * Math.sqrt(p.z)})`;
      const dotRadius = Math.max(.65, radius * .0044) * (.55 + .45 * Math.sqrt(p.z));
      ctx.beginPath(); ctx.arc(cx + p.x * radius, cy - p.y * radius, dotRadius, 0, TAU); ctx.fill();
    }
    const path = terminatorPath(radius, cx, cy);
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffad59'; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffce8a'; ctx.lineWidth = 1.25; ctx.stroke(path);
    ctx.shadowBlur = 0;
    const pin = rotate(unitVector(locationData.lat, locationData.lon), rotation, tilt);
    if (pin.z > 0) {
      const x = cx + pin.x * radius, y = cy - pin.y * radius;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = 'rgba(88,166,255,.15)'; ctx.fill();
      ctx.strokeStyle = 'rgba(125,195,255,.65)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fillStyle = '#bce6ff';
      ctx.shadowColor = '#58a6ff'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(123,164,225,.18)'; ctx.lineWidth = .75; ctx.stroke();
  }
  requestAnimationFrame(draw);
}

function solarTimes(lat, lon, date) {
  const { declination: dec, equation } = solarPosition(date), phi = lat * RAD;
  const cosH = Math.cos(90.833 * RAD) / (Math.cos(phi) * Math.cos(dec)) - Math.tan(phi) * Math.tan(dec);
  if (cosH <= -1 || cosH >= 1) return null;
  const hourAngle = Math.acos(cosH) / RAD, noon = 720 - 4 * lon - equation;
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { rise: new Date(midnight + (noon - hourAngle * 4) * 60000), set: new Date(midnight + (noon + hourAngle * 4) * 60000) };
}
function fmt(date) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function updateSun() {
  const now = new Date(), times = solarTimes(locationData.lat, locationData.lon, now);
  if (!times) return;
  let set = times.set;
  if (set < now) set = solarTimes(locationData.lat, locationData.lon, new Date(now.getTime() + 86400000))?.set || set;
  const seconds = Math.floor(Math.max(0, set - now) / 1000);
  document.getElementById('countdown').textContent = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  document.getElementById('sunset-meta').textContent = `Sunset at ${fmt(set)} local time`;
  document.getElementById('sunrise').textContent = fmt(times.rise);
  document.getElementById('golden').textContent = fmt(new Date(set.getTime() - 45 * 60000));
  document.getElementById('day-progress').style.width = `${Math.max(0, Math.min(100, (now - times.rise) / (times.set - times.rise) * 100))}%`;
}
function setLocation(data) {
  locationData = data;
  document.getElementById('location').textContent = data.city || `${data.lat.toFixed(2)}°, ${data.lon.toFixed(2)}°`;
  document.getElementById('coords').textContent = `${Math.abs(data.lat).toFixed(4)}° ${data.lat >= 0 ? 'N' : 'S'} · ${Math.abs(data.lon).toFixed(4)}° ${data.lon >= 0 ? 'E' : 'W'}`;
  updateSun();
}
async function locate() {
  setLocation(fallback);
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return;
    const data = await response.json();
    if (Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) setLocation({ lat: data.latitude, lon: data.longitude, city: [data.city, data.country_name].filter(Boolean).join(', ') });
  } catch { /* Keep the existing default location if lookup is unavailable. */ }
}
canvas.addEventListener('pointerdown', event => {
  dragging = true; lastX = event.clientX; lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  rotation += (event.clientX - lastX) / 220;
  tilt = Math.max(-1.2, Math.min(1.2, tilt + (event.clientY - lastY) / 300));
  lastX = event.clientX; lastY = event.clientY;
});
function release() { dragging = false; resumeAt = performance.now() + 4000; }
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowLeft') rotation -= .12;
  if (event.key === 'ArrowRight') rotation += .12;
  if (event.key === 'ArrowUp') tilt = Math.min(1.2, tilt + .12);
  if (event.key === 'ArrowDown') tilt = Math.max(-1.2, tilt - .12);
  resumeAt = performance.now() + 4000;
});
window.addEventListener('resize', size);
setInterval(updateSun, 1000);
size(); locate(); requestAnimationFrame(draw);
try {
  const response = await fetch('./land.geojson');
  if (!response.ok) throw new Error('Coastline data unavailable');
  points = landPoints(await response.json());
  canvas.dataset.landPoints = points.length;
} catch (error) {
  hint.textContent = 'Map unavailable — refresh to try again';
  console.error(error);
}
