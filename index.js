const firebaseConfig = {
    apiKey: "AIzaSyAtQurZfX_McwPEetml5itdOP607rDMCek",
    authDomain: "hhs-games.firebaseapp.com",
    projectId: "hhs-games",
    storageBucket: "hhs-games.firebasestorage.app",
    messagingSenderId: "791682352447",
    appId: "1:791682352447:web:109bebcd96b1848eb9ff8a"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (e) {
    console.warn("Firebase not available, using local scores only.", e);
}

let appSettings = {
    githubUsername: "HillcrestHigh",
    githubRepo: "hhs-maze-runner",
    branch: "main",
    photosFolder: "staff-photos",
    staffFiles: ["HB.webp", "teacher1.png", "teacher2.jpg", "slt_member.webp"]
};

const imageCache = {};

function getGitHubRawUrl(filename) {
    if (!filename) return '';
    if (filename.startsWith('data:') || filename.startsWith('http://') || filename.startsWith('https://')) {
        return filename;
    }
    const folder = appSettings.photosFolder ? `${appSettings.photosFolder.replace(/\/$/, '')}/` : '';
    return `https://raw.githubusercontent.com/${appSettings.githubUsername}/${appSettings.githubRepo}/${appSettings.branch}/${folder}${filename}`;
}

function getOrLoadImage(filename) {
    if (!filename) return null;
    if (imageCache[filename]) return imageCache[filename];

    const img = new Image();
    img.src = getGitHubRawUrl(filename);
    img.onload = function () {
        if (typeof drawEditorCanvas === 'function') drawEditorCanvas();
    };
    img.onerror = function () { img.failed = true; };
    imageCache[filename] = img;
    return img;
}

function loadSettings() {
    const stored = localStorage.getItem('hhs_game_settings');
    if (stored) {
        try {
            appSettings = Object.assign(appSettings, JSON.parse(stored));
        } catch (e) { }
    }
}
loadSettings();

function openSettingsModal() {
    document.getElementById('cfg-username').value = appSettings.githubUsername;
    document.getElementById('cfg-repo').value = appSettings.githubRepo;
    document.getElementById('cfg-branch').value = appSettings.branch;
    document.getElementById('cfg-folder').value = appSettings.photosFolder;
    document.getElementById('cfg-files').value = appSettings.staffFiles.join(', ');
    updateSettingsUrlPreview();

    ['cfg-username', 'cfg-repo', 'cfg-branch', 'cfg-folder', 'cfg-files'].forEach(id => {
        document.getElementById(id).oninput = updateSettingsUrlPreview;
    });

    document.getElementById('settings-modal').classList.add('active');
}

function updateSettingsUrlPreview() {
    const u = document.getElementById('cfg-username').value.trim();
    const r = document.getElementById('cfg-repo').value.trim();
    const b = document.getElementById('cfg-branch').value.trim();
    const f = document.getElementById('cfg-folder').value.trim();
    const folderStr = f ? `${f.replace(/\/$/, '')}/` : '';
    document.getElementById('cfg-url-preview').textContent = `https://raw.githubusercontent.com/${u}/${r}/${b}/${folderStr}HB.webp`;
}

function saveSettingsConfig() {
    appSettings.githubUsername = document.getElementById('cfg-username').value.trim();
    appSettings.githubRepo = document.getElementById('cfg-repo').value.trim();
    appSettings.branch = document.getElementById('cfg-branch').value.trim();
    appSettings.photosFolder = document.getElementById('cfg-folder').value.trim();

    const rawFiles = document.getElementById('cfg-files').value;
    appSettings.staffFiles = rawFiles.split(',').map(s => s.trim()).filter(s => s.length > 0);

    localStorage.setItem('hhs_game_settings', JSON.stringify(appSettings));
    closeSettingsModal();
    showMessageBox("GitHub Staff Settings saved successfully!");
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function exportSettingsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appSettings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "settings.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function importSettingsJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const data = JSON.parse(evt.target.result);
            appSettings = Object.assign(appSettings, data);
            localStorage.setItem('hhs_game_settings', JSON.stringify(appSettings));
            openSettingsModal();
            showMessageBox("settings.json imported successfully!");
        } catch (err) {
            showMessageBox("Error parsing settings.json file.");
        }
    };
    reader.readAsText(file);
}

let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    try {
        initAudio();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(660, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'minus') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(150, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'step') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'patrol') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(180, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    } catch (e) { }
}

