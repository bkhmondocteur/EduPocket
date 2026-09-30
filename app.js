document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const viewHome = document.getElementById('view-home');
    const viewDashboard = document.getElementById('view-dashboard');
    const formAddStudent = document.getElementById('form-add-student');
    const formAddSession = document.getElementById('form-add-session');
    const btnBack = document.getElementById('btn-back');
    const dateInput = document.getElementById('date-seance');
    
    // État de l'application
    let currentStudentId = null;

    // Masque de saisie strict pour la date (JJ/MM/AAAA)
    dateInput.addEventListener('input', function(e) {
        if (e.inputType === 'deleteContentBackward') {
            // Laisse faire le comportement par défaut lors d'une suppression
            // Cependant, on s'assure qu'on ne reformate pas agressivement si on efface juste le slash.
        }
        
        let value = e.target.value.replace(/\D/g, ''); // Garde uniquement les chiffres
        if (value.length > 8) {
            value = value.substring(0, 8);
        }

        let formatted = '';
        if (value.length > 0) {
            formatted += value.substring(0, 2);
        }
        if (value.length > 2) {
            formatted += '/' + value.substring(2, 4);
        }
        if (value.length > 4) {
            formatted += '/' + value.substring(4, 8);
        }

        e.target.value = formatted;
    });

    dateInput.addEventListener('keydown', function(e) {
        // Empêcher la saisie d'autres caractères que les chiffres et touches de contrôle
        if (!/[\d\b\t\n\r]/.test(e.key) && e.key.indexOf('Arrow') === -1 && !e.ctrlKey && !e.metaKey && e.key !== 'Backspace' && e.key !== 'Delete') {
            e.preventDefault();
        }
    });

    // Navigation
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'view-home') {
            loadStudents();
        }
    }

    btnBack.addEventListener('click', () => {
        currentStudentId = null;
        showView('view-home');
        formAddStudent.reset();
    });

    // Gestion des élèves
    formAddStudent.addEventListener('submit', (e) => {
        e.preventDefault();
        const nom = document.getElementById('nom').value.trim();
        const prenom = document.getElementById('prenom').value.trim();
        const classe = document.getElementById('classe').value.trim();

        if (nom && prenom && classe) {
            const studentId = 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const student = { id: studentId, nom, prenom, classe, sessions: [] };
            
            saveStudent(student);
            currentStudentId = studentId;
            
            loadDashboard(student);
            showView('view-dashboard');
        }
    });

    // Gestion des séances
    formAddSession.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = dateInput.value;
        const sujet = document.getElementById('sujet-seance').value.trim();
        const statut = document.getElementById('statut-seance').value;

        // Validation basique de la date (longueur 10 : JJ/MM/AAAA)
        if (date.length !== 10) {
            alert('Veuillez entrer une date complète au format JJ/MM/AAAA.');
            return;
        }

        // Validation simple des jours et mois
        const day = parseInt(date.substring(0, 2), 10);
        const month = parseInt(date.substring(3, 5), 10);
        if (day < 1 || day > 31 || month < 1 || month > 12) {
            alert('Veuillez entrer une date valide.');
            return;
        }

        if (date && sujet && currentStudentId) {
            const student = getStudent(currentStudentId);
            const sessionId = 'ses_' + Date.now();
            student.sessions.push({ id: sessionId, date, sujet, statut, timestamp: Date.now() });
            
            saveStudent(student);
            populateSubjectsFilter(student);
            renderFilteredSessions();
            formAddSession.reset();
        }
    });

    // Filtres et Tri
    const filterStatus = document.getElementById('filter-status');
    const filterMatiere = document.getElementById('filter-matiere');
    const sortBy = document.getElementById('sort-by');

    filterStatus.addEventListener('change', renderFilteredSessions);
    filterMatiere.addEventListener('change', renderFilteredSessions);
    sortBy.addEventListener('change', renderFilteredSessions);

    function populateSubjectsFilter(student) {
        const currentSelection = filterMatiere.value;
        const subjects = new Set();
        if (student.sessions) {
            student.sessions.forEach(s => {
                if (s.sujet) subjects.add(s.sujet);
            });
        }
        
        filterMatiere.innerHTML = '<option value="Toutes">Toutes les matières</option>';
        Array.from(subjects).sort().forEach(subj => {
            const option = document.createElement('option');
            option.value = subj;
            option.textContent = subj;
            filterMatiere.appendChild(option);
        });
        
        // Restore selection if it still exists, else default to 'Toutes'
        if (subjects.has(currentSelection)) {
            filterMatiere.value = currentSelection;
        } else {
            filterMatiere.value = 'Toutes';
        }
    }

    function renderFilteredSessions() {
        if (!currentStudentId) return;
        const student = getStudent(currentStudentId);
        let sessions = student.sessions || [];

        // Filtrage Statut
        const statusFilter = filterStatus.value;
        if (statusFilter !== 'Tous') {
            sessions = sessions.filter(s => (s.statut || 'Planifiée') === statusFilter);
        }

        // Filtrage Matière
        const matiereFilter = filterMatiere.value;
        if (matiereFilter !== 'Toutes') {
            sessions = sessions.filter(s => s.sujet === matiereFilter);
        }

        // Tri
        const sortOption = sortBy.value;
        sessions.sort((a, b) => {
            if (sortOption.startsWith('date')) {
                const partsA = a.date.split('/');
                const partsB = b.date.split('/');
                const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
                const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
                return sortOption === 'date-desc' ? dateB - dateA : dateA - dateB;
            } else if (sortOption.startsWith('matiere')) {
                const cmp = a.sujet.localeCompare(b.sujet);
                return sortOption === 'matiere-asc' ? cmp : -cmp;
            }
            return 0;
        });

        renderSessionsList(sessions, student);
    }

    // Persistance (localStorage)
    function saveStudent(student) {
        const students = JSON.parse(localStorage.getItem('edupocket_students') || '{}');
        students[student.id] = student;
        localStorage.setItem('edupocket_students', JSON.stringify(students));
    }

    function getStudent(id) {
        const students = JSON.parse(localStorage.getItem('edupocket_students') || '{}');
        return students[id];
    }

    // Affichage UI
    function loadStudents() {
        const list = document.getElementById('saved-students-list');
        list.innerHTML = '';
        const studentsObj = JSON.parse(localStorage.getItem('edupocket_students') || '{}');
        const students = Object.values(studentsObj);
        
        if (students.length === 0) {
            list.innerHTML = '<li><span style="color: #999;">Aucun élève dans la base de données.</span></li>';
            return;
        }

        students.forEach(student => {
            const li = document.createElement('li');
            li.addEventListener('click', () => {
                currentStudentId = student.id;
                loadDashboard(student);
                showView('view-dashboard');
            });

            const spanName = document.createElement('span');
            spanName.className = 'student-name';
            spanName.textContent = `${student.prenom} ${student.nom}`;
            
            const spanClass = document.createElement('span');
            spanClass.className = 'student-class-badge';
            spanClass.textContent = student.classe;
            
            li.appendChild(spanName);
            li.appendChild(spanClass);
            list.appendChild(li);
        });
    }

    function loadDashboard(student) {
        document.getElementById('student-fullname').textContent = `${student.prenom} ${student.nom}`;
        document.getElementById('student-class').textContent = student.classe;
        filterStatus.value = 'Tous';
        filterMatiere.value = 'Toutes';
        sortBy.value = 'date-desc';
        populateSubjectsFilter(student);
        renderFilteredSessions();
    }

    function renderSessionsList(sessions, student) {
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        
        if (sessions.length === 0) {
            list.innerHTML = '<li><span style="color: #999;">Aucune séance trouvée.</span></li>';
            return;
        }

        sessions.forEach(session => {
            const li = document.createElement('li');
            
            const header = document.createElement('div');
            header.className = 'session-header';
            
            const spanDate = document.createElement('span');
            spanDate.className = 'session-date';
            spanDate.textContent = session.date;
            
            const spanSubject = document.createElement('span');
            spanSubject.className = 'session-subject';
            spanSubject.textContent = session.sujet;
            
            header.appendChild(spanDate);
            header.appendChild(spanSubject);
            
            const actions = document.createElement('div');
            actions.className = 'session-actions';
            
            const statusSelect = document.createElement('select');
            const options = ['Planifiée', 'Effectuée', 'Annulée'];
            options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt;
                optionEl.textContent = opt;
                if ((session.statut || 'Planifiée') === opt) {
                    optionEl.selected = true;
                }
                statusSelect.appendChild(optionEl);
            });
            
            statusSelect.addEventListener('change', (e) => {
                // Update in DB
                const freshStudent = getStudent(student.id);
                const targetSession = freshStudent.sessions.find(s => s.id === session.id || s.timestamp === session.timestamp);
                if (targetSession) {
                    targetSession.statut = e.target.value;
                    saveStudent(freshStudent);
                    renderFilteredSessions();
                }
            });
            
            actions.appendChild(statusSelect);
            
            li.appendChild(header);
            li.appendChild(actions);
            list.appendChild(li);
        });
    }

    // Initialisation
    loadStudents();
});

// Installation de la PWA
let deferredPrompt;
const btnInstall = document.getElementById('btn-install');

window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique de l'invite sur certains navigateurs
    e.preventDefault();
    // Sauvegarder l'événement pour le déclencher plus tard
    deferredPrompt = e;
    // Afficher le bouton d'installation
    if (btnInstall) {
        btnInstall.style.display = 'block';
    }
});

if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Afficher l'invite d'installation
            deferredPrompt.prompt();
            // Attendre la réponse de l'utilisateur
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('Installation acceptée');
            }
            // Réinitialiser la variable
            deferredPrompt = null;
            btnInstall.style.display = 'none';
        }
    });
}
window.addEventListener('appinstalled', () => {
    // L'application a été installée
    if (btnInstall) {
        btnInstall.style.display = 'none';
    }
});
