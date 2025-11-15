// script.js (module)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ────────── CONFIG ──────────
// Remplace ces placeholders par les valeurs de ton projet Supabase
const SUPABASE_URL = 'https://gcdruwruygjclvszgerc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NPo8JYU8do60kvTzt_3Wbw_vI3O2DEU' // Safe for browser - RLS activate

//const SUPABASE_URL = 'http://127.0.0.1:54321'
//const SUPABASE_ANON_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
// IMPORTANT: ne mets jamais de service_role key dans ce fichier public

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// État applicatif
let currentProgram = null
let eleves = []
let isAccordion = false

// DOM refs
const programSelect = document.getElementById('programSelect')
const promotionSelect = document.getElementById('promotionSelect')
const tablesContainer = document.getElementById('tables-container')
const toggleView = document.getElementById('toggleView')
const dateInput = document.getElementById('date')

// Défaut date = aujourd'hui
dateInput.valueAsDate = new Date()

// --------- Chargements initial ---------
async function loadPrograms(){
    programSelect.innerHTML = '<option value="">Chargement…</option>'
    const { data, error } = await supabase.from('programs').select('*').eq('active', true).order('created_at', { ascending: false })
    if(error){ console.error('loadPrograms', error); programSelect.innerHTML = '<option value="">Erreur</option>'; return }
    programSelect.innerHTML = '<option value="">— Sélectionner —</option>'
    data.forEach(p => {
        const opt = document.createElement('option')
        opt.value = p.id
        opt.textContent = `${p.name} ${p.version ? `(v${p.version})` : ''}`
        programSelect.appendChild(opt)
    })
}

async function loadPromotions(){
    promotionSelect.innerHTML = '<option value="">Chargement…</option>'
    const { data, error } = await supabase.from('promotions').select('id,name').order('name', { ascending: true })
    if(error){ console.error('loadPromotions', error); promotionSelect.innerHTML = '<option value="">Erreur</option>'; return }
    promotionSelect.innerHTML = '<option value="">— Sélectionner —</option>'
    data.forEach(p => {
        const opt = document.createElement('option')
        opt.value = p.id
        opt.textContent = p.name
        promotionSelect.appendChild(opt)
    })
}

// Charge catégories + techniques pour un programme
async function loadProgramDetails(programId){
    if(!programId) return
    const { data: categories, error } = await supabase
        .from('categories')
        .select('*, techniques(*)')
        .eq('program_id', programId)
        .order('created_at', { ascending: true })
    if(error){ console.error('loadProgramDetails', error); return }
    currentProgram = categories
    if(eleves.length) renderTables()
}

// Charge élèves d'une promotion via students_promotions -> students(id, name)
async function loadStudents(promotionId){
    if(!promotionId) return
    tablesContainer.innerHTML = '<p class="loading">Chargement des élèves…</p>'
    const { data, error } = await supabase
        .from('students_promotions')
        .select('student:students(id,name)')
        .eq('promotion_id', promotionId)
    if(error){ console.error('loadStudents', error); tablesContainer.innerHTML = '<p class="loading">Erreur en chargeant élèves</p>'; return }
    eleves = data.map(link => link.student) // [{id, name}]
    if(currentProgram) renderTables()
    else tablesContainer.innerHTML = '<p class="loading">Sélectionne un programme.</p>'
}

// RENDER (tableau ou accordéon technique -> élèves)
function renderTables(){
    tablesContainer.innerHTML = ''
    if(!currentProgram || eleves.length === 0){
        tablesContainer.innerHTML = '<p class="loading">Sélectionne un programme et une promotion.</p>'
        return
    }

    currentProgram.forEach(cat => {
        const section = document.createElement('div')
        section.className = 'cat-section'
        const title = document.createElement('h2')
        title.textContent = cat.title || cat.name || 'Catégorie'
        section.appendChild(title)

        if(!isAccordion){
            // ---------- TABLE MODE ----------
            const scrollDiv = document.createElement('div'); scrollDiv.className = 'table-scroll'
            const table = document.createElement('table')
            // header
            const thead = document.createElement('thead'); const trHead = document.createElement('tr')
            trHead.appendChild(document.createElement('th'))
            cat.techniques.forEach(t => {
                const th = document.createElement('th'); th.textContent = t.name || t
                trHead.appendChild(th)
            })
            thead.appendChild(trHead); table.appendChild(thead)
            // body
            const tbody = document.createElement('tbody')
            eleves.forEach(eleve => {
                const tr = document.createElement('tr')
                const tdName = document.createElement('td'); tdName.textContent = eleve.name; tr.appendChild(tdName)
                cat.techniques.forEach(tech => {
                    const td = document.createElement('td')
                    td.appendChild(createStarDiv(cat.id, tech.id, eleve.id))
                    tr.appendChild(td)
                })
                tbody.appendChild(tr)
            })
            table.appendChild(tbody); scrollDiv.appendChild(table)
            section.appendChild(scrollDiv)
        } else {
            // ---------- ACCORDION MODE: show techniques, click -> students ----------
            cat.techniques.forEach(tech => {
                const techDiv = document.createElement('div'); techDiv.className = 'accordion-tech'; techDiv.textContent = tech.name || tech
                const content = document.createElement('div'); content.className = 'accordion-content'
                // students inside
                eleves.forEach(eleve => {
                    const row = document.createElement('div'); row.className = 'accordion-row'
                    const nameDiv = document.createElement('div'); nameDiv.className = 'accordion-student'; nameDiv.textContent = eleve.name
                    const starDiv = createStarDiv(cat.id, tech.id, eleve.id)
                    row.appendChild(nameDiv); row.appendChild(starDiv)
                    content.appendChild(row)
                })
                // toggle behaviour (slide style via class)
                techDiv.addEventListener('click', () => {
                    const visible = content.style.display === 'flex'
                    content.style.display = visible ? 'none' : 'flex'
                    content.style.flexDirection = 'column'
                })
                section.appendChild(techDiv); section.appendChild(content)
            })
        }

        tablesContainer.appendChild(section)
    })
}

