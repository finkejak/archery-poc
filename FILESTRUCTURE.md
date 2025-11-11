```bash
.
├── INSTRUCTIONS.md
├── image.png
├── output.txt
└── src
    ├── index.html
    ├── script.js
    └── style.css

2 directories, 6 files
```

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
