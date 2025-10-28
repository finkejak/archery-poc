function calculateAngle(a, b, c) {
  // a, b, c sind Objekte wie {x: 0.5, y: 0.6}

  let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(rad * (180.0 / Math.PI));

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                   {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#FF0000', lineWidth: 2});

    try {
        // Hol dir die Keypoints für den Bogenarm (links)
        // 11 = LEFT_SHOULDER, 13 = LEFT_ELBOW, 15 = LEFT_WRIST
        const shoulder = results.poseLandmarks[11];
        const elbow = results.poseLandmarks[13];
        const wrist = results.poseLandmarks[15];

        // Berechne den Winkel
        const angle = calculateAngle(shoulder, elbow, wrist);

        // Gib den Winkel in der Konsole aus
        console.log("Bogenarm-Winkel:", angle);

        const elbowPixelX = elbow.x * 640;
        const elbowPixelY = elbow.y * 480;

        // 2. Zeichne den Text auf das Canvas
        canvasCtx.font = "30px Arial";
        canvasCtx.fillStyle = "#FFFF00"; // Gelbe Schrift
        canvasCtx.fillText(angle.toFixed(1), elbowPixelX + 10, elbowPixelY);

    } catch (error) {
        // Falls ein Punkt nicht sichtbar ist, Fehler abfangen
        console.log("Punkte nicht im Bild");
    }
    
    // Test: Position der Nase in der Konsole ausgeben
    const nose = results.poseLandmarks[0];
    console.log("Nase X:", nose.x, "Nase Y:", nose.y);
  }
}

const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

if (results.poseLandmarks) {

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                   {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#FF0000', lineWidth: 2});

  console.log(results.poseLandmarks);

  const nose = results.poseLandmarks[0];
  console.log("Nase X:", nose.x, "Nase Y:", nose.y);

}

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({image: videoElement});
  },
  width: 640,
  height: 480
});

camera.start();