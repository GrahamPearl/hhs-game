/* features.js - load AFTER index.js:  <script src="features.js"></script>
   Adds: per-character items, per-level per-character speed, Teacher/SLT photo pickers,
   and the bell "You won" screen after all default levels are completed. */

/* ---------- 1. Photo lists (editable in the Settings modal) ---------- */
if (!Array.isArray(appSettings.teacherFiles)) {
    appSettings.teacherFiles = [
        "HB.webp",
        "Teachers/mrs_knight_principal.jpg",
        "Teachers/mr_ndebele_deputy_principal.JPG",
        "Teachers/sibongiseni_ndebele_deputy_principal.JPG",
        "Teachers/mr_joseph_it.JPG",
        "Teachers/mr_moore_history.JPG",
        "Teachers/mrs_ramsern_geography.JPG",
        "Teachers/ms_zulu_commerce.JPG",
        "Teachers/Woodrow.JPG",
        "Teachers/grade_controllers_1.JPG",
        "Teachers/teachers.JPG"
    ];
}
if (!Array.isArray(appSettings.sltFiles)) {
    appSettings.sltFiles = [
        "SLT/isabella_te_brugge_deputy_head.JPG",
        "SLT/jorja_pretorius_head_girl.JPG",
        "SLT/luke_whittle_head_boy.JPG",
        "SLT/rylan-leask_deputy_head_boy.JPG",
        "SLT/tamuka_chovuchovu_deputy_head_boy.JPG",
        "SLT/ziyanda_mabhida_deputy_head_girl.JPG"
    ];
}
const BELL_IMAGE = "Bell/bell.JPG";
const LOGO_IMAGE = "Symbols/hhs_logo.png";
const KINGFISHER_IMAGE = "Symbols/hhs_kingfisher.png";

function getPhotoListForRole(role) {
    const list = role === 'slt' ? appSettings.sltFiles : appSettings.teacherFiles;
    return list && list.length ? list : ["HB.webp"];
}

/* Extra inputs in the settings modal */
(function () {
    const grp = document.getElementById('cfg-files').closest('.form-group');
    grp.insertAdjacentHTML('afterend', `
        <div class="form-group"><label>Teacher Photos (comma-separated, relative to photos folder)</label>
        <input type="text" id="cfg-teacher-files" class="form-control"></div>
        <div class="form-group"><label>SLT Photos (comma-separated, relative to photos folder)</label>
        <input type="text" id="cfg-slt-files" class="form-control"></div>`);
})();
const _openSettings = window.openSettingsModal;
window.openSettingsModal = function () {
    _openSettings();
    document.getElementById('cfg-teacher-files').value = appSettings.teacherFiles.join(', ');
    document.getElementById('cfg-slt-files').value = appSettings.sltFiles.join(', ');
};
const _saveSettings = window.saveSettingsConfig;
window.saveSettingsConfig = function () {
    const split = id => document.getElementById(id).value.split(',').map(s => s.trim()).filter(Boolean);
    appSettings.teacherFiles = split('cfg-teacher-files');
    appSettings.sltFiles = split('cfg-slt-files');
    _saveSettings();
};

/* ---------- 2. Items for every character ---------- */
const ITEM_DEFS = {
    4:  { icon: '📚', label: 'Books',        base: 15, bonus: 20, who: ['library'],  bg: '#d97706' },
    5:  { icon: '⚽', label: 'Sports Ball',  base: 10, bonus: 15, who: ['soccer'], bg: '#16a34a' },
    7:  { icon: '⭐', label: 'Pride Star',   base: 30, bonus: 0,  who: [],           bg: '#f59e0b' },
    9:  { icon: '🏉', label: 'Rugby Ball',   base: 10, bonus: 20, who: ['rugby'],    bg: '#15803d' },
    10: { icon: '⚽', label: 'Soccer Ball',  base: 10, bonus: 20, who: ['soccer'],   bg: '#0d9488' },
    11: { icon: '🏐', label: 'Netball',      base: 10, bonus: 20, who: ['netball'],  bg: '#c026d3' },
    12: { icon: '🎤', label: 'Microphone',   base: 10, bonus: 20, who: ['drama'],    bg: '#be123c' },
    13: { icon: '🎒', label: 'School Bag',   base: 10, bonus: 20, who: ['learner'],  bg: '#2563eb' }
};

