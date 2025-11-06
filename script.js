// --- Globale Variablen & Hilfsfunktionen ---

function calculateAngle(a, b, c) {
  let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(rad * (180.0 / Math.PI));
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

// Audio-Setup (wie vorher)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null; let gainNode = null; let isBeeping = false;
function playBeep(frequency, volume) {
  if (!isBeeping) {
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    isBeeping = true;
    oscillator.start();
  }
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
}
function stopBeep() {
  if (isBeeping) {
    oscillator.stop();
    isBeeping = false;
  }
}

// App-Zustand
let idealPoseAngles = null; // Speichert jetzt MEHRERE Winkel

// DOM-Elemente (wie vorher)
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const imageInputElement = document.getElementById('imageInput');
const imageElement = document.getElementById('loadedImage');
const videoElement = document.getElementsByClassName('input_video')[0];
const feedbackText = document.getElementById('feedback-text');
const calibrationStep = document.getElementById('calibration-step');
const trainingStep = document.getElementById('training-step');
const confirmationArea = document.getElementById('confirmation-area');
const confirmButton = document.getElementById('confirmButton');
const retryButton = document.getElementById('retryButton');
const calibrationResultText = document.getElementById('calibration-result-text');

// --- 1. KALIBRIERUNGS-LOGIK (Statisches Bild) ---

const poseStatic = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
poseStatic.setOptions({
  staticImageMode: true, modelComplexity: 1, minDetectionConfidence: 0.5
});
poseStatic.onResults(onStaticResults);

function onStaticResults(results) {
  drawScaledImage(results.image);

  if (!results.poseLandmarks) {
    alert("Konnte keine Pose im Bild erkennen. Bitte versuche ein anderes Bild.");
    return;
  }

  // Erzeuge die skalierten Punkte (fürs Zeichnen)
  const scaledLandmarks = getScaledLandmarks(results.poseLandmarks);

  // Zeichne das Skelett (mit den skalierten Punkten)
  drawSkeleton(scaledLandmarks, '#0000FF'); 

  try {
    // Hol dir die NORMALISIERTEN Punkte (für die Mathe)
    const pose = results.poseLandmarks;
    const shoulder = pose[11]; // L-Schulter
    const elbow = pose[13];    // L-Ellbogen
    const wrist = pose[15];    // L-Handgelenk
    const hip = pose[23];      // L-Hüfte

    // Prüfe Sichtbarkeit
    if (shoulder.visibility < 0.5 || elbow.visibility < 0.5 || wrist.visibility < 0.5 || hip.visibility < 0.5) {
      throw new Error("Wichtige Gelenke (Arm/Hüfte) nicht deutlich sichtbar.");
    }

    // --- NEUE LOGIK: ZWEI WINKEL ---
    const bowArmAngle = calculateAngle(shoulder, elbow, wrist);
    const shoulderLiftAngle = calculateAngle(elbow, shoulder, hip); // DEIN NEUER WINKEL

    idealPoseAngles = {
      bowArm: bowArmAngle,
      shoulderLift: shoulderLiftAngle
    };

    calibrationResultText.textContent = `Kalibrierung OK! Arm: ${bowArmAngle.toFixed(1)}° / Schulter: ${shoulderLiftAngle.toFixed(1)}°`;
    confirmationArea.style.display = 'block';
    imageInputElement.style.display = 'none';

  } catch (error) {
    alert(`Fehler bei der Winkel-Berechnung: ${error.message}. Bitte lade ein neues Bild hoch.`);
    console.error(error);
  }
}

// Event-Listener (wie vorher)
imageInputElement.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => { imageElement.src = event.target.result; };
  reader.readAsDataURL(file);
});
imageElement.onload = async () => {
  await poseStatic.send({image: imageElement});
};

// --- 2. LIVE-TRAINING LOGIK ---

// UI-Buttons (wie vorher)
retryButton.addEventListener('click', () => {
  confirmationArea.style.display = 'none';
  imageInputElement.style.display = 'block';
  idealPoseAngles = null;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  imageInputElement.value = "";
});
confirmButton.addEventListener('click', () => {
  calibrationStep.style.display = 'none';
  trainingStep.style.display = 'block';
  camera.start();
  feedbackText.textContent = "Position einnehmen...";
  playBeep(220, 0.1);
});

// MediaPipe Live-Instanz (wie vorher)
const poseLive = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
poseLive.setOptions({
  modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
});
poseLive.onResults(onLiveResults);

const camera = new Camera(videoElement, {
  onFrame: async () => { await poseLive.send({image: videoElement}); },
  width: 640,
  height: 480
});

