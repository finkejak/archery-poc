# Instructions

## Schritte

- Bild hochladen
- Reviewing davon, was Mediapipe herausgelesen hat z.B. Bild neu hochladen, neu versuchen
- Wenn das stimmt, dann kann man ins Live-Video reingehen mit Real-Time Skelett starten

## Stages

Du hast quasi zwei Stages - Kalibration und Echtzeit

1. Dich in der pefekten Pose fotografien als Richtwert als Ideal sozusagen, mit dem echten Trainer in Person aufgenommen. Der Code weiß vom ideal, das kann man hochladen
2. Live-Feed vom Video mit Feedback, bis man sich der Pose annähert, die ideal ist - aktuell soll es grün angezeigt werden d.h. mit gewissen Winkeln (z.B. Schulter-Ellbogen) wird in Blau angezeigt von der Idealpose. Wenn man sich annähert, wird Skelett grün und man wird auch über Sound benachrichtigt - je höher, desto näher am Winkel

- MediaPipe in javaScript eingebunden (HTML und JS)
- Format: Webseite im Browser

## Typedefinition für das PoseObject

MediaPipe gibt ein Posenobjekt aus, wie folgt:

```ts
type PoseObject {
    image: HTMlCanvasElement
    poseLandmarks: Array<{x: number; y: number; z: number}>
    poseWorldLandmarks: Array<{x: number; y: number; z: number}>
}
```

## Aktuelles Problem

Das Bild stammt aus einem veralteten Prototypen, beim neuen stellt sich das Problem auf, dass man das Bild hochladen kann, und wenn man es verarbeitet und der aktueller Fehler besthet darin, dass kein Skelett angezeigt wird. Es gibt keinen Error-Output aus.

## File Descriptions

### `INSTRUCTIONS.md`

This file contains instructions for the user on how to use the application. It describes the two stages of the application: calibration and real-time training. It also defines the `PoseObject` type and describes the current problem with the application.

### `image.png`

This is an image file that is used for the calibration step. The user uploads an image of themselves in the ideal pose, and the application uses this image to calculate the ideal angles for the joints.

### `output.md`

This file contains the file structure of the project and descriptions of the files.

### `src/index.html`

This is the main HTML file for the application. It contains the structure of the web page, including the video element for the live feed, the canvas for drawing the skeleton, and the input elements for uploading the calibration image.

### `src/script.js`

This file contains the JavaScript code for the application. It uses the MediaPipe library to detect the user's pose in real-time and provide feedback on their form. It also handles the calibration step, where the user uploads an image of themselves in the ideal pose.

### `src/style.css`

This file contains the CSS styles for the application. It styles the HTML elements to create a user-friendly interface.