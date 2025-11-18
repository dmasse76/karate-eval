// script.js extrait depuis index.html

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://gcdruwruygjclvszgerc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NPo8JYU8do60kvTzt_3Wbw_vI3O2DEU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let programList = [];
let promotionList = [];
let studentList = [];
let programIdMap = {};
let promotionIdMap = {};
let studentIdMap = {};

const evaluations = {};
const notes = {};
let currentBelt = '';
let currentPromotion = '';
let currentProgramData = null;
let currentStudentList = null;
let currentProgramId = null;
let currentPromotionId = null;
let currentTab = 0;
let rendered = false;
let controlsVisible = false;

const evaluatorInput = document.getElementById('evaluatorInput');
const beltSelect = document.getElementById('beltSelect');
const promotionSelect = document.getElementById('promotionSelect');
const tabsContainer = document.getElementById('tabsContainer');
const contentContainer = document.getElementById('contentContainer');
const saveButton = document.getElementById('saveButton');
const progressIndicator = document.getElementById('progressIndicator');
const controlsPanel = document.getElementById('controlsPanel');
const toggleBtn = document.getElementById('toggleBtn');

// --- Swipe Button Logic ---
const swipeContainer = document.getElementById('swipeContainer');
const swipeSlider = document.getElementById('swipeSlider');
let startX = null;
let currentX = null;
let dragging = false;
const swipeThreshold = 100; // px

function resetSlider() {
    swipeSlider.style.transition = 'transform 0.3s';
    swipeSlider.style.transform = 'translateX(-50%)';
    swipeContainer.classList.remove('swiping-left', 'swiping-right');
    setTimeout(() => {
        swipeSlider.style.transition = '';
    }, 300);
}

function onSwipeEnd(action) {
    resetSlider();
    if (action === 'left') {
        resetAllNotesAndRatings();
    } else if (action === 'right') {
        saveEvaluations();
    }
}

function handleDragStart(e) {
    dragging = true;
    swipeSlider.style.transition = '';
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    currentX = startX;
    document.body.style.userSelect = 'none';
}

function handleDragMove(e) {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = x - startX;
    // Limit slider movement to container width
    const maxDx = swipeContainer.offsetWidth / 2 - swipeSlider.offsetWidth / 2 - 10;
    let limitedDx = Math.max(Math.min(dx, maxDx), -maxDx);
    swipeSlider.style.transform = `translateX(calc(-50% + ${limitedDx}px))`;
    if (limitedDx < -swipeThreshold) {
        swipeContainer.classList.add('swiping-left');
        swipeContainer.classList.remove('swiping-right');
    } else if (limitedDx > swipeThreshold) {
        swipeContainer.classList.add('swiping-right');
        swipeContainer.classList.remove('swiping-left');
    } else {
        swipeContainer.classList.remove('swiping-left', 'swiping-right');
    }
    currentX = x;
}

function handleDragEnd() {
    if (!dragging) return;
    const dx = currentX - startX;
    if (dx < -swipeThreshold) {
        onSwipeEnd('left');
    } else if (dx > swipeThreshold) {
        onSwipeEnd('right');
    } else {
        resetSlider();
    }
    dragging = false;
    document.body.style.userSelect = '';
}

// Mouse events
swipeSlider.addEventListener('mousedown', handleDragStart);
window.addEventListener('mousemove', handleDragMove);
window.addEventListener('mouseup', handleDragEnd);

// Touch events
swipeSlider.addEventListener('touchstart', handleDragStart, { passive: false });
window.addEventListener('touchmove', handleDragMove, { passive: false });
window.addEventListener('touchend', handleDragEnd);

// --- Chargement programmes ---
async function loadPrograms() {
    beltSelect.innerHTML = '<option value="">Chargement…</option>';
    const { data, error } = await supabase.from('programs').select('*').eq('active', true).order('created_at', { ascending: false });
    if (error) { beltSelect.innerHTML = '<option value="">Erreur</option>'; return; }
    programList = data;
    beltSelect.innerHTML = '<option value="">Sélectionner...</option>';
    data.forEach(p => {
        programIdMap[p.name.toLowerCase()] = p.id;
        const opt = document.createElement('option');
        opt.value = p.name.toLowerCase();
        opt.textContent = p.name;
        beltSelect.appendChild(opt);
    });
}

// --- Chargement promotions ---
async function loadPromotions() {
    promotionSelect.innerHTML = '<option value="">Chargement…</option>';
    const { data, error } = await supabase.from('promotions').select('id,name,program_name').order('name', { ascending: true });
    if (error) { promotionSelect.innerHTML = '<option value="">Erreur</option>'; return; }
    promotionList = data;
    promotionSelect.innerHTML = '<option value="">Sélectionner...</option>';
    data.forEach(p => {
        promotionIdMap[p.name] = p.id;
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        promotionSelect.appendChild(opt);
    });
}

