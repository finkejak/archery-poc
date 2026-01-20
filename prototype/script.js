// ==========================================
// 1. SETUP & STATE MANAGEMENT
// ==========================================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const appState = {
    screen: 'welcome',
    calibration: {
        side: null, // { bowArm: 170, shoulderLift: 10 }
        front: null // { stanceRatio: 0.5 }
    },
    training: {
        phase: 'SIDE', // 'SIDE' or 'FRONT'
        reps: 0,
        maxReps: 5,
        holdingSince: 0,
        lastSuccess: 0,
        isActive: false
    }
};

// DOM Referenzen
const screens = document.querySelectorAll('.screen');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');
const video = document.querySelector('.input_video');

// ==========================================
// 2. NAVIGATION & UI LOGIC
// ==========================================

function showScreen(screenId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
    appState.screen = screenId;
    
    // Audio Context starten bei erster Interaktion
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Event Listeners Buttons
document.getElementById('btn-start-onboarding').onclick = () => showScreen('calib-side');
document.getElementById('btn-to-front').onclick = () => showScreen('calib-front');
document.getElementById('btn-finish-calib').onclick = () => {
    saveCalibration();
    showScreen('home');
};
document.getElementById('btn-start-training').onclick = () => {
    resetTraining();
    showScreen('instruction');
    speak("Lektion Eins. Profilansicht. Achte auf den Bogenarm.");
};
document.getElementById('btn-go-live').onclick = () => {
    showScreen('live');
    startCamera();
};
document.getElementById('btn-abort').onclick = () => {
    stopTraining();
    showScreen('home');
};
document.getElementById('btn-back-home').onclick = () => showScreen('home');

// ==========================================
// 3. AUDIO SYSTEM (TONE.JS + TTS)
// ==========================================

// Drone & Synth Setup
let drone, noise, beepOsc;

function initAudio() {
    if(drone) return; // Schon initiiert

    // Drone (Basis)
    drone = new Tone.FatOscillator({
        type: "triangle", frequency: 110, spread: 20, count: 3
    }).toDestination();
    drone.volume.value = -Infinity; // Start stumm
    drone.start();

    // Noise (Fehler)
    noise = new Tone.NoiseSynth({
        noise: { type: "pink" }, envelope: { attack: 0.1, decay: 0.5, sustain: 0 }
    }).toDestination();
}

function playSuccessSound() {
    // Einfaches Pling mit Tone.js
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.triggerAttackRelease(["C5", "E5", "G5"], "8n");
}

function updateDrone(active, intensity) {
    if(!drone) initAudio();
    if(active) {
        // Intensity 0..1 mapped to -20db .. -10db
        const vol = -30 + (intensity * 20);
        drone.volume.rampTo(vol, 0.1);
    } else {
        drone.volume.rampTo(-Infinity, 0.5);
    }
}

function triggerBeep(freq) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.stop(audioCtx.currentTime + 0.1);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Vorheriges abbrechen
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'de-DE'; u.rate = 1.1;
        window.speechSynthesis.speak(u);
    }
}

// ==========================================
// 4. KALIBRIERUNG LOGIK
// ==========================================

// Static Analyzers
const poseStatic = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
poseStatic.setOptions({modelComplexity: 1, minDetectionConfidence: 0.5});
poseStatic.onResults(handleCalibrationResult);

let calibMode = 'SIDE'; // 'SIDE' or 'FRONT'

function handleFileSelect(evt, mode) {
    calibMode = mode;
    const file = evt.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById(`img-preview-${mode.toLowerCase()}`);
        img.src = e.target.result;
        img.style.display = 'block';
        img.onload = () => poseStatic.send({image: img});
    };
    reader.readAsDataURL(file);
}

document.getElementById('input-side').onchange = (e) => handleFileSelect(e, 'SIDE');
document.getElementById('input-front').onchange = (e) => handleFileSelect(e, 'FRONT');

function handleCalibrationResult(results) {
    if (!results.poseLandmarks) {
        document.getElementById(`res-${calibMode.toLowerCase()}`).innerText = "Keine Pose erkannt.";
        return;
    }
    
    const lm = results.poseLandmarks;
    
    if (calibMode === 'SIDE') {
        // Arm & Schulter
        const bowArm = calculateAngle(lm[11], lm[13], lm[15]);
        const shoulder = calculateAngle(lm[13], lm[11], lm[23]);
        appState.calibration.side = { bowArm, shoulder };
        
        document.getElementById('res-side').innerText = `OK! Arm: ${bowArm.toFixed(0)}°`;
        document.getElementById('btn-to-front').disabled = false;
        
    } else {
        // Front: Standbreite (Verhältnis Fußabstand zu Schulterbreite)
        const shoulderWidth = Math.abs(lm[11].x - lm[12].x);
        const footWidth = Math.abs(lm[27].x - lm[28].x);
        const ratio = footWidth / shoulderWidth;
        appState.calibration.front = { stanceRatio: ratio };
        
        document.getElementById('res-front').innerText = `OK! Stand-Ratio: ${ratio.toFixed(2)}`;
        document.getElementById('btn-finish-calib').disabled = false;
    }
}

function saveCalibration() {
    localStorage.setItem('archerCalib', JSON.stringify(appState.calibration));
}

