// --- Globale Variablen & Konfiguration ---

// Audio-Setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Timing-Variablen für Rhythmus und Status
let lastBeepTime = 0;           // Zeitstempel des letzten "Geiger"-Beeps
let perfectPoseStartTime = 0;   // Seit wann halten wir die perfekte Pose?
let lastSuccessSoundTime = 0;   // Wann kam der letzte Erfolgs-Sound?

// Konfiguration
const HOLD_DURATION = 300;      // ms, die man stillhalten muss (0.3s)
const SUCCESS_COOLDOWN = 2000;  // ms Pause zwischen Erfolgs-Sounds, damit es nicht spammt

// App-Zustand
let idealPoseAngles = null; // Speichert die Ideal-Winkel nach Kalibrierung

// DOM-Elemente
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

// --- VISUELLES OVERLAY ERSTELLEN ---
// Wir erstellen das grüne Overlay dynamisch, damit du kein CSS anfassen musst
let successOverlay = document.getElementById('success-overlay');
if (!successOverlay) {
    successOverlay = document.createElement('div');
    successOverlay.id = 'success-overlay';
    Object.assign(successOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(74, 222, 128, 0.4)', // Transparentes Neongrün
        zIndex: '9999', pointerEvents: 'none', display: 'none',
        transition: 'opacity 0.1s ease'
    });
    document.body.appendChild(successOverlay);
}

// --- MATHEMATISCHE HILFSFUNKTIONEN ---

function calculateAngle(a, b, c) {
    let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(rad * (180.0 / Math.PI));
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

// --- AUDIO FUNKTIONEN ---

// 1. Der "Geigerzähler"-Beep (Kurz, für die Zielführung)
function triggerGuidanceBeep(frequency) {
    if (audioCtx.state === "suspended") { audioCtx.resume(); }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = frequency;
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    osc.start(now);
    
    // Sehr kurz und knackig (50ms)
    gain.gain.setValueAtTime(0.3, now); 
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.stop(now + 0.06);
}

// 2. Der Erfolgs-Sound (Lauter, Zweiklang)
function playSuccessSound() {
    const nowMs = Date.now();
    // Verhindern, dass der Sound doppelt feuert (Cooldown)
    if (nowMs - lastSuccessSoundTime < SUCCESS_COOLDOWN) return;
    lastSuccessSoundTime = nowMs;

    if (audioCtx.state === "suspended") { audioCtx.resume(); }
    const now = audioCtx.currentTime;

    // Ton 1: Tief (Grundton)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.frequency.value = 440; 
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start(now);
    gain1.gain.setValueAtTime(0.8, now); // Lautstärke 0.8
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.stop(now + 0.15);

    // Ton 2: Hoch (Quinte) - Startet leicht verzögert
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.frequency.value = 660; 
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc2.start(now + 0.1);
    gain2.gain.setValueAtTime(0.8, now + 0.1); // Lautstärke 0.8
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.stop(now + 0.4);
}


// --- 1. KALIBRIERUNGS-LOGIK (Statisches Bild) ---

const poseStatic = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

poseStatic.setOptions({
  staticImageMode: true,
  modelComplexity: 1,
  minDetectionConfidence: 0.5
});

poseStatic.onResults(onStaticResults); 

function onStaticResults(results) {
  drawScaledImage(results.image); 

  if (!results.poseLandmarks) {
    alert("Konnte keine Pose im Bild erkennen. Bitte versuche ein anderes Bild.");
    return;
  }

  // Zeichne das Bild mit Skelett
  const scaledLandmarks = getScaledLandmarks(results.poseLandmarks);
  drawSkeleton(scaledLandmarks, '#0000FF'); 

  // Berechne Ideal-Winkel
  try {
    const pose = results.poseLandmarks;
    const shoulder = pose[11];
    const elbow = pose[13];
    const wrist = pose[15];
    const hip = pose[23];

    // Prüfe ob alle Punkte sichtbar sind
    if (shoulder.visibility < 0.5 || elbow.visibility < 0.5 || wrist.visibility < 0.5 || hip.visibility < 0.5) {
      throw new Error("Wichtige Gelenke nicht sichtbar.");
    }

    const bowArmAngle = calculateAngle(shoulder, elbow, wrist);
    const shoulderLiftAngle = calculateAngle(elbow, shoulder, hip);

    idealPoseAngles = {
      bowArm: bowArmAngle,
      shoulderLift: shoulderLiftAngle
    };

    calibrationResultText.textContent = `Kalibrierung OK! Arm: ${bowArmAngle.toFixed(1)}° / Schulter: ${shoulderLiftAngle.toFixed(1)}°`;
    confirmationArea.style.display = 'block';
    imageInputElement.style.display = 'none';

  } catch (error) {
    alert("Fehler bei der Winkel-Berechnung. Bitte lade ein besseres Bild hoch.");
    console.error(error);
  }
}

// Event-Listener Bild Upload
imageInputElement.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => { imageElement.src = event.target.result; };
  reader.readAsDataURL(file);
});

