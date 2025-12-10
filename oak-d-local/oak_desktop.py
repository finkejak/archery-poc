import cv2
import mediapipe as mp
import depthai as dai
import numpy as np

# --- 1. MediaPipe Setup ---
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

def run_hardcore_mode():
    print("Versuche 'Blindflug'-Start der OAK-D...")
    pipeline = dai.Pipeline()
    
    try:
        # Wir nutzen direkt die Pipeline-Methoden, ohne dai.node zu prüfen
        cam = pipeline.createColorCamera() # Oder pipeline.create(dai.node.ColorCamera)
        cam.setPreviewSize(1280, 720)
        cam.setInterleaved(False)
        cam.setFps(30)
        cam.setBoardSocket(dai.CameraBoardSocket.RGB)
        
        # HIER IST DER KNACKPUNKT: Wir hoffen, dass createXLinkOut existiert
        xout = pipeline.createXLinkOut()
        xout.setStreamName("rgb")
        cam.preview.link(xout.input)
        
    except Exception as e:
        print(f"CRASH beim Erstellen: {e}")
        return

    # Starten
    with dai.Device(pipeline) as device:
        q = device.getOutputQueue(name="rgb", maxSize=4, blocking=False)
        print(">>> ES LEBT! Fenster öffnet sich... <<<")
        
        while True:
            in_rgb = q.tryGet()
            if in_rgb is not None:
                frame = in_rgb.getCvFrame()
                
                # MediaPipe
                results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if results.pose_landmarks:
                    mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                
                cv2.imshow("OAK-D Test", frame)
            
            if cv2.waitKey(1) == ord('q'): break

if __name__ == "__main__":
    run_hardcore_mode()