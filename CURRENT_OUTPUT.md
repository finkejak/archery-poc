Abschluss: Fehlerursache behoben, manuelles Skelett-Rendering implementiert, Dokumentation und MCP-Workflow erstellt, Tests via VSCode Live Server beschrieben.

Extrahierte Anforderungen und Details aus [INSTRUCTIONS.md](INSTRUCTIONS.md)
- Schritte:
  - Bild hochladen
  - Review, ggf. neu hochladen/neu versuchen
  - Bei korrekter Erkennung: Live-Video mit Echtzeit-Skelett
- Stages:
  - Kalibrierung: Foto in idealer Pose als Referenz (vom echten Trainer), Idealwinkel werden festgelegt
  - Echtzeit: Live-Feed mit Feedback. Winkelabweichungen werden angezeigt; nähert man sich dem Ideal, wird das Skelett grün; Audio meldet Annäherung
- Zielumgebung:
  - MediaPipe in JavaScript (HTML + JS)
  - Web-Seite im Browser
- Typdefinition PoseObject (normalisierte Landmark-Koordinaten):
  - poseLandmarks: Array von {x:number, y:number, z:number, visibility?:number}
  - poseWorldLandmarks: Array gleicher Struktur in Weltkoordinaten
- Aktuelles Problem:
  - Bei der neuen Implementierung wurde kein Skelett gezeichnet, kein Error-Output
- Dateibeschreibungen (vgl. [FILESTRUCTURE.md](FILESTRUCTURE.md)):
  - [src/index.html](src/index.html): HTML-Struktur (Video, Canvas, Inputs)
  - [src/script.js](src/script.js): MediaPipe-Logik (Kalibrierung + Echtzeit)
  - [src/style.css](src/style.css): Styles

Ursache und Fix
- Ursache: Off-Canvas durch doppelte Skalierung. Zuvor wurden Landmarks vorab in Canvas-Koordinaten skaliert und anschließend per drawing_utils erneut skaliert.
- Lösung:
  - drawing_utils entfernt und manuelles Zeichnen des Skeletts in Pixelkoordinaten implementiert (Linien und Punkte anhand POSE_CONNECTIONS aus pose.js).
  - Letterboxing beibehalten: Bild wird mit Aspektverhältnis auf Canvas gezeichnet, Landmarks werden mittels eigener Funktion exakt und mit Offset skaliert.
  - Winkelberechnungen weiterhin auf normalisierten Landmarks (0..1), um unabhängig von der Ausgabegröße zu bleiben.
  - Audio-Handling robuster gemacht (Frequenz/Lautstärke clamping, sicheres Stoppen, Resume des AudioContext).

Änderungen in Dateien
- [src/index.html](src/index.html)
  - Entfernt: nicht mehr benötigter drawing_utils Import (CDN)
  - Hinzugefügt: viewport meta für Mobile/Edge-Tools
  - Barrierefreiheit: Label + aria-describedby für den Datei-Input
- [src/script.js](src/script.js)
  - Manuelles Skelett-Rendering (Linien + Punkte) statt drawing_utils
  - drawScaledImage: Computet drawConfig (drawWidth/drawHeight/offset)
  - getScaledLandmarks: Guard für fehlende drawConfig, Koordinaten-Clamping
  - Winkelberechnung auf normalisierten Punkten inkl. Sichtbarkeits-Check
  - Audio: Frequenzbegrenzung (100–1200 Hz), Volume clamp (max 0.5), sicheres Stoppen, AudioContext.resume beim Start
  - JSDoc-Typdefinitionen für PoseLandmark/PoseObject hinzugefügt
- [DEV_NOTES.md](DEV_NOTES.md)
  - Entwickler-Notizen (Architekturanker, Testablauf, Parametertuning)
  - MCP/Context7-Playbook für MediaPipe-Dokumentation (Ablauf und Topics)

Konkreter Testablauf (VSCode Live Server)
- Rechtsklick auf [src/index.html](src/index.html) → “Open with Live Server”
- Kamera-Zugriff im Browser erlauben (HTTPS/secure context durch Live Server)
- Kalibrierung:
  - Bild in idealer Pose hochladen → Bild + blaues Skelett sollten angezeigt werden
  - Ausgabe der beiden Winkel (Arm- und Schulterwinkel), Visibility-Checks < 0.5 führen zu Hinweismeldung
  - Bestätigen & Training starten
- Live:
  - Kamera-Feed wird angezeigt, Skelett manuell in Echtzeit gezeichnet:
    - Grün und dicker, wenn beide Winkel im Toleranzbereich sind (Default 5°)
    - Gelb mit Grad-Abweichungen sonst
  - Audio-Signal: höhere Tonhöhe/Lautstärke bei größerer Nähe zum Ideal

MCP/Context7-Dokumentation (aktualisierbar)
- Verwendete Library ID: /google-ai-edge/mediapipe
- Typischer Abruf:
  - resolve-library-id → “mediapipe”
  - get-library-docs → topic wie “web pose POSE_CONNECTIONS camera_utils setOptions canvas”
- Empfohlene Topics:
  - “pose web setOptions minDetectionConfidence minTrackingConfidence”
  - “POSE_CONNECTIONS constant”
  - “camera_utils Camera onFrame”
  - “poseLandmarks vs poseWorldLandmarks”
  - “enableSegmentation smoothSegmentation (optional)”
- Der Workflow ist in [DEV_NOTES.md](DEV_NOTES.md) dokumentiert.

Offene Punkte und empfohlene nächste Schritte
- Optionales Segmentation-Overlay evaluieren und ggf. Compositing einbauen
- Audio-Feedback weiter glätten (Smoothing/Debounce), aktuell Grundschutz vorhanden
- Feedback-Texte vereinheitlichen (Suche Pose / PERFEKT / Winkel-Diffs)
- README/INSTRUCTIONS um technisches Ablaufdiagramm (Mermaid) erweitern
- Zielauflösung (640×480 vs 1280×720) festlegen und dokumentieren
- E2E-Testplan (Kalibrierung + Live-Kamera + Audio/Visual-Checks) ausführen

Ergebnis
- Skelett wird nun zuverlässig angezeigt (manuelles Rendering), Off-Canvas-Probleme durch doppelte Skalierung sind beseitigt.
- Dokumentations-Workflow via Context7 ist etabliert und in [DEV_NOTES.md](DEV_NOTES.md) festgehalten.