(function buildPalette() {
    const nice = { rugby: 'Rugby', soccer: 'Soccer', netball: 'Netball', library: 'Library', drama: 'Drama', learner: 'Learner' };
    Object.keys(ITEM_DEFS).forEach(id => {
        const d = ITEM_DEFS[id];
        const name = d.bonus
            ? `${d.label} (+${d.base} / +${d.base + d.bonus} ${d.who.map(w => nice[w]).join('/')})`
            : `${d.label} (+${d.base})`;
        const existing = paletteItemsConfig.find(p => p.id === Number(id));
        if (existing) { existing.name = name; }
        else paletteItemsConfig.push({ id: Number(id), name, icon: d.icon, bg: d.bg });
    });
    paletteItemsConfig.find(p => p.id === 6).name = 'Teacher Persona';
    paletteItemsConfig.push({ id: 14, name: 'SLT Persona (Prefects/Deputies)', icon: '🎓', bg: '#b45309' });
})();

function extractEntitiesFromGrid() {
    activeEntities = [];
    const lvl = levels[currentLevelIndex];
    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            const t = currentMapGrid[r][c];
            if (t === 6 || ITEM_DEFS[t]) activeEntities.push({ y: r, x: c, type: t, interacted: false });
        }
    }
}

function collectItem(ent) {
    const d = ITEM_DEFS[ent.type];
    const match = d.who.includes(selectedCharacter.id);
    const pts = d.base + (match ? d.bonus : 0);
    prideScore += pts;
    ent.interacted = true;
    playSound('success');
    updateHudScore();
    showSpecialPopup(match ? `${selectedCharacter.name} Bonus: ${d.label} +${pts} Pts!` : `${d.label} +${pts} Pts`, d.icon);
}

