function calculateAngle(a, b, c) {

  let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(rad * (180.0 / Math.PI));

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const imageInputElement = document.getElementById('imageInput');
const imageElement = document.getElementById('loadedImage');

// Diese Funktion wird aufgerufen, wenn Ergebnisse vorliegen
// (Sie ist jetzt viel einfacher!)
function onResults(results) {
  // Lösche das Canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Zeichne das Original-Bild auf das Canvas
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  // Zeichne das Skelett und die Punkte
  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                   {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#FF0000', lineWidth: 2});

    // --- DEINE ANALYSE (genau wie vorher) ---
    try {
      const shoulder = results.poseLandmarks[11]; // L-Schulter
      const elbow = results.poseLandmarks[13];    // L-Ellbogen
      const wrist = results.poseLandmarks[15];    // L-Handgelenk

      const angle = calculateAngle(shoulder, elbow, wrist);

      // Zeichne den Winkel auf das Canvas
      const elbowPixelX = elbow.x * 640;
      const elbowPixelY = elbow.y * 480;
      
      canvasCtx.font = "30px Arial";
      canvasCtx.fillStyle = "#FFFF00";
      canvasCtx.fillText(angle.toFixed(1), elbowPixelX + 10, elbowPixelY);

    } catch (error) {
      console.log("Punkte nicht im Bild");
    }
  }
}

// Initialisiere das Pose-Modell
const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

// Setze Modell-Optionen (WICHTIG: Füge staticImageMode hinzu)
pose.setOptions({
  staticImageMode: true, // SAGT MEDIAPIPE, DASS ES EIN BILD IST
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5
});

// Verknüpfe die "onResults" Funktion
pose.onResults(onResults);

// --- DER NEUE TEIL (STATT KAMERA) ---
// Warte darauf, dass der Nutzer eine Datei auswählt
imageInputElement.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  
  // Erzeuge eine URL für die Datei, damit das <img> sie laden kann
  const reader = new FileReader();
  reader.onload = (event) => {
    imageElement.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Sobald das <img>-Element das Bild geladen hat...
imageElement.onload = async () => {
  // ...passe die Canvas-Größe an das Bild an (optional, aber gut)
  // canvasElement.width = imageElement.width;
  // canvasElement.height = imageElement.height;
  
  // ...zeichne das Bild ins (unsichtbare) Canvas für MediaPipe...
  // canvasCtx.drawImage(imageElement, 0, 0, canvasElement.width, canvasElement.height);

  // ...und SENDE ES AN MEDIAPIPE ZUR ANALYSE!
  await pose.send({image: imageElement});
};