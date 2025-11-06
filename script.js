// --- Globale Variablen & Hilfsfunktionen ---

// Winkel-Berechnung (wie vorher)
function calculateAngle(a, b, c) {
  let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(rad * (180.0 / Math.PI));
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

// Audio-Setup (erzeugt einen "Beep" ohne MP3-Datei)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null;
let gainNode = null;
let isBeeping = false;

function playBeep(frequency, volume) {
  if (!isBeeping) {
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine'; // Ein simpler Sinus-Ton
    isBeeping = true;
    oscillator.start();
  }
  // Passe Frequenz und Lautstärke an
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
let idealPoseAngles = null; // Hier speichern wir die Ideal-Winkel

// DOM-Elemente holen
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

const poseStatic = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

poseStatic.setOptions({
  staticImageMode: true,
  modelComplexity: 1,
  minDetectionConfidence: 0.5
});

poseStatic.onResults(onStaticResults); // Eigene Funktion für statische Ergebnisse

// Wird aufgerufen, nachdem das Ideal-Bild analysiert wurde
function onStaticResults(results) {

  drawScaledImage(results.image); // Zeichne das Bild skaliert

  if (!results.poseLandmarks) {
    alert("Konnte keine Pose im Bild erkennen. Bitte versuche ein anderes Bild.");
    return;
  }

  drawSkeleton(results.poseLandmarks, '#0000FF'); // Blaues Skelett für "Ideal"


  // Berechne und speichere die Ideal-Winkel
  try {
    const pose = results.poseLandmarks;
    const idealShoulder = pose[11];
    const idealElbow = pose[13];
    const idealWrist = pose[15];
    const idealBowArmAngle = calculateAngle(idealShoulder, idealElbow, idealWrist);

    // TO-DO: Hier alle anderen Winkel (Zughand, Körper etc.) auch berechnen
    
    idealPoseAngles = {
      bowArm: idealBowArmAngle
      // z.B. drawArm: ...
    };

    calibrationResultText.textContent = `Kalibrierung OK! Bogenarm-Winkel: ${idealBowArmAngle.toFixed(1)}°`;
    confirmationArea.style.display = 'block';
    imageInputElement.style.display = 'none'; // Verstecke den Upload-Button

  } catch (error) {
    alert("Fehler bei der Winkel-Berechnung. Sind alle Gelenke sichtbar? Bitte lade ein neues Bild hoch.");
    console.error(error);
  }
}

// Event-Listener für den Bild-Upload (wie vorher)
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
  // Setze UI zurück
  confirmationArea.style.display = 'none';
  imageInputElement.style.display = 'block';
  idealPoseAngles = null;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Lösche das Canvas
  imageInputElement.value = ""; // Setze File-Input zurück
});

confirmButton.addEventListener('click', () => {
  // UI umschalten
  calibrationStep.style.display = 'none';
  trainingStep.style.display = 'block';
  
  // Kamera starten
  camera.start();
  feedbackText.textContent = "Position einnehmen...";
  playBeep(220, 0.1); // Starte leisen Such-Ton
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

poseLive.onResults(onLiveResults); // Eigene Funktion für Live-Ergebnisse

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await poseLive.send({image: videoElement});
  },
  width: 640,
  height: 480
});

// Wird 30x pro Sekunde vom Live-Video aufgerufen
function onLiveResults(results) {
  // Zuerst das Kamerabild zeichnen
  drawScaledImage(results.image);
  
  if (!results.poseLandmarks || !idealPoseAngles) {
    // Wenn wir keine Pose haben oder nicht kalibriert sind, nur das Bild zeigen
    return;
  }
  
  // Wir haben eine Pose UND ein Ideal. Jetzt vergleichen!
  try {
    const livePose = results.poseLandmarks;
    const liveShoulder = livePose[11];
    const liveElbow = livePose[13];
    const liveWrist = livePose[15];

    const liveBowArmAngle = calculateAngle(liveShoulder, liveElbow, liveWrist);
    
    // --- DER KERN-VERGLEICH ---
    const idealAngle = idealPoseAngles.bowArm;
    const diff = Math.abs(liveBowArmAngle - idealAngle);
    const toleranz = 5.0; // 5 Grad Toleranz
    
    let feedbackColor = '#FF0000'; // Standard = Rot
    let feedbackLineWidth = 4;
    
    // Berechne "Nähe" von 0.0 (weit weg) bis 1.0 (perfekt)
    let proximity = 1.0 - Math.min(1.0, diff / 20.0); // 20 Grad = "sehr weit weg"
    
    if (diff <= toleranz) {
      // WIR SIND IM ZIELBEREICH
      feedbackColor = '#00FF00'; // Grün
      feedbackLineWidth = 8;
      feedbackText.textContent = "PERFEKT!";
      playBeep(880, 0.2); // Hoher, durchgehender Ton
    } else {
      // WIR SIND AUSSERHALB
      feedbackColor = '#FFFF00'; // Gelb (auf dem Weg)
      feedbackText.textContent = `Nähe... (${diff.toFixed(1)}° Abweichung)`;
      // Frequenz steigt, je näher man kommt
      let freq = 220 + (proximity * 440); // Frequenz von 220Hz bis 660Hz
      playBeep(freq, 0.1 + (proximity * 0.1));
    }
    
    // Zeichne das Live-Skelett mit der Feedback-Farbe
    drawSkeleton(livePose, feedbackColor, feedbackLineWidth);

  } catch (error) {
    // Punkte waren nicht sichtbar
    stopBeep();
    feedbackText.textContent = "Suche Pose...";
  }
}

// --- Globale Zeichen-Funktionen (HELFER) ---

// Zeichnet das Bild skaliert (wie im letzten Schritt)
function drawScaledImage(image) {

  if (!image || !image.width || !image.height) {
    console.error("drawScaledImage: Ungültiges Bild-Objekt empfangen.");
    return;
  }

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
  
  // Speichere die Skalierungs-Faktoren für die Skelett-Zeichnung
  // Wir hängen sie an das Canvas-Element (ein kleiner Trick)
  canvasElement.drawConfig = { drawWidth, drawHeight, offsetX, offsetY };
}

// Zeichnet ein Skelett
function drawSkeleton(landmarks, color, lineWidth = 4) {
  // Hol dir die Skalierungs-Faktoren
  const { drawWidth, drawHeight, offsetX, offsetY } = canvasElement.drawConfig;

  // Skaliere die Punkte auf die Canvas-Größe
  const scaledLandmarks = landmarks.map(landmark => {
    return {
      x: landmark.x * drawWidth + offsetX,
      y: landmark.y * drawHeight + offsetY,
    };
  });
  
  // Zeichne die Linien und Punkte
  drawConnectors(canvasCtx, scaledLandmarks, POSE_CONNECTIONS,
                 {color: color, lineWidth: lineWidth});
  drawLandmarks(canvasCtx, scaledLandmarks,
                {color: '#FFFFFF', lineWidth: 2, radius: 2}); // Weiße kleine Punkte
}