// Laden beim Start
const savedCalib = localStorage.getItem('archerCalib');
if (savedCalib) {
    appState.calibration = JSON.parse(savedCalib);
    // Button "Weiter" im Home enablen könnte man hier machen
}

// ==========================================
// 5. LIVE TRAINING LOGIK
// ==========================================

const poseLive = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
poseLive.setOptions({modelComplexity: 1, smoothLandmarks: true});
poseLive.onResults(onLiveResults);

async function startCamera() {
    appState.training.isActive = true;
    try {
        // Fallback Logik
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720} }
        }).catch(() => navigator.mediaDevices.getUserMedia({video: true})); // Fallback
        
        video.srcObject = stream;
        video.play();
        processVideo();
    } catch(e) {
        alert("Kamerafehler: " + e.message);
    }
}

async function processVideo() {
    if(!appState.training.isActive) return;
    if(!video.paused && !video.ended) {
        await poseLive.send({image: video});
    }
    requestAnimationFrame(processVideo);
}

function stopTraining() {
    appState.training.isActive = false;
    if(video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    updateDrone(false);
}

function resetTraining() {
    appState.training.reps = 0;
    appState.training.phase = 'SIDE';
    updateUI();
}

function onLiveResults(results) {
    // 1. Zeichnen
    drawResults(results);

    // 2. Logic Check
    if (!results.poseLandmarks || !appState.calibration.side) return;
    
    const lm = results.poseLandmarks;
    const phase = appState.training.phase;
    let isGood = false;
    let diffInfo = "";
    let proximity = 0; // 0..1

    if (phase === 'SIDE') {
        // Check Arm & Schulter
        const currentArm = calculateAngle(lm[11], lm[13], lm[15]);
        const targetArm = appState.calibration.side.bowArm;
        const diff = Math.abs(currentArm - targetArm);
        
        diffInfo = `Arm: ${diff.toFixed(0)}°`;
        proximity = Math.max(0, 1 - (diff / 30)); // Innerhalb von 30 Grad
        isGood = diff < 10;
        
    } else {
        // PHASE FRONT: Check Standbreite
        const sW = Math.abs(lm[11].x - lm[12].x);
        const fW = Math.abs(lm[27].x - lm[28].x);
        const currentRatio = fW / sW;
        const targetRatio = appState.calibration.front.stanceRatio;
        const diff = Math.abs(currentRatio - targetRatio);

        diffInfo = `Stand: ${diff.toFixed(2)}`;
        proximity = Math.max(0, 1 - (diff / 0.5));
        isGood = diff < 0.2;
    }

    // 3. Feedback Loop
    handleFeedback(isGood, proximity, diffInfo);
}

let lastBeep = 0;

function handleFeedback(isGood, proximity, text) {
    const uiFeedback = document.getElementById('live-feedback');
    const overlay = document.getElementById('success-overlay');
    
    uiFeedback.innerText = text;

    if (isGood) {
        // Timer Logic
        if (appState.training.holdingSince === 0) appState.training.holdingSince = Date.now();
        const holdTime = Date.now() - appState.training.holdingSince;

        if (holdTime > 300) { // Erfolg!
            // Nur alle 2 Sek feuern
            if (Date.now() - appState.training.lastSuccess > 2000) {
                appState.training.lastSuccess = Date.now();
                appState.training.reps++;
                
                playSuccessSound();
                overlay.style.display = 'block';
                setTimeout(() => overlay.style.display = 'none', 200);

                if (appState.training.reps < 5) {
                    speak(String(appState.training.reps));
                } else {
                    nextPhase();
                }
                updateUI();
            }
        }
        updateDrone(true, 1.0); // Drone laut
        
    } else {
        appState.training.holdingSince = 0;
        // Geigerzähler
        updateDrone(true, proximity * 0.5); // Drone leise
        
        const interval = 800 - (proximity * 700);
        if (Date.now() - lastBeep > interval) {
            triggerBeep(200 + (proximity * 600));
            lastBeep = Date.now();
        }
    }
}

function nextPhase() {
    if (appState.training.phase === 'SIDE') {
        appState.training.phase = 'FRONT';
        appState.training.reps = 0;
        speak("Seitenwechsel. Dreh dich zur Kamera. Prüfe deinen Stand.");
        updateUI();
    } else {
        speak("Training beendet. Gute Arbeit.");
        stopTraining();
        showScreen('summary');
    }
}

function updateUI() {
    document.getElementById('phase-indicator').innerText = `PHASE: ${appState.training.phase}`;
    document.getElementById('rep-counter').innerText = `${appState.training.reps} / 5`;
}

// ==========================================
// 6. HELPER & SIMULATION
// ==========================================

function calculateAngle(a, b, c) {
    let rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(rad * (180.0 / Math.PI));
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function drawResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    if(results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#ffffff', lineWidth: 4});
        drawLandmarks(ctx, results.poseLandmarks, {color: '#4ade80', lineWidth: 2});
    }
}

// SIMULATION MODE (Taste 'S')
document.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') {
        if(appState.screen === 'live') {
            console.log("Simulation triggered");
            // Fake Erfolg
            handleFeedback(true, 1.0, "SIMULATION");
        }
    }
});