imageElement.onload = async () => {
  await poseStatic.send({image: imageElement});
};


// --- 2. LIVE-TRAINING LOGIK ---

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
  if (audioCtx.state === "suspended") { audioCtx.resume(); }
});

const poseLive = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

poseLive.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

poseLive.onResults(onLiveResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await poseLive.send({image: videoElement});
  },
  width: 640,
  height: 480
});

// --- HAUPT-FUNKTION: LIVE ANALYSE ---
function onLiveResults(results) {
    drawScaledImage(results.image);
    
    // Reset wenn keine Pose da ist
    if (!results.poseLandmarks || !idealPoseAngles) {
        perfectPoseStartTime = 0;
        successOverlay.style.display = 'none';
        return;
    }
    
    const scaledLandmarks = getScaledLandmarks(results.poseLandmarks);
    
    try {
        const livePose = results.poseLandmarks;
        const liveShoulder = livePose[11];
        const liveElbow = livePose[13];
        const liveWrist = livePose[15];
        const liveHip = livePose[23];

        // Sichtbarkeits-Check
        if (liveShoulder.visibility < 0.5 || liveElbow.visibility < 0.5 || liveWrist.visibility < 0.5 || liveHip.visibility < 0.5) {
            throw new Error("Nicht im Bild");
        }

        // Winkel berechnen
        const liveBowArmAngle = calculateAngle(liveShoulder, liveElbow, liveWrist);
        const liveShoulderLiftAngle = calculateAngle(liveElbow, liveShoulder, liveHip);
        
        // Abweichungen berechnen
        const armDiff = Math.abs(liveBowArmAngle - idealPoseAngles.bowArm);
        const shoulderDiff = Math.abs(liveShoulderLiftAngle - idealPoseAngles.shoulderLift);
        
        // Toleranz (hier 8 Grad, etwas toleranter für Demo)
        const toleranz = 8.0; 
        
        // Nähe (Proximity) berechnen für Audio-Steuerung
        // 0.0 = Weit weg (schlecht), 1.0 = Nah dran (gut)
        const armProx = 1.0 - Math.min(1.0, armDiff / 30.0);
        const shoulderProx = 1.0 - Math.min(1.0, shoulderDiff / 30.0);
        const totalProximity = (armProx + shoulderProx) / 2.0;
        
        let feedbackColor = '#FFFF00'; 
        let feedbackLineWidth = 4;
        
        // --- LOGIK: PERFEKT vs. UNTERWEGS ---
        if (armDiff <= toleranz && shoulderDiff <= toleranz) {
            // *** STATUS: IM ZIELBEREICH ***
            
            // Timer starten
            if (perfectPoseStartTime === 0) {
                perfectPoseStartTime = Date.now();
            }

            const holdTime = Date.now() - perfectPoseStartTime;

            if (holdTime >= HOLD_DURATION) {
                // >>>> ERFOLG (Nach 300ms halten) <<<<
                feedbackText.textContent = "PERFEKT!";
                
                // 1. Overlay an
                successOverlay.style.display = 'block';
                
                // 2. Sound abspielen (Funktion regelt Cooldown selbst)
                playSuccessSound();
                
                // 3. Blinken (Skelett wechselt Farbe schnell)
                const blink = Math.floor(Date.now() / 100) % 2 === 0;
                feedbackColor = blink ? "#00FF00" : "#FFFFFF"; // Grün / Weiß
                feedbackLineWidth = 8;
                
            } else {
                // >>>> STABILISIEREN (Noch keine 300ms) <<<<
                feedbackColor = "#ADFF2F"; // Hellgrün
                feedbackText.textContent = "Halten...";
                successOverlay.style.display = 'none';
            }

        } else {
            // *** STATUS: UNTERWEGS (Geigerzähler) ***
            
            // Reset
            perfectPoseStartTime = 0;
            successOverlay.style.display = 'none';
            
            feedbackText.textContent = `Diff: ${armDiff.toFixed(0)}° / ${shoulderDiff.toFixed(0)}°`;
            
            // GEIGERZÄHLER LOGIK
            const now = Date.now();
            
            // Intervall (Pause zwischen Beeps):
            // Weit weg (Prox 0) = 800ms (Langsam)
            // Nah dran (Prox 1) = 100ms (Schnell)
            const beepInterval = 800 - (totalProximity * 700);
            
            // Frequenz (Tonhöhe):
            // Weit weg = 200Hz (Tief)
            // Nah dran = 800Hz (Hoch)
            const beepFreq = 200 + (totalProximity * 600);
            
            if (now - lastBeepTime > beepInterval) {
                triggerGuidanceBeep(beepFreq);
                lastBeepTime = now;
            }
        }
        
        drawSkeleton(scaledLandmarks, feedbackColor, feedbackLineWidth);

    } catch (error) {
        // Bei Fehler (Arm nicht sichtbar) alles resetten
        perfectPoseStartTime = 0;
        successOverlay.style.display = 'none';
        feedbackText.textContent = "Suche Pose...";
    }
}