function showMessageBox(msg) {
    alert(msg);
}

let defaultLevels = [
    {
        id: "corridor_sprint",
        name: "Main Corridor Sprint",
        description: "Navigate past patrolling staff from reception to the quad.",
        cols: 20,
        rows: 12,
        patrolSpeed: 1.0,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 0, 0, 6, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 8, 1],
            [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 1, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 1, 0, 1],
            [1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
            [1, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 6, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 90,
        personas: {
            "1_4": { name: "Mr. van der Merwe", portrait: "👨‍🏫", photo: "HB.webp", prompt: "Good morning! Why are you rushing down this corridor?", responses: [{ text: "Good morning, Sir! My apologies.", points: 20 }, { text: "No time to chat!", points: -10 }] },
            "5_14": { name: "Mrs. Dube (SLT)", portrait: "👩‍🏫", photo: "teacher1.png", prompt: "Stop right there. Where is your school blazer?", responses: [{ text: "Good morning, Mrs. Dube. Here it is.", points: 20 }, { text: "*Scurries past silently*", points: -10 }] },
            "9_17": { name: "Mr. Pillay", portrait: "👔", photo: "teacher2.jpg", prompt: "Quiet in the passages please!", responses: [{ text: "Understood, Sir. Have a great day.", points: 20 }, { text: "Can't hear you!", points: -15 }] }
        }
    }
];

let levels = [];
function loadLevels() {
    const stored = localStorage.getItem('hhs_custom_levels');
    if (stored) {
        try {
            levels = JSON.parse(stored);
        } catch (e) { levels = JSON.parse(JSON.stringify(defaultLevels)); }
    } else {
        levels = JSON.parse(JSON.stringify(defaultLevels));
    }
}
loadLevels();

let currentScreen = 'screen-menu';
let selectedCharacter = { id: 'rugby', name: 'Rugby Player', icon: '🏉' };
let playerName = 'Alex Smith';
let currentLevelIndex = 0;

let playerX = 1;
let playerY = 1;
let prideScore = 0;
let minusScore = 0;
let gameTimer = 0;
let timerInterval = null;
let patrolInterval = null;
let gameRunning = false;
let currentMapGrid = [];
let activeEntities = [];
let currentPersonas = {};
let currentPatrolSpeed = 1.0;

function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;

    // Reset button only visible while playing
    document.getElementById('reset-btn').classList.toggle('visible', screenId === 'screen-game');

    if (screenId === 'screen-level-select') {
        renderPlayLevelSelect();
    } else if (screenId === 'screen-leaderboard') {
        renderLeaderboardTable();
    }
}