// --- Détails programme ---
async function loadProgramDetails(belt) {
    const program = programList.find(p => p.name.toLowerCase() === belt);
    if (!program) return null;
    currentProgramId = program.id;
    const { data: categories, error } = await supabase
        .from('categories')
        .select('id,title,key,weight,techniques(id,name)')
        .eq('program_id', program.id)
        .order('created_at', { ascending: true });
    if (error) return null;
    return categories.map(cat => ({
        id: cat.id,
        category: cat.title || cat.key,
        techniques: (cat.techniques || []).map(t => ({ id: t.id, name: t.name })),
        poid: cat.weight
    }));
}

// --- Chargement étudiants ---
async function loadStudents(promotion) {
    const promo = promotionList.find(p => p.name === promotion);
    if (!promo) return [];
    currentPromotionId = promo.id;
    const { data, error } = await supabase
        .from('students_promotions')
        .select('student:students(id,name)')
        .eq('promotion_id', promo.id);
    if (error) return [];
    studentList = data.map(link => link.student.name);
    studentIdMap = {};
    data.forEach(link => studentIdMap[link.student.name] = link.student.id);
    return studentList;
}

// --- Affichage évaluation (une seule fois) ---
async function renderEvaluation() {
    const belt = beltSelect.value;
    const promotion = promotionSelect.value;
    currentBelt = belt;
    currentPromotion = promotion;

    if (!belt || !promotion) {
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = `<div class="empty-state">
            <div>Sélectionnez une ceinture et une promotion</div>
            <div class="icon">
                <img src="shinden-ryu-logo.png" alt="Shinden Ryu Logo" style="width:120px;height:120px;">
            </div>
        </div>`;
        saveButton.style.display = 'none';
        document.getElementById('resetButton').style.display = 'none';
        progressIndicator.style.display = 'none';
        toggleBtn.classList.add('hidden');
        currentProgramData = null;
        currentStudentList = null;
        return;
    }

    const program = await loadProgramDetails(belt);
    const studentsArr = await loadStudents(promotion);
    currentProgramData = program;
    currentStudentList = studentsArr;

    if (!program || !studentsArr) {
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><div>Programme non disponible</div></div>`;
        saveButton.style.display = 'none';
        progressIndicator.style.display = 'none';
        toggleBtn.classList.add('hidden');
        return;
    }

    if (!rendered) {
        renderTabs(program, studentsArr);
        renderTabContent(program, studentsArr);
        rendered = true;
    }

    updateProgress();
    updateVisualIndicators();

    controlsPanel.classList.add('collapsed');
    controlsVisible = false;
    toggleBtn.classList.remove('hidden');
    saveButton.style.display = 'block';
    document.getElementById('resetButton').style.display = 'block';
    progressIndicator.style.display = 'block';
}

// --- Fonctions d'affichage et de gestion ---
function renderTabs(program, studentList) {
    let tabsHtml = '';
    program.forEach((cat, index) => {
        const activeClass = index === currentTab ? 'active' : '';
        const categoryCompletionStatus = getCategoryCompletionStatus(index, program[index].techniques.length, studentList);
        const completedClass = categoryCompletionStatus === 'completed' ? 'completed' : '';
        tabsHtml += `<div class="tab ${activeClass} ${completedClass}" onclick="switchTab(${index})">${cat.category}</div>`;
    });
    tabsContainer.innerHTML = tabsHtml;
}

function renderTabContent(program, studentList) {
    contentContainer.innerHTML = '';
    const catIndex = currentTab;
    const cat = program[catIndex];
    const weight = cat.poid !== undefined ? cat.poid : null;
    let categoryHeaderHtml = '';
    if (weight !== null) {
        categoryHeaderHtml += `<div style='font-size:13px;color:#c41e3a;font-weight:500;margin:18px 0 18px 0;'>Poid de la catégorie : <b>${weight}%</b></div>`;
    }
    contentContainer.insertAdjacentHTML('beforeend', categoryHeaderHtml);
    cat.techniques.forEach((tech, techIndex) => {
        const techniqueKey = `${catIndex}-${techIndex}`;
        let card = document.querySelector(`[data-technique="${techniqueKey}"]`);
        if (!card) {
            const contentHtml = `
            <div class="technique-card not-started" data-technique="${techniqueKey}">
                <div class="technique-header" onclick="toggleTechnique(${catIndex}, ${techIndex})">
                    <div class="technique-title">
                        <span class="technique-status">○</span>
                        <span>${tech.name}</span>
                    </div>
                    <span class="technique-icon">▼</span>
                </div>
                <div class="students-container"></div>
            </div>
        `;
            contentContainer.insertAdjacentHTML('beforeend', contentHtml);
            card = document.querySelector(`[data-technique="${techniqueKey}"]`);
        } else {
            contentContainer.appendChild(card);
        }
        const container = card.querySelector('.students-container');
        studentList.forEach((student, studentIndex) => {
            const key = `${currentBelt}-${currentPromotion}-${catIndex}-${techIndex}-${studentIndex}`;
            let row = container.querySelector(`.student-row[data-student-key="${key}"]`);
            if (!row) {
                row = initStudentRow(key, student, container);
            } else {
                const rating = evaluations[key] || 0;
                row.querySelectorAll('.rating-btn').forEach((btn, idx) => {
                    btn.classList.toggle('selected', idx + 1 === rating);
                });
            }
        });
    });
}

function initStudentRow(key, studentName, container) {
    const row = document.createElement('div');
    row.className = 'student-row';
    row.dataset.studentKey = key;
    row.innerHTML = `
    <div class="student-main">
        <span class="student-name">${studentName}</span>
    </div>
    <div class="rating-buttons">
        <button class="rating-btn" style="background:#c41e3a" onclick="setRating('${key}',1);return false;">Insuffisant</button>
        <button class="rating-btn" style="background:#ff9800" onclick="setRating('${key}',2);return false;">Partiellement réussi</button>
        <button class="rating-btn" style="background:#8bc34a" onclick="setRating('${key}',3);return false;">Répond aux attentes</button>
        <button class="rating-btn" style="background:#2e7d32" onclick="setRating('${key}',4);return false;">Dépasse les attentes</button>
    </div>
    <div class="note-section">
        <button class="speech-mic-btn" title="Dictée vocale" type="button" tabindex="0">🎤</button>
        <textarea
            class="note-textarea"
            placeholder="Commentaires..."
            data-textarea-key="${key}"
            onblur="saveNoteOnBlur('${key}')"
            oninput="updateNoteStatus('${key}')"
        >${notes[key] || ''}</textarea>
        <button class="note-delete-btn" onclick="deleteNote('${key}')" title="Effacer la note">🗑️</button>
    </div>
`;
    container.appendChild(row);
    const rating = evaluations[key] || 0;
    row.querySelectorAll('.rating-btn').forEach((btn, idx) => {
        btn.classList.toggle('selected', idx + 1 === rating);
    });
    return row;
}

function setRating(key, rating) {
    evaluations[key] = rating;
    const row = document.querySelector(`.student-row[data-student-key="${key}"]`);
    if (!row) return;
    row.querySelectorAll('.rating-btn').forEach((btn, idx) => {
        btn.classList.toggle('selected', idx + 1 === rating);
    });
    updateVisualIndicators();
    updateProgress();
}
window.setRating = setRating;

function toggleTechnique(catIndex, techIndex) {
    const technique = document.querySelector(`[data-technique="${catIndex}-${techIndex}"]`);
    if (technique) technique.classList.toggle('open');
}
window.toggleTechnique = toggleTechnique;

function switchTab(index) {
    currentTab = index;
    document.querySelectorAll('.tab').forEach((tab, i) => tab.classList.toggle('active', i === index));
    renderTabContent(currentProgramData, currentStudentList);
    updateVisualIndicators();
    updateProgress();
}
window.switchTab = switchTab;

function updateNoteStatus(key) {
    const textarea = document.querySelector(`[data-textarea-key="${key}"]`);
    if (textarea) notes[key] = textarea.value;
}
window.updateNoteStatus = updateNoteStatus;

function saveNoteOnBlur(key) {
    const textarea = document.querySelector(`[data-textarea-key="${key}"]`);
    if (textarea) notes[key] = textarea.value;
}
window.saveNoteOnBlur = saveNoteOnBlur;

function deleteNote(key) {
    notes[key] = '';
    const textarea = document.querySelector(`[data-textarea-key="${key}"]`);
    if (textarea) textarea.value = '';
}
window.deleteNote = deleteNote;

function updateProgress() {
    if (!currentProgramData || !currentStudentList) return;
    const program = currentProgramData;
    const studentList = currentStudentList;
    let total = 0, done = 0;
    program.forEach((cat, catIndex) => {
        cat.techniques.forEach((tech, techIndex) => {
            studentList.forEach((student, studentIndex) => {
                total++;
                const key = `${currentBelt}-${currentPromotion}-${catIndex}-${techIndex}-${studentIndex}`;
                if (evaluations[key] && evaluations[key] > 0) done++;
            });
        });
    });
    const percentage = total > 0 ? (done / total) * 100 : 0;
    document.getElementById('progressText').textContent = `${done}/${total}`;
    document.getElementById('progressFill').style.width = `${percentage}%`;
}

function getTechniqueCompletionStatus(catIndex, techIndex, studentList) {
    let total = studentList.length, done = 0;
    studentList.forEach((_, studentIndex) => {
        const key = `${currentBelt}-${currentPromotion}-${catIndex}-${techIndex}-${studentIndex}`;
        if (evaluations[key] && evaluations[key] > 0) done++;
    });
    if (done === total) return 'completed';
    if (done > 0) return 'incomplete';
    return 'not-started';
}

function getCategoryCompletionStatus(catIndex, numTechniques, studentList) {
    let completedTechniques = 0;
    for (let i = 0; i < numTechniques; i++) {
        const status = getTechniqueCompletionStatus(catIndex, i, studentList);
        if (status === 'completed') completedTechniques++;
    }
    return completedTechniques === numTechniques ? 'completed' : 'incomplete';
}

function updateVisualIndicators() {
    if (!currentProgramData || !currentStudentList) return;
    const program = currentProgramData;
    const studentList = currentStudentList;
    document.querySelectorAll('.tab').forEach((tab, index) => {
        const categoryStatus = getCategoryCompletionStatus(index, program[index].techniques.length, studentList);
        tab.classList.toggle('completed', categoryStatus === 'completed');
        tab.classList.remove('incomplete', 'not-started');
    });
    program.forEach((cat, catIndex) => {
        cat.techniques.forEach((tech, techIndex) => {
            const techniqueKey = `${catIndex}-${techIndex}`;
            const card = document.querySelector(`[data-technique="${techniqueKey}"]`);
            if (card) {
                const status = getTechniqueCompletionStatus(catIndex, techIndex, studentList);
                card.classList.remove('completed', 'incomplete', 'not-started');
                card.classList.add(status);
                const statusIcon = card.querySelector('.technique-status');
                if (statusIcon) {
                    if (status === 'completed') {
                        statusIcon.textContent = '✓';
                    } else if (status === 'incomplete') {
                        statusIcon.textContent = '!';
                    } else {
                        statusIcon.textContent = '●';
                    }
                }
            }
        });
    });
}

async function saveEvaluations() {
    const evaluatorName = evaluatorInput.value.trim();
    if (!currentBelt || !currentPromotion || !currentProgramId || !currentPromotionId) {
        alert('Sélectionnez une ceinture et une promotion.');
        return;
    }
    const now = new Date();
    const rows = [];
    if (!currentProgramData || !currentStudentList) {
        alert('Aucune donnée à sauvegarder.');
        return;
    }
    currentProgramData.forEach((cat, catIndex) => {
        cat.techniques.forEach((tech, techIndex) => {
            currentStudentList.forEach((student, studentIndex) => {
                const key = `${currentBelt}-${currentPromotion}-${catIndex}-${techIndex}-${studentIndex}`;
                const score = (typeof evaluations[key] === 'number') ? evaluations[key] : 0;
                const note = notes[key] || '';
                if (score > 0 || note) {
                    rows.push({
                        student_id: studentIdMap[student],
                        program_id: currentProgramId,
                        category_id: cat.id,
                        technique_id: tech.id,
                        evaluator_name: evaluatorName,
                        score: score,
                        comment: note,
                        evaluated_at: now.toISOString()
                    });
                }
            });
        });
    });
    if (rows.length === 0) {
        alert('Aucune évaluation à sauvegarder.');
        return;
    }
    let errorCount = 0;
    for (const row of rows) {
        const { error } = await supabase.from('evaluations').upsert(row, {
            onConflict: ['student_id', 'program_id', 'category_id', 'technique_id', 'evaluator_name']
        });
        if (error) {
            errorCount++;
            console.error('Erreur sauvegarde:', error);
        }
    }
    if (errorCount === 0) {
        alert('Évaluations sauvegardées avec succès.');
    } else {
        alert(`Sauvegarde terminée avec ${errorCount} erreur(s).`);
    }
}
window.saveEvaluations = saveEvaluations;

function resetAllNotesAndRatings() {
    if (!confirm('Effacer toutes les notes et évaluations pour ce formulaire ?')) return;
    if (typeof notes === 'object') Object.keys(notes).forEach(k => notes[k] = '');
    if (typeof evaluations === 'object') Object.keys(evaluations).forEach(k => evaluations[k] = 0);
    if (typeof renderTabContent === 'function') renderTabContent(currentProgramData, currentStudentList);
    if (typeof updateVisualIndicators === 'function') updateVisualIndicators();
    if (typeof updateProgress === 'function') updateProgress();
}
window.resetAllNotesAndRatings = resetAllNotesAndRatings;
document.getElementById('resetButton').onclick = resetAllNotesAndRatings;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPrograms();
    await loadPromotions();
    renderEvaluation();
    beltSelect.addEventListener('change', renderEvaluation);
    promotionSelect.addEventListener('change', renderEvaluation);
});
