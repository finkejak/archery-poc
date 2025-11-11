# DEV_NOTES: Archery AI Pose

Purpose: Developer notes for the current browser-based PoC using MediaPipe Pose, manual skeleton rendering with letterboxing, and an MCP workflow to keep documentation up to date.

Implementation overview
- Manual skeleton rendering replaces drawing_utils to avoid double-scaling issues.
- Letterboxing is preserved: the incoming image (static or video frame) is scaled to canvas while keeping aspect ratio, and landmarks are scaled accordingly in pixel space.
- Angles are computed on normalized landmarks (0..1) from MediaPipe to remain independent of output scaling.
- Audio feedback uses a simple sine oscillator with safe clamps and context resume.

Key code anchors
- Image draw + drawConfig: src/script.js drawScaledImage()
- Landmark scaling to canvas pixels with guards: src/script.js getScaledLandmarks()
- Manual skeleton drawing (lines + points): src/script.js drawSkeleton()
- Calibration (static image): src/script.js onStaticResults()
- Live loop (webcam): src/script.js onLiveResults()

Testing with VSCode Live Server
- In VSCode, right-click src/index.html and select “Open with Live Server”.
- Allow camera permissions in the browser (secure context required).
- Stage 1: Calibration
  - Use the file picker to upload an image of the ideal pose.
  - The app draws the image and a blue skeleton overlay; two angles are computed:
    - Bow arm: angle(shoulder[11], elbow[13], wrist[15])
    - Shoulder lift: angle(elbow[13], shoulder[11], hip[23])
  - If visibility for required joints < 0.5, calibration prompts to try another image.
  - On success, confirmation panel appears with angle readouts.
- Stage 2: Live training
  - Click “Bestätigen & Training starten”.
  - The camera feed appears behind the canvas; the skeleton is drawn in feedback color:
    - Green and thicker lines when both angles are within tolerance.
    - Yellow with numeric diffs otherwise.
  - Audio pitch and volume reflect proximity.

MediaPipe usage (Web)
- Global POSE_CONNECTIONS constant is provided by @mediapipe/pose when loading pose.js via CDN.
- Landmarks structure: array of {x, y, z, visibility?} in normalized coordinates (0..1).
- We do not rely on drawing_utils; we draw lines and points manually using POSE_CONNECTIONS.

MCP Context7 documentation playbook
Goal: Keep MediaPipe documentation snippets available and refreshable from within the Chat/MCP workflow.

Library IDs
- Primary: /google-ai-edge/mediapipe
- Samples (optional): /google-ai-edge/mediapipe-samples

Typical retrieval flow (MCP)
1) Resolve library ID
   - Tool: context7.resolve-library-id
   - Input: "mediapipe"
   - Expected: /google-ai-edge/mediapipe
2) Fetch docs
   - Tool: context7.get-library-docs
   - Params:
     - context7CompatibleLibraryID: "/google-ai-edge/mediapipe"
     - topic: e.g. "web pose POSE_CONNECTIONS camera_utils setOptions canvas"
     - tokens: 2000–6000 (depending on needed context length)

Useful topics to query
- "pose web setOptions minDetectionConfidence minTrackingConfidence"
- "POSE_CONNECTIONS constant documentation"
- "camera_utils Camera onFrame usage"
- "poseLandmarks vs poseWorldLandmarks"
- "segmentation enableSegmentation smoothSegmentation (optional overlay)"

Why manual skeleton rendering?
- When using drawing_utils with pre-scaled points, landmarks can be drawn off-canvas due to internal scaling assumptions (expects normalized coordinates).
- Manual rendering on already scaled pixel coordinates avoids double-scaling and respects letterboxing offsets.

Parameters and tuning
- Tolerances (defaults)
  - armToleranz: 5°
  - shoulderToleranz: 5°
- Audio
  - Frequency clamp: 100–1200 Hz
  - Volume clamp: 0.0–0.5
- Canvas and resolution
  - Default 640×480; increase for more detail if performance allows.
- Visibility threshold
  - 0.5 for required joints; adjust if your camera or lighting conditions reduce detections.

Pose landmark indices (MediaPipe)
- Nose: 0
- Left shoulder: 11
- Left elbow: 13
- Left wrist: 15
- Left hip: 23
(Mirror for right side if needed)

Type definitions
- JSDoc typedefs for PoseLandmark and PoseObject are included near the top of src/script.js to aid tooling and comprehension.

Known limitations
- No segmentation overlay by default; can be enabled via poseLive.setOptions if needed, with appropriate canvas compositing.
- Audio feedback is simplistic; refine with smoothing or debounce if jitter occurs.
- This PoC focuses on single-person pose; multi-pose is out of scope.

Future work
- Add optional segmentation overlay for emphasis.
- UI controls to configure tolerances and audio behavior.
- Export/import of calibration results.
- Add Mermaid diagram documenting the data flow from calibration to live feedback.

Changelog (recent)
- Replaced drawing_utils with manual drawSkeleton.
- Added guards in getScaledLandmarks for missing drawConfig and clamped coordinates.
- Improved audio handling with clamping and safe cleanup.
- Added viewport meta and accessible label for the file input.
- Documented MCP Context7 flow for MediaPipe docs.