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
    githubUsername: "grahampearl",
    githubRepo: "hhs-game",
    branch: "main",
    photosFolder: "staff-photos",
    teacher: 0, // 1 = teacher mode (Level Editor + Select Level visible), 0 = learner mode
    staffFiles: [
        "HB.webp",
        "teacher1.png",
        "teacher2.jpg",
        "slt_member.webp"
    ]
};

// Teacher name to filepath mapping (linked with teachers.json)
let teacherPathMapping = {
    "Mr. van der Merwe": "staff-photos/HB.webp",
    "Mrs. Dube (SLT)": "staff-photos/teacher1.png",
    "Mr. Pillay": "staff-photos/teacher2.jpg",
    "SLT Member": "staff-photos/slt_member.webp"
};

const imageCache = {};

function getGitHubRawUrl(filename) {
    if (!filename) return '';
    if (filename.startsWith('data:') || filename.startsWith('http://') || filename.startsWith('https://')) {
        return filename;
    }
    const cleanPath = filename.replace(/^staff-photos\//, '');
    const folder = appSettings.photosFolder ? `${appSettings.photosFolder.replace(/\/$/, '')}/` : '';
    return `https://raw.githubusercontent.com/${appSettings.githubUsername}/${appSettings.githubRepo}/${appSettings.branch}/${folder}${encodeURI(cleanPath)}`;
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

/* ---------- Teacher mode ("teacher": 1 or 0 in settings.json) ---------- */
function isTeacherMode() {
    return Number(appSettings.teacher) === 1;
}

function applyTeacherMode() {
    document.body.classList.toggle('teacher-mode', isTeacherMode());
    if (!isTeacherMode() && (currentScreen === 'screen-editor' || currentScreen === 'screen-level-select')) {
        goToScreen('screen-menu');
    }
}

// Load settings.json from the site. Order of priority:
// built-in defaults < settings.json < settings saved on this device (Settings modal)
async function loadSettingsFile() {
    try {
        const res = await fetch('settings.json', { cache: 'no-store' });
        if (res.ok) {
            const fileData = await res.json();
            let stored = {};
            try { stored = JSON.parse(localStorage.getItem('hhs_game_settings') || '{}'); } catch (e) { }
            appSettings = Object.assign(appSettings, fileData, stored);
        }
    } catch (e) {
        console.warn('Could not load settings.json, using built-in/local settings.', e);
    }
    applyTeacherMode();
}

function openSettingsModal() {
    document.getElementById('cfg-username').value = appSettings.githubUsername;
    document.getElementById('cfg-repo').value = appSettings.githubRepo;
    document.getElementById('cfg-branch').value = appSettings.branch;
    document.getElementById('cfg-folder').value = appSettings.photosFolder;
    document.getElementById('cfg-files').value = appSettings.staffFiles.join(', ');
    document.getElementById('cfg-teacher').value = isTeacherMode() ? '1' : '0';
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
    appSettings.teacher = Number(document.getElementById('cfg-teacher').value) === 1 ? 1 : 0;

    localStorage.setItem('hhs_game_settings', JSON.stringify(appSettings));
    applyTeacherMode();
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
            applyTeacherMode();
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

// Sad "wah wah wah waaah" for finishing without positive points
function playSadSound() {
    try {
        initAudio();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const t0 = audioCtx.currentTime;
        const notes = [[392, 0.0, 0.30], [370, 0.35, 0.30], [349, 0.70, 0.30], [330, 1.05, 0.90]];
        notes.forEach(([freq, offset, dur], i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const s = t0 + offset;
            osc.frequency.setValueAtTime(freq, s);
            if (i === notes.length - 1) osc.frequency.exponentialRampToValueAtTime(freq * 0.75, s + dur);
            gain.gain.setValueAtTime(0.0001, s);
            gain.gain.exponentialRampToValueAtTime(0.18, s + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
            osc.start(s);
            osc.stop(s + dur + 0.05);
        });
    } catch (e) { }
}

function playSound(type) {
    try {
        initAudio();
        if (!audioCtx) return;
        if (type === 'sad') { playSadSound(); return; }
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
        id: "a_block_bottom_floor",
        name: "A Block Bottom Floor",
        description: "Corridor challenge",
        cols: 30,
        rows: 10,
        patrolSpeed: 0.8,
        speedAdvantage: 1,
        characterSpeeds: {"learner":1.2},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 11, 1, 0, 10, 0, 0, 1, 6, 0, 0, 1, 11, 1, 0, 0, 0, 13, 1, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1],
            [1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 4, 1],
            [1, 0, 6, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 13, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 7, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 8, 1],
            [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 6, 1, 0, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1],
            [1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 9, 1, 0, 4, 0, 12, 0, 1, 0, 1, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 70,
        personas: {
            "6_11": {
                "name": "Grade Controllers",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/grade_controllers_1.JPG",
                "prompt": "Welcome to Hillcrest High School, aren't you supposed to be in class?",
                "responses": [
                    {
                        "text": "Good morning, Sir and Ma'am! Going there now.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -15
                    },
                    {
                        "text": "Going there now!",
                        "points": -5
                    }
                ]
            },
            "4_2": {
                "name": "Luke Whittle (Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/luke_whittle_head_boy.JPG",
                "prompt": "Good morning! Is that how a Hillcrest learner should look?",
                "responses": [
                    {
                        "text": "Good morning! Sorry, I will fix it.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Run Away)",
                        "points": -15
                    },
                    {
                        "text": "Sorry I will fix it soon.",
                        "points": 5
                    }
                ]
            },
            "6_25": {
                "name": "Mr Ndebele (Deputy Principal)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_ndebele_deputy_principal.JPG",
                "prompt": "Good morning, where are you going?",
                "responses": [
                    {
                        "text": "Good morning Mr. Ndebele just going to class.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Cannot hear you!",
                        "points": -20
                    },
                    {
                        "text": "Going to class sir.",
                        "points": 5
                    }
                ]
            },
            "1_18": {
                "name": "Tamuka Chovuchovu (Deputy Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/tamuka_chovuchovu_deputy_head_boy.JPG",
                "prompt": "Good morning, how are you doing?",
                "responses": [
                    {
                        "text": "Good morning. I am doing good and you?",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -15
                    },
                    {
                        "text": "Good morning. I am doing good.",
                        "points": 10
                    },
                    {
                        "text": "Sorry I have to rush to class can't talk.",
                        "points": -8
                    }
                ]
            }
        }
    },
        {
        id: "a_block_middle_floor",
        name: "A Block Middle Floor",
        description: "Corridor challenge",
        cols: 30,
        rows: 10,
        patrolSpeed: 1,
        speedAdvantage: 1,
        characterSpeeds: {"soccer":1.2},
        grid: [
            [1, 1, 1, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 1, 1, 1],
            [1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1],
            [1, 1, 0, 1, 0, 1, 1, 9, 10, 0, 0, 1, 1, 0, 0, 12, 0, 0, 1, 0, 0, 0, 4, 1, 1, 6, 0, 0, 1, 1],
            [1, 0, 10, 1, 0, 6, 1, 12, 13, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 11, 1, 1, 7, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 11, 1, 0, 0, 0, 1, 1, 0, 1, 6, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0, 9, 1, 0, 1, 0, 1, 0, 1, 0, 1, 10, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1],
            [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 4, 1, 0, 6, 1, 1, 1, 0, 1, 0, 1, 0, 1],
            [1, 13, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 70,
        personas: {
            "7_20": {
                "name": "Rylan Leask (Deputy Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/rylan-leask_deputy_head_boy.JPG",
                "prompt": "Good morning why are you not at break?",
                "responses": [
                    {
                        "text": "I need to ask my grade controllers about something.",
                        "points": 15
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "I don't feel like being at break.",
                        "points": -5
                    },
                    {
                        "text": "I just need to ask a teacher something.",
                        "points": 8
                    }
                ]
            },
            "3_5": {
                "name": "Teachers",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/Woodrow.JPG",
                "prompt": "Good morning!",
                "responses": [
                    {
                        "text": "Good morning, ma'ams hope you are having a good day!",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Hello!",
                        "points": 8
                    },
                    {
                        "text": "(Walk away)",
                        "points": -15
                    }
                ]
            },
            "2_25": {
                "name": "Ms Zulu (Commerce Teacher)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/ms_zulu_commerce.JPG",
                "prompt": "Good morning how are you?",
                "responses": [
                    {
                        "text": "Good morning, Miss Zulu!  I am doing good and you?",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Run Away)",
                        "points": -20
                    },
                    {
                        "text": "Good morning Miss Zulu! I am doing good.",
                        "points": 10
                    },
                    {
                        "text": "Good Morning Miss Zulu!",
                        "points": 5
                    }
                ]
            },
            "5_12": {
                "name": "Ziyanda Mabhida (Deputy Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/ziyanda_mabhida_deputy_head_girl.JPG",
                "prompt": "Good morning! Where is your blazer?",
                "responses": [
                    {
                        "text": "Good morning! I just had it in my bag, here it is.",
                        "points": 15
                    },
                    {
                        "text": "(Ignore)",
                        "points": -15
                    },
                    {
                        "text": "Sorry I forgot it at home I will bring it to school tomorrow.",
                        "points": 10
                    },
                    {
                        "text": "Sorry I do not have it right now.",
                        "points": 0
                    }
                ]
            }
        }
    },
        {
        id: "b_block_middle_floor",
        name: "B Block Middle Floor",
        description: "Corridor challenge",
        cols: 30,
        rows: 10,
        patrolSpeed: 0.7,
        speedAdvantage: 1.1,
        characterSpeeds: {"library":1.2,"drama":1.2},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 10, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 7, 0, 0, 12, 0, 1, 11, 1, 1, 1, 1, 0, 0, 0, 13, 0, 1],
            [1, 6, 1, 0, 1, 1, 4, 0, 1, 0, 1, 1, 0, 1, 6, 0, 1, 0, 1, 0, 1, 4, 0, 1, 0, 1, 1, 1, 1, 1],
            [1, 0, 1, 0, 9, 1, 0, 1, 1, 0, 0, 0, 4, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 10, 0, 1, 4, 4, 1],
            [1, 13, 13, 1, 0, 1, 0, 1, 11, 0, 1, 1, 0, 0, 0, 0, 10, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 4, 4, 1],
            [1, 12, 12, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1],
            [1, 0, 1, 1, 1, 1, 0, 0, 0, 9, 1, 1, 1, 0, 0, 1, 0, 0, 1, 9, 0, 1, 6, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 1, 11, 0, 1, 6, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 9, 0, 12, 1, 0, 1],
            [1, 0, 8, 1, 0, 4, 0, 1, 13, 1, 2, 0, 0, 10, 0, 0, 1, 0, 0, 0, 11, 1, 0, 0, 0, 0, 1, 8, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 80,
        personas: {
            "2_14": {
                "name": "Mr Moore (History Teacher)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_moore_history.JPG",
                "prompt": "Good evening why are you over here?",
                "responses": [
                    {
                        "text": "Good evening Mr. Moore I came to go to the library.",
                        "points": 20
                    },
                    {
                        "text": "I don't know",
                        "points": -10
                    },
                    {
                        "text": "Good evening, I just came to go to ask a teacher about something.",
                        "points": 8
                    }
                ]
            },
            "2_1": {
                "name": "Mr Joseph (IT Teacher)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_joseph_it.JPG",
                "prompt": "Good afternoon how are you?",
                "responses": [
                    {
                        "text": "Good afternoon, Sir I am good and you? ",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Good afternoon Sir I am going to the computer room.",
                        "points": 10
                    },
                    {
                        "text": "I can't hear you!",
                        "points": -15
                    }
                ]
            },
            "6_22": {
                "name": "Isabella te Brugge (Deputy Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/isabella_te_brugge_deputy_head.JPG",
                "prompt": "Good evening, why are you not at lessons?",
                "responses": [
                    {
                        "text": "Good evening, I just need to fetch some books. Here is the teacher's card.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -8
                    },
                    {
                        "text": "(Run Away)",
                        "points": -20
                    },
                    {
                        "text": "Good evening, I just needed to do something for the teacher.",
                        "points": 10
                    }
                ]
            },
            "7_6": {
                "name": "Jorja Pretorius (Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/jorja_pretorius_head_girl.JPG",
                "prompt": "Good afternoon, you seem to be using the wrong school bag.",
                "responses": [
                    {
                        "text": "Good morning! Thank you, I will fix it tomorrow.",
                        "points": 10
                    },
                    {
                        "text": "Ignore",
                        "points": -10
                    },
                    {
                        "text": "I have a note from the grade controllers it is just for today.",
                        "points": 15
                    },
                    {
                        "text": "I'm sure it is fine.",
                        "points": -15
                    }
                ]
            }
        }
    },
    {
        id: "b_block_bottom_floor",
        name: "B Block Bottom Floor",
        description: "Roof Challenge",
        cols: 24,
        rows: 9,
        patrolSpeed: 0.9,
        speedAdvantage: 1,
        characterSpeeds: {"rugby":1.2,"netball":1.2},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 0, 1, 0, 0, 5, 0, 1, 0, 1, 6, 0, 0, 0, 1, 0, 0, 0, 1, 4, 1, 0, 1],
            [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 11, 1, 0, 1, 0, 6, 0, 0, 0, 1],
            [1, 0, 1, 1, 9, 0, 1, 0, 0, 0, 1, 12, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 13, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 13, 1],
            [1, 0, 1, 6, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 9, 1, 0, 1, 1],
            [1, 0, 1, 0, 1, 1, 12, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
            [1, 4, 1, 0, 2, 1, 0, 1, 1, 11, 1, 6, 1, 0, 1, 0, 5, 0, 0, 0, 0, 1, 8, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 65,
        personas: {
            "5_3": {
                "name": "Mrs Ramsern (Geography Teacher)",
                "role": "teacher",
                "portrait": "👩‍🏫",
                "photo": "Teachers/mrs_ramsern_geography.JPG",
                "prompt": "Good afternoon! Is that how a Hillcrest learner should look?",
                "responses": [
                    {
                        "text": "Good morning! Thank you, I will fix it now.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Yes it is.",
                        "points": -15
                    },
                    {
                        "text": "Sorry ma'am I will fix it now.",
                        "points": 10
                    }
                ]
            },
            "2_19": {
                "name": "Mrs Knight (Principal)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mrs_knight_principal.jpg",
                "prompt": "Good morning!",
                "responses": [
                    {
                        "text": "Good morning, ma'am! I hope your day is going well.",
                        "points": 15
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Run Past)",
                        "points": -15
                    },
                    {
                        "text": "Good morning ma'am.",
                        "points": 5
                    }
                ]
            },
            "7_11": {
                "name": "Ziyanda Mabhid (Deputy Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/ziyanda_mabhida_deputy_head_girl.JPG",
                "prompt": "Good afternoon, how is your day going?",
                "responses": [
                    {
                        "text": "Good afternoon ma'am my day is going well, and yours?",
                        "points": 15
                    },
                    {
                        "text": "Ignore",
                        "points": -10
                    },
                    {
                        "text": "Great and yours?",
                        "points": 5
                    }
                ]
            },
            "1_11": {
                "name": "Luke Whittle (Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/luke_whittle_head_boy.JPG",
                "prompt": "Good morning! Please make sure you do not run in the hallways.",
                "responses": [
                    {
                        "text": "Good morning! Sorry Sir I will slow down.",
                        "points": 20
                    },
                    {
                        "text": "Ignore",
                        "points": -10
                    },
                    {
                        "text": "(Continue Running)",
                        "points": -15
                    }
                ]
            }
        }
    },
    {
        id: "a_block_top_floor",
        name: "A Block Top Floor",
        description: "Corridor challenge",
        cols: 29,
        rows: 9,
        patrolSpeed: 0.85,
        speedAdvantage: 1,
        characterSpeeds: {"drama":1.2,"learner":1.1},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0, 9, 0, 0, 1, 10, 1],
            [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 5, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
            [1, 11, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 12, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 7, 1, 0, 1],
            [1, 6, 0, 0, 0, 0, 0, 0, 1, 0, 1, 6, 1, 0, 11, 0, 1, 0, 4, 0, 1, 13, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 13, 0, 0, 9, 0, 1, 0, 0, 0, 4, 0, 0, 0, 0, 0, 1, 0, 0, 6, 0, 0, 0, 8, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 75,
        personas: {
            "5_1": {
                "name": "Mrs Knight (Principal)",
                "role": "teacher",
                "portrait": "👩‍🏫",
                "photo": "Teachers/mrs_knight_principal.jpg",
                "prompt": "Good morning! Where are you off to in such a hurry?",
                "responses": [
                    {
                        "text": "Good morning, ma'am! I'm on my way to class.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Run Past)",
                        "points": -15
                    },
                    {
                        "text": "Good morning ma'am, going to class.",
                        "points": 8
                    }
                ]
            },
            "5_11": {
                "name": "Jorja Pretorius (Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/jorja_pretorius_head_girl.JPG",
                "prompt": "Good morning! Please make sure you look neat for assembly.",
                "responses": [
                    {
                        "text": "Good morning! Thank you, I'll fix it right now.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "It's fine.",
                        "points": -15
                    },
                    {
                        "text": "Sorry, I'll sort it out soon.",
                        "points": 5
                    }
                ]
            },
            "1_16": {
                "name": "Mr Joseph (IT Teacher)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_joseph_it.JPG",
                "prompt": "Good morning, are you ready for class?",
                "responses": [
                    {
                        "text": "Good morning, Sir! Yes, I am ready.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "I will be later.",
                        "points": -5
                    },
                    {
                        "text": "Good morning Sir, I just forgot my calculator at home.",
                        "points": 8
                    }
                ]
            },
            "7_23": {
                "name": "Tamuka Chovuchovu (Deputy Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/tamuka_chovuchovu_deputy_head_boy.JPG",
                "prompt": "Good morning! Please make sure you pick up litter if you see any.",
                "responses": [
                    {
                        "text": "Good morning! Yes Sir, I will pick up some now.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -12
                    },
                    {
                        "text": "Not my problem.",
                        "points": -18
                    },
                    {
                        "text": "Good morning! I will.",
                        "points": 10
                    }
                ]
            }
        }
    },
    {
        id: "c_block_bottom_floor",
        name: "C Block Bottom Floor",
        description: "Corridor challenge",
        cols: 29,
        rows: 9,
        patrolSpeed: 0.75,
        speedAdvantage: 1.1,
        characterSpeeds: {"rugby":1.2,"soccer":1.2,"netball":1.2},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 12, 0, 0, 1, 4, 13, 0, 6, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 6, 1, 0, 1, 1, 1, 0, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 1, 5, 1, 0, 6, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 5, 1],
            [1, 1, 1, 11, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 6, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 9, 0, 7, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 1, 1, 1, 1, 1, 0, 1, 4, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 1, 8, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 75,
        personas: {
            "3_10": {
                "name": "Mr Moore (History Teacher)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_moore_history.JPG",
                "prompt": "Good afternoon! Which class are you heading to?",
                "responses": [
                    {
                        "text": "Good afternoon, Mr. Moore! I'm going to my next lesson.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "I'm not sure.",
                        "points": -10
                    },
                    {
                        "text": "Afternoon Sir, going to class.",
                        "points": 8
                    }
                ]
            },
            "4_15": {
                "name": "Rylan Leask (Deputy Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/rylan-leask_deputy_head_boy.JPG",
                "prompt": "Good afternoon! Please don't run in the corridor.",
                "responses": [
                    {
                        "text": "Good afternoon! Thanks for the reminder, I'll make sure to walk.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Keep Running)",
                        "points": -15
                    },
                    {
                        "text": "Okay, sorry.",
                        "points": 5
                    }
                ]
            },
            "2_19": {
                "name": "Ms Zulu (Commerce Teacher)",
                "role": "teacher",
                "portrait": "👩‍🏫",
                "photo": "Teachers/ms_zulu_commerce.JPG",
                "prompt": "Good afternoon! Have you finished your homework?",
                "responses": [
                    {
                        "text": "Good afternoon, Miss Zulu! Yes, it's in my bag.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "I'll do it tonight.",
                        "points": -5
                    },
                    {
                        "text": "Good afternoon, I'm nearly finished and will hand it in tomorrow.",
                        "points": 8
                    }
                ]
            },
            "1_24": {
                "name": "Ziyanda Mabhida (Deputy Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/ziyanda_mabhida_deputy_head_girl.JPG",
                "prompt": "Good afternoon! How is your day going so far?",
                "responses": [
                    {
                        "text": "Good afternoon, ma'am! It's going well, and yours?",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Fine.",
                        "points": 0
                    },
                    {
                        "text": "Great, thank you!",
                        "points": 8
                    }
                ]
            }
        }
    },
    {
        id: "fish_pond_quad",
        name: "Fish Pond Quad",
        description: "Open-air challenge",
        cols: 29,
        rows: 9,
        patrolSpeed: 0.9,
        speedAdvantage: 1,
        characterSpeeds: {"library":1.2,"drama":1.1},
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 0, 0, 0, 0, 1, 0, 4, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 6, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 6, 1, 6, 0, 0, 0, 0, 1, 0, 6, 0, 1, 0, 0, 0, 5, 0, 0, 0, 0, 11, 1],
            [1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 12, 1, 0, 7, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 8, 1],
            [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 13, 1, 0, 1],
            [1, 0, 0, 7, 0, 1, 0, 0, 0, 0, 0, 0, 9, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 6, 0, 5, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        timeLimit: 80,
        personas: {
            "3_7": {
                "name": "Mr Ndebele (Deputy Principal)",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/mr_ndebele_deputy_principal.JPG",
                "prompt": "Good morning! The bell has rung, shouldn't you be in class?",
                "responses": [
                    {
                        "text": "Good morning, Mr. Ndebele! I'm heading there right now.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Cannot hear you!",
                        "points": -20
                    },
                    {
                        "text": "Going to class, Sir.",
                        "points": 5
                    }
                ]
            },
            "3_9": {
                "name": "Mrs Ramsern (Geography Teacher)",
                "role": "teacher",
                "portrait": "👩‍🏫",
                "photo": "Teachers/mrs_ramsern_geography.JPG",
                "prompt": "Good morning! Please make sure you put your rubbish in the bin.",
                "responses": [
                    {
                        "text": "Good morning, ma'am! Of course, I'll use the bin.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Walk Away)",
                        "points": -15
                    },
                    {
                        "text": "Sorry ma'am, I will.",
                        "points": 8
                    }
                ]
            },
            "3_16": {
                "name": "Luke Whittle (Head Boy)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/luke_whittle_head_boy.JPG",
                "prompt": "Good morning! Do you have your school bag and blazer today?",
                "responses": [
                    {
                        "text": "Good morning! Yes, I have everything I need.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "Not really.",
                        "points": -8
                    },
                    {
                        "text": "Good morning, I left my blazer at home but will bring it tomorrow.",
                        "points": 8
                    }
                ]
            },
            "2_21": {
                "name": "Isabella te Brugge (Deputy Head Girl)",
                "role": "slt",
                "portrait": "👩‍🏫",
                "photo": "SLT/isabella_te_brugge_deputy_head.JPG",
                "prompt": "Good morning! Are you excited to be a Hillcrest High learner?",
                "responses": [
                    {
                        "text": "Good morning! Yes, I'm very proud to wear the uniform.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -10
                    },
                    {
                        "text": "(Run Away)",
                        "points": -15
                    },
                    {
                        "text": "Good morning, yes I am.",
                        "points": 8
                    }
                ]
            },
            "7_25": {
                "name": "Grade Controllers",
                "role": "teacher",
                "portrait": "👨‍🏫",
                "photo": "Teachers/grade_controllers_1.JPG",
                "prompt": "Good morning! Do you have a pass to be outside right now?",
                "responses": [
                    {
                        "text": "Good morning, Sir and Ma'am! Yes, here is my pass.",
                        "points": 20
                    },
                    {
                        "text": "(Ignore)",
                        "points": -15
                    },
                    {
                        "text": "What pass?",
                        "points": -8
                    },
                    {
                        "text": "Good morning, I'm just going to class.",
                        "points": 5
                    }
                ]
            }
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
let selectedCharacter = { id: 'rugby', name: 'Rugby Player', icon: '🏉', matchType: 5 };
let playerName = 'Alex Smith';
let playerGrade = '7';
let playerSchool = 'Hillcrest Primary School';
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
let currentSpeedAdvantage = 1.0;
let lastMoveTime = 0;

function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;

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
    if (id === 'rugby') selectedCharacter = { id, name: 'Rugby Player', icon: '🏉', matchType: 5 };
    if (id === 'soccer') selectedCharacter = { id, name: 'Soccer Player', icon: '⚽', matchType: 5 };
    if (id === 'netball') selectedCharacter = { id, name: 'Netball Player', icon: '🏐', matchType: 5 };
    if (id === 'library') selectedCharacter = { id, name: 'Library Assistant', icon: '📚', matchType: 4 };
    if (id === 'drama') selectedCharacter = { id, name: 'Drama Student', icon: '🎤', matchType: 7 };
    if (id === 'learner') selectedCharacter = { id, name: 'Basic Learner', icon: '🎒', matchType: 0 };
}

function startSelectedGame() {
    document.getElementById('name-modal').classList.add('active');
}

function confirmPlayerName() {
    const name = document.getElementById('player-name-input').value.trim();
    const grade = document.getElementById('player-grade-input').value.trim();
    const school = document.getElementById('player-school-input').value.trim();
    if (name) playerName = name;
    if (grade) playerGrade = grade;
    if (school) playerSchool = school;
    document.getElementById('name-modal').classList.remove('active');

    // Play Game runs the default levels one after another
    const defaults = getDefaultLevelIndices();
    launchGameLevel(defaults.length ? defaults[0] : 0);
}

function openLevelSelectForPlay() {
    if (!isTeacherMode()) return;
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
            <p style="font-size: 0.75rem; color: #38bdf8; margin-bottom: 8px;">Patrol Speed: ${lvl.patrolSpeed || 1.0}s | Speed Boost: ${lvl.speedAdvantage || 1.0}x</p>
            <button class="btn btn-success" style="font-size: 0.85rem; padding: 6px 12px;" onclick="launchGameLevel(${idx})">Play Level</button>
        `;
        grid.appendChild(div);
    });
}

function launchGameLevel(index, continueRun) {
    if (!continueRun || !run) {
        beginRun();
        prideScore = 0;
        minusScore = 0;
    }
    currentLevelIndex = index;
    const lvl = levels[index];
    currentMapGrid = JSON.parse(JSON.stringify(lvl.grid));
    currentPersonas = JSON.parse(JSON.stringify(lvl.personas || {}));
    currentPatrolSpeed = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;
    currentSpeedAdvantage = lvl.speedAdvantage !== undefined ? lvl.speedAdvantage : 1.0;

    gameTimer = lvl.timeLimit || 90;
    document.getElementById('interact-btn').style.display = 'none';

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

    document.getElementById('hud-level-name').textContent = lvl.name || `Level ${index + 1}`;
    document.getElementById('hud-char').textContent = `${playerName} (${selectedCharacter.name})`;
    document.getElementById('hud-patrol-speed').textContent = `${currentPatrolSpeed}s (${currentSpeedAdvantage}x Boost)`;
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
    gameRunning = false;
    // Save the current learner's progress before clearing (people may need to be ended early)
    saveRunScore('reset');
    if (timerInterval) clearInterval(timerInterval);
    if (patrolInterval) clearInterval(patrolInterval);
    window.removeEventListener('keydown', handleGameKeydown);

    document.getElementById('dialogue-modal').classList.remove('active');
    document.getElementById('interact-btn').style.display = 'none';

    playerX = 1;
    playerY = 1;
    prideScore = 0;
    minusScore = 0;
    gameTimer = 0;
    run = null;
    victoryNextIndex = -1;
    activeEntities = [];
    currentMapGrid = [];
    currentPersonas = {};
    updateHudScore();
    updateTimerDisplay();

    goToScreen('screen-menu');
}

function showSpecialPopup(text, emoji) {
    const popup = document.getElementById('special-popup');
    popup.innerHTML = `${emoji} ${text}`;
    popup.classList.add('show');
    setTimeout(() => {
        popup.classList.remove('show');
    }, 1000); // exactly 1 second on screen
}

function updateTeacherPatrols() {
    if (!gameRunning) return;
    const lvl = levels[currentLevelIndex];
    const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    let movedAny = false;

    activeEntities.forEach(ent => {
        if (ent.type === 6 && !ent.interacted) {
            const shuffled = [...directions].sort(() => Math.random() - 0.5);
            for (let d of shuffled) {
                const nx = ent.x + d.dx;
                const ny = ent.y + d.dy;

                if (nx >= 0 && nx < lvl.cols && ny >= 0 && ny < lvl.rows) {
                    if (currentMapGrid[ny][nx] !== 1) {
                        const occupant = activeEntities.find(e => !e.interacted && e.x === nx && e.y === ny && e !== ent);
                        if (!occupant && currentMapGrid[ny][nx] !== 8) {
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
    
    // Player movement speed limit / throttle enforcement based on speed advantage
    const now = Date.now();
    const speedDelay = Math.max(80, 180 / (currentSpeedAdvantage || 1.0));
    if (now - lastMoveTime < speedDelay && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','s','a','d','W','S','A','D'].includes(e.key)) {
        return;
    }

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
            lastMoveTime = now;
            playerX = nx;
            playerY = ny;
            playSound('step');

            if (currentMapGrid[ny][nx] === 8) {
                endGame(true, "Congratulations! You won successfully");
                return;
            }

            const ent = activeEntities.find(en => !en.interacted && en.x === playerX && en.y === playerY);
            if (ent) {
                if (ent.type === 4) { // Books
                    let pts = 15;
                    if (selectedCharacter.id === 'library') {
                        pts += 20; // Bonus points for Library Assistant picking up books!
                        showSpecialPopup("Library Assistant Bonus +20 Pts!", "📚");
                    } else {
                        showSpecialPopup("Collected Books +15 Pts", "📚");
                    }
                    prideScore += pts;
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 5) { // Ball (Rugby/Soccer/Netball)
                    let pts = 10;
                    if (selectedCharacter.id === 'soccer' || selectedCharacter.id === 'rugby' || selectedCharacter.id === 'netball') {
                        pts += 15; // Bonus points for sports players picking up balls!
                        showSpecialPopup(`${selectedCharacter.name} Ball Bonus +15 Pts!`, selectedCharacter.icon);
                    } else {
                        showSpecialPopup("Collected Sports Ball +10 Pts", "⚽");
                    }
                    prideScore += pts;
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 7) { // Star
                    prideScore += 30;
                    showSpecialPopup("Pride Star Bonus +30 Pts!", "⭐");
                    playSound('success');
                    ent.interacted = true;
                    updateHudScore();
                } else if (ent.type === 6) {
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

    const photoPath = persona.photo || teacherPathMapping[persona.name] || "HB.webp";
    if (photoPath) {
        const img = document.createElement('img');
        img.src = getGitHubRawUrl(photoPath);
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

    // Create a copy and shuffle responses so positive answers aren't fixed to top/bottom
    const shuffledResponses = [...persona.responses].sort(() => Math.random() - 0.5);

    shuffledResponses.forEach(resp => {
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
            const photoFile = p && (p.photo || teacherPathMapping[p.name]) ? (p.photo || teacherPathMapping[p.name]) : null;
            const photoImg = photoFile ? getOrLoadImage(photoFile) : null;

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

// ---- A "run" is one play-through; score carries over between levels ----
let run = null; // { id, timeBonus, completed: [levelIds], saved }
let victoryNextIndex = -1;

function beginRun() {
    run = {
        id: 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        timeBonus: 0,
        completed: [],
        saved: false
    };
}

function hasPositivePoints() {
    return (prideScore - minusScore) > 0;
}

function getDefaultLevelIndices() {
    const ids = defaultLevels.map(l => l.id);
    const out = [];
    levels.forEach((l, i) => { if (ids.includes(l.id)) out.push(i); });
    return out;
}

function nextDefaultLevelIndex(fromIndex) {
    const defaults = getDefaultLevelIndices();
    if (!defaults.includes(fromIndex)) return -1;
    const next = defaults.find(i => i > fromIndex && !run.completed.includes(levels[i].id));
    return next === undefined ? -1 : next;
}

function allDefaultsCompleted() {
    const ids = getDefaultLevelIndices().map(i => levels[i].id);
    return ids.length > 0 && ids.every(id => run.completed.includes(id));
}

function saveRunScore(result) {
    if (!run || run.saved) return;
    run.saved = true;
    const net = prideScore - minusScore;
    saveHighScore({
        name: playerName,
        grade: playerGrade,
        school: playerSchool,
        char: selectedCharacter.name,
        pride: net,
        total: net + run.timeBonus,
        levelsCompleted: run.completed.length,
        result: result
    });
}

function endGame(victory, message) {
    gameRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    if (patrolInterval) clearInterval(patrolInterval);
    window.removeEventListener('keydown', handleGameKeydown);
    if (!run) beginRun();

    const lvl = levels[currentLevelIndex];
    run.timeBonus += victory ? gameTimer * 2 : 0;
    if (victory && lvl && !run.completed.includes(lvl.id)) run.completed.push(lvl.id);

    const nextIndex = victory ? nextDefaultLevelIndex(currentLevelIndex) : -1;
    const allDone = victory && nextIndex === -1 && allDefaultsCompleted();
    const total = (prideScore - minusScore) + run.timeBonus;
    victoryNextIndex = nextIndex;

    const btn = document.getElementById('victory-action-btn');
    if (nextIndex !== -1) {
        document.getElementById('victory-title').textContent = "Level Completed!";
        document.getElementById('victory-subtitle').textContent = `${message} Next up: ${levels[nextIndex].name}`;
        document.getElementById('res-total-label').textContent = "Total Score So Far:";
        btn.textContent = "Next Level ▶";
    } else {
        document.getElementById('victory-title').textContent = victory ? (allDone ? "All Levels Completed!" : "Level Completed!") : "Game Over";
        document.getElementById('victory-subtitle').textContent = message;
        document.getElementById('res-total-label').textContent = "Final Score:";
        btn.textContent = "Save Score & Menu";
        saveRunScore(victory ? 'completed' : 'time-up');
    }

    document.getElementById('res-name').textContent = playerName;
    document.getElementById('res-school').textContent = playerSchool;
    document.getElementById('res-grade').textContent = formatGrade(playerGrade);
    document.getElementById('res-char').textContent = selectedCharacter.name;
    document.getElementById('res-pride').textContent = prideScore;
    document.getElementById('res-minus').textContent = minusScore;
    document.getElementById('res-time').textContent = `+${run.timeBonus}`;
    document.getElementById('res-total').textContent = total;

    goToScreen('screen-victory');

    if (nextIndex === -1) {
        if (allDone && typeof showBellWin === 'function') showBellWin();
        else if (!hasPositivePoints()) playSound('sad');
    }
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

function formatGrade(g) {
    const s = (g === undefined || g === null) ? '' : String(g).trim();
    if (!s) return '-';
    return /^grade\b/i.test(s) ? s : `Grade ${s}`;
}

function saveHighScore(entry) {
    const record = {
        name: String(entry.name || 'Unknown').slice(0, 40),
        grade: String(entry.grade || '').slice(0, 20),
        school: String(entry.school || '').slice(0, 60),
        char: String(entry.char || ''),
        pride: Math.round(Number(entry.pride) || 0),
        total: Math.round(Number(entry.total) || 0),
        levelsCompleted: Math.round(Number(entry.levelsCompleted) || 0),
        result: String(entry.result || 'completed'),
        date: new Date().toLocaleDateString()
    };

    let scores = getLocalScores();
    scores.push(record);
    scores.sort((a, b) => b.total - a.total);
    if (scores.length > 15) scores = scores.slice(0, 15);
    localStorage.setItem('hhs_high_scores', JSON.stringify(scores));

    if (db) {
        db.collection('scores').add(Object.assign({}, record, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })).catch(err => console.error("Could not save online score (check Firestore rules):", err.code, err.message));
    }
}

async function renderLeaderboardTable() {
    const tbody = document.getElementById('leaderboard-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Loading scores...</td></tr>`;

    let scores = [];
    if (db) {
        try {
            const snap = await db.collection('scores').orderBy('total', 'desc').limit(15).get();
            scores = snap.docs.map(d => d.data());
        } catch (e) {
            scores = getLocalScores();
        }
    } else {
        scores = getLocalScores();
    }

    tbody.innerHTML = '';
    if (scores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8;">No scores recorded yet. Play a level!</td></tr>`;
        return;
    }

    scores.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${idx + 1}</td>
            <td>${escapeHtml(s.name)}</td>
            <td>${s.school ? escapeHtml(s.school) : '-'}</td>
            <td>${escapeHtml(formatGrade(s.grade))}</td>
            <td>${escapeHtml(s.char)}</td>
            <td style="color: #4ade80;">${s.pride}</td>
            <td style="color: #38bdf8; font-weight: bold;">${s.total}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveScoreAndReturn() {
    run = null;
    goToScreen('screen-menu');
}

// Button on the results screen: next default level, or back to menu when the run is over
function victoryButtonClick() {
    if (victoryNextIndex >= 0) {
        const i = victoryNextIndex;
        victoryNextIndex = -1;
        launchGameLevel(i, true);
    } else {
        saveScoreAndReturn();
    }
}

let editorRows = 10;
let editorCols = 30;
let editorGrid = [];
let editorPersonas = {};
let editorPatrolSpeed = 1.0;
let editorSpeedAdvantage = 1.0;
let selectedPaletteTile = 1;

const paletteItemsConfig = [
    { id: 1, name: 'Wall / Corridor', icon: '🧱', bg: '#334155' },
    { id: 0, name: 'Empty Floor', icon: '·', bg: '#1e293b' },
    { id: 2, name: 'Player Start', icon: 'S', bg: '#0284c7' },
    { id: 4, name: 'Books (+15 / +20 Library)', icon: '📚', bg: '#d97706' },
    { id: 5, name: 'Ball (+10 / +25 Sports)', icon: '⚽', bg: '#16a34a' },
    { id: 6, name: 'Teacher / SLT Persona', icon: '👨‍🏫', bg: '#9333ea' },
    { id: 7, name: 'Bonus Star (+30)', icon: '⭐', bg: '#f59e0b' },
    { id: 8, name: 'Mascot Flag (Finish)', icon: '🏁', bg: '#dc2626' }
];

function openLevelEditorMenu() {
    if (!isTeacherMode()) return;
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
        document.getElementById('edit-speed-advantage').value = "1.0";
        document.getElementById('edit-grid-size').value = "30";
        editorCols = 30;
        editorRows = 10;
        editorPatrolSpeed = 1.0;
        editorSpeedAdvantage = 1.0;
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
        document.getElementById('edit-speed-advantage').value = lvl.speedAdvantage !== undefined ? lvl.speedAdvantage : 1.0;
        editorCols = lvl.cols;
        editorRows = lvl.rows;
        editorPatrolSpeed = lvl.patrolSpeed !== undefined ? lvl.patrolSpeed : 1.0;
        editorSpeedAdvantage = lvl.speedAdvantage !== undefined ? lvl.speedAdvantage : 1.0;
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
                const photoFile = p && (p.photo || teacherPathMapping[p.name]) ? (p.photo || teacherPathMapping[p.name]) : null;
                const photoImg = photoFile ? getOrLoadImage(photoFile) : null;

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
        speedAdvantage: parseFloat(document.getElementById('edit-speed-advantage').value) || 1.0,
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
        speedAdvantage: parseFloat(document.getElementById('edit-speed-advantage').value) || 1.0,
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

function buildStarterLevelCode() {
    const selVal = document.getElementById('editor-level-select').value;
    const name = document.getElementById('edit-level-name').value.trim() || 'Custom Route';
    const id = (selVal !== "NEW" && levels[parseInt(selVal)])
        ? levels[parseInt(selVal)].id
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('custom_' + Date.now());

    const gridLines = editorGrid
        .map(row => '            [' + row.join(', ') + ']')
        .join(',\n');

    const personasStr = JSON.stringify(editorPersonas, null, 4)
        .split('\n')
        .map((line, i) => i === 0 ? line : '        ' + line)
        .join('\n');

    return `    {
        id: ${JSON.stringify(id)},
        name: ${JSON.stringify(name)},
        description: ${JSON.stringify(document.getElementById('edit-level-desc').value)},
        cols: ${editorCols},
        rows: ${editorRows},
        patrolSpeed: ${parseFloat(document.getElementById('edit-patrol-speed').value) || 1.0},
        speedAdvantage: ${parseFloat(document.getElementById('edit-speed-advantage').value) || 1.0},
        grid: [
${gridLines}
        ],
        timeLimit: ${parseInt(document.getElementById('edit-level-time').value) || 90},
        personas: ${personasStr}
    }`;
}

function exportLevelAsStarterCode() {
    const code = buildStarterLevelCode();

    // Download as a .js snippet
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starter_level.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Also copy to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(
            () => showMessageBox("Starter level code copied to clipboard and downloaded as starter_level.js.\n\nPaste it into the defaultLevels array in index.js (add a comma after the previous level)."),
            () => showMessageBox("Downloaded starter_level.js. Paste its contents into the defaultLevels array in index.js.")
        );
    } else {
        showMessageBox("Downloaded starter_level.js. Paste its contents into the defaultLevels array in index.js.");
    }
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
            document.getElementById('edit-speed-advantage').value = lvl.speedAdvantage !== undefined ? lvl.speedAdvantage : 1.0;
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

applyTeacherMode();
loadSettingsFile();