function handleGameKeydown(e) {
    if (!gameRunning) return;
    if (e.key === ' ') { e.preventDefault(); triggerInteraction(); return; }
    const dirs = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    const d = dirs[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();

    const now = Date.now();
    if (now - lastMoveTime < Math.max(80, 180 / (currentSpeedAdvantage || 1))) return;

    const lvl = levels[currentLevelIndex];
    const nx = playerX + d[0], ny = playerY + d[1];
    if (nx < 0 || nx >= lvl.cols || ny < 0 || ny >= lvl.rows || currentMapGrid[ny][nx] === 1) return;

    lastMoveTime = now;
    playerX = nx; playerY = ny;
    playSound('step');

    if (currentMapGrid[ny][nx] === 8) {
        endGame(true, "Congratulations! You successfully caught the HHS Mascot!");
        return;
    }
    const ent = activeEntities.find(en => !en.interacted && en.x === nx && en.y === ny);
    if (ent) {
        if (ent.type === 6) openDialogueModal(ent);
        else if (ITEM_DEFS[ent.type]) collectItem(ent);
    }
    checkForNearbyInteraction();
    updateGameLoop();
}

/* ---------- 3. Drawing (game + editor) ---------- */
function drawTileContent(ctx, t, r, c, ts, personas) {
    const cx = c * ts + ts / 2, cy = r * ts + ts / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (t === 6) {
        const p = personas[`${r}_${c}`];
        const file = p && (p.photo || teacherPathMapping[p.name]);
        const img = file ? getOrLoadImage(file) : null;
        if (img && img.complete && !img.failed && img.naturalWidth) {
            const sw = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = (img.naturalWidth - sw) / 2;
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(img, sx, 0, sw, sw, c * ts, r * ts, ts, ts); // square crop from the top (faces)
            ctx.restore();
            ctx.strokeStyle = (p && p.role === 'slt') ? '#f0ad4e' : '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, ts * 0.4, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.font = `${Math.floor(ts * 0.7)}px sans-serif`;
            ctx.fillText((p && p.portrait) || '👨‍🏫', cx, cy);
        }
        return;
    }
    if (t === 8) {
        // Flag on top, HHS kingfisher mascot underneath it
        ctx.font = `${Math.floor(ts * 0.5)}px sans-serif`;
        ctx.fillText('🏁', cx, r * ts + ts * 0.3);
        const kf = getOrLoadImage(KINGFISHER_IMAGE);
        if (kf && kf.complete && !kf.failed && kf.naturalWidth) {
            const maxW = ts * 0.9, maxH = ts * 0.5;
            const sc = Math.min(maxW / kf.naturalWidth, maxH / kf.naturalHeight);
            const w = kf.naturalWidth * sc, h = kf.naturalHeight * sc;
            ctx.drawImage(kf, cx - w / 2, r * ts + ts * 0.55 + (maxH - h) / 2, w, h);
        }
        return;
    }
    let sym = '';
    if (ITEM_DEFS[t]) sym = ITEM_DEFS[t].icon;
    if (sym) {
        ctx.font = `${Math.floor(ts * 0.7)}px sans-serif`;
        ctx.fillText(sym, cx, cy);
    }
}

function updateGameLoop() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const lvl = levels[currentLevelIndex];
    const ts = Math.floor(canvas.width / lvl.cols);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
            const t = currentMapGrid[r][c];
            ctx.fillStyle = t === 1 ? '#334155' : '#1e293b';
            ctx.fillRect(c * ts, r * ts, ts, ts);
            ctx.strokeStyle = '#1e293b';
            ctx.strokeRect(c * ts, r * ts, ts, ts);
            if (t === 8) drawTileContent(ctx, 8, r, c, ts, currentPersonas);
        }
    }
    activeEntities.forEach(ent => {
        if (!ent.interacted) drawTileContent(ctx, ent.type, ent.y, ent.x, ts, currentPersonas);
    });
    ctx.font = `${Math.floor(ts * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(selectedCharacter.icon, playerX * ts + ts / 2, playerY * ts + ts / 2);
}

function drawEditorCanvas() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const ts = Math.floor(canvas.width / editorCols);
    canvas.height = ts * editorRows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < editorRows; r++) {
        for (let c = 0; c < editorCols; c++) {
            const t = editorGrid[r][c];
            ctx.fillStyle = t === 1 ? '#334155' : '#1e293b';
            ctx.fillRect(c * ts, r * ts, ts, ts);
            ctx.strokeStyle = '#0f172a';
            ctx.strokeRect(c * ts, r * ts, ts, ts);
            if (t === 2 || t === 3) {
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.floor(ts * 0.7)}px sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('S', c * ts + ts / 2, r * ts + ts / 2);
            } else {
                drawTileContent(ctx, t, r, c, ts, editorPersonas);
            }
        }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(editorCursorX * ts, editorCursorY * ts, ts, ts);
}

/* ---------- 4. Editor clicks: Teacher vs SLT ---------- */
let pendingRole = 'teacher';
let tempRole = 'teacher';

function canvasClick(e) {
    const canvas = document.getElementById('editorCanvas');
    const rect = canvas.getBoundingClientRect();
    const ts = canvas.width / editorCols;
    const c = Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / ts);
    const r = Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / ts);
    if (r < 0 || r >= editorRows || c < 0 || c >= editorCols) return;

    editorCursorX = c; editorCursorY = r;
    const personaTool = selectedPaletteTile === 6 || selectedPaletteTile === 14;

    if (personaTool && editorGrid[r][c] === 6) {
        openPersonaModalForCoord(r, c);
    } else if (personaTool) {
        editorGrid[r][c] = 6;
        pendingRole = selectedPaletteTile === 14 ? 'slt' : 'teacher';
        openPersonaModalForCoord(r, c);
    } else {
        if (editorGrid[r][c] === 6) delete editorPersonas[`${r}_${c}`];
        editorGrid[r][c] = selectedPaletteTile;
    }
    drawEditorCanvas();
}

function defaultPersonaFor(role) {
    const photo = getPhotoListForRole(role)[0];
    return role === 'slt'
        ? { name: 'SLT Member', role, portrait: '👩‍🏫', photo, prompt: 'Good morning! Is that how a Hillcrest learner should look?',
            responses: [{ text: 'Good morning! Thank you, I will fix it.', points: 20 }, { text: 'Ignore', points: -10 }] }
        : { name: 'Teacher', role, portrait: '👨‍🏫', photo, prompt: 'Good morning!',
            responses: [{ text: 'Good morning, Sir/Madam!', points: 20 }, { text: 'Ignore', points: -10 }] };
}

(function addRoleSelect() {
    const photoGroup = document.getElementById('p-photo-gallery').closest('.form-group');
    const g = document.createElement('div');
    g.className = 'form-group';
    g.innerHTML = `<label>Staff Type (decides which photos you can pick)</label>
        <select id="p-role" class="form-control" onchange="onPersonaRoleChange(this.value)">
            <option value="teacher">Teacher</option>
            <option value="slt">SLT / Prefects &amp; Deputies</option>
        </select>`;
    photoGroup.before(g);
})();

function onPersonaRoleChange(role) {
    tempRole = role;
    const list = getPhotoListForRole(role);
    if (!list.includes(tempSelectedPhoto)) {
        tempSelectedPhoto = list[0];
        document.getElementById('p-custom-filename').value = list[0];
    }
    renderStaffPhotoGallery();
}

function openPersonaModalForCoord(r, c) {
    currentEditingCoordKey = `${r}_${c}`;
    const existing = editorPersonas[currentEditingCoordKey];
    tempRole = existing ? (existing.role || 'teacher') : pendingRole;
    const persona = existing || defaultPersonaFor(tempRole);

    document.getElementById('p-role').value = tempRole;
    document.getElementById('p-name').value = persona.name;
    document.getElementById('p-prompt').value = persona.prompt;
    document.getElementById('p-custom-filename').value = persona.photo || '';
    tempSelectedPortrait = persona.portrait || '👨‍🏫';
    tempSelectedPhoto = persona.photo || '';
    tempResponses = JSON.parse(JSON.stringify(persona.responses || []));

    renderStaffPhotoGallery();
    renderPersonaResponsesList();
    document.getElementById('persona-modal').classList.add('active');
}

function savePersonaConfig() {
    if (!currentEditingCoordKey) return;
    editorPersonas[currentEditingCoordKey] = {
        name: document.getElementById('p-name').value,
        role: tempRole,
        portrait: tempSelectedPortrait,
        photo: tempSelectedPhoto || document.getElementById('p-custom-filename').value.trim(),
        prompt: document.getElementById('p-prompt').value,
        responses: tempResponses
    };
    closePersonaModal();
    drawEditorCanvas();
}

/* ---------- 5. Per-character speed per level ---------- */
const CHAR_LIST = [
    ['rugby', '🏉 Rugby'], ['soccer', '⚽ Soccer'], ['netball', '🏐 Netball'],
    ['library', '📚 Library'], ['drama', '🎤 Drama'], ['learner', '🎒 Learner']
];

(function addSpeedInputs() {
    const meta = document.getElementById('edit-speed-advantage').closest('.form-group').parentElement;
    const box = document.createElement('div');
    box.style.gridColumn = '1 / -1';
    box.innerHTML = `<label style="display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:6px;">
        Per-character speed multiplier for THIS level (multiplies the level boost; 1.0 = normal, 1.5 = faster, 0.7 = slower)</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">` +
        CHAR_LIST.map(([id, label]) => `<div><label style="font-size:0.75rem;color:#cbd5e1;">${label}</label>
        <input type="number" step="0.1" min="0.3" max="3" id="edit-cs-${id}" class="form-control" value="1.0"></div>`).join('') +
        `</div>`;
    meta.appendChild(box);
})();

