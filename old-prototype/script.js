const stages = [
  document.querySelector("#stagePassword"),
  document.querySelector("#stageOtp"),
  document.querySelector("#stageFace"),
  document.querySelector("#stageLocation"),
  document.querySelector("#stageSuccess")
];

const steps = [...document.querySelectorAll(".step")];
const progressFill = document.querySelector("#progressFill");
const riskScore = document.querySelector("#riskScore");
const threatStatus = document.querySelector("#threatStatus");
const globalBehaviorScore = document.querySelector("#globalBehaviorScore");
const globalLocationScore = document.querySelector("#globalLocationScore");

const passwordForm = document.querySelector("#passwordForm");
const togglePassword = document.querySelector("#togglePassword");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const charsPerSecond = document.querySelector("#charsPerSecond");
const wordsPerSecond = document.querySelector("#wordsPerSecond");
const avgKeyDelay = document.querySelector("#avgKeyDelay");
const behaviorTrust = document.querySelector("#behaviorTrust");
const behaviorFill = document.querySelector("#behaviorFill");
const behaviorStatus = document.querySelector("#behaviorStatus");

const sendOtp = document.querySelector("#sendOtp");
const otpDisplay = document.querySelector("#otpDisplay");
const otpForm = document.querySelector("#otpForm");
const phoneNumber = document.querySelector("#phoneNumber");
const otpInput = document.querySelector("#otpInput");
const otpStatus = document.querySelector("#otpStatus");
const otpInputContainer = document.querySelector("#otpInputContainer");
const verifyOtpButton = otpForm.querySelector(".primary-action");

const startCamera = document.querySelector("#startCamera");
const scanFace = document.querySelector("#scanFace");
const cameraFeed = document.querySelector("#cameraFeed");
const cameraFallback = document.querySelector("#cameraFallback");
const scanFill = document.querySelector("#scanFill");
const scanStatus = document.querySelector("#scanStatus");

const restartDemo = document.querySelector("#restartDemo");
const setTrustedLocation = document.querySelector("#setTrustedLocation");
const verifyLocation = document.querySelector("#verifyLocation");
const locationDistance = document.querySelector("#locationDistance");
const locationRadius = document.querySelector("#locationRadius");
const locationAccuracy = document.querySelector("#locationAccuracy");
const locationTrust = document.querySelector("#locationTrust");
const locationStatus = document.querySelector("#locationStatus");
const locationFill = document.querySelector("#locationFill");
const gpsConsole = document.querySelector("#gpsConsole");

const credentials = {
  username: "SSIT",
  password: "SSIT@123"
};

const trustedLocationKey = "secureshieldTrustedLocation";
const trustedRadiusMeters = 500;
const demoPhoneNumber = "+919945576554";
let currentStage = 0;
let cameraStream = null;
let faceScanActive = false;
let faceDetector = null;
let faceConfidence = 0;
let otpAutoTimer = null;
let otpCountdownTimer = null;
let otpVerifyTimer = null;
let stageOtpAutoTimer = null;
let lastAutoSentPhone = "";
let otpSending = false;
let otpVerifying = false;
let activeOtp = null;
const otpLifetimeMs = 5 * 60 * 1000;
const maxOtpAttempts = 5;
const initialOtpMessage = "Enter your phone number and click 'Send Code' to receive your secure OTP.";
const cameraCanvas = document.createElement("canvas");
const cameraContext = cameraCanvas.getContext("2d", { willReadFrequently: true });
const behavior = {
  lastKeyDownTime: 0,
  keyCount: 0,
  keyDownTimes: new Map(),
  dwellTimes: [],
  flightTimes: [],
  trust: 0
};