function selectCharacter(id, cardEl) {
    document.querySelectorAll('#character-grid .card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    if (id === 'rugby') selectedCharacter = { id, name: 'Rugby Player', icon: '🏉' };
    if (id === 'netball') selectedCharacter = { id, name: 'Netball Player', icon: '🏐' };
    if (id === 'drama') selectedCharacter = { id, name: 'Drama Student', icon: '🎤' };
    if (id === 'learner') selectedCharacter = { id, name: 'Basic Learner', icon: '🎒' };
}

function startSelectedGame() {
    document.getElementById('name-modal').classList.add('active');
}

function confirmPlayerName() {
    const val = document.getElementById('player-name-input').value.trim();
    if (val) playerName = val;
    document.getElementById('name-modal').classList.remove('active');
    goToScreen('screen-level-select');
}

function openLevelSelectForPlay() {
    goToScreen('screen-level-select');
}

function renderPlayLevelSelect() {
    const grid = document.getElementById('play-level-grid');
    grid.innerHTML = '';
    levels.forEach((lvl, idx) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🏫</div>
            <h3>${lvl.name}</h3>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 5px 0;">${lvl.description}</p>
            <p style="font-size: 0.75rem; color: #38bdf8; margin-bottom: 8px;">Patrol Speed: ${lvl.patrolSpeed || 1.0}s</p>
            <button class="btn btn-success" style="font-size: 0.85rem; padding: 6px 12px;" onclick="launchGameLevel(${idx})">Play Level</button>
        `;
        grid.appendChild(div);
    });
}

function launchGameLevel(index) {
    currentLevelIndex = index;
    const lvl = levels[index];
    currentMapGrid = JSON.parse(JSON.stringify(lvl.grid));
    currentPersonas = JSON.parse(JSON.stringify(lvl.personas || {}));
    currentPatrolSpeed = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;

    prideScore = 0;
    minusScore = 0;
    gameTimer = lvl.timeLimit || 90;

    // Find player start position
    playerX = 1;
    playerY = 1;
    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            if (currentMapGrid[r][c] === 2 || currentMapGrid[r][c] === 3) {
                playerX = c;
                playerY = r;
            }
        }
    }

    extractEntitiesFromGrid();

    document.getElementById('hud-char').textContent = `${playerName} (${selectedCharacter.name})`;
    document.getElementById('hud-patrol-speed').textContent = `${currentPatrolSpeed}s`;
    updateHudScore();
    goToScreen('screen-game');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameRunning) return;
        gameTimer--;
        updateTimerDisplay();
        if (gameTimer <= 0) {
            endGame(false, "Time's up! You were too slow getting to class.");
        }
    }, 1000);

    if (patrolInterval) clearInterval(patrolInterval);
    patrolInterval = setInterval(() => {
        if (!gameRunning) return;
        updateTeacherPatrols();
    }, currentPatrolSpeed * 1000);

    gameRunning = true;
    window.addEventListener('keydown', handleGameKeydown);
    setTimeout(() => updateGameLoop(), 50);
}

function extractEntitiesFromGrid() {
    activeEntities = [];
    const lvl = levels[currentLevelIndex];
    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            const t = currentMapGrid[r][c];
            if (t === 4 || t === 5 || t === 6 || t === 7) {
                activeEntities.push({ y: r, x: c, type: t, interacted: false });
            }
        }
    }
}

function updateHudScore() {
    document.getElementById('hud-score').textContent = prideScore - minusScore;
}

function updateTimerDisplay() {
    const m = Math.floor(gameTimer / 60);
    const s = gameTimer % 60;
    document.getElementById('hud-time').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function quitGame() {
    gameRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    if (patrolInterval) clearInterval(patrolInterval);
    window.removeEventListener('keydown', handleGameKeydown);
    goToScreen('screen-menu');
}

function resetGame() {
    // Stop everything
    gameRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    if (patrolInterval) clearInterval(patrolInterval);
    window.removeEventListener('keydown', handleGameKeydown);

    // Close any open dialogue / interact prompt
    document.getElementById('dialogue-modal').classList.remove('active');
    document.getElementById('interact-btn').style.display = 'none';

    // Reset positions and run state (high scores are untouched)
    playerX = 1;
    playerY = 1;
    prideScore = 0;
    minusScore = 0;
    gameTimer = 0;
    activeEntities = [];
    currentMapGrid = [];
    currentPersonas = {};
    updateHudScore();
    updateTimerDisplay();

    goToScreen('screen-menu');
}

function updateTeacherPatrols() {
    if (!gameRunning) return;
    const lvl = levels[currentLevelIndex];
    const directions = [
        { dx: 0, dy: -1 }, // Up
        { dx: 0, dy: 1 },  // Down
        { dx: -1, dy: 0 }, // Left
        { dx: 1, dy: 0 }   // Right
    ];

    let movedAny = false;

    activeEntities.forEach(ent => {
        if (ent.type === 6 && !ent.interacted) {
            // Shuffle directions randomly
            const shuffled = [...directions].sort(() => Math.random() - 0.5);
            for (let d of shuffled) {
                const nx = ent.x + d.dx;
                const ny = ent.y + d.dy;

                // Check bounds and wall collisions (tile !== 1)
                if (nx >= 0 && nx < lvl.cols && ny >= 0 && ny < lvl.rows) {
                    if (currentMapGrid[ny][nx] !== 1) {
                        // Ensure teacher doesn't step on another active teacher or finish flag
                        const occupant = activeEntities.find(e => !e.interacted && e.x === nx && e.y === ny && e !== ent);
                        if (!occupant && currentMapGrid[ny][nx] !== 8) {
                            // Update teacher position key mapping in currentPersonas if needed
                            const oldKey = `${ent.y}_${ent.x}`;
                            const newKey = `${ny}_${nx}`;
                            if (currentPersonas[oldKey]) {
                                currentPersonas[newKey] = currentPersonas[oldKey];
                                delete currentPersonas[oldKey];
                            }

                            ent.x = nx;
                            ent.y = ny;
                            movedAny = true;
                            playSound('patrol');
                            break;
                        }
                    }
                }
            }

            // Check if teacher bumped into player (same map cell overlap)
            if (ent.x === playerX && ent.y === playerY && !ent.interacted) {
                openDialogueModal(ent);
            }
        }
    });

    if (movedAny) {
        updateGameLoop();
        checkForNearbyInteraction();
    }
}

function handleGameKeydown(e) {
    if (!gameRunning) return;
    const lvl = levels[currentLevelIndex];
    let nx = playerX;
    let ny = playerY;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') ny--;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') ny++;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') nx--;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') nx++;

    if (e.key === ' ') {
        e.preventDefault();
        triggerInteraction();
        return;
    }

    if (nx >= 0 && nx < lvl.cols && ny >= 0 && ny < lvl.rows) {
        if (currentMapGrid[ny][nx] !== 1) {
            playerX = nx;
            playerY = ny;
            playSound('step');

            // Check win tile (8)
            if (currentMapGrid[ny][nx] === 8) {
                endGame(true, "Congratulations! You successfully caught the HHS Mascot!");
                return;
            }

            // Check items / entities / teachers overlap
            const ent = activeEntities.find(en => !en.interacted && en.x === playerX && en.y === playerY);
            if (ent) {
                if (ent.type === 4) { // Books
                    prideScore += 15;
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 5) { // Ball
                    prideScore += 10;
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 7) { // Star
                    prideScore += 30;
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 6) { // Teacher / SLT overlap collision
                    openDialogueModal(ent);
                }
            }

            checkForNearbyInteraction();
            updateGameLoop();
        }
    }
}

function checkForNearbyInteraction() {
    const adj = [
        { y: playerY - 1, x: playerX },
        { y: playerY + 1, x: playerX },
        { y: playerY, x: playerX - 1 },
        { y: playerY, x: playerX + 1 }
    ];
    const btn = document.getElementById('interact-btn');
    const found = activeEntities.find(en => !en.interacted && en.type === 6 && adj.some(a => a.y === en.y && a.x === en.x));
    if (found) {
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}

function triggerInteraction() {
    const adj = [
        { y: playerY - 1, x: playerX },
        { y: playerY + 1, x: playerX },
        { y: playerY, x: playerX - 1 },
        { y: playerY, x: playerX + 1 }
    ];
    const found = activeEntities.find(en => !en.interacted && en.type === 6 && adj.some(a => a.y === en.y && a.x === en.x));
    if (found) {
        openDialogueModal(found);
    }
}

function openDialogueModal(ent) {
    gameRunning = false;
    const key = `${ent.y}_${ent.x}`;
    const persona = currentPersonas[key] || {
        name: "Teacher / SLT",
        portrait: "👨‍🏫",
        photo: "HB.webp",
        prompt: "Good morning! Mind your behaviour in the corridors.",
        responses: [
            { text: "Good morning, Sir/Madam! Have a wonderful day.", points: 20 },
            { text: "Whatever...", points: -10 }
        ]
    };

    const avatarContainer = document.getElementById('dlg-avatar-container');
    avatarContainer.innerHTML = '';

    if (persona.photo) {
        const img = document.createElement('img');
        img.src = getGitHubRawUrl(persona.photo);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.onerror = function () {
            avatarContainer.innerHTML = `<div id="dlg-avatar" style="font-size: 3rem;">${persona.portrait || '👨‍🏫'}</div>`;
        };
        avatarContainer.appendChild(img);
    } else {
        avatarContainer.innerHTML = `<div id="dlg-avatar" style="font-size: 3rem;">${persona.portrait || '👨‍🏫'}</div>`;
    }

    document.getElementById('dlg-title').textContent = persona.name;
    document.getElementById('dlg-speech').textContent = persona.prompt;

    const container = document.getElementById('dlg-options-container');
    container.innerHTML = '';

    persona.responses.forEach(resp => {
        const btn = document.createElement('button');
        btn.className = 'dialogue-option';
        btn.innerHTML = `<b>${resp.points >= 0 ? '+' + resp.points : resp.points} Pts:</b> "${resp.text}"`;
        btn.onclick = () => {
            if (resp.points >= 0) {
                prideScore += resp.points;
                playSound('success');
            } else {
                minusScore += Math.abs(resp.points);
                playSound('minus');
            }
            updateHudScore();
            ent.interacted = true;
            document.getElementById('dialogue-modal').classList.remove('active');
            document.getElementById('interact-btn').style.display = 'none';
            gameRunning = true;
        };
        container.appendChild(btn);
    });

    document.getElementById('dialogue-modal').classList.add('active');
}

function updateGameLoop() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const lvl = levels[currentLevelIndex];
    const tileSize = Math.floor(canvas.width / lvl.cols);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            const t = currentMapGrid[r][c];
            ctx.fillStyle = t === 1 ? '#334155' : '#1e293b';
            ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
            ctx.strokeStyle = '#1e293b';
            ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
        }
    }

    activeEntities.forEach(ent => {
        if (ent.interacted) return;
        const cx = ent.x * tileSize + tileSize / 2;
        const cy = ent.y * tileSize + tileSize / 2;

        if (ent.type === 6) {
            const key = `${ent.y}_${ent.x}`;
            const p = currentPersonas[key];
            const photoImg = p && p.photo ? getOrLoadImage(p.photo) : null;

            if (photoImg && photoImg.complete && !photoImg.failed) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, tileSize * 0.4, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(photoImg, ent.x * tileSize, ent.y * tileSize, tileSize, tileSize);
                ctx.restore();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, tileSize * 0.4, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.font = `${Math.floor(tileSize * 0.7)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((p && p.portrait) ? p.portrait : '👨‍🏫', cx, cy);
            }
        } else {
            ctx.font = `${Math.floor(tileSize * 0.7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let sym = '·';
            if (ent.type === 4) sym = '📚';
            if (ent.type === 5) sym = '⚽';
            if (ent.type === 7) sym = '⭐';
            ctx.fillText(sym, cx, cy);
        }
    });

    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            if (currentMapGrid[r][c] === 8) {
                ctx.font = `${Math.floor(tileSize * 0.8)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🏁', c * tileSize + tileSize / 2, r * tileSize + tileSize / 2);
            }
        }
    }

    ctx.font = `${Math.floor(tileSize * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(selectedCharacter.icon, playerX * tileSize + tileSize / 2, playerY * tileSize + tileSize / 2);
}

function endGame(victory, message) {
    gameRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    if (patrolInterval) clearInterval(patrolInterval);
    window.removeEventListener('keydown', handleGameKeydown);

    document.getElementById('victory-title').textContent = victory ? "Level Completed!" : "Game Over";
    document.getElementById('victory-subtitle').textContent = message;

    document.getElementById('res-name').textContent = playerName;
    document.getElementById('res-char').textContent = selectedCharacter.name;
    document.getElementById('res-pride').textContent = prideScore;
    document.getElementById('res-minus').textContent = minusScore;

    const timeBonus = victory ? gameTimer * 2 : 0;
    document.getElementById('res-time').textContent = `+${timeBonus}`;

    const total = (prideScore - minusScore) + timeBonus;
    document.getElementById('res-total').textContent = total;

    saveHighScore(playerName, selectedCharacter.name, prideScore - minusScore, total);

    goToScreen('screen-victory');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function getLocalScores() {
    try {
        return JSON.parse(localStorage.getItem('hhs_high_scores') || '[]');
    } catch (e) {
        return [];
    }
}

function saveHighScore(name, char, pride, total) {
    // Local backup
    let scores = getLocalScores();
    scores.push({ name, char, pride, total, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.total - a.total);
    if (scores.length > 15) scores = scores.slice(0, 15);
    localStorage.setItem('hhs_high_scores', JSON.stringify(scores));

    // Online leaderboard
    if (db) {
        db.collection('scores').add({
            name: String(name).slice(0, 40),
            char: String(char),
            pride: pride,
            total: total,
            date: new Date().toLocaleDateString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error("Could not save online score:", err));
    }
}

async function renderLeaderboardTable() {
    const tbody = document.getElementById('leaderboard-tbody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Loading scores...</td></tr>`;

    let scores = [];
    if (db) {
        try {
            const snap = await db.collection('scores').orderBy('total', 'desc').limit(15).get();
            scores = snap.docs.map(d => d.data());
        } catch (e) {
            console.error("Could not load online scores:", e);
            scores = getLocalScores();
        }
    } else {
        scores = getLocalScores();
    }

    tbody.innerHTML = '';
    if (scores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No scores recorded yet. Play a level!</td></tr>`;
        return;
    }

    scores.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${idx + 1}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.char)}</td>
            <td style="color: #4ade80;">${s.pride}</td>
            <td style="color: #38bdf8; font-weight: bold;">${s.total}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveScoreAndReturn() {
    goToScreen('screen-menu');
}

let editorRows = 10;
let editorCols = 30;
let editorGrid = [];
let editorPersonas = {};
let editorPatrolSpeed = 1.0;
let selectedPaletteTile = 1;

const paletteItemsConfig = [
    { id: 1, name: 'Wall / Corridor', icon: '🧱', bg: '#334155' },
    { id: 0, name: 'Empty Floor', icon: '·', bg: '#1e293b' },
    { id: 2, name: 'Player Start', icon: 'S', bg: '#0284c7' },
    { id: 4, name: 'Books (+15)', icon: '📚', bg: '#d97706' },
    { id: 5, name: 'Rugby/Netball Ball (+10)', icon: '⚽', bg: '#16a34a' },
    { id: 6, name: 'Teacher / SLT Persona', icon: '👨‍🏫', bg: '#9333ea' },
    { id: 7, name: 'Bonus Star (+30)', icon: '⭐', bg: '#f59e0b' },
    { id: 8, name: 'Mascot Flag (Finish)', icon: '🏁', bg: '#dc2626' }
];

function openLevelEditorMenu() {
    const sel = document.getElementById('editor-level-select');
    sel.innerHTML = `<option value="NEW">+ Create New Level</option>`;
    levels.forEach((lvl, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = lvl.name;
        sel.appendChild(opt);
    });

    renderPalette();
    loadLevelIntoEditor("NEW");
    goToScreen('screen-editor');
}

function renderPalette() {
    const container = document.getElementById('palette-items');
    container.innerHTML = '';
    paletteItemsConfig.forEach(item => {
        const div = document.createElement('div');
        div.className = `palette-item ${selectedPaletteTile === item.id ? 'active' : ''}`;
        div.innerHTML = `
            <div class="palette-icon" style="background: ${item.bg};">${item.icon}</div>
            <span style="font-size: 0.85rem;">${item.name}</span>
        `;
        div.onclick = () => {
            selectedPaletteTile = item.id;
            renderPalette();
        };
        container.appendChild(div);
    });
}

function loadLevelIntoEditor(val) {
    if (val === "NEW") {
        document.getElementById('edit-level-name').value = "New HHS Route";
        document.getElementById('edit-level-desc').value = "Corridor challenge";
        document.getElementById('edit-level-time').value = "90";
        document.getElementById('edit-patrol-speed').value = "1.0";
        document.getElementById('edit-grid-size').value = "30";
        editorCols = 30;
        editorRows = 10;
        editorPatrolSpeed = 1.0;
        editorGrid = [];
        editorPersonas = {};

        for (let r = 0; r < editorRows; r++) {
            editorGrid[r] = [];
            for (let c = 0; c < editorCols; c++) {
                editorGrid[r][c] = (r === 0 || r === editorRows - 1 || c === 0 || c === editorCols - 1) ? 1 : 0;
            }
        }
        editorGrid[1][1] = 2;
        editorGrid[editorRows - 2][editorCols - 2] = 8;
    } else {
        const lvl = levels[parseInt(val)];
        document.getElementById('edit-level-name').value = lvl.name;
        document.getElementById('edit-level-desc').value = lvl.description;
        document.getElementById('edit-level-time').value = lvl.timeLimit;
        document.getElementById('edit-patrol-speed').value = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;
        editorCols = lvl.cols;
        editorRows = lvl.rows;
        editorPatrolSpeed = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;
        document.getElementById('edit-grid-size').value = editorCols;
        editorGrid = JSON.parse(JSON.stringify(lvl.grid));
        editorPersonas = JSON.parse(JSON.stringify(lvl.personas || {}));
    }
    drawEditorCanvas();
}

let editorCursorX = 0;
let editorCursorY = 0;

function drawEditorCanvas() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const tileSize = Math.floor(canvas.width / editorCols);
    canvas.height = tileSize * editorRows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < editorRows; r++) {
        for (let c = 0; c < editorCols; c++) {
            const t = editorGrid[r][c];
            ctx.fillStyle = t === 1 ? '#334155' : '#1e293b';
            ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
            ctx.strokeStyle = '#0f172a';
            ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);

            const cx = c * tileSize + tileSize / 2;
            const cy = r * tileSize + tileSize / 2;

            if (t === 6) {
                const key = `${r}_${c}`;
                const p = editorPersonas[key];
                const photoImg = p && p.photo ? getOrLoadImage(p.photo) : null;

                if (photoImg && photoImg.complete && !photoImg.failed) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, tileSize * 0.4, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(photoImg, c * tileSize, r * tileSize, tileSize, tileSize);
                    ctx.restore();
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(cx, cy, tileSize * 0.4, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    ctx.font = `${Math.floor(tileSize * 0.7)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText((p && p.portrait) ? p.portrait : '👨‍🏫', cx, cy);
                }
            } else {
                let sym = '';
                if (t === 2) sym = 'S';
                if (t === 3) sym = 'S2';
                if (t === 4) sym = '📚';
                if (t === 5) sym = '⚽';
                if (t === 7) sym = '⭐';
                if (t === 8) sym = '🏁';

                if (sym) {
                    ctx.font = `${Math.floor(tileSize * 0.7)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(sym, cx, cy);
                }
            }
        }
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(editorCursorX * tileSize, editorCursorY * tileSize, tileSize, tileSize);
}

function canvasClick(e) {
    const canvas = document.getElementById('editorCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    const tileSize = canvas.width / editorCols;

    const c = Math.floor(clickX / tileSize);
    const r = Math.floor(clickY / tileSize);

    if (r >= 0 && r < editorRows && c >= 0 && c < editorCols) {
        editorCursorX = c;
        editorCursorY = r;

        if (editorGrid[r][c] === 6 && selectedPaletteTile === 6) {
            openPersonaModalForCoord(r, c);
        } else {
            editorGrid[r][c] = selectedPaletteTile;
            if (selectedPaletteTile === 6) {
                openPersonaModalForCoord(r, c);
            }
        }
        drawEditorCanvas();
    }
}

function changeGridSize() {
    const val = parseInt(document.getElementById('edit-grid-size').value);
    editorCols = val;
    editorRows = Math.floor(val * 0.4);
    editorGrid = [];
    for (let r = 0; r < editorRows; r++) {
        editorGrid[r] = [];
        for (let c = 0; c < editorCols; c++) {
            editorGrid[r][c] = (r === 0 || r === editorRows - 1 || c === 0 || c === editorCols - 1) ? 1 : 0;
        }
    }
    editorGrid[1][1] = 2;
    editorGrid[editorRows - 2][editorCols - 2] = 8;
    drawEditorCanvas();
}

function clearMapGrid() {
    for (let r = 0; r < editorRows; r++) {
        for (let c = 0; c < editorCols; c++) {
            editorGrid[r][c] = (r === 0 || r === editorRows - 1 || c === 0 || c === editorCols - 1) ? 1 : 0;
        }
    }
    editorPersonas = {};
    drawEditorCanvas();
}

let currentEditingCoordKey = null;
let tempSelectedPortrait = '👨‍🏫';
let tempSelectedPhoto = 'HB.webp';
let tempResponses = [];

function openPersonaModalForCoord(r, c) {
    currentEditingCoordKey = `${r}_${c}`;
    const persona = editorPersonas[currentEditingCoordKey] || {
        name: "Teacher / SLT",
        portrait: "👨‍🏫",
        photo: "HB.webp",
        prompt: "Good morning!",
        responses: [
            { text: "Good morning, Sir/Madam!", points: 20 },
            { text: "Ignore", points: -10 }
        ]
    };

    document.getElementById('p-name').value = persona.name;
    document.getElementById('p-prompt').value = persona.prompt;
    document.getElementById('p-custom-filename').value = persona.photo || '';
    tempSelectedPortrait = persona.portrait || '👨‍🏫';
    tempSelectedPhoto = persona.photo || 'HB.webp';
    tempResponses = JSON.parse(JSON.stringify(persona.responses || []));

    renderStaffPhotoGallery();
    renderPersonaResponsesList();
    document.getElementById('persona-modal').classList.add('active');
}

function renderStaffPhotoGallery() {
    const gallery = document.getElementById('p-photo-gallery');
    gallery.innerHTML = '';

    const files = appSettings.staffFiles && appSettings.staffFiles.length > 0 ? appSettings.staffFiles : ["HB.webp"];

    files.forEach(fileName => {
        const div = document.createElement('div');
        div.className = `photo-card ${tempSelectedPhoto === fileName ? 'selected' : ''}`;

        const img = document.createElement('img');
        img.src = getGitHubRawUrl(fileName);
        img.onerror = function () { img.src = 'https://placehold.co/100x100/1e293b/38bdf8?text=Staff'; };

        const span = document.createElement('span');
        span.textContent = fileName;

        div.appendChild(img);
        div.appendChild(span);

        div.onclick = function () {
            tempSelectedPhoto = fileName;
            document.getElementById('p-custom-filename').value = fileName;
            document.querySelectorAll('#p-photo-gallery .photo-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
        };

        gallery.appendChild(div);
    });
}

function previewCustomPhoto(val) {
    tempSelectedPhoto = val.trim();
    document.querySelectorAll('#p-photo-gallery .photo-card').forEach(c => c.classList.remove('selected'));
}

function selectPortrait(emoji, el) {
    tempSelectedPortrait = emoji;
    document.querySelectorAll('#p-portrait-list .card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
}

function renderPersonaResponsesList() {
    const container = document.getElementById('p-responses-container');
    container.innerHTML = '';
    tempResponses.forEach((resp, idx) => {
        const div = document.createElement('div');
        div.className = 'flex-row';
        div.style.marginBottom = '6px';
        div.innerHTML = `
            <input type="number" class="form-control" style="width: 80px;" value="${resp.points}" onchange="updateRespPoints(${idx}, this.value)">
            <input type="text" class="form-control" value="${resp.text}" onchange="updateRespText(${idx}, this.value)">
            <button class="btn btn-danger" style="padding: 6px 10px; margin:0;" onclick="removeRespOption(${idx})">X</button>
        `;
        container.appendChild(div);
    });
}

function addResponseOption() {
    tempResponses.push({ text: "Polite greeting", points: 15 });
    renderPersonaResponsesList();
}

function updateRespPoints(idx, val) {
    tempResponses[idx].points = parseInt(val) || 0;
}

function updateRespText(idx, val) {
    tempResponses[idx].text = val;
}

function removeRespOption(idx) {
    tempResponses.splice(idx, 1);
    renderPersonaResponsesList();
}

function savePersonaConfig() {
    if (!currentEditingCoordKey) return;
    editorPersonas[currentEditingCoordKey] = {
        name: document.getElementById('p-name').value,
        portrait: tempSelectedPortrait,
        photo: tempSelectedPhoto || document.getElementById('p-custom-filename').value.trim(),
        prompt: document.getElementById('p-prompt').value,
        responses: tempResponses
    };
    closePersonaModal();
    drawEditorCanvas();
}

function closePersonaModal() {
    document.getElementById('persona-modal').classList.remove('active');
}

function saveCurrentLevel() {
    const selVal = document.getElementById('editor-level-select').value;
    const lvlData = {
        id: selVal === "NEW" ? 'custom_' + Date.now() : levels[parseInt(selVal)].id,
        name: document.getElementById('edit-level-name').value,
        description: document.getElementById('edit-level-desc').value,
        cols: editorCols,
        rows: editorRows,
        grid: editorGrid,
        timeLimit: parseInt(document.getElementById('edit-level-time').value) || 90,
        patrolSpeed: parseFloat(document.getElementById('edit-patrol-speed').value) || 1.0,
        personas: editorPersonas
    };

    if (selVal === "NEW") {
        levels.push(lvlData);
    } else {
        levels[parseInt(selVal)] = lvlData;
    }

    localStorage.setItem('hhs_custom_levels', JSON.stringify(levels));
    showMessageBox("Level saved successfully!");
}

function exportLevelJSON() {
    const lvlData = {
        name: document.getElementById('edit-level-name').value,
        description: document.getElementById('edit-level-desc').value,
        cols: editorCols,
        rows: editorRows,
        grid: editorGrid,
        timeLimit: parseInt(document.getElementById('edit-level-time').value) || 90,
        patrolSpeed: parseFloat(document.getElementById('edit-patrol-speed').value) || 1.0,
        personas: editorPersonas
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lvlData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", "hhs_level.json");
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
}

function importLevelJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const lvl = JSON.parse(evt.target.result);
            document.getElementById('edit-level-name').value = lvl.name || "Imported Route";
            document.getElementById('edit-level-desc').value = lvl.description || "";
            document.getElementById('edit-level-time').value = lvl.timeLimit || 90;
            document.getElementById('edit-patrol-speed').value = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;
            editorCols = lvl.cols || 30;
            editorRows = lvl.rows || 10;
            document.getElementById('edit-grid-size').value = editorCols;
            editorGrid = lvl.grid;
            editorPersonas = lvl.personas || {};
            drawEditorCanvas();
            showMessageBox("Level JSON imported successfully!");
        } catch (err) {
            showMessageBox("Error parsing level JSON file.");
        }
    };
    reader.readAsText(file);
}