// --- ZEICHEN-HELFER ---

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
  
  // Config speichern für drawSkeleton
  canvasElement.drawConfig = { drawWidth, drawHeight, offsetX, offsetY };
}

function getScaledLandmarks(landmarks) {
  const cfg = canvasElement.drawConfig || { drawWidth: canvasElement.width, drawHeight: canvasElement.height, offsetX: 0, offsetY: 0 };
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  
  return landmarks.map(landmark => {
    const x = landmark.x * cfg.drawWidth + cfg.offsetX;
    const y = landmark.y * cfg.drawHeight + cfg.offsetY;
    return {
      x: clamp(x, 0, canvasElement.width),
      y: clamp(y, 0, canvasElement.height),
      z: landmark.z,
      visibility: landmark.visibility
    };
  });
}

const POSE_CONNECTIONS = [[11,13],[13,15],[11,12],[12,14],[14,16],[11,23],[12,24],[23,24]];

function drawSkeleton(scaledLandmarks, color, lineWidth = 4) {
    if (!Array.isArray(scaledLandmarks) || scaledLandmarks.length === 0) return;

    canvasCtx.save();
    canvasCtx.lineCap = "round";
    canvasCtx.lineJoin = "round";
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;

    // Linien zeichnen
    for (const [start, end] of POSE_CONNECTIONS) {
        const a = scaledLandmarks[start];
        const b = scaledLandmarks[end];
        
        if (a && b && a.visibility > 0.5 && b.visibility > 0.5) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(a.x, a.y);
            canvasCtx.lineTo(b.x, b.y);
            canvasCtx.stroke();
        }
    }
    
    // Punkte zeichnen
    canvasCtx.fillStyle = '#FFFFFF';
    for (const lm of scaledLandmarks) {
        if (lm && lm.visibility > 0.5) {
            canvasCtx.beginPath();
            canvasCtx.arc(lm.x, lm.y, lineWidth, 0, 2 * Math.PI);
            canvasCtx.fill();
        }
    }
    canvasCtx.restore();
}