function setStage(nextStage) {
  currentStage = nextStage;

  stages.forEach((stage, index) => {
    if (stage) stage.classList.toggle("current", index === nextStage);
  });

  steps.forEach((step, index) => {
    step.classList.toggle("active", index === nextStage);
    step.classList.toggle("done", index < nextStage || nextStage === 4);
  });

  const verifiedPercent = Math.min(nextStage, 4) * 25;
  progressFill.style.width = `${Math.min(verifiedPercent, 100)}%`;
  riskScore.textContent = `${Math.min(verifiedPercent, 100)}%`;
  threatStatus.textContent = nextStage === 4 ? "Cleared" : nextStage === 3 ? "Location" : nextStage > 1 ? "Scanning" : "Guarded";

  faceScanActive = nextStage === 2;

  if (nextStage === 1) {
    scheduleAutomaticOtp();
  }

  if (nextStage === 2) {
    startFaceRecognition();
  } else {
    stopCameraStream();
  }

  if (nextStage === 3) {
    resetLocation();
  }
}

function flashMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#b7352d" : "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function attachCameraStream() {
  if (!cameraStream) {
    return;
  }

  cameraFeed.srcObject = cameraStream;
  cameraFallback.textContent = "Live preview active. Keep your face inside the guide.";
}

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cameraFeed) {
    cameraFeed.srcObject = null;
  }
  cameraFallback.textContent = "Camera preview will appear here on localhost.";
}

async function requestCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraFallback.textContent = "Camera API is unavailable in this browser. You can still run the demo scan.";
    return false;
  }

  if (cameraStream) {
    attachCameraStream();
    return true;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });
    attachCameraStream();
    if ("FaceDetector" in window && !faceDetector) {
      faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }
    return true;
  } catch (error) {
    cameraFallback.textContent = "Camera permission was blocked. The demo scan can continue in simulation mode.";
    return false;
  }
}

function videoIsReady(video) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
}

function readCameraFrame(video, width = 96, height = 72) {
  if (!videoIsReady(video) || !cameraContext) {
    return null;
  }

  cameraCanvas.width = width;
  cameraCanvas.height = height;
  cameraContext.drawImage(video, 0, 0, width, height);
  return cameraContext.getImageData(0, 0, width, height);
}

function analyzeLiveFaceSignal() {
  const frame = readCameraFrame(cameraFeed, 80, 60);
  if (!frame) {
    return 0;
  }

  const data = frame.data;
  let brightPixels = 0;
  let contrastScore = 0;
  let lastLuma = null;

  for (let index = 0; index < data.length; index += 16) {
    const luma = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    if (luma > 45 && luma < 235) {
      brightPixels += 1;
    }
    if (lastLuma !== null) {
      contrastScore += Math.abs(luma - lastLuma);
    }
    lastLuma = luma;
  }

  const sampledPixels = data.length / 16;
  const exposure = brightPixels / sampledPixels;
  const contrast = contrastScore / sampledPixels;
  return clamp((exposure * 72) + (contrast * 1.2), 0, 100);
}

async function startFaceRecognition() {
  faceScanActive = true;
  faceConfidence = 0;
  scanFill.style.width = "0";
  updateFaceChecklist(0);

  const allowed = await requestCamera();
  if (!allowed) {
    flashMessage(scanStatus, "Camera access is required for real-time facial verification.", true);
    return;
  }

  flashMessage(scanStatus, "Live camera scan running. Keep your face inside the guide.");
  runFaceRecognitionLoop();
}

async function runFaceRecognitionLoop() {
  if (!faceScanActive || currentStage !== 2) {
    return;
  }

  let score = 0;

  if (faceDetector && videoIsReady(cameraFeed)) {
    try {
      const faces = await faceDetector.detect(cameraFeed);
      score = faces.length ? 28 : -10;
      scanStatus.textContent = faces.length
        ? "Face detected in real time. Holding for biometric confirmation..."
        : "Looking for a face in the live camera feed.";
    } catch (error) {
      faceDetector = null;
    }
  }

  if (!faceDetector) {
    const signal = analyzeLiveFaceSignal();
    score = signal > 42 ? 12 : -8;
    scanStatus.textContent = signal > 42
      ? "Live camera signal is stable. Verifying face presence..."
      : "Move closer to the camera or improve lighting.";
  }

  faceConfidence = clamp(faceConfidence + score, 0, 100);
  scanFill.style.width = `${faceConfidence}%`;
  updateFaceChecklist(faceConfidence);

  if (faceConfidence >= 100) {
    faceScanActive = false;
    flashMessage(scanStatus, "Real-time facial verification passed.");
    window.setTimeout(() => setStage(3), 500);
    return;
  }

  window.setTimeout(runFaceRecognitionLoop, 220);
}

