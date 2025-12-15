// =====================
// DATA
// =====================
const PEOPLE = ["เอก", "เคน", "แอล", "ปุยฝ้าย", "กานต์", "กาญ", "ปอเปี๊ยะ", "พู"];
const STRICT_EXACT = new Set(["กาญ", "กานต์"]); // ต้องพิมพ์ตรงเป๊ะเท่านั้น

const ALIASES = {
  "เอก": ["เอกก", "เอกๆ"],
  "เคน": ["เค็น", "ken", "khen"],
  "แอล": ["แอลน์", "แอลน", "l", "el", "elle", "al"],
  "ปุยฝ้าย": ["ปุยฟ้าย", "ปุยฝย", "ปุยฝาย", "pui", "puifai"],
  "ปอเปี๊ยะ": ["ปอเปียะ", "ปอเปี้ย", "ปอเปีย", "ปอเปี๊ย", "popia", "po pia"],
  "พู": ["ภู", "phu", "poo"]
};

const SEED = "XMAS-2025-GROUP-01";

// =====================
// DOM
// =====================
const loginCard = document.getElementById("loginCard");
const revealCard = document.getElementById("revealCard");
const nicknameInput = document.getElementById("nickname");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnReveal = document.getElementById("btnReveal");
const whoEl = document.getElementById("who");
const slotText = document.getElementById("slotText");
const resultBox = document.getElementById("result");
const resultName = document.getElementById("resultName");
const loginError = document.getElementById("loginError");

let currentUser = null;
let mapping = null;
let revealed = false;

