document.addEventListener('DOMContentLoaded', () => {
    // --- ÉTAT GLOBAL DE L'APPLICATION ---
    let appState = {
        role: localStorage.getItem('edupocket_role') || null, // 'parent' | 'eleve' | 'professeur' | null
        familyId: localStorage.getItem('edupocket_family_id') || null,
        currentStudentId: localStorage.getItem('edupocket_student_id') || null,
        profName: localStorage.getItem('edupocket_prof_name') || '',
        profMatiere: localStorage.getItem('edupocket_prof_matiere') || '',
        profCode: localStorage.getItem('edupocket_prof_code') || '',
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
    const modalLicenseActivation = document.getElementById('modal-license-activation');

    // --- GESTION DE LA LICENCE PARENT ---
    function getActiveLicense() {
        const raw = localStorage.getItem('edupocket_license');
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.key && typeof EduPocketLicense !== 'undefined') {
                if (EduPocketLicense.verifyLicenseKey(parsed.civilite, parsed.prenom, parsed.nom, parsed.key)) {
                    return parsed;
                }
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    function promptLicenseActivation(onSuccess) {
        const modal = document.getElementById('modal-license-activation');
        const form = document.getElementById('form-license-activation');
        const errEl = document.getElementById('license-activation-error');
        const btnCancel = document.getElementById('btn-cancel-license');

        if (!modal || !form) return;
        errEl.style.display = 'none';
        modal.style.display = 'flex';

        btnCancel.onclick = () => {
            modal.style.display = 'none';
            if (!getActiveLicense()) {
                appState.role = null;
                localStorage.removeItem('edupocket_role');
                updateRoleUI();
            }
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const civ = document.getElementById('lic-civilite').value;
            const nom = document.getElementById('lic-nom').value.trim();
            const prenom = document.getElementById('lic-prenom').value.trim();
            const key = document.getElementById('lic-key').value.trim();

            if (!nom || !prenom || !key) {
                errEl.textContent = 'Veuillez remplir tous les champs.';
                errEl.style.display = 'block';
                return;
            }

            if (typeof EduPocketLicense === 'undefined') {
                errEl.textContent = 'Module de licence introuvable.';
                errEl.style.display = 'block';
                return;
            }

            const isValid = EduPocketLicense.verifyLicenseKey(civ, prenom, nom, key);
            if (isValid) {
                const licenseObj = {
                    civilite: civ,
                    nom,
                    prenom,
                    key: key.toUpperCase(),
                    activatedAt: Date.now()
                };
                localStorage.setItem('edupocket_license', JSON.stringify(licenseObj));
                modal.style.display = 'none';

                const greeting = EduPocketLicense.getWelcomeGreeting(civ, nom);
                alert(`${greeting} !\n\nVotre clé de licence a été validée avec succès. Bienvenue sur votre espace EduPocket.`);

                if (onSuccess) onSuccess(licenseObj);
                updateRoleUI();
            } else {
                errEl.textContent = `Clé de licence invalide pour ${civ} ${prenom} ${nom}. Vérifiez vos nom/prénom ou contactez votre administrateur.`;
                errEl.style.display = 'block';
            }
        };
    }

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
        const parentBanner = document.getElementById('parent-license-banner');
        const parentGreeting = document.getElementById('parent-greeting-display');

        // Mise à jour de la boîte licence dans les réglages
        const activeLicense = getActiveLicense();
        const licNameEl = document.getElementById('settings-license-name');
        const licKeyEl = document.getElementById('settings-license-key');
        const licBadgeEl = document.getElementById('settings-license-badge');
        if (activeLicense) {
            if (licNameEl) licNameEl.textContent = `${activeLicense.civilite} ${activeLicense.prenom} ${activeLicense.nom}`;
            if (licKeyEl) licKeyEl.textContent = activeLicense.key;
            if (licBadgeEl) {
                licBadgeEl.textContent = '🟢 Active';
                licBadgeEl.style.background = '#D1FAE5';
                licBadgeEl.style.color = '#065F46';
            }
        } else {
            if (licNameEl) licNameEl.textContent = 'Non activée';
            if (licKeyEl) licKeyEl.textContent = '---';
            if (licBadgeEl) {
                licBadgeEl.textContent = '🔴 Inactive';
                licBadgeEl.style.background = '#FEE2E2';
                licBadgeEl.style.color = '#991B1B';
            }
        }

        if (displayFamilyCode) displayFamilyCode.textContent = appState.familyId;
        if (settingsFamilyCode) settingsFamilyCode.textContent = appState.familyId;

        document.body.classList.toggle('role-eleve', appState.role === 'eleve');

        if (appState.role === 'parent') {
            // VÉRIFICATION STRICTE DE LA LICENCE PARENT
            if (!activeLicense) {
                promptLicenseActivation(() => {
                    updateRoleUI();
                });
                return;
            }

            if (parentBanner && parentGreeting) {
                parentGreeting.textContent = EduPocketLicense.getWelcomeGreeting(activeLicense.civilite, activeLicense.nom);
                parentBanner.style.display = 'flex';
            }

            bannerFamilyCode.style.display = 'flex';
            homeRoleDesc.innerHTML = '<strong>Espace Parents :</strong> Gérez vos enfants, transmettez-leur leur <strong>Code Famille & Code Élève</strong>, configurez les tarifs et partagez les codes professeurs.';
            sectionParent.style.display = 'block';
            sectionStudent.style.display = 'none';
            sectionProf.style.display = 'none';
            if (btnTabTarifs) btnTabTarifs.style.display = 'block';
            loadParentStudentsList();
            showView(viewHome);
        } else if (appState.role === 'eleve') {
            if (btnTabTarifs) btnTabTarifs.style.display = 'none';

            // Si l'élève est identifié : ouverture IMMÉDIATE de son tableau de bord personnel
            if (appState.currentStudentId) {
                const student = getStudent(appState.currentStudentId);
                if (student) {
                    loadDashboard(student);
                    showView(viewDashboard);
                    return;
                }
            }

            bannerFamilyCode.style.display = 'none';
            homeRoleDesc.innerHTML = '<strong>Espace Élève :</strong> Saisissez votre <strong>Code Famille</strong> ainsi que votre <strong>Code Élève</strong> transmis par vos parents pour ouvrir immédiatement votre dossier.';
            sectionParent.style.display = 'none';
            sectionStudent.style.display = 'block';
            sectionProf.style.display = 'none';
            showView(viewHome);
        } else if (appState.role === 'professeur') {
            // Si le professeur est déjà authentifié avec son code combiné et un élève
            if (appState.currentStudentId && appState.profCode && appState.profMatiere) {
                const student = getStudent(appState.currentStudentId);
                if (student) {
                    loadDashboard(student);
                    showView(viewDashboard);
                    return;
                }
            }

            bannerFamilyCode.style.display = 'none';
            homeRoleDesc.innerHTML = '<strong>Espace Professeur :</strong> Saisissez votre <strong>Code Professeur combiné</strong> (ex: PRF-XXXX-ELV-YYYY) pour accéder à l\'élève et à votre matière uniquement.';
            sectionParent.style.display = 'none';
            sectionStudent.style.display = 'none';
            sectionProf.style.display = 'block';
            showView(viewHome);
        }
    }

    // Réarmer la licence dans les réglages
    const btnRearmLic = document.getElementById('btn-rearm-license');
    if (btnRearmLic) {
        btnRearmLic.addEventListener('click', () => {
            modalSettings.style.display = 'none';
            promptLicenseActivation(() => {
                updateRoleUI();
            });
        });
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
            localStorage.removeItem('edupocket_prof_code');
            localStorage.removeItem('edupocket_prof_name');
            localStorage.removeItem('edupocket_prof_matiere');
            appState.role = null;
            appState.currentStudentId = null;
            appState.profCode = '';
            appState.profName = '';
            appState.profMatiere = '';
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

    function ensureProfCodes(student) {
        if (!student) return false;
        if (!student.matieres) student.matieres = [];
        let modified = false;

        student.matieres.forEach(m => {
            if (!m.profCodes) m.profCodes = [];
            const profsList = m.professeurs || [];

            profsList.forEach(p => {
                const profName = typeof p === 'string' ? p.trim() : (p.nom || '').trim();
                if (!profName || profName.toLowerCase() === 'non spécifié') return;

                let existing = m.profCodes.find(pc => pc.nom.toLowerCase() === profName.toLowerCase());
                if (!existing) {
                    const randomTag = Math.random().toString(36).substring(2, 6).toUpperCase();
                    const combinedCode = `PRF-${randomTag}-${student.codeEleve}`;
                    m.profCodes.push({
                        nom: profName,
                        code: combinedCode,
                        matiere: m.nom
                    });
                    modified = true;
                } else if (!existing.code || !existing.code.includes(student.codeEleve)) {
                    const randomTag = Math.random().toString(36).substring(2, 6).toUpperCase();
                    existing.code = `PRF-${randomTag}-${student.codeEleve}`;
                    existing.matiere = m.nom;
                    modified = true;
                }
            });
        });

        return modified;
    }

    function ensureStudentCodes() {
        if (!appState.data || !appState.data.students) return;
        let modified = false;
        appState.data.students.forEach(s => {
            if (!s.codeEleve) {
                s.codeEleve = 'ELV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                modified = true;
            }
            if (ensureProfCodes(s)) {
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
        if (appState.role === 'professeur' && appState.currentStudentId) {
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

    // --- ACCÈS PARENT : LISTE DES ENFANTS AVEC CODES ÉLÈVE ET PROFESSEUR ---
    function loadParentStudentsList() {
        const list = document.getElementById('saved-students-list');
        list.innerHTML = '';

        if (!appState.data || !appState.data.students || appState.data.students.length === 0) {
            list.innerHTML = '<li><span style="color: #94A3B8;">Aucun enfant enregistré. Ajoutez-en un ci-dessous !</span></li>';
            return;
        }

        appState.data.students.forEach(student => {
            ensureProfCodes(student);

            // Construction de la liste des codes professeurs combinés
            let profCodesHtml = '';
            let totalProfs = 0;
            (student.matieres || []).forEach(m => {
                (m.profCodes || []).forEach(pc => {
                    totalProfs++;
                    profCodesHtml += `
                        <div class="prof-code-item">
                            <span>👨‍🏫 <strong>${pc.nom}</strong> (${m.nom})</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <code class="code-badge-combined">${pc.code}</code>
                                <button class="btn-sm btn-copy-prof-code" data-code="${pc.code}" style="padding: 2px 8px; font-size: 0.75rem; background: var(--sidi-blue); color: white;">📋 Copier</button>
                            </div>
                        </div>
                    `;
                });
            });

            if (totalProfs === 0) {
                profCodesHtml = '<div style="color: #94A3B8; font-size: 0.8rem; padding: 4px 0;">Aucun professeur configuré. Ajoutez-en dans Réglages > Tarifs & Matières.</div>';
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex: 1;">
                    <strong style="font-size: 1.05rem;">${student.prenom} ${student.nom}</strong>
                    <div style="font-size: 0.85rem; color: #64748B; margin-top: 2px;">
                        ${(student.sessions || []).length} séance(s) • ${(student.matieres || []).length} matière(s)
                    </div>

                    <!-- Codes pour l'élève -->
                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 0.82rem; background: #EBF4FA; color: #005A9C; padding: 4px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #BAE6FD;">
                            Code Famille : <strong>${appState.familyId}</strong>
                        </span>
                        <button class="btn-sm btn-copy-child-fam" data-code="${appState.familyId}" style="padding: 3px 8px; font-size: 0.75rem;">📋 Copier</button>

                        <span style="font-size: 0.82rem; background: #EBF4FA; color: #005A9C; padding: 4px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #BAE6FD;">
                            🔑 Code Élève : <strong>${student.codeEleve}</strong>
                        </span>
                        <button class="btn-sm btn-copy-child-code" data-code="${student.codeEleve}" style="padding: 3px 8px; font-size: 0.75rem; background: #005A9C; color: white;">📋 Copier</button>
                    </div>

                    <div style="font-size: 0.76rem; color: #007799; margin-top: 4px;">
                        👉 Transmettez le <strong>Code Famille</strong> ET le <strong>Code Élève</strong> à ${student.prenom} pour qu'il ouvre son espace.
                    </div>

                    <!-- Codes pour les professeurs de cet élève -->
                    <div class="child-prof-codes-box">
                        <div style="font-weight: 700; color: #005A9C; margin-bottom: 4px;">
                            👨‍🏫 Codes d'accès Professeurs combinés :
                        </div>
                        ${profCodesHtml}
                        <div style="font-size: 0.74rem; color: #64748B; margin-top: 4px;">
                            Transmettez ce code à chaque professeur pour qu'il accède uniquement aux séances de sa matière.
                        </div>
                    </div>
                </div>
                <span class="student-class-badge">${student.classe}</span>
            `;

            // Clic sur l'élève pour ouvrir son dossier
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-copy-child-code') || 
                    e.target.classList.contains('btn-copy-child-fam') || 
                    e.target.classList.contains('btn-copy-prof-code')) return;
                appState.currentStudentId = student.id;
                loadDashboard(student);
                showView(viewDashboard);
            });

            // Boutons copier
            const btnCopyCode = li.querySelector('.btn-copy-child-code');
            if (btnCopyCode) {
                btnCopyCode.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(student.codeEleve).then(() => {
                        alert(`Code unique de ${student.prenom} copié : ${student.codeEleve}\n\nTransmettez ce code avec le Code Famille (${appState.familyId}) à votre enfant pour qu'il se connecte.`);
                    });
                });
            }

            const btnCopyFam = li.querySelector('.btn-copy-child-fam');
            if (btnCopyFam) {
                btnCopyFam.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(appState.familyId).then(() => {
                        alert(`Code Famille copié : ${appState.familyId}`);
                    });
                });
            }

            li.querySelectorAll('.btn-copy-prof-code').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pCode = btn.getAttribute('data-code');
                    navigator.clipboard.writeText(pCode).then(() => {
                        alert(`Code Professeur combiné copié : ${pCode}\n\nTransmettez ce code au professeur pour qu'il accède directement aux séances de ${student.prenom} pour sa matière uniquement.`);
                    });
                });
            });

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
                    { nom: 'Anglais', prixSeance: 20, quotaPaiement: 3, professeurs: ['M. Dubois'], profCodes: [] },
                    { nom: 'Mathématiques', prixSeance: 25, quotaPaiement: 4, professeurs: ['Mme Sonia'], profCodes: [] }
                ],
                sessions: [],
                paiements: []
            };

            ensureProfCodes(newStudent);

            if (!appState.data.students) appState.data.students = [];
            appState.data.students.push(newStudent);
            saveData();

            appState.currentStudentId = newStudent.id;
            loadDashboard(newStudent);
            showView(viewDashboard);
            document.getElementById('form-add-student').reset();

            alert(`Élève ajouté avec succès !\n\n1. Code Famille : ${appState.familyId}\n2. Code Élève : ${uniqueCode}\n\nTransmettez ces DEUX codes à votre enfant pour qu'il accède directement à son espace personnel.`);
        }
    });

    // --- ACCÈS ÉLÈVE : CONNEXION PAR CODE FAMILLE ET CODE ÉLÈVE ---
    const btnEleveLogin = document.getElementById('btn-eleve-login');
    if (btnEleveLogin) {
        btnEleveLogin.addEventListener('click', () => {
            const inputFam = document.getElementById('input-eleve-family-code');
            const inputElv = document.getElementById('input-eleve-code');
            const errorEl = document.getElementById('eleve-login-error');
            const pickerEl = document.getElementById('eleve-multiple-students-picker');
            errorEl.style.display = 'none';
            if (pickerEl) pickerEl.style.display = 'none';

            const rawFam = (inputFam ? inputFam.value : '').trim().toUpperCase();
            const rawElv = (inputElv ? inputElv.value : '').trim().toUpperCase();

            if (!rawFam || !rawElv) {
                errorEl.textContent = 'Veuillez saisir votre Code Famille (ex: FAM-XXXX) ET votre Code Élève (ex: ELV-YYYY).';
                errorEl.style.display = 'block';
                return;
            }

            const targetFam = rawFam.startsWith('FAM-') ? rawFam : ('FAM-' + rawFam);
            const targetElv = rawElv.startsWith('ELV-') ? rawElv : ('ELV-' + rawElv);

            // 1. Vérification dans le cache local
            if (appState.data && appState.data.students) {
                if (appState.familyId === targetFam || appState.familyId === rawFam) {
                    const found = appState.data.students.find(s => s.codeEleve === targetElv || s.codeEleve === rawElv);
                    if (found) {
                        appState.familyId = targetFam;
                        appState.currentStudentId = found.id;
                        localStorage.setItem('edupocket_family_id', targetFam);
                        localStorage.setItem('edupocket_student_id', found.id);
                        loadDashboard(found);
                        showView(viewDashboard);
                        alert(`Bienvenue ${found.prenom} ! Votre espace élève est ouvert.`);
                        return;
                    }
                }
            }

            // 2. Recherche Cloud Firestore
            if (typeof db !== 'undefined' && db) {
                btnEleveLogin.disabled = true;
                btnEleveLogin.textContent = 'Connexion...';

                db.collection('edupocket_families').doc(targetFam).get().then(famDoc => {
                    if (famDoc.exists) {
                        const famData = famDoc.data();
                        const students = famData.students || [];
                        const foundStudent = students.find(s => s.codeEleve === targetElv || s.codeEleve === rawElv);

                        if (foundStudent) {
                            btnEleveLogin.disabled = false;
                            btnEleveLogin.textContent = 'Accéder à mon tableau de bord';
                            appState.familyId = targetFam;
                            appState.currentStudentId = foundStudent.id;
                            appState.data = famData;
                            localStorage.setItem('edupocket_family_id', targetFam);
                            localStorage.setItem('edupocket_student_id', foundStudent.id);
                            localStorage.setItem('edupocket_family_data_' + targetFam, JSON.stringify(famData));

                            initDataPersistence();
                            loadDashboard(foundStudent);
                            showView(viewDashboard);
                            alert(`Bienvenue ${foundStudent.prenom} !`);
                            return;
                        }
                    }

                    // Recherche secours par document élève indexé
                    db.collection('edupocket_students').doc(targetElv).get().then(stDoc => {
                        btnEleveLogin.disabled = false;
                        btnEleveLogin.textContent = 'Accéder à mon tableau de bord';

                        if (stDoc.exists) {
                            const stData = stDoc.data();
                            if (stData.familyId === targetFam || stData.familyId === rawFam) {
                                appState.familyId = stData.familyId;
                                appState.currentStudentId = stData.id;
                                appState.data = {
                                    familyId: stData.familyId,
                                    students: [stData]
                                };
                                localStorage.setItem('edupocket_family_id', appState.familyId);
                                localStorage.setItem('edupocket_student_id', stData.id);
                                localStorage.setItem('edupocket_family_data_' + appState.familyId, JSON.stringify(appState.data));

                                initDataPersistence();
                                loadDashboard(stData);
                                showView(viewDashboard);
                                alert(`Bienvenue ${stData.prenom} !`);
                                return;
                            } else {
                                errorEl.textContent = `Le Code Élève "${targetElv}" n'appartient pas à la famille "${targetFam}".`;
                                errorEl.style.display = 'block';
                                return;
                            }
                        }

                        errorEl.textContent = 'Code Famille ou Code Élève introuvable. Demandez à vos parents de vérifier vos codes d\'accès.';
                        errorEl.style.display = 'block';
                    }).catch(err => {
                        btnEleveLogin.disabled = false;
                        btnEleveLogin.textContent = 'Accéder à mon tableau de bord';
                        errorEl.textContent = 'Erreur lors de la vérification : ' + (err.message || 'problème réseau');
                        errorEl.style.display = 'block';
                    });
                }).catch(err => {
                    btnEleveLogin.disabled = false;
                    btnEleveLogin.textContent = 'Accéder à mon tableau de bord';
                    errorEl.textContent = 'Erreur de connexion : ' + (err.message || 'problème réseau');
                    errorEl.style.display = 'block';
                });
            } else {
                errorEl.textContent = 'Application hors-ligne. Veuillez vous connecter à Internet ou vérifier vos codes.';
                errorEl.style.display = 'block';
            }
        });
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
                    { nom: 'Anglais', prixSeance: 20, quotaPaiement: 3, professeurs: ['M. Dubois'], profCodes: [] },
                    { nom: 'Mathématiques', prixSeance: 25, quotaPaiement: 4, professeurs: ['Mme Sonia'], profCodes: [] }
                ],
                sessions: [],
                paiements: []
            };

            ensureProfCodes(newStudent);

            appState.data = {
                familyId: appState.familyId,
                students: [newStudent]
            };
            appState.currentStudentId = newStudent.id;
            localStorage.setItem('edupocket_student_id', newStudent.id);
            saveData();

            loadDashboard(newStudent);
            showView(viewDashboard);
            alert(`Votre espace est créé !\nCode Famille : ${appState.familyId}\nCode Élève : ${uniqueCode}`);
        }
    });

    // --- ACCÈS PROFESSEUR : CONNEXION PAR CODE PROFESSEUR COMBINÉ ---
    const btnProfLogin = document.getElementById('btn-prof-login');
    if (btnProfLogin) {
        btnProfLogin.addEventListener('click', () => {
            const inputCode = document.getElementById('input-prof-combined-code');
            const errorEl = document.getElementById('prof-login-error');
            errorEl.style.display = 'none';

            const rawCode = (inputCode ? inputCode.value : '').trim().toUpperCase();
            if (!rawCode) {
                errorEl.textContent = 'Veuillez saisir votre Code Professeur combiné (ex: PRF-XXXX-ELV-YYYY).';
                errorEl.style.display = 'block';
                return;
            }

            const regex = /^(PRF-[A-Z0-9]+)-(ELV-[A-Z0-9]+)$/i;
            const match = rawCode.match(regex);
            if (!match) {
                errorEl.textContent = 'Format de code invalide. Le code doit être combiné au code élève, ex: PRF-XXXX-ELV-YYYY.';
                errorEl.style.display = 'block';
                return;
            }

            const studentCode = match[2].toUpperCase();

            function connectProfWithStudent(student, famId) {
                let matchedMatiere = null;
                let matchedProfNom = null;

                (student.matieres || []).forEach(m => {
                    if (m.profCodes) {
                        const found = m.profCodes.find(pc => pc.code.toUpperCase() === rawCode);
                        if (found) {
                            matchedMatiere = m.nom;
                            matchedProfNom = found.nom;
                        }
                    }
                });

                if (!matchedMatiere) {
                    // Fallback si le professeur était enregistré dans le tableau
                    (student.matieres || []).forEach(m => {
                        if (!matchedMatiere && (m.professeurs || []).length > 0) {
                            matchedMatiere = m.nom;
                            matchedProfNom = m.professeurs[0];
                        }
                    });
                }

                if (!matchedMatiere) {
                    errorEl.textContent = `Ce code professeur n'est associé à aucune matière pour cet élève.`;
                    errorEl.style.display = 'block';
                    return;
                }

                appState.role = 'professeur';
                appState.profCode = rawCode;
                appState.profName = matchedProfNom;
                appState.profMatiere = matchedMatiere;
                appState.currentStudentId = student.id;
                appState.familyId = famId || student.familyId || appState.familyId;

                localStorage.setItem('edupocket_role', 'professeur');
                localStorage.setItem('edupocket_prof_code', rawCode);
                localStorage.setItem('edupocket_prof_name', matchedProfNom);
                localStorage.setItem('edupocket_prof_matiere', matchedMatiere);
                localStorage.setItem('edupocket_student_id', student.id);
                localStorage.setItem('edupocket_family_id', appState.familyId);

                initDataPersistence();
                loadDashboard(student);
                showView(viewDashboard);

                alert(`Bienvenue ${matchedProfNom} !\nVous accédez au dossier de ${student.prenom} ${student.nom} pour la matière "${matchedMatiere}" uniquement.`);
            }

            // 1. Chercher dans cache local
            if (appState.data && appState.data.students) {
                const localStudent = appState.data.students.find(s => s.codeEleve === studentCode);
                if (localStudent) {
                    connectProfWithStudent(localStudent, appState.familyId);
                    return;
                }
            }

            // 2. Recherche Cloud Firestore
            if (typeof db !== 'undefined' && db) {
                btnProfLogin.disabled = true;
                btnProfLogin.textContent = 'Connexion...';

                db.collection('edupocket_students').doc(studentCode).get().then(doc => {
                    btnProfLogin.disabled = false;
                    btnProfLogin.textContent = 'Accéder à ma matière';

                    if (doc.exists) {
                        const stData = doc.data();
                        if (stData.familyId) {
                            db.collection('edupocket_families').doc(stData.familyId).get().then(famDoc => {
                                if (famDoc.exists) {
                                    appState.data = famDoc.data();
                                    localStorage.setItem('edupocket_family_data_' + stData.familyId, JSON.stringify(appState.data));
                                }
                                connectProfWithStudent(stData, stData.familyId);
                            }).catch(() => {
                                connectProfWithStudent(stData, stData.familyId);
                            });
                        } else {
                            connectProfWithStudent(stData, appState.familyId);
                        }
                        return;
                    }

                    errorEl.textContent = `Élève introuvable pour le code ${studentCode}. Demandez aux parents de vérifier le code.`;
                    errorEl.style.display = 'block';
                }).catch(err => {
                    btnProfLogin.disabled = false;
                    btnProfLogin.textContent = 'Accéder à ma matière';
                    errorEl.textContent = 'Erreur Firestore : ' + (err.message || 'accès refusé');
                    errorEl.style.display = 'block';
                });
            } else {
                errorEl.textContent = 'Application hors-ligne et données non trouvées en cache local.';
                errorEl.style.display = 'block';
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
        } else if (appState.role === 'professeur') {
            if (confirm("Voulez-vous vous déconnecter de cette session professeur ?")) {
                localStorage.removeItem('edupocket_prof_code');
                localStorage.removeItem('edupocket_prof_name');
                localStorage.removeItem('edupocket_prof_matiere');
                localStorage.removeItem('edupocket_student_id');
                appState.profCode = '';
                appState.profName = '';
                appState.profMatiere = '';
                appState.currentStudentId = null;
                showView(viewHome);
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
        const profBanner = document.getElementById('prof-dashboard-banner');
        const profBannerName = document.getElementById('prof-banner-name');
        const profBannerSubject = document.getElementById('prof-banner-subject');

        if (appState.role === 'eleve') {
            if (btnBack) btnBack.style.display = 'none';
            if (btnSub) btnSub.style.display = 'none';
            if (profBanner) profBanner.style.display = 'none';
        } else if (appState.role === 'professeur') {
            if (btnBack) {
                btnBack.style.display = 'inline-block';
                btnBack.textContent = '← Déconnexion Professeur';
            }
            if (btnSub) btnSub.style.display = 'none';
            if (profBanner) {
                profBanner.style.display = 'flex';
                if (profBannerName) profBannerName.textContent = appState.profName || 'Professeur';
                if (profBannerSubject) profBannerSubject.textContent = appState.profMatiere || '';
            }
        } else {
            if (btnBack) {
                btnBack.style.display = 'inline-block';
                btnBack.textContent = '← Retour';
            }
            if (btnSub) btnSub.style.display = 'inline-block';
            if (profBanner) profBanner.style.display = 'none';
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

        // Pour le professeur : restreint UNIQUEMENT à sa matière et son nom
        if (appState.role === 'professeur' && appState.profMatiere) {
            const opt = document.createElement('option');
            opt.value = appState.profMatiere;
            opt.textContent = appState.profMatiere;
            opt.selected = true;
            selectSujet.innerHTML = '';
            selectSujet.appendChild(opt);

            selectProf.innerHTML = '';
            const profOpt = document.createElement('option');
            profOpt.value = appState.profName || 'Professeur';
            profOpt.textContent = appState.profName || 'Professeur';
            profOpt.selected = true;
            selectProf.appendChild(profOpt);

            filterMatiere.innerHTML = '';
            const fOpt = document.createElement('option');
            fOpt.value = appState.profMatiere;
            fOpt.textContent = `${appState.profMatiere} (Votre matière uniquement)`;
            fOpt.selected = true;
            filterMatiere.appendChild(fOpt);
            filterMatiere.disabled = true;
            return;
        }

        filterMatiere.disabled = false;
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

        if (appState.role === 'eleve' || appState.role === 'professeur') return;

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

        // Pour le professeur : STRICTEMENT L'HISTORIQUE DE SA MATIÈRE
        if (appState.role === 'professeur' && appState.profMatiere) {
            sessions = sessions.filter(s => s.sujet === appState.profMatiere);
        } else if (filterMatiere.value !== 'Toutes') {
            sessions = sessions.filter(s => s.sujet === filterMatiere.value);
        }

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
            ensureProfCodes(student);

            let profsHtml = '';
            if (m.profCodes && m.profCodes.length > 0) {
                m.profCodes.forEach(pc => {
                    profsHtml += `
                        <div style="margin-top: 4px; font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #F1F5F9; padding: 4px 8px; border-radius: 6px;">
                            <span>👨‍🏫 <strong>${pc.nom}</strong> : <code class="code-badge-combined">${pc.code}</code></span>
                            <button class="btn-sm btn-copy-prof-code-cfg" data-code="${pc.code}" style="padding: 2px 8px; font-size: 0.75rem; background: var(--sidi-blue); color: white;">📋 Copier</button>
                        </div>
                    `;
                });
            } else if (m.professeurs && m.professeurs.length > 0) {
                profsHtml = `<div style="font-size: 0.8rem; color: #64748B; margin-top: 4px;">Profs : ${m.professeurs.join(', ')}</div>`;
            } else {
                profsHtml = `<div style="font-size: 0.8rem; color: #94A3B8; margin-top: 4px;">Aucun professeur assigné</div>`;
            }

            const item = document.createElement('div');
            item.className = 'matiere-config-item';
            item.innerHTML = `
                <div style="flex: 1;">
                    <strong>${m.nom}</strong>
                    <div style="font-size: 0.85rem; color: #64748B;">
                        Prix : <strong>${m.prixSeance} DT</strong> | Quota : <strong>${m.quotaPaiement} séances</strong>
                    </div>
                    <div style="margin-top: 6px;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--sidi-blue);">Codes Professeurs :</span>
                        ${profsHtml}
                    </div>
                </div>
                <button class="btn-sm" style="background: #EF4444; align-self: flex-start; margin-left: 10px;" data-idx="${idx}">Supprimer</button>
            `;

            item.querySelector('button[data-idx]').addEventListener('click', () => {
                if (confirm(`Supprimer la matière ${m.nom} ?`)) {
                    student.matieres.splice(idx, 1);
                    saveData();
                    renderMatieresConfigList();
                    populateMatieresSelect(student);
                }
            });

            item.querySelectorAll('.btn-copy-prof-code-cfg').forEach(b => {
                b.addEventListener('click', () => {
                    const c = b.getAttribute('data-code');
                    navigator.clipboard.writeText(c).then(() => {
                        alert(`Code Professeur copié : ${c}\n\nTransmettez ce code au professeur pour qu'il accède directement à l'élève pour la matière ${m.nom} uniquement.`);
                    });
                });
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
                student.matieres.push({ nom, prixSeance: prix, quotaPaiement: quota, professeurs, profCodes: [] });
            }

            ensureProfCodes(student);
            saveData();
            document.getElementById('form-config-matiere').reset();
            renderMatieresConfigList();
            populateMatieresSelect(student);
            alert(`Matière "${nom}" enregistrée (${prix} DT / quota ${quota}) avec codes professeurs générés !`);
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