function updateFaceChecklist(confidence) {
  const alignment = document.querySelector("#checkAlignment");
  const lighting = document.querySelector("#checkLighting");
  const liveness = document.querySelector("#checkLiveness");
  const spoofing = document.querySelector("#checkSpoofing");

  if (alignment) alignment.classList.toggle("passed", confidence >= 10);
  if (lighting) lighting.classList.toggle("passed", confidence >= 35);
  if (liveness) liveness.classList.toggle("passed", confidence >= 60);
  if (spoofing) spoofing.classList.toggle("passed", confidence >= 85);
}

function logGps(message) {
  if (!gpsConsole) return;
  const timestamp = new Date().toLocaleTimeString();
  gpsConsole.textContent += `\n[${timestamp}] ${message}`;
  gpsConsole.scrollTop = gpsConsole.scrollHeight;
}



function resetBehavior() {
  behavior.lastKeyDownTime = 0;
  behavior.keyCount = 0;
  behavior.keyDownTimes.clear();
  behavior.dwellTimes = [];
  behavior.flightTimes = [];
  behavior.trust = 0;
  charsPerSecond.textContent = "0 ms";
  wordsPerSecond.textContent = "0 ms";
  avgKeyDelay.textContent = "0 ms";
  behaviorTrust.textContent = "0%";
  globalBehaviorScore.textContent = "0%";
  behaviorFill.style.width = "0";
  behaviorStatus.textContent = "Type the password naturally to build a typing rhythm profile.";
}

function updateBehaviorMetrics() {
  const averageDwell = behavior.dwellTimes.length
    ? behavior.dwellTimes.reduce((sum, value) => sum + value, 0) / behavior.dwellTimes.length
    : 0;
  const averageFlight = behavior.flightTimes.length
    ? behavior.flightTimes.reduce((sum, value) => sum + value, 0) / behavior.flightTimes.length
    : 0;
  const combined = [...behavior.dwellTimes, ...behavior.flightTimes];
  const averageRhythm = combined.length
    ? combined.reduce((sum, value) => sum + value, 0) / combined.length
    : 0;
  const rhythmVariance = combined.length
    ? combined.reduce((sum, value) => sum + Math.pow(value - averageRhythm, 2), 0) / combined.length
    : 0;
  const stability = clamp(100 - Math.sqrt(rhythmVariance) / 4, 0, 100);
  const sampleDepth = clamp((behavior.keyCount / 8) * 100, 0, 100);
  const humanTempo = averageFlight ? clamp(100 - Math.abs(averageFlight - 180) / 3, 0, 100) : 0;

  behavior.trust = Math.round((sampleDepth * 0.36) + (stability * 0.36) + (humanTempo * 0.28));
  charsPerSecond.textContent = `${Math.round(averageDwell)} ms`;
  wordsPerSecond.textContent = `${Math.round(averageFlight)} ms`;
  avgKeyDelay.textContent = `${Math.round(Math.sqrt(rhythmVariance))} ms`;
  behaviorTrust.textContent = `${behavior.trust}%`;
  globalBehaviorScore.textContent = `${behavior.trust}%`;
  behaviorFill.style.width = `${behavior.trust}%`;

  if (behavior.keyCount < 4) {
    behaviorStatus.textContent = "Collecting dwell time and flight time from password typing...";
  } else if (behavior.trust >= 65) {
    behaviorStatus.textContent = "Stable password typing rhythm detected in the background.";
  } else if (behavior.trust >= 40) {
    behaviorStatus.textContent = "Typing rhythm captured. Continue typing naturally for stronger confidence.";
  } else {
    behaviorStatus.textContent = "Low rhythm confidence. Re-type naturally if needed.";
  }
}