// LIVE-ANALYSE-FUNKTION (STARK ÜBERARBEITET)
function onLiveResults(results) {
  drawScaledImage(results.image);
  
  if (!results.poseLandmarks || !idealPoseAngles) {
    stopBeep(); // Stoppe Piepen, wenn keine Pose da ist
    return;
  }

  // Erzeuge die skalierten Punkte (fürs Zeichnen)
  const scaledLandmarks = getScaledLandmarks(results.poseLandmarks);
  
  try {
    // Hol dir die NORMALISIERTEN Punkte (für die Mathe)
    const livePose = results.poseLandmarks;
    const liveShoulder = livePose[11];
    const liveElbow = livePose[13];
    const liveWrist = livePose[15];
    const liveHip = livePose[23];

    // Prüfe Sichtbarkeit
    if (liveShoulder.visibility < 0.5 || liveElbow.visibility < 0.5 || liveWrist.visibility < 0.5 || liveHip.visibility < 0.5) {
      throw new Error("Bogenarm/Hüfte nicht im Bild");
    }

    // --- NEUE LOGIK: ZWEI WINKEL VERGLEICHEN ---
    const liveBowArmAngle = calculateAngle(liveShoulder, liveElbow, liveWrist);
    const liveShoulderLiftAngle = calculateAngle(liveElbow, liveShoulder, liveHip);

    // Berechne Abweichungen
    const armDiff = Math.abs(liveBowArmAngle - idealPoseAngles.bowArm);
    const shoulderDiff = Math.abs(liveShoulderLiftAngle - idealPoseAngles.shoulderLift);
    
    // Toleranzen
    const armToleranz = 5.0; 
    const shoulderToleranz = 5.0; 

    // Gesamt-Feedback (Proximity von 0.0 bis 1.0)
    // Nur wenn BEIDE Winkel gut sind, ist es "perfekt"
    const armProx = 1.0 - Math.min(1.0, armDiff / 20.0);
    const shoulderProx = 1.0 - Math.min(1.0, shoulderDiff / 20.0);
    const totalProximity = (armProx + shoulderProx) / 2.0; // Durchschnittliche Nähe
    
    let feedbackColor = '#FFFF00'; // Gelb
    let feedbackLineWidth = 4;
    
    if (armDiff <= armToleranz && shoulderDiff <= shoulderToleranz) {
      // WIR SIND PERFEKT
      feedbackColor = '#00FF00'; // Grün
      feedbackLineWidth = 8;
      feedbackText.textContent = "PERFEKT!";
      playBeep(880, 0.2); 
    } else {
      // WIR SIND AUF DEM WEG
      feedbackText.textContent = `Arm: ${armDiff.toFixed(0)}° / Schulter: ${shoulderDiff.toFixed(0)}°`;
      let freq = 220 + (totalProximity * 440);
      playBeep(freq, 0.1 + (totalProximity * 0.1));
    }
    
    // Zeichne das Live-Skelett mit Feedback-Farbe
    drawSkeleton(scaledLandmarks, feedbackColor, feedbackLineWidth);

  } catch (error) {
    stopBeep();
    feedbackText.textContent = "Suche Pose...";
  }
}

// --- Globale Zeichen-Funktionen (HELFER) ---

// Zeichnet das Bild skaliert (wie vorher)
function drawScaledImage(image) {
  if (!image || !image.width || !image.height) return;
  const videoWidth = image.width;
  const videoHeight = image.height;
  const canvasWidth = canvasElement.width;
  const canvasHeight = canvasElement.height;
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  let drawWidth, drawHeight, offsetX, offsetY;
  if (videoAspect > canvasAspect) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / videoAspect;
    offsetX = 0;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * videoAspect;
    offsetX = (canvasWidth - drawWidth) / 2;
    offsetY = 0;
  }
  canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  canvasCtx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  canvasElement.drawConfig = { drawWidth, drawHeight, offsetX, offsetY };
}

// NEUE HILFSFUNKTION: Skaliert die Punkte
function getScaledLandmarks(landmarks) {
  const { drawWidth, drawHeight, offsetX, offsetY } = canvasElement.drawConfig;
  return landmarks.map(landmark => {
    return {
      x: landmark.x * drawWidth + offsetX,
      y: landmark.y * drawHeight + offsetY,
      z: landmark.z, // z und visibility behalten
      visibility: landmark.visibility
    };
  });
}

// ZEICHNET EIN SKELETT (NEUE LOGIK!)
function drawSkeleton(scaledLandmarks, color, lineWidth = 4) {
  // Diese Funktion nimmt jetzt die VOR-SKALIERTEN Punkte
  
  // Zeichne die Linien und Punkte
  drawConnectors(canvasCtx, scaledLandmarks, POSE_CONNECTIONS,
                 {color: color, lineWidth: lineWidth});
  drawLandmarks(canvasCtx, scaledLandmarks,
                {color: '#FFFFFF', lineWidth: 2, radius: 2}); 
}