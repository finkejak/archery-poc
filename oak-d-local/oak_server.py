import cv2
import depthai as dai
import mediapipe as mp
import numpy as np
import asyncio
import websockets
import json
import base64
import sys

# Version prüfen
print(f"Genutzte DepthAI Version: {dai.__version__}")

# MediaPipe Setup
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

def create_pipeline():
    pipeline = dai.Pipeline()

    # --- 1. KAMERA ERSTELLEN (Die NEUE Methode) ---
    # Wir benutzen NICHT mehr 'dai.node.ColorCamera', sondern die Helper-Funktion
    try:
        print("Erstelle ColorCamera...")
        cam_rgb = pipeline.createColorCamera()
        
        # Einstellungen
        cam_rgb.setPreviewSize(640, 480)
        cam_rgb.setInterleaved(False)
        cam_rgb.setFps(30)
        cam_rgb.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        
        # In Version 3 ist 'CAM_A' der Standard für RGB
        cam_rgb.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        
    except AttributeError as e:
        print(f"Fehler bei Kamera-Erstellung: {e}")
        sys.exit(1)

    # --- 2. AUSGANG ERSTELLEN (Die NEUE Methode) ---
    # Das war der Fehler! Wir nutzen jetzt createXLinkOut() direkt.
    try:
        xout_rgb = pipeline.createXLinkOut()
        xout_rgb.setStreamName("rgb")
    except AttributeError as e:
        print(f"Fehler bei XLinkOut-Erstellung: {e}")
        sys.exit(1)
    
    # Verknüpfung
    cam_rgb.preview.link(xout_rgb.input)

    return pipeline

async def run_server(websocket):
    print("Client verbunden! Starte OAK-D Pipeline...")
    
    try:
        pipeline = create_pipeline()
        
        # OAK-D starten
        with dai.Device(pipeline) as device:
            # Output Queue holen
            q_rgb = device.getOutputQueue(name="rgb", maxSize=4, blocking=False)
            
            print(">>> Kamera läuft! Sende Daten... <<<")
            
            while True:
                in_rgb = q_rgb.tryGet()
                
                if in_rgb is not None:
                    # Bilddaten holen
                    frame = in_rgb.getCvFrame()
                    
                    # MediaPipe Pose
                    results = pose.process(frame)
                    
                    landmarks_data = []
                    if results.pose_landmarks:
                        for lm in results.pose_landmarks.landmark:
                            landmarks_data.append({
                                'x': lm.x,
                                'y': lm.y,
                                'z': lm.z, 
                                'visibility': lm.visibility
                            })

                    # Encode
                    _, buffer = cv2.imencode('.jpg', frame)
                    jpg_as_text = base64.b64encode(buffer).decode('utf-8')

                    # Senden
                    message = {
                        'image': jpg_as_text,
                        'landmarks': landmarks_data
                    }
                    
                    try:
                        await websocket.send(json.dumps(message))
                        await asyncio.sleep(0.01) 
                    except websockets.exceptions.ConnectionClosed:
                        print("Client getrennt.")
                        break
                else:
                    await asyncio.sleep(0.001)

    except Exception as e:
        print(f"\nSCHWERER FEHLER: {e}")
        import traceback
        traceback.print_exc()

async def main():
    print("Starte WebSocket Server auf ws://localhost:8765...")
    async with websockets.serve(run_server, "localhost", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer gestoppt.")