function trackBehaviorKeyDown(event) {
  if (event.key.length !== 1 && event.key !== "Backspace") {
    return;
  }

  // Visual pulse telemetry highlight
  const cards = document.querySelectorAll(".behavior-panel .metric-grid div");
  cards.forEach(card => {
    card.classList.add("key-flash");
    setTimeout(() => card.classList.remove("key-flash"), 120);
  });

  const now = performance.now();
  behavior.keyDownTimes.set(event.code, now);
  if (behavior.lastKeyDownTime) {
    behavior.flightTimes.push(now - behavior.lastKeyDownTime);
    behavior.flightTimes = behavior.flightTimes.slice(-20);
  }

  behavior.lastKeyDownTime = now;
  behavior.keyCount += 1;
  window.requestAnimationFrame(updateBehaviorMetrics);
}

function trackBehaviorKeyUp(event) {
  if (!behavior.keyDownTimes.has(event.code)) {
    return;
  }

  const dwell = performance.now() - behavior.keyDownTimes.get(event.code);
  behavior.keyDownTimes.delete(event.code);
  behavior.dwellTimes.push(dwell);
  behavior.dwellTimes = behavior.dwellTimes.slice(-20);
  window.requestAnimationFrame(updateBehaviorMetrics);
}

function resetLocation() {
  locationDistance.textContent = "--";
  locationAccuracy.textContent = "--";
  locationTrust.textContent = "0%";
  globalLocationScore.textContent = "0%";
  locationFill.style.width = "0";
  locationRadius.textContent = `${trustedRadiusMeters} m`;
  locationStatus.textContent = getTrustedLocation()
    ? "Trusted safe zone found. Verify this login location."
    : "No trusted safe zone saved. Use current location as trusted for this demo.";

  if (gpsConsole) {
    gpsConsole.textContent = "> Ready for GPS telemetry...";
  }
}

function getTrustedLocation() {
  try {
    const value = window.localStorage.getItem(trustedLocationKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function saveTrustedLocation(position) {
  const trusted = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    savedAt: new Date().toISOString()
  };
  window.localStorage.setItem(trustedLocationKey, JSON.stringify(trusted));
  return trusted;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
  });
}

function distanceMeters(pointA, pointB) {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLon = toRadians(pointB.longitude - pointA.longitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }

  return `${Math.round(meters)} m`;
}

async function handleSetTrustedLocation() {
  locationStatus.textContent = "Requesting GPS permission to save trusted safe zone...";
  setTrustedLocation.disabled = true;
  logGps("Requesting current GPS coordinates...");

  try {
    const position = await getCurrentPosition();
    saveTrustedLocation(position);
    locationAccuracy.textContent = `${Math.round(position.coords.accuracy)} m`;
    locationStatus.textContent = "Trusted location saved. Now verify this login location.";
    locationTrust.textContent = "100%";
    globalLocationScore.textContent = "100%";
    locationFill.style.width = "100%";
    
    logGps(`Success. Position: ${position.coords.latitude.toFixed(5)}° N, ${position.coords.longitude.toFixed(5)}° E`);
    logGps(`Accuracy: ${Math.round(position.coords.accuracy)}m. Saved as trusted safe zone.`);
  } catch (error) {
    locationStatus.textContent = error.message || "Unable to save trusted location.";
    logGps(`ERROR: ${error.message || "Unable to acquire location coordinates."}`);
  } finally {
    setTrustedLocation.disabled = false;
  }
}

