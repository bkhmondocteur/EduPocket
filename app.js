document.addEventListener('DOMContentLoaded', () => {
    // --- ÉTAT GLOBAL DE L'APPLICATION ---
    let appState = {
        role: localStorage.getItem('edupocket_role') || null, // 'parent' | 'eleve' | 'professeur' | null
        familyId: localStorage.getItem('edupocket_family_id') || null,
        currentStudentId: localStorage.getItem('edupocket_student_id') || null,
        profName: localStorage.getItem('edupocket_prof_name') || '',
        data: null // Données de la famille
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
    const bannerFamilyCode = document.getElementById('banner-family-code-container');
    const dateInput = document.getElementById('date-seance');
    const heureInput = document.getElementById('heure-seance');
    const editDateInput = document.getElementById('edit-date-seance');
    const editHeureInput = document.getElementById('edit-heure-seance');
    const modalSettings = document.getElementById('modal-settings');
    const modalPayment = document.getElementById('modal-payment');
    const modalEditSession = document.getElementById('modal-edit-session');

    // --- MASQUES DE SAISIE RIGOUREUX ---
    function applyDateMask(input) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 8) val = val.substring(0, 8);
            let formatted = '';
            if (val.length > 0) formatted += val.substring(0, 2);
            if (val.length > 2) formatted += '/' + val.substring(2, 4);
            if (val.length > 4) formatted += '/' + val.substring(4, 8);
            e.target.value = formatted;
        });
    }

    function applyTimeMask(input) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 4) val = val.substring(0, 4);
            let formatted = '';
            if (val.length > 0) formatted += val.substring(0, 2);
            if (val.length > 2) formatted += ':' + val.substring(2, 4);
            e.target.value = formatted;
        });
    }

    applyDateMask(dateInput);
    applyTimeMask(heureInput);
    applyDateMask(editDateInput);
    applyTimeMask(editHeureInput);

    const payDateInput = document.getElementById('pay-date');
    if (payDateInput) applyDateMask(payDateInput);

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
        const sectionParent = document.getElementById('section-parent-management');
        const sectionStudent = document.getElementById('section-student-welcome');
        const sectionProf = document.getElementById('section-prof-setup');
        const btnTabTarifs = document.getElementById('btn-tab-tarifs');

        if (displayFamilyCode) displayFamilyCode.textContent = appState.familyId;
        if (settingsFamilyCode) settingsFamilyCode.textContent = appState.familyId;

        document.body.classList.toggle('role-eleve', appState.role === 'eleve');

        if (appState.role === 'parent') {
            bannerFamilyCode.style.display = 'flex';
            homeRoleDesc.innerHTML = '<strong>Espace Parents :</strong> Gérez vos enfants, transmettez-leur leur <strong>Code Élève unique</strong>, configurez les tarifs et suivez les séances.';
            sectionParent.style.display = 'block';
            sectionStudent.style.display = 'none';
            sectionProf.style.display = 'none';
            if (btnTabTarifs) btnTabTarifs.style.display = 'block';
            loadParentStudentsList();
            showView(viewHome);
        } else if (appState.role === 'eleve') {
            if (btnTabTarifs) btnTabTarifs.style.display = 'none';

            // Auto-sélection si l'élève a déjà un profil ou s'il y a un seul élève enregistré
            if (!appState.currentStudentId && appState.data && appState.data.students && appState.data.students.length > 0) {
                appState.currentStudentId = appState.data.students[0].id;
                localStorage.setItem('edupocket_student_id', appState.currentStudentId);
            }

            // Si l'élève est identifié : ouverture IMMÉDIATE de son tableau de bord personnel (pas d'écran intermédiaire)
            if (appState.currentStudentId) {
                const student = getStudent(appState.currentStudentId);
                if (student) {
                    loadDashboard(student);
                    showView(viewDashboard);
                    return;
                }
            }

            bannerFamilyCode.style.display = 'none';
            homeRoleDesc.innerHTML = '<strong>Espace Élève :</strong> Entrez le <strong>Code d\'accès propre à votre profil</strong> (ex: ELV-XXXX) transmis par vos parents pour ouvrir immédiatement votre dossier.';
            sectionParent.style.display = 'none';
            sectionStudent.style.display = 'block';
            sectionProf.style.display = 'none';
            showView(viewHome);
        } else if (appState.role === 'professeur') {
            bannerFamilyCode.style.display = 'flex';
            homeRoleDesc.innerHTML = '<strong>Espace Professeur :</strong> Confirmez et suivez les séances de rattrapage de vos élèves.';
            sectionParent.style.display = 'none';
            sectionStudent.style.display = 'none';
            sectionProf.style.display = 'block';
            document.getElementById('prof-self-name').value = appState.profName || '';
            document.getElementById('prof-family-code').value = appState.familyId || '';
            showView(viewHome);
        }
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
            localStorage.removeItem('edupocket_student_id');
            appState.role = null;
            appState.currentStudentId = null;
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
            students: [],
            updatedAt: Date.now()
        };
    }

    function initDataPersistence() {
        const local = localStorage.getItem('edupocket_family_data_' + appState.familyId);
        if (local) {
            try {
                appState.data = JSON.parse(local);
            } catch (e) {
                appState.data = getDefaultData();
            }
        } else {
            appState.data = getDefaultData();
        }

        // Assurer que chaque élève a un Code Élève unique
        ensureStudentCodes();

        // Écoute temps réel Firebase Firestore
        if (typeof db !== 'undefined' && db) {
            btnSyncStatus.textContent = '🟢';
            btnSyncStatus.title = 'Connecté à Firestore en direct';

            db.collection('edupocket_families').doc(appState.familyId).onSnapshot(doc => {
                if (doc.exists) {
                    const cloudData = doc.data();
                    if (cloudData && cloudData.students) {
                        appState.data = cloudData;
                        ensureStudentCodes();
                        localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
                        refreshCurrentView();
                    }
                } else {
                    saveDataToCloud();
                }
            }, err => {
                console.warn("Écoute Firestore famille :", err);
                btnSyncStatus.textContent = '🟡';
                btnSyncStatus.title = 'Mode local (Hors-ligne)';
            });

            // Si parent, s'assurer que les documents des codes élèves sont bien synchronisés dans Firestore
            if (appState.role === 'parent' && appState.data && appState.data.students && appState.data.students.length > 0) {
                saveDataToCloud();
            }
        } else {
            btnSyncStatus.textContent = '🟡';
            btnSyncStatus.title = 'Mode local (Hors-ligne)';
        }
    }

    function ensureStudentCodes() {
        if (!appState.data || !appState.data.students) return;
        let modified = false;
        appState.data.students.forEach(s => {
            if (!s.codeEleve) {
                s.codeEleve = 'ELV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                modified = true;
            }
        });
        if (modified) {
            localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
            saveDataToCloud();
        }
    }

    function saveData() {
        if (!appState.data) appState.data = getDefaultData();
        ensureStudentCodes();
        appState.data.updatedAt = Date.now();
        localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
        saveDataToCloud();
        refreshCurrentView();
    }

    function saveDataToCloud() {
        if (typeof db !== 'undefined' && db && appState.data) {
            // 1. Sauvegarde du document Famille
            const familyPayload = {
                familyId: appState.familyId,
                students: appState.data.students || [],
                updatedAt: Date.now()
            };
            db.collection('edupocket_families').doc(appState.familyId).set(familyPayload)
                .catch(err => console.warn("Erreur sauvegarde Cloud Famille :", err));

            // 2. Sauvegarde indexée de chaque Élève par son Code Élève unique
            (appState.data.students || []).forEach(student => {
                if (student.codeEleve) {
                    const studentPayload = {
                        id: student.id,
                        studentCode: student.codeEleve,
                        familyId: appState.familyId,
                        nom: student.nom,
                        prenom: student.prenom,
                        classe: student.classe || '',
                        matieres: student.matieres || [],
                        sessions: student.sessions || [],
                        paiements: student.paiements || [],
                        updatedAt: Date.now()
                    };
                    db.collection('edupocket_students').doc(student.codeEleve).set(studentPayload)
                        .catch(err => console.warn("Erreur sauvegarde Cloud Élève :", err));
                }
            });
        }
    }

    function refreshCurrentView() {
        if (appState.role === 'eleve' && appState.currentStudentId) {
            const student = getStudent(appState.currentStudentId);
            if (student) {
                loadDashboard(student);
                showView(viewDashboard);
                return;
            }
        }
        if (viewHome.classList.contains('active')) {
            if (appState.role === 'parent') loadParentStudentsList();
        } else if (viewDashboard.classList.contains('active') && appState.currentStudentId) {
            const student = getStudent(appState.currentStudentId);
            if (student) loadDashboard(student);
        }
    }

    function getStudent(id) {
        if (!appState.data || !appState.data.students) return null;
        return appState.data.students.find(s => s.id === id || s.codeEleve === id);
    }

    // --- ACCÈS PARENT : LISTE DES ENFANTS AVEC LEUR CODE ÉLÈVE UNIQUE ---
    function loadParentStudentsList() {
        const list = document.getElementById('saved-students-list');
        list.innerHTML = '';

        if (!appState.data || !appState.data.students || appState.data.students.length === 0) {
            list.innerHTML = '<li><span style="color: #94A3B8;">Aucun enfant enregistré. Ajoutez-en un ci-dessous !</span></li>';
            return;
        }

        appState.data.students.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex: 1;">
                    <strong style="font-size: 1.05rem;">${student.prenom} ${student.nom}</strong>
                    <div style="font-size: 0.85rem; color: #64748B; margin-top: 2px;">
                        ${(student.sessions || []).length} séance(s) • ${(student.matieres || []).length} matière(s)
                    </div>
                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 0.85rem; background: #EBF4FA; color: #005A9C; padding: 4px 10px; border-radius: 6px; font-weight: 700; border: 1px solid #BAE6FD;">
                            🔑 Code unique de l'élève : <strong>${student.codeEleve}</strong>
                        </span>
                        <button class="btn-sm btn-copy-child-code" data-code="${student.codeEleve}" style="padding: 4px 10px; font-size: 0.8rem; background: #005A9C; color: white;">📋 Copier Code</button>
                    </div>
                    <div style="font-size: 0.78rem; color: #007799; margin-top: 4px;">
                        👉 Transmettez ce code unique à ${student.prenom} pour qu'il accède directement à son espace personnel.
                    </div>
                </div>
                <span class="student-class-badge">${student.classe}</span>
            `;

            // Clic sur l'élève pour ouvrir son dossier
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-copy-child-code')) return;
                appState.currentStudentId = student.id;
                loadDashboard(student);
                showView(viewDashboard);
            });

            // Bouton copier le code de cet enfant
            const btnCopy = li.querySelector('.btn-copy-child-code');
            if (btnCopy) {
                btnCopy.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(student.codeEleve).then(() => {
                        alert(`Code unique de ${student.prenom} copié : ${student.codeEleve}\n\nTransmettez ce code à votre enfant pour qu'il accède directement et uniquement à ses cours et séances !`);
                    });
                });
            }

            list.appendChild(li);
        });
    }

    // Ajout d'enfant par le parent
    document.getElementById('form-add-student').addEventListener('submit', (e) => {
        e.preventDefault();
        const nom = document.getElementById('nom').value.trim();
        const prenom = document.getElementById('prenom').value.trim();
        const classe = document.getElementById('classe').value.trim();

        if (nom && prenom && classe) {
            const uniqueCode = 'ELV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const newStudent = {
                id: 'std_' + Date.now(),
                codeEleve: uniqueCode,
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
            alert(`Élève ajouté avec succès !\nSon Code Élève unique est : ${uniqueCode}`);
        }
    });

    // --- ACCÈS ÉLÈVE : CONNEXION PAR CODE ÉLÈVE UNIQUE ---
    const btnEleveLogin = document.getElementById('btn-eleve-login');
    if (btnEleveLogin) {
        btnEleveLogin.addEventListener('click', () => {
            const rawInput = document.getElementById('input-eleve-code').value.trim().toUpperCase();
            const errorEl = document.getElementById('eleve-login-error');
            const pickerEl = document.getElementById('eleve-multiple-students-picker');
            errorEl.style.display = 'none';
            if (pickerEl) pickerEl.style.display = 'none';

            if (!rawInput) {
                errorEl.textContent = 'Veuillez entrer votre Code Élève personnel (ex: ELV-XXXX).';
                errorEl.style.display = 'block';
                return;
            }

            const candidates = [rawInput];
            if (!rawInput.includes('-')) {
                candidates.push('ELV-' + rawInput);
                candidates.push('FAM-' + rawInput);
            }

            // 1. Vérification dans le cache local actuel
            if (appState.data && appState.data.students) {
                for (const c of candidates) {
                    const found = appState.data.students.find(s => s.codeEleve === c || (s.codeEleve && s.codeEleve.toUpperCase() === c) || s.id === c);
                    if (found) {
                        appState.currentStudentId = found.id;
                        localStorage.setItem('edupocket_student_id', found.id);
                        loadDashboard(found);
                        showView(viewDashboard);
                        return;
                    }
                }
            }

            // 2. Recherche Cloud Firestore
            if (typeof db !== 'undefined' && db) {
                btnEleveLogin.disabled = true;
                btnEleveLogin.textContent = 'Connexion...';

                const targetElvCode = candidates.find(c => c.startsWith('ELV-')) || rawInput;

                db.collection('edupocket_students').doc(targetElvCode).get().then(doc => {
                    if (doc.exists) {
                        btnEleveLogin.disabled = false;
                        btnEleveLogin.textContent = 'Accéder';
                        const studentDoc = doc.data();
                        appState.familyId = studentDoc.familyId || appState.familyId;
                        appState.currentStudentId = studentDoc.id;
                        localStorage.setItem('edupocket_family_id', appState.familyId);
                        localStorage.setItem('edupocket_student_id', studentDoc.id);

                        // Synchronisation avec la famille complète
                        db.collection('edupocket_families').doc(appState.familyId).get().then(famDoc => {
                            if (famDoc.exists) {
                                appState.data = famDoc.data();
                            } else {
                                appState.data = {
                                    familyId: appState.familyId,
                                    students: [studentDoc]
                                };
                            }
                            localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
                            initDataPersistence();
                            loadDashboard(studentDoc);
                            showView(viewDashboard);
                        }).catch(() => {
                            appState.data = {
                                familyId: appState.familyId,
                                students: [studentDoc]
                            };
                            localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));
                            initDataPersistence();
                            loadDashboard(studentDoc);
                            showView(viewDashboard);
                        });
                        return;
                    }

                    // Secours avec Code Famille (au cas où le parent a donné son code FAM-XXXX)
                    const targetFamCode = candidates.find(c => c.startsWith('FAM-')) || rawInput;
                    db.collection('edupocket_families').doc(targetFamCode).get().then(famDoc => {
                        btnEleveLogin.disabled = false;
                        btnEleveLogin.textContent = 'Accéder';

                        if (famDoc.exists) {
                            const famData = famDoc.data();
                            const students = famData.students || [];
                            if (students.length === 1) {
                                const targetStudent = students[0];
                                appState.familyId = famDoc.id;
                                appState.currentStudentId = targetStudent.id;
                                appState.data = famData;
                                localStorage.setItem('edupocket_family_id', famDoc.id);
                                localStorage.setItem('edupocket_student_id', targetStudent.id);
                                initDataPersistence();
                                loadDashboard(targetStudent);
                                showView(viewDashboard);
                                return;
                            } else if (students.length > 1) {
                                showStudentSelectionForFamily(famData, pickerEl);
                                return;
                            }
                        }

                        errorEl.textContent = 'Code Élève introuvable. Demandez à vos parents de vous transmettre le Code Élève unique visible dans leur espace.';
                        errorEl.style.display = 'block';
                    }).catch(err => {
                        btnEleveLogin.disabled = false;
                        btnEleveLogin.textContent = 'Accéder';
                        errorEl.textContent = 'Erreur lors de la vérification : ' + (err.message || 'problème de réseau');
                        errorEl.style.display = 'block';
                    });
                }).catch(err => {
                    btnEleveLogin.disabled = false;
                    btnEleveLogin.textContent = 'Accéder';
                    console.warn("Erreur recherche élève Firestore :", err);
                    errorEl.textContent = 'Erreur de connexion : ' + (err.message || 'accès refusé');
                    errorEl.style.display = 'block';
                });
            } else {
                errorEl.textContent = 'Serveur inaccessible hors-ligne.';
                errorEl.style.display = 'block';
            }
        });
    }

    function showStudentSelectionForFamily(famData, container) {
        if (!container) return;
        container.innerHTML = `
            <div style="background: #EBF4FA; padding: 12px; border-radius: 8px; border: 1px solid #BAE6FD;">
                <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #005A9C; font-weight: 600;">
                    Plusieurs élèves trouvés dans cette famille. Cliquez sur votre profil :
                </p>
                <div style="display: flex; flex-direction: column; gap: 8px;" id="eleve-pick-buttons"></div>
            </div>
        `;
        const btnsBox = container.querySelector('#eleve-pick-buttons');
        (famData.students || []).forEach(st => {
            const b = document.createElement('button');
            b.className = 'btn-primary';
            b.style.textAlign = 'left';
            b.style.padding = '8px 12px';
            b.innerHTML = `🎓 <strong>${st.prenom} ${st.nom}</strong> (${st.classe}) <span style="font-size: 0.8rem; opacity: 0.9; float: right;">Code: ${st.codeEleve}</span>`;
            b.addEventListener('click', () => {
                appState.familyId = famData.familyId;
                appState.currentStudentId = st.id;
                appState.data = famData;
                localStorage.setItem('edupocket_family_id', appState.familyId);
                localStorage.setItem('edupocket_student_id', st.id);
                initDataPersistence();
                loadDashboard(st);
                showView(viewDashboard);
                alert(`Bienvenue ${st.prenom} ! Pour vos prochaines connexions directes, votre code personnel est : ${st.codeEleve}`);
            });
            btnsBox.appendChild(b);
        });
        container.style.display = 'block';
    }

    // Inscription élève autonome
    document.getElementById('form-eleve-self-signup').addEventListener('submit', (e) => {
        e.preventDefault();
        const nom = document.getElementById('eleve-self-nom').value.trim();
        const prenom = document.getElementById('eleve-self-prenom').value.trim();
        const classe = document.getElementById('eleve-self-classe').value.trim();

        if (nom && prenom && classe) {
            const uniqueCode = 'ELV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const newStudent = {
                id: 'std_' + Date.now(),
                codeEleve: uniqueCode,
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

            appState.data = {
                familyId: appState.familyId,
                students: [newStudent]
            };
            appState.currentStudentId = newStudent.id;
            localStorage.setItem('edupocket_student_id', newStudent.id);
            saveData();

            loadDashboard(newStudent);
            showView(viewDashboard);
            alert(`Votre espace est créé ! Votre Code Élève unique est : ${uniqueCode}`);
        }
    });

    // --- ACCÈS PROFESSEUR ---
    const btnSaveProfName = document.getElementById('btn-save-prof-name');
    if (btnSaveProfName) {
        btnSaveProfName.addEventListener('click', () => {
            const name = document.getElementById('prof-self-name').value.trim();
            if (name) {
                appState.profName = name;
                localStorage.setItem('edupocket_prof_name', name);
                if (appState.data && appState.data.students && appState.data.students.length > 0) {
                    appState.currentStudentId = appState.data.students[0].id;
                    loadDashboard(appState.data.students[0]);
                    showView(viewDashboard);
                } else {
                    alert('Nom enregistré. Entrez le Code Famille ou Code Élève pour charger leurs séances.');
                }
            } else {
                alert('Veuillez saisir votre nom de professeur.');
            }
        });
    }

    const btnSaveProfCode = document.getElementById('btn-save-prof-code');
    if (btnSaveProfCode) {
        btnSaveProfCode.addEventListener('click', () => {
            const code = document.getElementById('prof-family-code').value.trim().toUpperCase();
            if (code) {
                appState.familyId = code;
                localStorage.setItem('edupocket_family_id', code);
                initDataPersistence();
                alert(`Lié à la famille ${code} avec succès !`);
            }
        });
    }

    // Bouton Retour du Tableau de bord
    document.getElementById('btn-back').addEventListener('click', () => {
        if (appState.role === 'eleve') {
            if (confirm("Voulez-vous vous déconnecter de votre espace élève ?")) {
                localStorage.removeItem('edupocket_student_id');
                appState.currentStudentId = null;
                updateRoleUI();
            }
        } else {
            appState.currentStudentId = null;
            showView(viewHome);
            loadParentStudentsList();
        }
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

        const btnBack = document.getElementById('btn-back');
        const btnSub = document.getElementById('btn-open-settings-sub');
        if (appState.role === 'eleve') {
            if (btnBack) btnBack.style.display = 'none';
            if (btnSub) btnSub.style.display = 'none';
        } else {
            if (btnBack) btnBack.style.display = 'inline-block';
            if (btnSub) btnSub.style.display = 'inline-block';
        }

        populateMatieresSelect(student);
        checkAndDisplayPaymentAlerts(student);
        renderFilteredSessions();
    }

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

        if (appState.role === 'eleve') return;

        const matieres = student.matieres || [];
        const sessions = student.sessions || [];

        matieres.forEach(m => {
            const quota = m.quotaPaiement || 3;
            const prix = m.prixSeance || 20;

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

            sessionsToPay.forEach(s => {
                s.paye = true;
                s.datePaiement = datePaiement;
            });

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

    // --- AJOUT D'UNE SÉANCE (HEURE OPTIONNELLE) ---
    document.getElementById('form-add-session').addEventListener('submit', (e) => {
        e.preventDefault();
        const date = dateInput.value.trim();
        const heureRaw = heureInput.value.trim();
        const sujet = document.getElementById('sujet-seance').value;
        const prof = document.getElementById('prof-seance').value;
        const statut = document.getElementById('statut-seance').value;

        if (date.length !== 10) {
            alert('Veuillez entrer une date complète au format JJ/MM/AAAA.');
            return;
        }

        // L'heure est désormais optionnelle !
        const heure = heureRaw.length >= 4 ? heureRaw : '--:--';

        if (!sujet) {
            alert('Veuillez sélectionner une matière.');
            return;
        }

        const student = getStudent(appState.currentStudentId);
        if (student) {
            let validationStatut = 'Confirmee';
            if (appState.role === 'professeur') {
                validationStatut = 'En attente';
            } else if (prof !== 'Non spécifié') {
                validationStatut = 'En attente';
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

        if (filterStatus.value !== 'Tous') {
            sessions = sessions.filter(s => s.statut === filterStatus.value);
        }

        if (filterValidation.value !== 'Tous') {
            if (filterValidation.value === 'Modifiee') {
                sessions = sessions.filter(s => s.validation === 'Modifiee par eleve');
            } else if (filterValidation.value === 'Suppression') {
                sessions = sessions.filter(s => s.validation === 'Demande suppression');
            } else {
                sessions = sessions.filter(s => s.validation === filterValidation.value);
            }
        }

        if (filterMatiere.value !== 'Toutes') {
            sessions = sessions.filter(s => s.sujet === filterMatiere.value);
        }

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

            let tagValidationClass = 'tag-val-confirmee';
            let validationLabel = session.validation || 'Confirmee';

            if (session.validation === 'En attente') {
                tagValidationClass = 'tag-val-attente';
            } else if (session.validation === 'Modifiee par eleve') {
                tagValidationClass = 'tag-val-modifiee';
                validationLabel = '⚠️ Modifiée par élève';
            } else if (session.validation === 'Demande suppression') {
                tagValidationClass = 'tag-val-suppression';
                validationLabel = '⚠️ Demande suppression';
            } else if (session.validation === 'Refusee') {
                tagValidationClass = 'tag-val-refusee';
            }

            const tagPaiementClass = session.paye ? 'tag-paye' : 'tag-non-paye';
            const textPaiement = session.paye ? `💰 Payé le ${session.datePaiement}` : '⏳ Non payé';

            // Boutons d'arbitrage parental
            let parentReviewHtml = '';
            if (appState.role === 'parent') {
                if (session.validation === 'Modifiee par eleve') {
                    parentReviewHtml = `
                        <div class="parent-review-box">
                            <span class="parent-review-text">⚠️ L'élève a modifié cette séance</span>
                            <div class="validation-buttons">
                                <button class="btn-action-sm btn-confirm btn-parent-accept-mod" data-id="${session.id}">Valider</button>
                                <button class="btn-action-sm btn-reject btn-parent-reject-mod" data-id="${session.id}">Refuser</button>
                            </div>
                        </div>
                    `;
                } else if (session.validation === 'Demande suppression') {
                    parentReviewHtml = `
                        <div class="parent-review-box" style="background: #FEE2E2; border-color: #EF4444;">
                            <span class="parent-review-text" style="color: #991B1B;">⚠️ L'élève demande la suppression</span>
                            <div class="validation-buttons">
                                <button class="btn-action-sm btn-reject btn-parent-accept-del" data-id="${session.id}">Confirmer suppression</button>
                                <button class="btn-action-sm btn-confirm btn-parent-keep" data-id="${session.id}">Conserver</button>
                            </div>
                        </div>
                    `;
                }
            }

            // Boutons professeur
            let showProfConfirmButtons = false;
            if (session.validation === 'En attente' && appState.role === 'professeur') {
                showProfConfirmButtons = true;
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
                    <span class="tag-badge ${tagValidationClass}">${validationLabel}</span>
                    <span class="tag-badge ${tagPaiementClass}">${textPaiement}</span>
                    <span style="font-size: 0.8rem; color: #64748B; margin-left: auto;">Statut : <strong>${session.statut}</strong></span>
                </div>

                ${parentReviewHtml}

                <div class="session-actions-row">
                    <div class="session-control-buttons">
                        <button class="btn-icon-action btn-edit-session" data-id="${session.id}" title="Modifier">✏️ Modifier</button>
                        <button class="btn-icon-action delete btn-delete-session" data-id="${session.id}" title="Supprimer">🗑️ Effacer</button>
                    </div>

                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${showProfConfirmButtons ? `
                            <div class="validation-buttons">
                                <button class="btn-action-sm btn-confirm btn-prof-confirm" data-id="${session.id}">Confirmer</button>
                                <button class="btn-action-sm btn-reject btn-prof-reject" data-id="${session.id}">Refuser</button>
                            </div>
                        ` : ''}

                        <select class="select-change-status" data-id="${session.id}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.85rem;">
                            <option value="Planifiée" ${session.statut === 'Planifiée' ? 'selected' : ''}>Planifiée</option>
                            <option value="Effectuée" ${session.statut === 'Effectuée' ? 'selected' : ''}>Effectuée</option>
                            <option value="Annulée" ${session.statut === 'Annulée' ? 'selected' : ''}>Annulée</option>
                        </select>
                    </div>
                </div>
            `;

            li.querySelector('.select-change-status').addEventListener('change', (e) => {
                const target = student.sessions.find(s => s.id === session.id);
                if (target) {
                    target.statut = e.target.value;
                    saveData();
                }
            });

            // Modifier séance
            li.querySelector('.btn-edit-session').addEventListener('click', () => {
                openEditSessionModal(student, session);
            });

            // Supprimer séance
            li.querySelector('.btn-delete-session').addEventListener('click', () => {
                if (appState.role === 'eleve') {
                    if (confirm("Voulez-vous demander la suppression de cette séance à vos parents ?")) {
                        const target = student.sessions.find(s => s.id === session.id);
                        if (target) {
                            target.validation = 'Demande suppression';
                            saveData();
                            alert("Demande de suppression envoyée à vos parents !");
                        }
                    }
                } else {
                    if (confirm("Supprimer définitivement cette séance ?")) {
                        const idx = student.sessions.findIndex(s => s.id === session.id);
                        if (idx !== -1) {
                            student.sessions.splice(idx, 1);
                            saveData();
                            alert("Séance supprimée définitivement.");
                        }
                    }
                }
            });

            // Actions d'arbitrage parental
            const btnAcceptMod = li.querySelector('.btn-parent-accept-mod');
            if (btnAcceptMod) {
                btnAcceptMod.addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Confirmee';
                        saveData();
                        alert("Modification confirmée !");
                    }
                });
            }

            const btnRejectMod = li.querySelector('.btn-parent-reject-mod');
            if (btnRejectMod) {
                btnRejectMod.addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Refusee';
                        saveData();
                        alert("Modification refusée.");
                    }
                });
            }

            const btnAcceptDel = li.querySelector('.btn-parent-accept-del');
            if (btnAcceptDel) {
                btnAcceptDel.addEventListener('click', () => {
                    const idx = student.sessions.findIndex(s => s.id === session.id);
                    if (idx !== -1) {
                        student.sessions.splice(idx, 1);
                        saveData();
                        alert("Suppression validée.");
                    }
                });
            }

            const btnKeep = li.querySelector('.btn-parent-keep');
            if (btnKeep) {
                btnKeep.addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Confirmee';
                        saveData();
                        alert("Séance conservée.");
                    }
                });
            }

            if (showProfConfirmButtons) {
                li.querySelector('.btn-prof-confirm').addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Confirmee';
                        saveData();
                        alert("Séance confirmée !");
                    }
                });

                li.querySelector('.btn-prof-reject').addEventListener('click', () => {
                    const target = student.sessions.find(s => s.id === session.id);
                    if (target) {
                        target.validation = 'Refusee';
                        saveData();
                        alert("Séance refusée.");
                    }
                });
            }

            list.appendChild(li);
        });
    }

    // --- MODAL MODIFIER UNE SÉANCE ---
    function openEditSessionModal(student, session) {
        document.getElementById('edit-session-id').value = session.id;
        document.getElementById('edit-date-seance').value = session.date;
        document.getElementById('edit-heure-seance').value = (session.heure && session.heure !== '--:--') ? session.heure : '';
        document.getElementById('edit-statut-seance').value = session.statut;

        const editSelectSujet = document.getElementById('edit-sujet-seance');
        const editSelectProf = document.getElementById('edit-prof-seance');

        editSelectSujet.innerHTML = '';
        (student.matieres || []).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.nom;
            opt.textContent = m.nom;
            if (m.nom === session.sujet) opt.selected = true;
            editSelectSujet.appendChild(opt);
        });

        function updateEditProfs() {
            editSelectProf.innerHTML = '<option value="Non spécifié">Non spécifié</option>';
            const selectedSubject = student.matieres.find(m => m.nom === editSelectSujet.value);
            if (selectedSubject && selectedSubject.professeurs) {
                selectedSubject.professeurs.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    if (p === session.professeur) opt.selected = true;
                    editSelectProf.appendChild(opt);
                });
            }
        }

        editSelectSujet.onchange = updateEditProfs;
        updateEditProfs();

        const warningEleve = document.getElementById('edit-session-role-warning');
        if (appState.role === 'eleve') {
            warningEleve.style.display = 'block';
        } else {
            warningEleve.style.display = 'none';
        }

        modalEditSession.style.display = 'flex';
    }

    document.getElementById('btn-close-edit-session').addEventListener('click', () => {
        modalEditSession.style.display = 'none';
    });

    document.getElementById('form-edit-session').addEventListener('submit', (e) => {
        e.preventDefault();
        const sessionId = document.getElementById('edit-session-id').value;
        const student = getStudent(appState.currentStudentId);
        if (!student) return;

        const target = student.sessions.find(s => s.id === sessionId);
        if (target) {
            target.date = document.getElementById('edit-date-seance').value.trim();
            const editH = document.getElementById('edit-heure-seance').value.trim();
            target.heure = editH.length >= 4 ? editH : '--:--';
            target.sujet = document.getElementById('edit-sujet-seance').value;
            target.professeur = document.getElementById('edit-prof-seance').value;
            target.statut = document.getElementById('edit-statut-seance').value;

            if (appState.role === 'eleve') {
                target.validation = 'Modifiee par eleve';
                saveData();
                modalEditSession.style.display = 'none';
                alert('Modifications enregistrées ! Vos parents doivent maintenant les confirmer.');
            } else {
                target.validation = 'Confirmee';
                saveData();
                modalEditSession.style.display = 'none';
                alert('Séance mise à jour avec succès !');
            }
        }
    });

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

    document.getElementById('form-config-matiere').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!appState.currentStudentId) {
            alert('Veuillez d\'abord sélectionner un élève.');
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

    // --- SAUVEGARDE ET RESTAURATION DES DONNÉES ---
    const btnBackup = document.getElementById('btn-backup-data');
    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            if (!appState.data) {
                alert('Aucune donnée à sauvegarder.');
                return;
            }

            const backupPayload = {
                version: 'edupocket-backup-v1',
                exportedAt: new Date().toISOString(),
                familyId: appState.familyId,
                role: appState.role,
                data: appState.data
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
            const dlAnchor = document.createElement('a');
            const todayStr = new Date().toISOString().split('T')[0];
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", `edupocket_sauvegarde_${appState.familyId}_${todayStr}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();

            alert('Sauvegarde téléchargée avec succès !\nConservez ce fichier en sécurité pour restaurer vos données à tout moment.');
        });
    }

    const btnRestoreTrigger = document.getElementById('btn-restore-data-trigger');
    const inputRestoreFile = document.getElementById('input-restore-file');

    if (btnRestoreTrigger && inputRestoreFile) {
        btnRestoreTrigger.addEventListener('click', () => {
            inputRestoreFile.click();
        });

        inputRestoreFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    let importedData = null;
                    let importedFamilyId = null;

                    // Vérification format backup
                    if (parsed.version && parsed.data) {
                        importedData = parsed.data;
                        importedFamilyId = parsed.familyId || appState.familyId;
                    } else if (parsed.students) {
                        importedData = parsed;
                        importedFamilyId = parsed.familyId || appState.familyId;
                    } else {
                        throw new Error("Format de fichier non reconnu. Fichier JSON invalide.");
                    }

                    if (!Array.isArray(importedData.students)) {
                        throw new Error("Le fichier ne contient pas de liste d'élèves valide.");
                    }

                    if (!confirm(`Restaurer les données ?\n${importedData.students.length} élève(s) seront importés. Les données actuelles de l'application seront remplacées.`)) {
                        inputRestoreFile.value = '';
                        return;
                    }

                    appState.familyId = importedFamilyId;
                    appState.data = importedData;
                    localStorage.setItem('edupocket_family_id', appState.familyId);
                    localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));

                    // Synchronisation Cloud et rafraîchissement
                    saveData();
                    initDataPersistence();
                    updateRoleUI();
                    modalSettings.style.display = 'none';

                    alert(`Restauration réussie !\n${importedData.students.length} élève(s) et leurs séances ont été restaurés.`);
                } catch (err) {
                    console.error("Erreur restauration :", err);
                    alert("Erreur lors de la restauration du fichier : " + (err.message || "Fichier invalide"));
                } finally {
                    inputRestoreFile.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    // --- INITIALISATION AU CHARGEMENT ---
    initDataPersistence();
    updateRoleUI();
});
