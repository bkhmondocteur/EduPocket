document.addEventListener('DOMContentLoaded', () => {
    // --- ÉTAT GLOBAL DE L'APPLICATION ---
    let appState = {
        role: localStorage.getItem('edupocket_role') || null, // 'parent' | 'eleve' | 'professeur' | null
        familyId: localStorage.getItem('edupocket_family_id') || null,
        currentStudentId: null,
        profName: localStorage.getItem('edupocket_prof_name') || '',
        data: null // Données de la famille (étudiants, séances, matières)
    };

    // Initialisation du Code Famille si inexistant
    if (!appState.familyId) {
        appState.familyId = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        localStorage.setItem('edupocket_family_id', appState.familyId);
    }

    // Éléments du DOM
    const viewRoleSelection = document.getElementById('view-role-selection');
    const viewHome = document.getElementById('view-home');
    const viewDashboard = document.getElementById('view-dashboard');
    const headerRoleBadge = document.getElementById('header-role-badge');
    const btnSyncStatus = document.getElementById('btn-sync-status');
    const displayFamilyCode = document.getElementById('display-family-code');
    const settingsFamilyCode = document.getElementById('settings-family-code');
    const dateInput = document.getElementById('date-seance');
    const heureInput = document.getElementById('heure-seance');
    const modalSettings = document.getElementById('modal-settings');
    const modalPayment = document.getElementById('modal-payment');

    // --- MASQUES DE SAISIE RIGOUREUX ---
    // 1. Masque Date (JJ/MM/AAAA)
    dateInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.substring(0, 8);
        let formatted = '';
        if (val.length > 0) formatted += val.substring(0, 2);
        if (val.length > 2) formatted += '/' + val.substring(2, 4);
        if (val.length > 4) formatted += '/' + val.substring(4, 8);
        e.target.value = formatted;
    });

    // 2. Masque Heure (HH:MM)
    heureInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 4) val = val.substring(0, 4);
        let formatted = '';
        if (val.length > 0) formatted += val.substring(0, 2);
        if (val.length > 2) formatted += ':' + val.substring(2, 4);
        e.target.value = formatted;
    });

    // Masque date dans le modal de paiement
    const payDateInput = document.getElementById('pay-date');
    if (payDateInput) {
        payDateInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 8) val = val.substring(0, 8);
            let formatted = '';
            if (val.length > 0) formatted += val.substring(0, 2);
            if (val.length > 2) formatted += '/' + val.substring(2, 4);
            if (val.length > 4) formatted += '/' + val.substring(4, 8);
            e.target.value = formatted;
        });
    }

    // --- NAVIGATION ET ROUTAGE ---
    function showView(viewElement) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        viewElement.classList.add('active');
    }

    function updateRoleUI() {
        if (!appState.role) {
            headerRoleBadge.textContent = 'Sélection de rôle';
            showView(viewRoleSelection);
            return;
        }

        const roleLabels = {
            'parent': '👨‍👩‍👧 Parent',
            'eleve': '🎓 Élève',
            'professeur': '👨‍🏫 Professeur'
        };
        headerRoleBadge.textContent = roleLabels[appState.role] || appState.role;
        document.getElementById('settings-current-role').textContent = roleLabels[appState.role] || appState.role;

        const homeRoleDesc = document.getElementById('home-role-description');
        const cardAddStudent = document.getElementById('card-add-student-container');
        const sectionStudents = document.getElementById('section-students-management');
        const sectionProf = document.getElementById('section-prof-setup');

        if (appState.role === 'parent') {
            homeRoleDesc.innerHTML = '<strong>Espace Parents :</strong> Vous pouvez gérer vos enfants, configurer les matières, les tarifs de rattrapage et suivre les paiements.';
            cardAddStudent.style.display = 'block';
            sectionStudents.style.display = 'block';
            sectionProf.style.display = 'none';
        } else if (appState.role === 'eleve') {
            homeRoleDesc.innerHTML = '<strong>Espace Élève :</strong> Planifiez vos séances de cours et suivez votre calendrier de rattrapage.';
            cardAddStudent.style.display = 'block'; // Un élève autonome peut s'ajouter lui-même
            sectionStudents.style.display = 'block';
            sectionProf.style.display = 'none';
        } else if (appState.role === 'professeur') {
            homeRoleDesc.innerHTML = '<strong>Espace Professeur :</strong> Confirmez et validez les séances planifiées par vos élèves.';
            cardAddStudent.style.display = 'none';
            sectionStudents.style.display = 'block';
            sectionProf.style.display = 'block';
            document.getElementById('prof-self-name').value = appState.profName || '';
        }

        if (displayFamilyCode) displayFamilyCode.textContent = appState.familyId;
        if (settingsFamilyCode) settingsFamilyCode.textContent = appState.familyId;

        loadStudentsList();
        showView(viewHome);
    }

    // --- GESTION DU CHOIX DU RÔLE (VUE 0) ---
    let tempSelectedRole = null;
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            tempSelectedRole = card.getAttribute('data-role');
            document.getElementById('btn-confirm-role').disabled = false;
        });
    });

    document.getElementById('btn-confirm-role').addEventListener('click', () => {
        if (tempSelectedRole) {
            appState.role = tempSelectedRole;
            localStorage.setItem('edupocket_role', appState.role);
            updateRoleUI();
        }
    });

    // Réinitialiser le rôle dans les réglages
    document.getElementById('btn-reset-role').addEventListener('click', () => {
        if (confirm("Voulez-vous réinitialiser votre profil pour choisir un autre rôle ?")) {
            localStorage.removeItem('edupocket_role');
            appState.role = null;
            modalSettings.style.display = 'none';
            tempSelectedRole = null;
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('btn-confirm-role').disabled = true;
            updateRoleUI();
        }
    });

    // --- GESTION DES DONNÉES & FIREBASE FIRESTORE ---
    function getDefaultData() {
        return {
            familyId: appState.familyId,
            students: []
        };
    }

    function initDataPersistence() {
        // 1. Chargement initial depuis localStorage
        const local = localStorage.getItem('edupocket_family_data_' + appState.familyId);
        if (local) {
            try {
                appState.data = JSON.parse(local);
            } catch (e) {
                appState.data = getDefaultData();
            }
        } else {
            // Migration des anciennes données edupocket_students si présentes
            const legacy = localStorage.getItem('edupocket_students');
            if (legacy) {
                try {
                    const legacyStudents = Object.values(JSON.parse(legacy));
                    appState.data = {
                        familyId: appState.familyId,
                        students: legacyStudents
                    };
                } catch(e) {
                    appState.data = getDefaultData();
                }
            } else {
                appState.data = getDefaultData();
            }
        }

        // 2. Écoute temps réel Firebase Firestore
        if (typeof db !== 'undefined' && db) {
            btnSyncStatus.textContent = '🟢';
            btnSyncStatus.title = 'Connecté à Firestore en temps réel';

            db.collection('edupocket_families').doc(appState.familyId).onSnapshot(doc => {
                if (doc.exists) {
                    const cloudData = doc.data();
                    if (cloudData && cloudData.students) {
                        appState.data = cloudData;
                        localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
                        refreshCurrentView();
                    }
                } else {
                    // Sauvegarde initiale dans le cloud
                    saveDataToCloud();
                }
            }, err => {
                console.warn("Erreur écoute Firestore :", err);
                btnSyncStatus.textContent = '🟡';
                btnSyncStatus.title = 'Mode local (Hors-ligne)';
            });
        } else {
            btnSyncStatus.textContent = '🟡';
            btnSyncStatus.title = 'Mode local (Hors-ligne)';
        }
    }

    function saveData() {
        if (!appState.data) appState.data = getDefaultData();
        // Sauvegarde locale
        localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
        // Sauvegarde cloud Firestore
        saveDataToCloud();
        refreshCurrentView();
    }

    function saveDataToCloud() {
        if (typeof db !== 'undefined' && db && appState.data) {
            db.collection('edupocket_families').doc(appState.familyId).set(appState.data)
                .catch(err => console.warn("Erreur enregistrement Cloud :", err));
        }
    }

    function refreshCurrentView() {
        if (viewHome.classList.contains('active')) {
            loadStudentsList();
        } else if (viewDashboard.classList.contains('active') && appState.currentStudentId) {
            const student = getStudent(appState.currentStudentId);
            if (student) loadDashboard(student);
        }
    }

    function getStudent(id) {
        if (!appState.data || !appState.data.students) return null;
        return appState.data.students.find(s => s.id === id);
    }

    // --- GESTION DES ÉLÈVES (ACCUEIL) ---
    function loadStudentsList() {
        const list = document.getElementById('saved-students-list');
        list.innerHTML = '';

        if (!appState.data || !appState.data.students || appState.data.students.length === 0) {
            list.innerHTML = '<li><span style="color: #94A3B8;">Aucun élève enregistré. Ajoutez-en un ci-dessous !</span></li>';
            return;
        }

        appState.data.students.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong style="font-size: 1.05rem;">${student.prenom} ${student.nom}</strong>
                    <div style="font-size: 0.85rem; color: #64748B; margin-top: 2px;">
                        ${(student.sessions || []).length} séance(s) planifiée(s)
                    </div>
                </div>
                <span class="student-class-badge">${student.classe}</span>
            `;
            li.addEventListener('click', () => {
                appState.currentStudentId = student.id;
                loadDashboard(student);
                showView(viewDashboard);
            });
            list.appendChild(li);
        });
    }

    // Formulaire d'ajout d'élève
    document.getElementById('form-add-student').addEventListener('submit', (e) => {
        e.preventDefault();
        const nom = document.getElementById('nom').value.trim();
        const prenom = document.getElementById('prenom').value.trim();
        const classe = document.getElementById('classe').value.trim();

        if (nom && prenom && classe) {
            const newStudent = {
                id: 'std_' + Date.now(),
                nom,
                prenom,
                classe,
                matieres: [
                    { nom: 'Anglais', prixSeance: 20, quotaPaiement: 3, professeurs: ['M. Dubois'] },
                    { nom: 'Mathématiques', prixSeance: 25, quotaPaiement: 4, professeurs: ['Mme Sonia'] }
                ],
                sessions: [],
                paiements: []
            };

            if (!appState.data.students) appState.data.students = [];
            appState.data.students.push(newStudent);
            saveData();

            appState.currentStudentId = newStudent.id;
            loadDashboard(newStudent);
            showView(viewDashboard);
            document.getElementById('form-add-student').reset();
        }
    });

    // Enregistrement du nom du prof
    const btnSaveProfName = document.getElementById('btn-save-prof-name');
    if (btnSaveProfName) {
        btnSaveProfName.addEventListener('click', () => {
            const name = document.getElementById('prof-self-name').value.trim();
            if (name) {
                appState.profName = name;
                localStorage.setItem('edupocket_prof_name', name);
                alert(`Nom de professeur enregistré : ${name}`);
            }
        });
    }

    // Bouton retour à l'accueil
    document.getElementById('btn-back').addEventListener('click', () => {
        appState.currentStudentId = null;
        showView(viewHome);
        loadStudentsList();
    });

    // Copie du code famille
    document.getElementById('btn-copy-code').addEventListener('click', () => {
        navigator.clipboard.writeText(appState.familyId).then(() => {
            alert('Code Famille copié : ' + appState.familyId);
        });
    });

    // --- TABLEAU DE BORD ÉLÈVE & SÉANCES ---
    function loadDashboard(student) {
        document.getElementById('student-fullname').textContent = `${student.prenom} ${student.nom}`;
        document.getElementById('student-class').textContent = student.classe;

        populateMatieresSelect(student);
        checkAndDisplayPaymentAlerts(student);
        renderFilteredSessions();
    }

    // Remplir les menus déroulants Matières et Professeurs
    function populateMatieresSelect(student) {
        const selectSujet = document.getElementById('sujet-seance');
        const selectProf = document.getElementById('prof-seance');
        const filterMatiere = document.getElementById('filter-matiere');

        selectSujet.innerHTML = '<option value="">-- Choisir une matière --</option>';
        filterMatiere.innerHTML = '<option value="Toutes">Toutes les matières</option>';

        const matieres = student.matieres || [];
        matieres.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.nom;
            opt.textContent = `${m.nom} (${m.prixSeance || 20} DT/séance)`;
            selectSujet.appendChild(opt);

            const filterOpt = document.createElement('option');
            filterOpt.value = m.nom;
            filterOpt.textContent = m.nom;
            filterMatiere.appendChild(filterOpt);
        });

        // Quand on change la matière, mettre à jour les professeurs correspondants
        selectSujet.onchange = () => {
            const chosenName = selectSujet.value;
            selectProf.innerHTML = '<option value="Non spécifié">Non spécifié</option>';
            const targetMatiere = matieres.find(m => m.nom === chosenName);
            if (targetMatiere && targetMatiere.professeurs) {
                targetMatiere.professeurs.forEach(prof => {
                    const profOpt = document.createElement('option');
                    profOpt.value = prof;
                    profOpt.textContent = prof;
                    selectProf.appendChild(profOpt);
                });
            }
        };
    }

    // --- GESTION DU CALCUL ET DES ALERTES DE PAIEMENT ---
    function checkAndDisplayPaymentAlerts(student) {
        const container = document.getElementById('payment-alerts-container');
        container.innerHTML = '';

        const matieres = student.matieres || [];
        const sessions = student.sessions || [];

        matieres.forEach(m => {
            const quota = m.quotaPaiement || 3;
            const prix = m.prixSeance || 20;

            // Compter les séances effectuées et NON payées
            const nonPayees = sessions.filter(s => s.sujet === m.nom && s.statut === 'Effectuée' && !s.paye);
            const count = nonPayees.length;

            if (count >= quota) {
                const totalDT = count * prix;
                const alertCard = document.createElement('div');
                alertCard.className = 'payment-alert-card';
                alertCard.innerHTML = `
                    <div class="payment-alert-content">
                        <div class="payment-alert-title">🚨 Quota de paiement atteint : ${m.nom}</div>
                        <div class="payment-alert-sub">${count} séance(s) effectuée(s) à régler • Montant total : <strong>${totalDT} DT</strong></div>
                    </div>
                    <button class="btn-pay-now">Payer (${totalDT} DT)</button>
                `;

                alertCard.querySelector('.btn-pay-now').addEventListener('click', () => {
                    openPaymentModal(student, m, nonPayees, totalDT);
                });

                container.appendChild(alertCard);
            }
        });
    }

    function openPaymentModal(student, matiere, sessionsToPay, totalDT) {
        const modalDesc = document.getElementById('payment-modal-desc');
        modalDesc.innerHTML = `Règlement pour <strong>${matiere.nom}</strong> (${sessionsToPay.length} séances) : <strong>${totalDT} DT</strong>`;
        
        // Date du jour préremplie
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        document.getElementById('pay-date').value = `${dd}/${mm}/${yyyy}`;

        modalPayment.style.display = 'flex';

        document.getElementById('btn-confirm-payment').onclick = () => {
            const datePaiement = document.getElementById('pay-date').value.trim();
            const note = document.getElementById('pay-note').value.trim();

            if (datePaiement.length !== 10) {
                alert('Veuillez entrer une date valide (JJ/MM/AAAA).');
                return;
            }

            // Marquer les séances comme payées
            sessionsToPay.forEach(s => {
                s.paye = true;
                s.datePaiement = datePaiement;
            });

            // Enregistrer l'historique du paiement
            if (!student.paiements) student.paiements = [];
            student.paiements.push({
                id: 'pay_' + Date.now(),
                matiere: matiere.nom,
                nombreSeances: sessionsToPay.length,
                montantTotal: totalDT,
                datePaiement,
                note
            });

            saveData();
            modalPayment.style.display = 'none';
            alert(`Paiement de ${totalDT} DT validé avec succès !`);
        };
    }

    document.getElementById('btn-close-payment').addEventListener('click', () => {
        modalPayment.style.display = 'none';
    });

    // --- AJOUT D'UNE SÉANCE ---
    document.getElementById('form-add-session').addEventListener('submit', (e) => {
        e.preventDefault();
        const date = dateInput.value.trim();
        const heure = heureInput.value.trim();
        const sujet = document.getElementById('sujet-seance').value;
        const prof = document.getElementById('prof-seance').value;
        const statut = document.getElementById('statut-seance').value;

        if (date.length !== 10) {
            alert('Veuillez entrer une date complète au format JJ/MM/AAAA.');
            return;
        }

        if (heure.length < 4) {
            alert('Veuillez entrer une heure de début au format HH:MM.');
            return;
        }

        if (!sujet) {
            alert('Veuillez sélectionner une matière.');
            return;
        }

        const student = getStudent(appState.currentStudentId);
        if (student) {
            // Validation croisée
            let validationStatut = 'Confirmee'; // Par défaut si pas d'ambiguïté
            if (appState.role === 'professeur') {
                validationStatut = 'En attente'; // Doit être confirmée par le parent ou l'élève
            } else if (prof !== 'Non spécifié') {
                validationStatut = 'En attente'; // Doit être confirmée par le professeur
            }

            const newSession = {
                id: 'ses_' + Date.now(),
                date,
                heure,
                sujet,
                professeur: prof,
                statut,
                validation: validationStatut,
                creePar: appState.role || 'parent',
                paye: false,
                datePaiement: null,
                timestamp: Date.now()
            };

            if (!student.sessions) student.sessions = [];
            student.sessions.push(newSession);

            saveData();
            document.getElementById('form-add-session').reset();
            alert('Séance planifiée avec succès !');
        }
    });

    // --- FILTRAGE ET TRI DES SÉANCES ---
    const filterStatus = document.getElementById('filter-status');
    const filterValidation = document.getElementById('filter-validation');
    const filterMatiere = document.getElementById('filter-matiere');
    const sortBy = document.getElementById('sort-by');

    filterStatus.addEventListener('change', renderFilteredSessions);
    filterValidation.addEventListener('change', renderFilteredSessions);
    filterMatiere.addEventListener('change', renderFilteredSessions);
    sortBy.addEventListener('change', renderFilteredSessions);

    function renderFilteredSessions() {
        if (!appState.currentStudentId) return;
        const student = getStudent(appState.currentStudentId);
        if (!student) return;

        let sessions = [...(student.sessions || [])];

        // 1. Filtrage Statut de présence
        if (filterStatus.value !== 'Tous') {
            sessions = sessions.filter(s => s.statut === filterStatus.value);
        }

        // 2. Filtrage Validation
        if (filterValidation.value !== 'Tous') {
            sessions = sessions.filter(s => s.validation === filterValidation.value);
        }

        // 3. Filtrage Matière
        if (filterMatiere.value !== 'Toutes') {
            sessions = sessions.filter(s => s.sujet === filterMatiere.value);
        }

        // 4. Tri
        sessions.sort((a, b) => {
            const opt = sortBy.value;
            if (opt.startsWith('date')) {
                const partsA = a.date.split('/');
                const partsB = b.date.split('/');
                const timeA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
                const timeB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
                return opt === 'date-desc' ? timeB - timeA : timeA - timeB;
            } else if (opt.startsWith('matiere')) {
                return opt === 'matiere-asc' ? a.sujet.localeCompare(b.sujet) : b.sujet.localeCompare(a.sujet);
            }
            return 0;
        });

        renderSessionsListDOM(sessions, student);
    }

    function renderSessionsListDOM(sessions, student) {
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';

        if (sessions.length === 0) {
            list.innerHTML = '<li><span style="color: #94A3B8;">Aucune séance trouvée pour ces critères.</span></li>';
            return;
        }

        sessions.forEach(session => {
            const li = document.createElement('li');

            // Badges
            const tagValidationClass = session.validation === 'Confirmee' ? 'tag-val-confirmee' : (session.validation === 'Refusee' ? 'tag-val-refusee' : 'tag-val-attente');
            const tagPaiementClass = session.paye ? 'tag-paye' : 'tag-non-paye';
            const textPaiement = session.paye ? `💰 Payé le ${session.datePaiement}` : '⏳ Non payé';

            // Boutons de validation croisée
            let showConfirmButtons = false;
            if (session.validation === 'En attente') {
                if (appState.role === 'professeur' && (session.creePar === 'parent' || session.creePar === 'eleve')) {
                    showConfirmButtons = true;
                } else if ((appState.role === 'parent' || appState.role === 'eleve') && session.creePar === 'professeur') {
                    showConfirmButtons = true;
                }
            }

            li.innerHTML = `
                <div class="session-main-row">
                    <div>
                        <span class="session-subject-title">${session.sujet}</span>
                        <div style="font-size: 0.85rem; color: #64748B; margin-top: 2px;">Prof: <strong>${session.professeur || 'Non spécifié'}</strong></div>
                    </div>
                    <div style="text-align: right;">
                        <span class="session-time-badge">📅 ${session.date}</span>
                        <div style="font-size: 0.85rem; color: #005A9C; font-weight: 600;">⏰ ${session.heure || '--:--'}</div>
                    </div>
                </div>

                <div class="session-meta-row">
                    <span class="tag-badge ${tagValidationClass}">${session.validation || 'Confirmee'}</span>
                    <span class="tag-badge ${tagPaiementClass}">${textPaiement}</span>
                    <span style="font-size: 0.8rem; color: #64748B; margin-left: auto;">Statut : <strong>${session.statut}</strong></span>
                </div>

                <div class="session-actions-row">
                    ${showConfirmButtons ? `
                        <div class="validation-buttons">
                            <button class="btn-action-sm btn-confirm" data-id="${session.id}">Confirmer</button>
                            <button class="btn-action-sm btn-reject" data-id="${session.id}">Refuser</button>
                        </div>
                    ` : `<div></div>`}
                    
                    <select class="select-change-status" data-id="${session.id}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.85rem;">
                        <option value="Planifiée" ${session.statut === 'Planifiée' ? 'selected' : ''}>Planifiée</option>
                        <option value="Effectuée" ${session.statut === 'Effectuée' ? 'selected' : ''}>Effectuée</option>
                        <option value="Annulée" ${session.statut === 'Annulée' ? 'selected' : ''}>Annulée</option>
                    </select>
                </div>
            `;

            // Événement changement de statut
            li.querySelector('.select-change-status').addEventListener('change', (e) => {
                const target = student.sessions.find(s => s.id === session.id);
                if (target) {
                    target.statut = e.target.value;
                    saveData();
                }
            });

            // Événements boutons de confirmation/refus
            if (showConfirmButtons) {
                li.querySelector('.btn-confirm').addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Confirmee';
                        saveData();
                        alert('Séance confirmée !');
                    }
                });

                li.querySelector('.btn-reject').addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Refusee';
                        saveData();
                        alert('Séance refusée !');
                    }
                });
            }

            list.appendChild(li);
        });
    }

    // --- MODAL RÉGLAGES ET TARIFS ---
    function openSettingsModal() {
        modalSettings.style.display = 'flex';
        renderMatieresConfigList();
    }

    document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
    const btnSubSettings = document.getElementById('btn-open-settings-sub');
    if (btnSubSettings) btnSubSettings.addEventListener('click', openSettingsModal);

    document.getElementById('btn-close-settings').addEventListener('click', () => {
        modalSettings.style.display = 'none';
    });

    // Navigation onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    function renderMatieresConfigList() {
        const container = document.getElementById('current-matieres-list');
        container.innerHTML = '';
        if (!appState.currentStudentId) {
            container.innerHTML = '<span style="color: #64748B;">Sélectionnez un élève pour configurer ses matières.</span>';
            return;
        }

        const student = getStudent(appState.currentStudentId);
        if (!student || !student.matieres || student.matieres.length === 0) {
            container.innerHTML = '<span style="color: #64748B;">Aucune matière configurée pour cet élève.</span>';
            return;
        }

        student.matieres.forEach((m, idx) => {
            const item = document.createElement('div');
            item.className = 'matiere-config-item';
            item.innerHTML = `
                <div>
                    <strong>${m.nom}</strong>
                    <div style="font-size: 0.85rem; color: #64748B;">
                        Prix : <strong>${m.prixSeance} DT</strong> | Quota : <strong>${m.quotaPaiement} séances</strong>
                        <br>Profs : ${m.professeurs ? m.professeurs.join(', ') : 'Aucun'}
                    </div>
                </div>
                <button class="btn-sm" style="background: #EF4444;" data-idx="${idx}">Supprimer</button>
            `;

            item.querySelector('button').addEventListener('click', () => {
                if (confirm(`Supprimer la matière ${m.nom} ?`)) {
                    student.matieres.splice(idx, 1);
                    saveData();
                    renderMatieresConfigList();
                    populateMatieresSelect(student);
                }
            });

            container.appendChild(item);
        });
    }

    // Formulaire d'ajout / modification de matière
    document.getElementById('form-config-matiere').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!appState.currentStudentId) {
            alert('Veuillez d\'abord sélectionner un élève sur l\'accueil.');
            return;
        }

        const student = getStudent(appState.currentStudentId);
        const nom = document.getElementById('cfg-nom-matiere').value.trim();
        const prix = parseFloat(document.getElementById('cfg-prix-seance').value);
        const quota = parseInt(document.getElementById('cfg-quota-seances').value, 10);
        const profsRaw = document.getElementById('cfg-professeurs').value.trim();
        const professeurs = profsRaw ? profsRaw.split(',').map(p => p.trim()).filter(p => p.length > 0) : [];

        if (nom && prix && quota) {
            if (!student.matieres) student.matieres = [];
            // Si la matière existe déjà, la mettre à jour
            const existing = student.matieres.find(m => m.nom.toLowerCase() === nom.toLowerCase());
            if (existing) {
                existing.prixSeance = prix;
                existing.quotaPaiement = quota;
                existing.professeurs = professeurs;
            } else {
                student.matieres.push({ nom, prixSeance: prix, quotaPaiement: quota, professeurs });
            }

            saveData();
            document.getElementById('form-config-matiere').reset();
            renderMatieresConfigList();
            populateMatieresSelect(student);
            alert(`Matière "${nom}" enregistrée (${prix} DT / quota ${quota}) !`);
        }
    });

    // Rejoindre une autre famille via le code
    document.getElementById('btn-join-family').addEventListener('click', () => {
        const inputCode = document.getElementById('input-join-family').value.trim().toUpperCase();
        if (inputCode && inputCode !== appState.familyId) {
            if (confirm(`Voulez-vous synchroniser votre application avec la famille ${inputCode} ?`)) {
                appState.familyId = inputCode;
                localStorage.setItem('edupocket_family_id', inputCode);
                initDataPersistence();
                modalSettings.style.display = 'none';
                updateRoleUI();
                alert(`Synchronisé avec la famille ${inputCode} !`);
            }
        }
    });

    // --- INITIALISATION AU CHARGEMENT ---
    initDataPersistence();
    updateRoleUI();
});