async function handleVerifyLocation() {
  let trusted = getTrustedLocation();
  locationStatus.textContent = "Checking current GPS location against trusted safe zone...";
  verifyLocation.disabled = true;
  logGps("Scanning current GPS telemetry...");

  try {
    const position = await getCurrentPosition();
    const current = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    if (!trusted) {
      logGps("Warning: No trusted coordinates found in database.");
      trusted = saveTrustedLocation(position);
      logGps("Current position marked as trusted zone baseline.");
    }

    const distance = distanceMeters(trusted, current);
    const trust = Math.round(clamp(100 - (distance / trustedRadiusMeters) * 100, 0, 100));
    locationDistance.textContent = formatDistance(distance);
    locationAccuracy.textContent = `${Math.round(position.coords.accuracy)} m`;
    locationTrust.textContent = `${trust}%`;
    globalLocationScore.textContent = `${trust}%`;
    locationFill.style.width = `${trust}%`;

    logGps(`Coords: ${current.latitude.toFixed(5)}° N, ${current.longitude.toFixed(5)}° E`);
    logGps(`Baseline delta: ${Math.round(distance)}m (Allowed: ${trustedRadiusMeters}m)`);
    logGps(`Trust Level: ${trust}%. Geofence analysis completed.`);

    if (distance <= trustedRadiusMeters) {
      locationStatus.textContent = "Location verified inside trusted safe zone.";
      logGps("STATUS: ACCESS GRANTED. Location validated successfully.");
      window.setTimeout(() => setStage(4), 450);
      return;
    }

    locationStatus.textContent = "Location is outside the trusted safe zone. Access remains blocked.";
    logGps("STATUS: BLOCKED. Safe zone violation detected.");
  } catch (error) {
    locationStatus.textContent = error.message || "Unable to verify location.";
    logGps(`ERROR: Geofence routing failed. Details: ${error.message}`);
  } finally {
    verifyLocation.disabled = false;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = {
      ok: false,
      message: "Server returned an invalid response."
    };
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.message || "Request failed");
    error.server = true;
    error.status = response.status;
    throw error;
  }

  return data;
}

