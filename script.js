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

function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  if (results.poseLandmarks) {
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                   {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#FF0000', lineWidth: 2});

    try {
        const shoulder = results.poseLandmarks[11];
        const elbow = results.poseLandmarks[13];
        const wrist = results.poseLandmarks[15];

        const angle = calculateAngle(shoulder, elbow, wrist);

        const elbowPixelX = elbow.x * 640;
        const elbowPixelY = elbow.y * 480;

        canvasCtx.font = "30px Arial";
        canvasCtx.fillStyle = "#FFFF00";
        canvasCtx.fillText(angle.toFixed(1), elbowPixelX + 10, elbowPixelY);

    } catch (error) {
        // Falls ein Punkt nicht sichtbar ist,
        console.log("Punkte nicht im Bild");
    }
  }
}

const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

pose.setOptions({
  staticImageMode: true,
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
});

pose.onResults(onResults);

imageInputElement.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    imageElement.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

imageElement.onload = async () => {

  canvasElement.width = imageElement.width;
  canvasElement.height = imageElement.height;
  
  await pose.send({image: imageElement});
};