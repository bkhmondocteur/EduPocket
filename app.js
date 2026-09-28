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
            student.sessions.push({ date, sujet, timestamp: Date.now() });
            
            // Tri par ordre chronologique (du plus récent au plus ancien ou inverse, ici ordre chronologique)
            student.sessions.sort((a, b) => {
                const partsA = a.date.split('/');
                const partsB = b.date.split('/');
                const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
                const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
                return dateA - dateB;
            });

            saveStudent(student);
            renderSessions(student.sessions);
            formAddSession.reset();
        }
    });

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
        renderSessions(student.sessions);
    }

    function renderSessions(sessions) {
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        
        if (sessions.length === 0) {
            list.innerHTML = '<li><span style="color: #999;">Aucune séance planifiée ou faite.</span></li>';
            return;
        }

        sessions.forEach(session => {
            const li = document.createElement('li');
            
            const spanDate = document.createElement('span');
            spanDate.className = 'session-date';
            spanDate.textContent = session.date;
            
            const spanSubject = document.createElement('span');
            spanSubject.className = 'session-subject';
            spanSubject.textContent = session.sujet;
            
            li.appendChild(spanDate);
            li.appendChild(spanSubject);
            list.appendChild(li);
        });
    }

    // Initialisation
    loadStudents();
});