// =====================
// NORMALIZE + DISTANCE
// =====================
function normalizeName(s){
  return (s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[“”"']/g, "")
    .toLowerCase();
}

function levenshtein(a, b){
  a = normalizeName(a);
  b = normalizeName(b);
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++){
    for (let j = 1; j <= n; j++){
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function thresholdFor(name){
  const len = normalizeName(name).length;
  if (len <= 2) return 1;
  if (len <= 4) return 1;
  return 2;
}

// =====================
// HYBRID SEARCH
// =====================
function matchUser(input){
  const raw = (input || "").trim();
  if (!raw) return null;

  // STRICT: ต้องตรงเป๊ะเท่านั้น
  if (STRICT_EXACT.has(raw)) return raw;
  for (const s of STRICT_EXACT){
    if (normalizeName(s) === normalizeName(raw) && raw !== s) return null;
  }

  // 1) Exact
  if (PEOPLE.includes(raw)) return raw;

  // 2) Alias
  const normIn = normalizeName(raw);
  for (const [canonical, list] of Object.entries(ALIASES)){
    if (STRICT_EXACT.has(canonical)) continue;
    if (normalizeName(canonical) === normIn) return canonical;
    for (const a of list){
      if (normalizeName(a) === normIn) return canonical;
    }
  }

  // 3) Fuzzy
  let best = { name: null, d: Infinity };
  for (const p of PEOPLE){
    if (STRICT_EXACT.has(p)) continue;
    const d = levenshtein(raw, p);
    if (d < best.d) best = { name: p, d };
  }
  if (!best.name) return null;

  const t = thresholdFor(best.name);
  return best.d <= t ? best.name : null;
}

// =====================
// SEEDED SHUFFLE + DERANGEMENT
// =====================
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seedStr){
  const seed = xmur3(seedStr)();
  const rand = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMapping(){
  const givers = PEOPLE.slice();
  let receivers = seededShuffle(PEOPLE, SEED);

  for (let attempt = 0; attempt < 30; attempt++){
    let ok = true;
    for (let i = 0; i < givers.length; i++){
      if (givers[i] === receivers[i]) { ok = false; break; }
    }
    if (ok){
      const map = {};
      for (let i = 0; i < givers.length; i++) map[givers[i]] = receivers[i];
      return map;
    }
    receivers = seededShuffle(receivers, `${SEED}-try-${attempt}`);
  }

  // fallback fix
  for (let i = 0; i < givers.length; i++){
    if (givers[i] === receivers[i]){
      const j = (i + 1) % receivers.length;
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }
  }
  const map = {};
  for (let i = 0; i < givers.length; i++) map[givers[i]] = receivers[i];
  return map;
}

// =====================
// UI + EFFECTS
// =====================
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function slotMachineReveal(finalName){
  const pool = PEOPLE.slice();
  const rounds = 26;
  slotText.textContent = "กำลังสุ่มให้น้า…";
  for (let i = 0; i < rounds; i++){
    const pick = pool[Math.floor(Math.random() * pool.length)];
    slotText.textContent = pick;
    slotText.style.transform = `translateY(${(Math.random()*6-3).toFixed(1)}px)`;
    await sleep(55 + i * 10);
  }
  slotText.style.transform = "translateY(0)";
  slotText.textContent = finalName;
}

function showError(msg){
  loginError.hidden = false;
  loginError.textContent = msg;
}
function clearError(){
  loginError.hidden = true;
  loginError.textContent = "";
}

function setLoggedIn(user){
  currentUser = user;
  revealed = false;
  resultBox.hidden = true;
  whoEl.textContent = user;
  loginCard.hidden = true;
  revealCard.hidden = false;
  slotText.textContent = "พร้อมแล้วกดเลย ✨";
}

function logout(){
  currentUser = null;
  revealed = false;
  nicknameInput.value = "";
  clearError();
  revealCard.hidden = true;
  loginCard.hidden = false;
}

// Confetti (canvas)
const canvas = document.getElementById("confetti");
const ctx = canvas.getContext("2d");
let confettiPieces = [];
let animating = false;

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function burstConfetti(){
  const n = 180;
  const w = canvas.width, h = canvas.height;
  for (let i = 0; i < n; i++){
    confettiPieces.push({
      x: w/2 + (Math.random()*70-35),
      y: h/3 + (Math.random()*50-25),
      vx: (Math.random()*6-3),
      vy: (Math.random()*-9-2),
      g: 0.18 + Math.random()*0.12,
      s: 3 + Math.random()*5,
      a: 1,
      r: Math.random()*Math.PI
    });
  }
  if (!animating) animate();
}
function animate(){
  animating = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiPieces = confettiPieces.filter(p => p.a > 0.02 && p.y < canvas.height + 60);

  for (const p of confettiPieces){
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.r += 0.08;
    p.a *= 0.985;

    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);

    const colors = ["#f4c95d", "#2f9e66", "#d94b4b"];
    ctx.fillStyle = colors[(Math.random()*colors.length)|0];
    ctx.fillRect(-p.s/2, -p.s/2, p.s, p.s);

    ctx.restore();
  }

  if (confettiPieces.length > 0){
    requestAnimationFrame(animate);
  } else {
    animating = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// =====================
// INIT + EVENTS
// =====================
function init(){
  mapping = buildMapping();
  const saved = localStorage.getItem("gift_user");
  if (saved && PEOPLE.includes(saved)) setLoggedIn(saved);
}
init();

btnLogin.addEventListener("click", () => {
  clearError();
  const user = matchUser(nicknameInput.value);
  if (!user){
    showError("ไม่เจอชื่อนี้ในกลุ่มน้า ลองพิมพ์ใหม่อีกทีได้ไหม 😊");
    return;
  }
  localStorage.setItem("gift_user", user);
  setLoggedIn(user);
});
nicknameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("gift_user");
  logout();
});
btnReveal.addEventListener("click", async () => {
  if (!currentUser || revealed) return;

  revealed = true;
  btnReveal.disabled = true;

  const target = mapping[currentUser];
  await slotMachineReveal(target);

  resultName.textContent = target;
  resultBox.hidden = false;
  burstConfetti();

  btnReveal.disabled = false;
});