function readCharSpeeds() {
    const out = {};
    CHAR_LIST.forEach(([id]) => {
        const v = parseFloat(document.getElementById(`edit-cs-${id}`).value);
        if (v && v !== 1) out[id] = v;
    });
    return out;
}
function setCharSpeedInputs(obj) {
    CHAR_LIST.forEach(([id]) => {
        document.getElementById(`edit-cs-${id}`).value = (obj && obj[id]) ? obj[id] : 1.0;
    });
}

const _loadEditor = window.loadLevelIntoEditor;
window.loadLevelIntoEditor = function (val) {
    _loadEditor(val);
    setCharSpeedInputs(val === "NEW" ? {} : (levels[parseInt(val)] || {}).characterSpeeds);
};

const _launch = window.launchGameLevel;
window.launchGameLevel = function (index, continueRun) {
    _launch(index, continueRun);
    const lvl = levels[index];
    const mult = (lvl.characterSpeeds && lvl.characterSpeeds[selectedCharacter.id]) || 1;
    currentSpeedAdvantage = (lvl.speedAdvantage !== undefined ? lvl.speedAdvantage : 1) * mult;
    document.getElementById('hud-patrol-speed').textContent =
        `${currentPatrolSpeed}s (${currentSpeedAdvantage.toFixed(2)}x Boost)`;
};

function currentEditorLevelData() {
    return {
        name: document.getElementById('edit-level-name').value,
        description: document.getElementById('edit-level-desc').value,
        cols: editorCols,
        rows: editorRows,
        grid: JSON.parse(JSON.stringify(editorGrid)),
        timeLimit: parseInt(document.getElementById('edit-level-time').value) || 90,
        patrolSpeed: parseFloat(document.getElementById('edit-patrol-speed').value) || 1.0,
        speedAdvantage: parseFloat(document.getElementById('edit-speed-advantage').value) || 1.0,
        characterSpeeds: readCharSpeeds(),
        personas: JSON.parse(JSON.stringify(editorPersonas))
    };
}