// Ajout d'un objet global pour stocker les notes temporaires
const ratings = {}

// Helper pour générer une clé unique
function ratingKey(studentId, catId, techId) {
    return `${studentId}_${catId}_${techId}`
}

// Helper: crée un div d'étoiles interactive (non-persistée)
function createStarDiv(catId, techId, eleveId){
    const starDiv = document.createElement('div')
    starDiv.className = 'star-rating'
    if (catId) starDiv.setAttribute('data-cat', catId)
    if (techId) starDiv.setAttribute('data-tech', techId)
    if (eleveId) starDiv.setAttribute('data-eleve', eleveId)
    // Appliquer le score déjà saisi si présent
    const key = ratingKey(eleveId, catId, techId);
    const filledCount = ratings[key] || 0;
    for(let i=1;i<=4;i++){
        const star = document.createElement('span')
        star.className = 'star'
        star.innerHTML = '★'
        star.dataset.value = i
        if(i <= filledCount) star.classList.add('filled');
        star.addEventListener('mouseenter', ()=> highlightStars(starDiv, i))
        star.addEventListener('mouseleave', ()=> resetStars(starDiv))
        star.addEventListener('click', ()=> setRating(starDiv, i, eleveId, catId, techId))
        starDiv.appendChild(star)
    }
    return starDiv
}

function highlightStars(div, count){
    div.querySelectorAll('.star').forEach((s, idx) => s.classList.toggle('hovered', idx < count))
}
function resetStars(div){
    div.querySelectorAll('.star').forEach(s => s.classList.remove('hovered'))
}
// setRating: met à jour ratings et l'affichage
function setRating(div, count, eleveId, catId, techId){
    div.querySelectorAll('.star').forEach((s, idx) => s.classList.toggle('filled', idx < count))
    // Mettre à jour ratings
    if(eleveId && catId && techId) {
        ratings[ratingKey(eleveId, catId, techId)] = count;
    }
}

// Ajout du bouton Sauvegarder si absent
function ensureSaveButton(){
    if (!document.getElementById('saveBtn')) {
        const saveBtn = document.createElement('button')
        saveBtn.textContent = 'Sauvegarder'
        saveBtn.className = 'submit-btn'
        saveBtn.id = 'saveBtn'
        document.querySelector('.wrap .card').appendChild(saveBtn)
    }
}
ensureSaveButton();

// Ajout de l'eventListener pour la sauvegarde
const saveBtn = document.getElementById('saveBtn')
saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const evaluator = document.getElementById('evaluator').value;
    const date = document.getElementById('date').value;
    const programId = programSelect.value;
    if(!evaluator || !date || !programId) {
        alert('Veuillez remplir nom, date et programme.');
        return;
    }
    const evaluations = [];
    if(!currentProgram || !eleves.length) {
        alert('Aucune donnée à sauvegarder.');
        return;
    }
    currentProgram.forEach(cat => {
        cat.techniques.forEach(tech => {
            eleves.forEach(eleve => {
                // Utiliser ratings si présent, sinon compter les étoiles dans le DOM (pour compatibilité)
                const key = ratingKey(eleve.id, cat.id, tech.id);
                const score = ratings[key] !== undefined
                    ? ratings[key]
                    : (() => {
                        const starDiv = document.querySelector(
                            `.star-rating[data-cat="${cat.id}"][data-tech="${tech.id}"][data-eleve="${eleve.id}"]`
                        );
                        return starDiv ? [...starDiv.children].filter(s => s.classList.contains('filled')).length : 0;
                    })();
                evaluations.push({
                    student_id: eleve.id,
                    program_id: programId,
                    category_id: cat.id,
                    technique_id: tech.id,
                    evaluator_name: evaluator,
                    score,
                    evaluated_at: date
                });
            });
        });
    });
    if (!evaluations.length) {
        alert("Aucune évaluation à sauvegarder.");
        return;
    }
    try {
        const { error } = await supabase
            .from('evaluations')
            .upsert(evaluations, {
                onConflict: ['student_id', 'program_id', 'category_id', 'technique_id', 'evaluator_name']
            });
        if (error) throw error;
        alert("Évaluations sauvegardées avec succès !");
    } catch (err) {
        console.error(err);
        alert("Erreur lors de la sauvegarde.");
    }
});

// EVENTS
programSelect.addEventListener('change', e => loadProgramDetails(e.target.value))
promotionSelect.addEventListener('change', e => loadStudents(e.target.value))
toggleView.addEventListener('change', e => { isAccordion = e.target.checked; renderTables() })

// INIT
loadPrograms()
loadPromotions()

// Expose small helper for debug in console (optional)
window._ke_debug = { loadPrograms, loadPromotions, loadProgramDetails, loadStudents, renderTables }