function normalizePhone(phone) {
  const cleaned = String(phone || "").trim().replace(/[^\d+]/g, "");

  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  if (/^\d{11,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return "";
}

function phoneLooksComplete(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function scheduleAutomaticOtp() {
  window.clearTimeout(stageOtpAutoTimer);
  stageOtpAutoTimer = window.setTimeout(() => {
    if (currentStage !== 1) {
      return;
    }

    if (!phoneNumber.value.trim()) {
      phoneNumber.value = demoPhoneNumber;
    }

    queueAutoOtpSend();
  }, 450);
}

function queueAutoOtpSend() {
  sendOtpToPhone();
}

function generateOtp() {
  if (window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return String(100000 + (values[0] % 900000));
  }

  return String(Math.floor(100000 + Math.random() * 900000));
}

function formatOtpTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setOtpStatus(message, isError = false) {
  otpStatus.textContent = message;
  otpStatus.style.color = isError ? "#b7352d" : "";
}

function clearOtpCountdown() {
  window.clearInterval(otpCountdownTimer);
  otpCountdownTimer = null;
}

function clearOtpVerificationTimer() {
  window.clearTimeout(otpVerifyTimer);
  otpVerifyTimer = null;
}

function clearActiveOtp() {
  clearOtpCountdown();
  lastAutoSentPhone = "";
  activeOtp = null;

  if (otpInputContainer) {
    otpInputContainer.classList.add("disabled");
  }
  otpInput.disabled = true;
  verifyOtpButton.disabled = true;
  
  otpDisplay.style.display = "none";
}

function showOtpCountdown(baseMessage) {
  clearOtpCountdown();

  const update = () => {
    if (!activeOtp) {
      return;
    }

    const remaining = activeOtp.expiresAt - Date.now();

    if (remaining <= 0) {
      clearActiveOtp();
      otpDisplay.textContent = "Expired";
      setOtpStatus("OTP expired. Generate a new code.", true);
      return;
    }

    setOtpStatus(`${baseMessage} Expires in ${formatOtpTime(remaining)}.`);
  };

  update();
  otpCountdownTimer = window.setInterval(update, 1000);
}

function startOtpSession({ phone, otp = "", displayText, message, mode }) {
  activeOtp = {
    phone,
    otp,
    mode,
    attempts: 0,
    expiresAt: Date.now() + otpLifetimeMs
  };
  
  if (displayText && displayText !== "Sent" && displayText !== "SMS Ready") {
    otpDisplay.style.display = "inline-block";
    otpDisplay.textContent = `Demo Code: ${displayText}`;
  } else {
    otpDisplay.style.display = "none";
    otpDisplay.textContent = displayText;
  }
  
  if (otpInputContainer) {
    otpInputContainer.classList.remove("disabled");
  }
  otpInput.disabled = false;
  verifyOtpButton.disabled = false;

  otpInput.value = "";
  otpInput.focus();
  showOtpCountdown(message);
}

function startLocalOtpSession(phone, reason = "") {
  const otp = generateOtp();
  const reasonText = reason ? `${reason} ` : "";

  startOtpSession({
    phone,
    otp,
    displayText: otp,
    mode: "local",
    message: `${reasonText}Local demo OTP generated for ${phone}.`
  });
  console.log(`[DEVELOPMENT Fallback] Local OTP generated: ${otp}`);
  setOtpStatus(`[Demo Fallback] Server is offline. Simulated OTP: ${otp}. Code expires in 5:00.`);
}

async function sendOtpToPhone() {
  const phone = phoneNumber.value.trim();
  const normalizedPhone = normalizePhone(phone);

  if (!phone) {
    setOtpStatus("Enter a phone number before sending OTP.", true);
    phoneNumber.focus();
    return;
  }

  if (!normalizedPhone) {
    setOtpStatus("Enter a valid phone number before sending OTP.", true);
    phoneNumber.focus();
    return;
  }

  if (otpSending) {
    return;
  }

  otpSending = true;
  sendOtp.disabled = true;
  sendOtp.textContent = "Sending...";
  setOtpStatus("Sending verification code...");

  try {
    const result = await postJson("/api/send-otp", { phone: normalizedPhone });
    lastAutoSentPhone = normalizedPhone;
    
    startOtpSession({
      phone: result.phone || normalizedPhone,
      otp: result.devOtp || "",
      displayText: result.devOtp ? result.devOtp : "Sent",
      mode: "server",
      message: `OTP sent to ${normalizedPhone}.`
    });

    if (result.devOtp) {
      console.log(`[DEVELOPMENT Fallback] SMS provider not configured. Use OTP: ${result.devOtp}`);
      setOtpStatus(`[Demo Fallback] SMS provider not configured. Simulated OTP: ${result.devOtp}. Code expires in 5:00.`);
    } else {
      setOtpStatus(`OTP sent to ${normalizedPhone}. Please check your phone.`);
    }
  } catch (error) {
    console.warn("OTP send failed, falling back to local simulation:", error);
    lastAutoSentPhone = normalizedPhone;
    startLocalOtpSession(normalizedPhone, "Server OTP API is unavailable.");
  } finally {
    otpSending = false;
    sendOtp.disabled = false;
    sendOtp.textContent = "Send Code";
  }
}

function verifyLocalOtp(phone, otp) {
  if (!activeOtp || activeOtp.phone !== phone) {
    return {
      ok: false,
      message: "OTP expired or not found. Generate a new OTP."
    };
  }

  if (Date.now() > activeOtp.expiresAt) {
    clearActiveOtp();
    otpDisplay.textContent = "Expired";
    return {
      ok: false,
      message: "OTP expired. Generate a new code."
    };
  }

  if (activeOtp.otp !== otp) {
    activeOtp.attempts += 1;

    if (activeOtp.attempts >= maxOtpAttempts) {
      clearActiveOtp();
      otpDisplay.textContent = "Locked";
      return {
        ok: false,
        message: "Too many incorrect OTP attempts. Generate a new OTP."
      };
    }

    return {
      ok: false,
      message: `Incorrect OTP. ${maxOtpAttempts - activeOtp.attempts} attempts left.`
    };
  }

  clearActiveOtp();
  return {
    ok: true,
    message: "OTP verified successfully."
  };
}

async function verifyOtpCode() {
  if (otpVerifying) {
    return;
  }

  const phone = normalizePhone(phoneNumber.value);
  const otp = otpInput.value.trim();

  if (!phone) {
    setOtpStatus("Enter a valid phone number before verifying OTP.", true);
    phoneNumber.focus();
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    setOtpStatus("Enter the 6 digit OTP to verify.", true);
    otpInput.focus();
    return;
  }

  otpVerifying = true;
  verifyOtpButton.disabled = true;
  setOtpStatus("Verifying OTP...");

  try {
    let result;

    if (activeOtp && activeOtp.mode === "local") {
      result = verifyLocalOtp(phone, otp);
    } else {
      try {
        result = await postJson("/api/verify-otp", { phone, otp });
        clearActiveOtp();
      } catch (error) {
        if (activeOtp && activeOtp.otp) {
          result = verifyLocalOtp(phone, otp);
        } else {
          throw error;
        }
      }
    }

    if (!result.ok) {
      throw new Error(result.message);
    }

    setOtpStatus(result.message);
    setStage(2);
    await requestCamera();
    return;
  } catch (error) {
    setOtpStatus(error.message, true);
  } finally {
    otpVerifying = false;
    verifyOtpButton.disabled = false;
  }

  otpInput.focus();
  otpInput.select();
}



togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

passwordInput.addEventListener("keydown", trackBehaviorKeyDown);
passwordInput.addEventListener("keyup", trackBehaviorKeyUp);
passwordInput.addEventListener("input", updateBehaviorMetrics);

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (username === credentials.username && password === credentials.password) {
    setStage(1);
    window.setTimeout(() => phoneNumber.focus(), 80);
    return;
  }

  passwordInput.focus();
  passwordInput.select();
});

sendOtp.addEventListener("click", () => {
  lastAutoSentPhone = "";
  sendOtpToPhone();
});

otpInput.addEventListener("input", () => {
  clearOtpVerificationTimer();
  otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);

  if (otpInput.value.length === 6) {
    setOtpStatus("Six digits entered. Auto verifying OTP...");
    otpVerifyTimer = window.setTimeout(verifyOtpCode, 300);
  }
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await verifyOtpCode();
});

startCamera.addEventListener("click", requestCamera);

scanFace.addEventListener("click", async () => {
  await startFaceRecognition();
});

setTrustedLocation.addEventListener("click", handleSetTrustedLocation);
verifyLocation.addEventListener("click", handleVerifyLocation);

restartDemo.addEventListener("click", () => {
  usernameInput.value = "";
  passwordInput.value = "";
  phoneNumber.value = "+919945576554";
  window.clearTimeout(otpAutoTimer);
  window.clearTimeout(stageOtpAutoTimer);
  clearOtpVerificationTimer();
  clearActiveOtp();
  lastAutoSentPhone = "";
  otpSending = false;
  otpVerifying = false;
  otpDisplay.textContent = "SMS Ready";
  otpInput.value = "";
  
  if (otpInputContainer) {
    otpInputContainer.classList.add("disabled");
  }
  otpInput.disabled = true;
  verifyOtpButton.disabled = true;

  setOtpStatus("Enter your phone number and click 'Send Code' to receive your secure OTP.");
  scanFill.style.width = "0";
  scanStatus.textContent = "Ready for biometric scan.";
  resetBehavior();
  resetLocation();
  setStage(0);
});

window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});

resetBehavior();
resetLocation();
setStage(0);