function saveCurrentLevel() {
    const sel = document.getElementById('editor-level-select');
    const selVal = sel.value;
    const data = currentEditorLevelData();
    data.id = selVal === "NEW" ? 'custom_' + Date.now() : levels[parseInt(selVal)].id;

    let idx;
    if (selVal === "NEW") { levels.push(data); idx = levels.length - 1; }
    else { idx = parseInt(selVal); levels[idx] = data; }
    localStorage.setItem('hhs_custom_levels', JSON.stringify(levels));

    // rebuild dropdown so a new level becomes "selected" (prevents duplicate saves)
    sel.innerHTML = `<option value="NEW">+ Create New Level</option>`;
    levels.forEach((l, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = l.name;
        sel.appendChild(o);
    });
    sel.value = idx;
    showMessageBox("Level saved successfully!");
}

function exportLevelJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentEditorLevelData(), null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = "hhs_level.json";
    document.body.appendChild(a); a.click(); a.remove();
}

const _starterCode = window.buildStarterLevelCode;
window.buildStarterLevelCode = function () {
    return _starterCode().replace(/(speedAdvantage: [^\n]*\n)/,
        `$1        characterSpeeds: ${JSON.stringify(readCharSpeeds())},\n`);
};

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
            setCharSpeedInputs(lvl.characterSpeeds);
            drawEditorCanvas();
            showMessageBox("Level JSON imported successfully!");
        } catch (err) {
            showMessageBox("Error parsing level JSON file.");
        }
    };
    reader.readAsText(file);
}

/* ---------- 6. Bell "You won" after ALL default levels (called from endGame in index.js) ---------- */

function showBellWin() {
    const negative = prideScore < minusScore;
    let m = document.getElementById('bell-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'bell-modal';
        m.className = 'modal-overlay';
        m.innerHTML = `<div class="modal-content" style="text-align:center;max-width:640px;">
            <h2 id="bell-title" style="margin-bottom:8px;"></h2>
            <p id="bell-msg" style="color:#cbd5e1;font-size:1.2rem;font-weight:bold;margin-bottom:12px;"></p>
            <img id="bell-img" alt="Hillcrest bell" style="max-width:100%;max-height:50vh;border-radius:10px;border:2px solid #f0ad4e;">
            <div style="margin-top:15px;">
                <button class="btn btn-success" onclick="document.getElementById('bell-modal').classList.remove('active')">Continue</button>
            </div>
            <img id="bell-logo" alt="Hillcrest High School logo" style="display:block;margin:18px auto 0;max-width:100%;max-height:110px;object-fit:contain;">
        </div>`;
        document.body.appendChild(m);
    }

    // Heading is set every time (the modal is reused between runs)
    const title = document.getElementById('bell-title');
    if (negative) {
        title.textContent = ' You Won! ';
        title.style.color = '#f04e4e';
    } else {
        title.textContent = '🔔 You Won! 🔔';
        title.style.color = '#f0ad4e';
    }

    // Updated end message:
    if (negative) {
        document.getElementById('bell-msg').textContent =
        `Welcome to Hillcrest High School! ${playerName}, you completed every Hillcrest route and beat the bell. However, your pride score is negative. Please try again to improve your score!`;
    } else {
        document.getElementById('bell-msg').textContent =
        `Welcome to Hillcrest High School! ${playerName}, you completed every Hillcrest route and beat the bell. Well done!`;
    }

    const img = document.getElementById('bell-img');
    img.style.display = '';
    img.onerror = () => { img.style.display = 'none'; };
    img.src = getGitHubRawUrl(BELL_IMAGE);
    const logo = document.getElementById('bell-logo');
    logo.style.display = 'block';
    loadImgWithFallback(logo, LOGO_IMAGE, () => { logo.style.display = 'none'; });
    m.classList.add('active');
    playSound(hasPositivePoints() ? 'success' : 'sad');
}


/* ---------- 7. Robust photo loading (relative path -> GitHub raw -> jsDelivr) ---------- */
function getImageCandidates(filename) {
    if (!filename) return [];
    if (/^(data:|https?:)/i.test(filename)) return [filename];
    const clean = filename.replace(/^\/+/, '').replace(/^staff-photos\//, '');
    const folder = (appSettings.photosFolder || '').replace(/^\/+|\/+$/g, '');
    const enc = ((folder ? folder + '/' : '') + clean).split('/').map(encodeURIComponent).join('/');
    const u = appSettings.githubUsername, r = appSettings.githubRepo, b = appSettings.branch;
    return [
        enc,                                                          // works locally / on GitHub Pages
        `https://raw.githubusercontent.com/${u}/${r}/${b}/${enc}`,    // GitHub raw
        `https://cdn.jsdelivr.net/gh/${u}/${r}@${b}/${enc}`           // CDN mirror of the repo
    ];
}

function loadImgWithFallback(img, filename, onFail) {
    const list = getImageCandidates(filename);
    let i = 0;
    img.onerror = function () {
        i++;
        if (i < list.length) { img.src = list[i]; }
        else {
            console.warn('[HHS] Photo failed to load:', filename, 'tried:', list);
            if (onFail) onFail(list);
        }
    };
    if (list.length) img.src = list[0]; else if (onFail) onFail(list);
}

window.getOrLoadImage = function (filename) {
    if (!filename) return null;
    if (imageCache[filename]) return imageCache[filename];
    const img = new Image();
    img.onload = function () {
        if (document.getElementById('screen-editor').classList.contains('active')) drawEditorCanvas();
        else if (document.getElementById('screen-game').classList.contains('active') && currentMapGrid.length) updateGameLoop();
    };
    imageCache[filename] = img;
    loadImgWithFallback(img, filename, () => { img.failed = true; });
    return img;
};

(function () {
    const st = document.createElement('style');
    st.textContent = '.photo-card.missing{border-color:#dc2626;}#p-photo-warning{font-size:0.75rem;color:#f87171;margin-bottom:6px;}#p-photo-warning a{color:#38bdf8;}';
    document.head.appendChild(st);
})();

const MISSING_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#1e293b'/><text x='50' y='62' font-size='44' text-anchor='middle' fill='#f87171'>?</text></svg>");

function renderStaffPhotoGallery() {
    const gallery = document.getElementById('p-photo-gallery');
    gallery.innerHTML = '';
    let warn = document.getElementById('p-photo-warning');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'p-photo-warning';
        gallery.before(warn);
    }
    warn.innerHTML = '';
    let failed = 0;

    getPhotoListForRole(tempRole).forEach(fileName => {
        const div = document.createElement('div');
        div.className = `photo-card ${tempSelectedPhoto === fileName ? 'selected' : ''}`;
        const img = document.createElement('img');
        img.loading = 'lazy';
        loadImgWithFallback(img, fileName, list => {
            div.classList.add('missing');
            div.title = 'Could not load: ' + list.join('  |  ');
            img.onerror = null;
            img.src = MISSING_SVG;
            failed++;
            warn.innerHTML = `⚠ ${failed} photo(s) could not be loaded. Check the files are pushed to GitHub (and the repo is public). Test link: <a target="_blank" href="${list[1] || list[0]}">open the first failing URL</a>`;
        });
        const span = document.createElement('span');
        span.textContent = fileName.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        div.appendChild(img);
        div.appendChild(span);
        div.onclick = () => {
            tempSelectedPhoto = fileName;
            document.getElementById('p-custom-filename').value = fileName;
            gallery.querySelectorAll('.photo-card').forEach(x => x.classList.remove('selected'));
            div.classList.add('selected');
        };
        gallery.appendChild(div);
    });
}

/* Dialogue popup avatar uses the same fallback loader */
const _openDialogue = window.openDialogueModal;
let _dlgAvatarToken = 0;
window.openDialogueModal = function (ent) {
    _openDialogue(ent);
    const box = document.getElementById('dlg-avatar-container');

    // The original function's <img> is still loading; its onerror would later
    // overwrite our photo with the emoji. Neutralise it first.
    box.querySelectorAll('img').forEach(o => { o.onerror = null; o.onload = null; });

    const p = currentPersonas[`${ent.y}_${ent.x}`];
    const file = (p && (p.photo || teacherPathMapping[p.name])) || 'HB.webp';
    const emoji = (p && p.portrait) || '\u{1F468}\u200D\u{1F3EB}';
    const token = ++_dlgAvatarToken;   // ignore results from a previous dialogue

    box.innerHTML = '';
    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top;';
    box.appendChild(img);
    loadImgWithFallback(img, file, () => {
        if (token !== _dlgAvatarToken || !img.isConnected) return;
        box.innerHTML = `<div id="dlg-avatar" style="font-size:3rem;">${emoji}</div>`;
    });
};