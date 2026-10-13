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

    // --- GESTION DES LICENCES (PARENT & PROFESSEUR) ---
    function getActiveLicense(role = 'parent') {
        const storageKey = role === 'professeur' ? 'edupocket_prof_license' : 'edupocket_license';
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.key && typeof EduPocketLicense !== 'undefined') {
                if (EduPocketLicense.verifyLicenseKey(role, parsed.civilite, parsed.prenom, parsed.nom, parsed.key)) {
                    return parsed;
                }
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    function promptLicenseActivation(role = 'parent', onSuccess) {
        const modal = document.getElementById('modal-license-activation');
        const form = document.getElementById('form-license-activation');
        const errEl = document.getElementById('license-activation-error');
        const btnCancel = document.getElementById('btn-cancel-license');
        const titleEl = document.getElementById('lic-modal-title');
        const descEl = document.getElementById('lic-modal-desc');
        const keyInput = document.getElementById('lic-key');

        if (!modal || !form) return;
        errEl.style.display = 'none';

        const isProf = (role === 'professeur');
        if (titleEl) titleEl.textContent = isProf ? '🔐 Activation Licence Professeur' : '🔐 Activation Licence Parent';
        if (descEl) {
            descEl.innerHTML = isProf
                ? 'Pour débloquer votre espace Professeur, veuillez saisir votre <strong>civilité</strong>, vos <strong>nom et prénom</strong> ainsi que votre <strong>clé de licence Professeur</strong> fournie par votre administrateur.'
                : 'Pour débloquer votre espace Parent, veuillez saisir votre <strong>civilité</strong>, vos <strong>nom et prénom</strong> ainsi que votre <strong>clé de licence Parent</strong> fournie par votre administrateur.';
        }
        if (keyInput) {
            keyInput.placeholder = isProf ? 'Ex: EDUP-PRF-XXXX-XXXX-XXXX' : 'Ex: EDUP-PAR-XXXX-XXXX-XXXX';
        }

        modal.style.display = 'flex';

        btnCancel.onclick = () => {
            modal.style.display = 'none';
            if (!getActiveLicense(role)) {
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

            const isValid = EduPocketLicense.verifyLicenseKey(role, civ, prenom, nom, key);
            if (isValid) {
                const licenseObj = {
                    role: role,
                    civilite: civ,
                    nom,
                    prenom,
                    key: key.toUpperCase(),
                    activatedAt: Date.now()
                };
                const storageKey = isProf ? 'edupocket_prof_license' : 'edupocket_license';
                localStorage.setItem(storageKey, JSON.stringify(licenseObj));
                if (isProf) {
                    appState.profName = `${civ} ${nom}`;
                    localStorage.setItem('edupocket_prof_name', appState.profName);
                }
                modal.style.display = 'none';

                const greeting = EduPocketLicense.getWelcomeGreeting(civ, nom);
                const roleLabel = isProf ? 'Professeur' : 'Parent';
                alert(`${greeting} !\n\nVotre clé de licence ${roleLabel} a été validée avec succès. Bienvenue sur votre espace EduPocket.`);

                if (onSuccess) onSuccess(licenseObj);
                updateRoleUI();
            } else {
                errEl.textContent = `Clé de licence invalide pour ${civ} ${prenom} ${nom} (${role === 'professeur' ? 'Licence Professeur requise' : 'Licence Parent requise'}). Vérifiez votre saisie ou contactez votre administrateur.`;
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
        const btnTabCodes = document.getElementById('btn-tab-codes');
        const parentBanner = document.getElementById('parent-license-banner');
        const parentGreeting = document.getElementById('parent-greeting-display');

        // Mise à jour de la boîte licence dans les réglages
        const currentRoleLic = (appState.role === 'professeur') ? getActiveLicense('professeur') : getActiveLicense('parent');
        const licNameEl = document.getElementById('settings-license-name');
        const licKeyEl = document.getElementById('settings-license-key');
        const licBadgeEl = document.getElementById('settings-license-badge');
        if (currentRoleLic) {
            if (licNameEl) licNameEl.textContent = `${currentRoleLic.civilite} ${currentRoleLic.prenom} ${currentRoleLic.nom}`;
            if (licKeyEl) licKeyEl.textContent = currentRoleLic.key;
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

        if (btnTabCodes) btnTabCodes.style.display = (appState.role === 'parent') ? 'block' : 'none';

        if (appState.role === 'parent') {
            // VÉRIFICATION STRICTE DE LA LICENCE PARENT
            const parentLicense = getActiveLicense('parent');
            if (!parentLicense) {
                promptLicenseActivation('parent', () => {
                    updateRoleUI();
                });
                return;
            }

            if (parentBanner && parentGreeting) {
                parentGreeting.textContent = EduPocketLicense.getWelcomeGreeting(parentLicense.civilite, parentLicense.nom);
                parentBanner.style.display = 'flex';
            }

            bannerFamilyCode.style.display = 'none';
            homeRoleDesc.innerHTML = '<strong>Espace Parents :</strong> Cliquez sur un enfant pour ouvrir son dossier. Retrouvez tous les codes d\'accès dans les <strong>Réglages ⚙️</strong>.';
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
            // VÉRIFICATION STRICTE DE LA LICENCE PROFESSEUR
            const profLicense = getActiveLicense('professeur');
            if (!profLicense) {
                promptLicenseActivation('professeur', () => {
                    updateRoleUI();
                });
                return;
            }

            const profBanner = document.getElementById('prof-license-banner');
            const profGreeting = document.getElementById('prof-greeting-display');
            if (profBanner && profGreeting) {
                profGreeting.textContent = EduPocketLicense.getWelcomeGreeting(profLicense.civilite, profLicense.nom);
                profBanner.style.display = 'flex';
            }

            if (btnTabTarifs) btnTabTarifs.style.display = 'none';

            // Si le professeur a sélectionné un élève pour le tableau de bord
            if (appState.currentStudentId && appState.profMatiere) {
                const student = getStudent(appState.currentStudentId);
                if (student) {
                    loadDashboard(student);
                    showView(viewDashboard);
                    return;
                }
            }

            bannerFamilyCode.style.display = 'none';
            homeRoleDesc.innerHTML = '<strong>Espace Professeur :</strong> Liez des élèves existants ou créez de nouveaux élèves pour générer leurs codes de liaison à transmettre aux parents.';
            sectionParent.style.display = 'none';
            sectionStudent.style.display = 'none';
            sectionProf.style.display = 'block';
            renderProfStudentsList();
            showView(viewHome);
        }
    }

    // Réarmer la licence dans les réglages
    const btnRearmLic = document.getElementById('btn-rearm-license');
    if (btnRearmLic) {
        btnRearmLic.addEventListener('click', () => {
            modalSettings.style.display = 'none';
            promptLicenseActivation(appState.role === 'professeur' ? 'professeur' : 'parent', () => {
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

    function cleanupFictionalProfessors() {
        if (!appState.data || !appState.data.students) return false;
        let modified = false;
        const fictional = ['m. dubois', 'dubois', 'mme sonia', 'sonia', 'mme smith'];

        appState.data.students.forEach(student => {
            if (!student.matieres) return;
            student.matieres.forEach(m => {
                if (m.professeurs && m.professeurs.length > 0) {
                    const countBefore = m.professeurs.length;
                    m.professeurs = m.professeurs.filter(p => {
                        const name = (typeof p === 'string' ? p : (p.nom || '')).trim().toLowerCase();
                        return !fictional.includes(name);
                    });
                    if (m.professeurs.length !== countBefore) modified = true;
                }
                if (m.profCodes && m.profCodes.length > 0) {
                    const countCodesBefore = m.profCodes.length;
                    m.profCodes = m.profCodes.filter(pc => {
                        const name = (pc.nom || '').trim().toLowerCase();
                        return !fictional.includes(name);
                    });
                    if (m.profCodes.length !== countCodesBefore) modified = true;
                }
            });
        });

        return modified;
    }

    function ensureProfCodes(student) {
        if (!student) return false;
        if (!student.matieres) student.matieres = [];
        let modified = false;

        student.matieres.forEach(m => {
            if (!m.profCodes) m.profCodes = [];
            const profsList = m.professeurs || [];

            // 1. Nettoyer les profs supprimés de la liste
            const validNamesLower = profsList.map(p => (typeof p === 'string' ? p.trim() : (p.nom || '').trim()).toLowerCase()).filter(Boolean);
            const beforeLen = m.profCodes.length;
            m.profCodes = m.profCodes.filter(pc => validNamesLower.includes((pc.nom || '').toLowerCase()));
            if (m.profCodes.length !== beforeLen) modified = true;

            // 2. Générer ou maintenir le code combiné pour les profs actuels
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
                } else {
                    existing.matiere = m.nom;
                }
            });
        });

        return modified;
    }

    function ensureStudentCodes() {
        if (!appState.data || !appState.data.students) return;
        let modified = false;

        if (cleanupFictionalProfessors()) {
            modified = true;
        }

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
    // --- ACCÈS PARENT : LISTE DES ENFANTS SUR L'ACCUEIL (INTERFACE ÉPURÉE SANS CODES) ---
    function loadParentStudentsList() {
        const list = document.getElementById('saved-students-list');
        list.innerHTML = '';

        if (!appState.data || !appState.data.students || appState.data.students.length === 0) {
            list.innerHTML = '<li><span style="color: #94A3B8;">Aucun enfant enregistré. Ajoutez-en un ci-dessous !</span></li>';
            return;
        }

        appState.data.students.forEach(student => {
            ensureProfCodes(student);

            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.innerHTML = `
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 1.15rem; color: var(--sidi-blue-dark);">${student.prenom} ${student.nom}</strong>
                        <span class="class-badge" style="font-size: 0.8rem; padding: 2px 10px;">${student.classe || 'Élève'}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #64748B; margin-top: 5px;">
                        ${(student.sessions || []).length} séance(s) effectuée(s) • ${(student.matieres || []).length} matière(s)
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; color: var(--sidi-blue); font-weight: 700; font-size: 0.92rem;">
                    <span>Ouvrir</span>
                    <span style="font-size: 1.25rem; line-height: 1;">→</span>
                </div>
            `;

            // Clic sur l'élève pour ouvrir son tableau de bord
            li.addEventListener('click', () => {
                appState.currentStudentId = student.id;
                loadDashboard(student);
                showView(viewDashboard);
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
                    { nom: 'Anglais', prixSeance: 20, quotaPaiement: 3, professeurs: [], profCodes: [] },
                    { nom: 'Mathématiques', prixSeance: 25, quotaPaiement: 4, professeurs: [], profCodes: [] }
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
                    { nom: 'Anglais', prixSeance: 20, quotaPaiement: 3, professeurs: [], profCodes: [] },
                    { nom: 'Mathématiques', prixSeance: 25, quotaPaiement: 4, professeurs: [], profCodes: [] }
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

    // --- ESPACE PROFESSEUR : ONGLETS & GESTION DES ÉLÈVES ---
    const btnProfTabLink = document.getElementById('btn-prof-tab-link');
    const btnProfTabCreate = document.getElementById('btn-prof-tab-create');
    const profPaneLink = document.getElementById('prof-pane-link');
    const profPaneCreate = document.getElementById('prof-pane-create');

    if (btnProfTabLink && btnProfTabCreate) {
        btnProfTabLink.addEventListener('click', () => {
            btnProfTabLink.classList.add('active');
            btnProfTabCreate.classList.remove('active');
            if (profPaneLink) profPaneLink.style.display = 'block';
            if (profPaneCreate) profPaneCreate.style.display = 'none';
        });

        btnProfTabCreate.addEventListener('click', () => {
            btnProfTabCreate.classList.add('active');
            btnProfTabLink.classList.remove('active');
            if (profPaneLink) profPaneLink.style.display = 'none';
            if (profPaneCreate) profPaneCreate.style.display = 'block';
        });
    }

    function getProfStudentsList() {
        try {
            const raw = localStorage.getItem('edupocket_prof_students');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveProfStudentsList(list) {
        localStorage.setItem('edupocket_prof_students', JSON.stringify(list));
    }

    function addStudentToProfList(student, matiere, profCode) {
        const list = getProfStudentsList();
        const code = student.codeEleve || student.studentCode;
        const existingIdx = list.findIndex(s => s.studentCode === code);
        const item = {
            id: student.id,
            studentCode: code,
            familyId: student.familyId || appState.familyId,
            nom: student.nom,
            prenom: student.prenom,
            classe: student.classe || '',
            matiere: matiere || (student.matieres && student.matieres[0] ? student.matieres[0].nom : 'Général'),
            profCode: profCode || '',
            updatedAt: Date.now()
        };
        if (existingIdx >= 0) {
            list[existingIdx] = Object.assign(list[existingIdx], item);
        } else {
            list.unshift(item);
        }
        saveProfStudentsList(list);
    }

    function renderProfStudentsList() {
        const container = document.getElementById('prof-my-students-list');
        if (!container) return;
        const list = getProfStudentsList();
        if (list.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px 0;">Aucun élève lié pour le moment.<br>Liez un élève existant ou créez-en un ci-dessus.</p>';
            return;
        }

        container.innerHTML = list.map((st, idx) => `
            <div class="prof-student-card">
                <div class="prof-student-header">
                    <div>
                        <strong style="font-size: 1.05rem; color: var(--sidi-blue-dark);">${st.prenom} ${st.nom}</strong>
                        <span class="class-badge" style="margin-left: 8px;">${st.classe || 'Élève'}</span>
                    </div>
                    <span style="font-size: 0.85rem; background: #EBF4FA; color: var(--sidi-blue-dark); font-weight: 700; padding: 3px 8px; border-radius: 6px;">
                        📖 ${st.matiere}
                    </span>
                </div>
                <div class="prof-student-codes-box">
                    <div>🏷️ Code Famille : <strong style="font-family: monospace; color: var(--sidi-blue);">${st.familyId}</strong></div>
                    <div>🎓 Code Élève : <strong style="font-family: monospace; color: #065F46;">${st.studentCode}</strong></div>
                    ${st.profCode ? `<div>👨‍🏫 Code Professeur : <strong style="font-family: monospace; color: #92400E;">${st.profCode}</strong></div>` : ''}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                    <button class="btn-primary btn-open-prof-student" data-index="${idx}" style="flex: 2; padding: 9px 12px; font-size: 0.9rem;">
                        📂 Ouvrir le dossier (Séances)
                    </button>
                    <button class="btn-secondary btn-share-prof-student" data-index="${idx}" style="flex: 2; padding: 9px 12px; font-size: 0.9rem;">
                        📲 Partager aux parents
                    </button>
                    <button class="btn-icon-action delete btn-remove-prof-student" data-index="${idx}" title="Retirer de ma liste" style="flex: 0 0 36px;">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        // Attachement des écouteurs
        container.querySelectorAll('.btn-open-prof-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-index'));
                const st = list[idx];
                if (!st) return;
                openProfStudentDashboard(st);
            });
        });

        container.querySelectorAll('.btn-share-prof-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-index'));
                const st = list[idx];
                if (!st) return;
                const profLic = getActiveLicense('professeur');
                const profName = profLic ? `${profLic.civilite} ${profLic.nom}` : (appState.profName || 'Professeur');
                const inviteMsg =
`Bonjour,
Votre professeur ${profName} suit ${st.prenom} ${st.nom} en ${st.matiere} sur l'application EduPocket.

Pour ajouter votre enfant à votre espace Parent :
---------------------------------------------
🏷️ Code Famille : ${st.familyId}
🎓 Code Élève   : ${st.studentCode}
🌐 Application  : https://bkhmondocteur.github.io/EduPocket/
---------------------------------------------
Instructions :
1. Ouvrez l'application et choisissez "Je suis Parent".
2. Dans la section "🔗 Rattacher un enfant créé par un professeur", entrez le Code Famille (${st.familyId}) ou le Code Élève (${st.studentCode}).

Bien cordialement,
${profName}`;
                navigator.clipboard.writeText(inviteMsg).then(() => {
                    alert('Message d\'invitation copié dans le presse-papier ! Vous pouvez le coller sur WhatsApp ou par SMS aux parents.');
                });
            });
        });

        container.querySelectorAll('.btn-remove-prof-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-index'));
                const st = list[idx];
                if (!st) return;
                if (confirm(`Voulez-vous retirer ${st.prenom} ${st.nom} de votre liste d'élèves ?`)) {
                    list.splice(idx, 1);
                    saveProfStudentsList(list);
                    renderProfStudentsList();
                }
            });
        });
    }

    function openProfStudentDashboard(st) {
        appState.role = 'professeur';
        appState.currentStudentId = st.id;
        appState.profMatiere = st.matiere;
        appState.profCode = st.profCode || '';
        appState.familyId = st.familyId;
        localStorage.setItem('edupocket_role', 'professeur');
        localStorage.setItem('edupocket_student_id', st.id);
        localStorage.setItem('edupocket_prof_matiere', st.matiere);
        localStorage.setItem('edupocket_prof_code', appState.profCode);
        localStorage.setItem('edupocket_family_id', appState.familyId);

        // Récupérer les données à jour
        if (typeof db !== 'undefined' && db && st.studentCode) {
            db.collection('edupocket_students').doc(st.studentCode).get().then(doc => {
                if (doc.exists) {
                    const stData = doc.data();
                    if (!appState.data) appState.data = getDefaultData();
                    const existingIdx = (appState.data.students || []).findIndex(s => s.id === stData.id);
                    if (existingIdx >= 0) {
                        appState.data.students[existingIdx] = stData;
                    } else {
                        appState.data.students = appState.data.students || [];
                        appState.data.students.push(stData);
                    }
                    loadDashboard(stData);
                    showView(viewDashboard);
                } else {
                    const fallback = getStudent(st.id) || st;
                    loadDashboard(fallback);
                    showView(viewDashboard);
                }
            }).catch(() => {
                const fallback = getStudent(st.id) || st;
                loadDashboard(fallback);
                showView(viewDashboard);
            });
        } else {
            const fallback = getStudent(st.id) || st;
            loadDashboard(fallback);
            showView(viewDashboard);
        }
    }

    // Création autonome d'un élève par le professeur
    const formProfCreateStudent = document.getElementById('form-prof-create-student');
    const profCreateResultBox = document.getElementById('prof-create-result-box');
    const profCreatedDetailsText = document.getElementById('prof-created-details-text');
    const btnCopyParentInvite = document.getElementById('btn-copy-parent-invite');
    let lastGeneratedParentInviteText = '';

    if (formProfCreateStudent) {
        formProfCreateStudent.addEventListener('submit', (e) => {
            e.preventDefault();
            const nom = document.getElementById('prof-create-nom').value.trim();
            const prenom = document.getElementById('prof-create-prenom').value.trim();
            const classe = document.getElementById('prof-create-classe').value.trim();
            const matiere = document.getElementById('prof-create-matiere').value.trim();
            const prix = Number(document.getElementById('prof-create-prix').value) || 25;

            if (!nom || !prenom || !classe || !matiere) return;

            const profLic = getActiveLicense('professeur');
            const profName = profLic ? `${profLic.civilite} ${profLic.nom}` : (appState.profName || 'Professeur');

            const uniqueStudentCode = 'ELV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const uniqueFamilyCode = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            const profTag = Math.random().toString(36).substring(2, 6).toUpperCase();
            const combinedProfCode = `PRF-${profTag}-${uniqueStudentCode}`;

            const newStudent = {
                id: 'std_' + Date.now(),
                familyId: uniqueFamilyCode,
                codeEleve: uniqueStudentCode,
                nom,
                prenom,
                classe,
                matieres: [{
                    nom: matiere,
                    prixSeance: prix,
                    quotaPaiement: 4,
                    professeurs: [profName],
                    profCodes: [{
                        nom: profName,
                        code: combinedProfCode,
                        matiere: matiere
                    }]
                }],
                sessions: [],
                paiements: [],
                createdAt: Date.now()
            };

            // Sauvegarde Cloud Firestore
            if (typeof db !== 'undefined' && db) {
                db.collection('edupocket_students').doc(uniqueStudentCode).set(newStudent).catch(err => console.warn(err));
                db.collection('edupocket_families').doc(uniqueFamilyCode).set({
                    familyId: uniqueFamilyCode,
                    students: [newStudent],
                    updatedAt: Date.now()
                }).catch(err => console.warn(err));
            }

            // Enregistrement dans la liste du professeur
            addStudentToProfList(newStudent, matiere, combinedProfCode);

            // Message complet pour les parents
            lastGeneratedParentInviteText = 
`Bonjour,
Votre professeur ${profName} a préparé le dossier de cours de rattrapage EduPocket pour votre enfant ${prenom} ${nom} en "${matiere}".

Voici les codes pour ajouter votre enfant à votre espace :
--------------------------------------------------
🏷️ Code Famille : ${uniqueFamilyCode}
🎓 Code Élève   : ${uniqueStudentCode}
👨‍🏫 Code Professeur : ${combinedProfCode}
🌐 Application  : https://bkhmondocteur.github.io/EduPocket/
--------------------------------------------------

Instructions pour le Parent :
1. Ouvrez l'application et choisissez "Je suis Parent".
2. Dans la section "🔗 Rattacher un enfant créé par un professeur", saisissez le Code Famille (${uniqueFamilyCode}) ou le Code Élève (${uniqueStudentCode}).

Bien cordialement,
${profName}`;

            if (profCreatedDetailsText) {
                profCreatedDetailsText.innerHTML = `
                    <div>👤 <strong>${prenom} ${nom}</strong> (${classe}) - Matière : <strong>${matiere}</strong> (${prix} DT)</div>
                    <div style="margin-top: 6px;">🏷️ Code Famille généré : <strong style="font-family: monospace; color: var(--sidi-blue);">${uniqueFamilyCode}</strong></div>
                    <div>🎓 Code Élève généré : <strong style="font-family: monospace; color: #065F46;">${uniqueStudentCode}</strong></div>
                    <div>👨‍🏫 Code Professeur : <strong style="font-family: monospace; color: #92400E;">${combinedProfCode}</strong></div>
                `;
            }

            if (profCreateResultBox) profCreateResultBox.style.display = 'block';

            // Réinitialiser les champs
            document.getElementById('prof-create-nom').value = '';
            document.getElementById('prof-create-prenom').value = '';
            document.getElementById('prof-create-classe').value = '';

            renderProfStudentsList();
            alert(`🎉 Élève ${prenom} ${nom} créé avec succès !\nCode Famille : ${uniqueFamilyCode}\nCode Élève : ${uniqueStudentCode}\nTransmettez ce message aux parents pour qu'ils ajoutent l'enfant.`);
        });
    }

    if (btnCopyParentInvite) {
        btnCopyParentInvite.addEventListener('click', () => {
            if (lastGeneratedParentInviteText) {
                navigator.clipboard.writeText(lastGeneratedParentInviteText).then(() => {
                    alert('Message d\'invitation pour les parents copié dans le presse-papier !');
                });
            }
        });
    }

    // --- ACCÈS PROFESSEUR : LIER UN ÉLÈVE EXISTANT ---
    const btnProfLogin = document.getElementById('btn-prof-login');
    if (btnProfLogin) {
        btnProfLogin.addEventListener('click', () => {
            const inputCode = document.getElementById('input-prof-combined-code');
            const errorEl = document.getElementById('prof-login-error');
            errorEl.style.display = 'none';

            const rawCode = (inputCode ? inputCode.value : '').trim().toUpperCase();
            if (!rawCode) {
                errorEl.textContent = 'Veuillez saisir votre Code Professeur combiné (ex: PRF-XXXX-ELV-YYYY) ou le Code Élève (ex: ELV-XXXX).';
                errorEl.style.display = 'block';
                return;
            }

            let studentCode = '';
            const combinedMatch = rawCode.match(/^(PRF-[A-Z0-9]+)-(ELV-[A-Z0-9]+)$/i);
            const simpleStudentMatch = rawCode.match(/^(ELV-[A-Z0-9]+)$/i);

            if (combinedMatch) {
                studentCode = combinedMatch[2].toUpperCase();
            } else if (simpleStudentMatch) {
                studentCode = simpleStudentMatch[1].toUpperCase();
            } else {
                errorEl.textContent = 'Format de code invalide. Saisissez soit le code combiné (PRF-XXXX-ELV-YYYY), soit le code élève (ELV-XXXX).';
                errorEl.style.display = 'block';
                return;
            }

            function connectProfWithStudent(student, famId) {
                let matchedMatiere = null;
                let matchedProfNom = null;

                const profLic = getActiveLicense('professeur');
                const defaultProfNom = profLic ? `${profLic.civilite} ${profLic.nom}` : (appState.profName || 'Professeur');

                // 1. Chercher si le code correspond exactement à une matière
                (student.matieres || []).forEach(m => {
                    if (m.profCodes) {
                        const found = m.profCodes.find(pc => pc.code.toUpperCase() === rawCode);
                        if (found) {
                            matchedMatiere = m.nom;
                            matchedProfNom = found.nom;
                        }
                    }
                });

                // 2. Si non trouvé par code exact, chercher par nom du professeur
                if (!matchedMatiere && profLic) {
                    (student.matieres || []).forEach(m => {
                        const hasName = (m.professeurs || []).some(p => {
                            const pName = typeof p === 'string' ? p : p.nom;
                            return pName && (pName.toLowerCase().includes(profLic.nom.toLowerCase()));
                        });
                        if (hasName) {
                            matchedMatiere = m.nom;
                            matchedProfNom = defaultProfNom;
                        }
                    });
                }

                // 3. Fallback sur la première matière si aucune restriction trouvée
                if (!matchedMatiere && (student.matieres || []).length > 0) {
                    matchedMatiere = student.matieres[0].nom;
                    matchedProfNom = defaultProfNom;
                }

                if (!matchedMatiere) {
                    errorEl.textContent = `Aucune matière configurée pour cet élève.`;
                    errorEl.style.display = 'block';
                    return;
                }

                addStudentToProfList(student, matchedMatiere, rawCode);
                renderProfStudentsList();

                openProfStudentDashboard({
                    id: student.id,
                    studentCode: student.codeEleve || studentCode,
                    familyId: famId || student.familyId || appState.familyId,
                    nom: student.nom,
                    prenom: student.prenom,
                    classe: student.classe || '',
                    matiere: matchedMatiere,
                    profCode: rawCode
                });

                alert(`Bienvenue ${matchedProfNom} !\nL'élève ${student.prenom} ${student.nom} a été lié à votre espace pour la matière "${matchedMatiere}".`);
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
                    btnProfLogin.textContent = 'Accéder à l\'élève';

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
                    btnProfLogin.textContent = 'Accéder à l\'élève';
                    errorEl.textContent = 'Erreur Firestore : ' + (err.message || 'accès refusé');
                    errorEl.style.display = 'block';
                });
            } else {
                errorEl.textContent = 'Application hors-ligne et données non trouvées en cache local.';
                errorEl.style.display = 'block';
            }
        });
    }

    // --- RATTACHEMENT D'UN ÉLÈVE PAR LE PARENT (CRÉÉ PAR UN PROFESSEUR) ---
    const btnParentJoinChild = document.getElementById('btn-parent-join-child');
    if (btnParentJoinChild) {
        btnParentJoinChild.addEventListener('click', () => {
            const input = document.getElementById('input-parent-join-child-code');
            const errorEl = document.getElementById('parent-join-error');
            if (errorEl) errorEl.style.display = 'none';

            const raw = (input ? input.value : '').trim().toUpperCase();
            if (!raw) {
                if (errorEl) {
                    errorEl.textContent = 'Veuillez saisir un Code Élève (ex: ELV-XXXX) ou un Code Famille (ex: FAM-XXXX).';
                    errorEl.style.display = 'block';
                }
                return;
            }

            if (typeof db === 'undefined' || !db) {
                alert('Connexion Internet requise pour rattacher un enfant via le Cloud.');
                return;
            }

            btnParentJoinChild.disabled = true;
            btnParentJoinChild.textContent = 'Recherche...';

            if (raw.startsWith('ELV-')) {
                // Recherche directe par Code Élève
                db.collection('edupocket_students').doc(raw).get().then(doc => {
                    btnParentJoinChild.disabled = false;
                    btnParentJoinChild.textContent = 'Lier à ma famille';

                    if (!doc.exists) {
                        if (errorEl) {
                            errorEl.textContent = `Aucun élève trouvé avec le code ${raw}. Vérifiez le code avec votre professeur.`;
                            errorEl.style.display = 'block';
                        }
                        return;
                    }

                    const stData = doc.data();
                    if (!appState.data) appState.data = getDefaultData();
                    if (!appState.data.students) appState.data.students = [];

                    const exists = appState.data.students.some(s => s.codeEleve === raw || s.id === stData.id);
                    if (exists) {
                        alert(`L'élève ${stData.prenom} ${stData.nom} est déjà présent dans vos enfants.`);
                        return;
                    }

                    // Rattachement à la famille du parent
                    stData.familyId = appState.familyId;
                    appState.data.students.push(stData);
                    saveData();

                    // Mettre à jour dans Firestore pour que l'index élève pointe vers la nouvelle famille
                    db.collection('edupocket_students').doc(raw).update({ familyId: appState.familyId }).catch(e => console.warn(e));

                    input.value = '';
                    alert(`✅ Félicitations ! L'élève ${stData.prenom} ${stData.nom} a été rattaché à votre espace avec succès.`);
                    loadParentStudentsList();
                }).catch(err => {
                    btnParentJoinChild.disabled = false;
                    btnParentJoinChild.textContent = 'Lier à ma famille';
                    if (errorEl) {
                        errorEl.textContent = 'Erreur lors de la recherche : ' + (err.message || 'accès réseau');
                        errorEl.style.display = 'block';
                    }
                });
            } else if (raw.startsWith('FAM-')) {
                // Recherche par Code Famille (généré par le professeur)
                db.collection('edupocket_families').doc(raw).get().then(doc => {
                    btnParentJoinChild.disabled = false;
                    btnParentJoinChild.textContent = 'Lier à ma famille';

                    if (!doc.exists) {
                        if (errorEl) {
                            errorEl.textContent = `Aucune famille trouvée avec le code ${raw}. Vérifiez le code avec le professeur.`;
                            errorEl.style.display = 'block';
                        }
                        return;
                    }

                    const famData = doc.data();
                    const importedStudents = famData.students || [];
                    if (importedStudents.length === 0) {
                        if (errorEl) {
                            errorEl.textContent = 'Aucun élève trouvé dans ce dossier famille.';
                            errorEl.style.display = 'block';
                        }
                        return;
                    }

                    if (!appState.data) appState.data = getDefaultData();
                    if (!appState.data.students) appState.data.students = [];

                    let addedCount = 0;
                    importedStudents.forEach(st => {
                        const exists = appState.data.students.some(s => s.codeEleve === st.codeEleve || s.id === st.id);
                        if (!exists) {
                            st.familyId = appState.familyId;
                            appState.data.students.push(st);
                            addedCount++;
                            if (st.codeEleve) {
                                db.collection('edupocket_students').doc(st.codeEleve).update({ familyId: appState.familyId }).catch(e => console.warn(e));
                            }
                        }
                    });

                    saveData();
                    input.value = '';

                    if (addedCount > 0) {
                        alert(`✅ ${addedCount} élève(s) rattaché(s) à votre espace avec succès !`);
                    } else {
                        alert('Tous les élèves de ce code sont déjà présents dans votre liste.');
                    }
                    loadParentStudentsList();
                }).catch(err => {
                    btnParentJoinChild.disabled = false;
                    btnParentJoinChild.textContent = 'Lier à ma famille';
                    if (errorEl) {
                        errorEl.textContent = 'Erreur lors de la recherche : ' + (err.message || 'accès réseau');
                        errorEl.style.display = 'block';
                    }
                });
            } else {
                btnParentJoinChild.disabled = false;
                btnParentJoinChild.textContent = 'Lier à ma famille';
                if (errorEl) {
                    errorEl.textContent = 'Format invalide. Le code doit commencer par ELV- ou FAM- (ex: ELV-A1B2 ou FAM-C3D4).';
                    errorEl.style.display = 'block';
                }
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
            // Retour fluide au tableau de bord des élèves du professeur sur l'accueil
            appState.currentStudentId = null;
            showView(viewHome);
            updateRoleUI();
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
    function openSettingsModal(targetTab = null) {
        modalSettings.style.display = 'flex';

        // Déterminer l'onglet par défaut selon le rôle
        let tabToOpen = targetTab;
        if (!tabToOpen) {
            tabToOpen = (appState.role === 'parent') ? 'tab-codes' : 'tab-sync';
        }

        // Basculer vers l'onglet cible
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabToOpen) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === tabToOpen) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        if (tabToOpen === 'tab-codes') {
            renderSettingsStudentsCodes();
        } else if (tabToOpen === 'tab-tarifs') {
            renderMatieresConfigList();
        }
    }

    document.getElementById('btn-open-settings').addEventListener('click', () => openSettingsModal('tab-codes'));
    const btnSubSettings = document.getElementById('btn-open-settings-sub');
    if (btnSubSettings) btnSubSettings.addEventListener('click', () => openSettingsModal('tab-tarifs'));

    const btnQuickOpenCodes = document.getElementById('btn-quick-open-codes');
    if (btnQuickOpenCodes) {
        btnQuickOpenCodes.addEventListener('click', () => openSettingsModal('tab-codes'));
    }

    document.getElementById('btn-close-settings').addEventListener('click', () => {
        modalSettings.style.display = 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
            if (targetId === 'tab-codes') {
                renderSettingsStudentsCodes();
            } else if (targetId === 'tab-tarifs') {
                renderMatieresConfigList();
            }
        });
    });

    // --- GESTION ET AFFICHAGE DES CODES D'ACCÈS DANS LES RÉGLAGES ---
    function renderSettingsStudentsCodes() {
        const container = document.getElementById('settings-students-codes-list');
        if (!container) return;
        container.innerHTML = '';

        if (!appState.data || !appState.data.students || appState.data.students.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 25px 15px; color: #64748B; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">👨‍👩‍👧‍👦</div>
                    <strong style="color: var(--sidi-blue-dark);">Aucun élève enregistré</strong>
                    <p style="font-size: 0.85rem; margin-top: 5px; color: #94A3B8;">Ajoutez d'abord un enfant depuis l'accueil pour générer ses codes d'accès.</p>
                </div>
            `;
            return;
        }

        appState.data.students.forEach(student => {
            ensureProfCodes(student);

            let profsListHtml = '';
            let allProfsCount = 0;
            let shareProfsText = '';

            if (student.matieres && student.matieres.length > 0) {
                student.matieres.forEach(m => {
                    if (m.profCodes && m.profCodes.length > 0) {
                        m.profCodes.forEach(pc => {
                            allProfsCount++;
                            shareProfsText += `\\n• ${pc.nom} (${m.nom}) : ${pc.code}`;
                            profsListHtml += `
                                <div class="settings-prof-code-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #E2E8F0; gap: 8px; flex-wrap: wrap;">
                                    <div style="flex: 1; min-width: 190px;">
                                        <div style="font-weight: 700; color: #1E293B; font-size: 0.95rem;">
                                            👨‍🏫 ${pc.nom} <span style="font-size: 0.8rem; font-weight: 600; color: var(--sidi-blue); background: #E0F2FE; padding: 2px 8px; border-radius: 4px; margin-left: 4px;">${m.nom}</span>
                                        </div>
                                        <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px;">
                                            <code class="code-badge-combined" style="font-size: 0.88rem; font-weight: 700; background: #EEF2FF; color: #3730A3; padding: 3px 8px; border-radius: 6px; border: 1px solid #C7D2FE;">${pc.code}</code>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                        <button class="btn-sm btn-copy-prof-code-item" data-code="${pc.code}" data-prof="${pc.nom}" data-matiere="${m.nom}" data-eleve="${student.prenom}" style="background: var(--sidi-blue); color: white; padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;" title="Copier le code">
                                            📋 Copier
                                        </button>
                                        <button class="btn-sm btn-share-prof-whatsapp" data-code="${pc.code}" data-prof="${pc.nom}" data-matiere="${m.nom}" data-eleve="${student.prenom}" style="background: #25D366; color: white; padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;" title="Envoyer par WhatsApp">
                                            💬 WhatsApp
                                        </button>
                                        <button class="btn-sm btn-edit-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pc.nom}" data-code="${pc.code}" style="background: #F59E0B; color: white; padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;" title="Modifier les données de ce professeur">
                                            ✏️ Modifier
                                        </button>
                                        <button class="btn-sm btn-delete-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pc.nom}" style="background: #EF4444; color: white; padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;" title="Supprimer ce professeur">
                                            🗑️ Supprimer
                                        </button>
                                    </div>
                                </div>
                            `;
                        });
                    }
                });
            }

            if (allProfsCount === 0) {
                profsListHtml = `
                    <div style="padding: 10px 0; font-size: 0.85rem; color: #64748B;">
                        Aucun professeur configuré pour ${student.prenom}.<br>
                        <button class="btn-sm btn-goto-config-matiere" data-student-id="${student.id}" style="margin-top: 6px; background: #F1F5F9; color: var(--sidi-blue-dark); border: 1px solid #CBD5E1; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                            ➕ Configurer les professeurs dans l'onglet Tarifs & Matières
                        </button>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'settings-student-codes-card';
            card.innerHTML = `
                <div class="settings-student-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #F1F5F9; padding-bottom: 8px;">
                    <div>
                        <strong style="font-size: 1.15rem; color: var(--sidi-blue-dark);">${student.prenom} ${student.nom}</strong>
                        <span class="class-badge" style="font-size: 0.78rem; padding: 2px 8px; margin-left: 6px;">${student.classe || 'Élève'}</span>
                    </div>
                    <button class="btn-sm btn-open-student-dash" data-student-id="${student.id}" style="background: transparent; color: var(--sidi-blue); border: 1px solid var(--sidi-blue); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;">
                        Voir tableau de bord ↗
                    </button>
                </div>

                <!-- Codes Accès Espace Élève -->
                <div class="settings-code-box" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: #0F172A; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <span>🎓 Accès Espace Élève de ${student.prenom}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div style="background: white; border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.72rem; color: #64748B; text-transform: uppercase; font-weight: 600;">Code Famille</div>
                                <strong style="font-size: 1.05rem; color: #0284C7; font-family: monospace;">${appState.familyId}</strong>
                            </div>
                            <button class="btn-sm btn-copy-settings-fam" data-fam="${appState.familyId}" style="background: #E0F2FE; color: #0369A1; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600;">Copier</button>
                        </div>

                        <div style="background: white; border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.72rem; color: #64748B; text-transform: uppercase; font-weight: 600;">Code Élève Unique</div>
                                <strong style="font-size: 1.05rem; color: #0D9488; font-family: monospace;">${student.codeEleve}</strong>
                            </div>
                            <button class="btn-sm btn-copy-settings-elv" data-code="${student.codeEleve}" data-nom="${student.prenom}" style="background: #CCFBF1; color: #0F766E; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600;">Copier</button>
                        </div>
                    </div>

                    <div style="font-size: 0.75rem; color: #64748B; margin-top: 8px;">
                        ℹ️ L'élève clique sur <em>"Je suis Élève"</em> et saisit ces deux codes pour ouvrir son espace.
                    </div>
                </div>

                <!-- Codes Accès Professeurs -->
                <div style="background: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: #0F172A; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span>👨‍🏫 Professeurs de ${student.prenom} (${allProfsCount})</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #64748B; margin-bottom: 8px;">
                        Chaque professeur utilise son code combiné unique pour voir et gérer uniquement sa matière pour cet élève.
                    </div>
                    <div class="settings-profs-container">
                        ${profsListHtml}
                    </div>
                </div>

                <!-- Bouton Partager le pack complet pour cet élève -->
                <div style="text-align: right;">
                    <button class="btn-sm btn-share-full-student-pack" data-student-id="${student.id}" style="background: var(--sidi-blue-dark); color: white; border: none; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <span>📲 Partager tous les accès de ${student.prenom}</span>
                    </button>
                </div>
            `;

            // Événements pour la carte
            const btnFam = card.querySelector('.btn-copy-settings-fam');
            if (btnFam) {
                btnFam.addEventListener('click', () => {
                    navigator.clipboard.writeText(appState.familyId).then(() => {
                        alert(`Code Famille copié : ${appState.familyId}`);
                    });
                });
            }

            const btnElv = card.querySelector('.btn-copy-settings-elv');
            if (btnElv) {
                btnElv.addEventListener('click', () => {
                    navigator.clipboard.writeText(student.codeEleve).then(() => {
                        alert(`Code Élève de ${student.prenom} copié : ${student.codeEleve}\\n\\nTransmettez ce code avec le Code Famille (${appState.familyId}) à votre enfant.`);
                    });
                });
            }

            const btnDash = card.querySelector('.btn-open-student-dash');
            if (btnDash) {
                btnDash.addEventListener('click', () => {
                    modalSettings.style.display = 'none';
                    appState.currentStudentId = student.id;
                    loadDashboard(student);
                    showView(viewDashboard);
                });
            }

            card.querySelectorAll('.btn-copy-prof-code-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const c = btn.getAttribute('data-code');
                    const p = btn.getAttribute('data-prof');
                    const m = btn.getAttribute('data-matiere');
                    navigator.clipboard.writeText(c).then(() => {
                        alert(`Code Professeur de ${p} (${m}) copié : ${c}\\n\\nTransmettez ce code au professeur pour son accès direct.`);
                    });
                });
            });

            card.querySelectorAll('.btn-share-prof-whatsapp').forEach(btn => {
                btn.addEventListener('click', () => {
                    const c = btn.getAttribute('data-code');
                    const p = btn.getAttribute('data-prof');
                    const m = btn.getAttribute('data-matiere');
                    const text = encodeURIComponent(`Bonjour ${p},\\n\\nVoici votre code d'accès professeur EduPocket pour suivre les cours de ${m} avec ${student.prenom} :\\n👉 ${c}\\n\\nAccédez à l'application ici : https://bkhmondocteur.github.io/EduPocket/\\n(Choisissez "Je suis Professeur" et saisissez ce code combiné)`);
                    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                });
            });

            card.querySelectorAll('.btn-edit-prof-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sId = btn.getAttribute('data-student-id');
                    const m = btn.getAttribute('data-matiere');
                    const p = btn.getAttribute('data-prof');
                    const c = btn.getAttribute('data-code') || '';
                    openEditProfessorModal(sId, m, p, c);
                });
            });

            card.querySelectorAll('.btn-delete-prof-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sId = btn.getAttribute('data-student-id');
                    const m = btn.getAttribute('data-matiere');
                    const p = btn.getAttribute('data-prof');
                    if (confirm(`Voulez-vous vraiment supprimer le professeur "${p}" de la matière ${m} pour ${student.prenom} ?`)) {
                        deleteProfessor(sId, m, p);
                        alert(`Professeur "${p}" supprimé avec succès.`);
                    }
                });
            });

            const btnGotoMatiere = card.querySelector('.btn-goto-config-matiere');
            if (btnGotoMatiere) {
                btnGotoMatiere.addEventListener('click', () => {
                    appState.currentStudentId = student.id;
                    openSettingsModal('tab-tarifs');
                });
            }

            const btnSharePack = card.querySelector('.btn-share-full-student-pack');
            if (btnSharePack) {
                btnSharePack.addEventListener('click', () => {
                    let msg = `🎓 EduPocket - Dossier de ${student.prenom} ${student.nom} (${student.classe || 'Élève'})\\n\\n`;
                    msg += `🔑 Accès Espace Élève :\\n`;
                    msg += `• Code Famille : ${appState.familyId}\\n`;
                    msg += `• Code Élève : ${student.codeEleve}\\n\\n`;
                    if (shareProfsText) {
                        msg += `👨‍🏫 Accès Professeurs combinés :${shareProfsText}\\n\\n`;
                    }
                    msg += `Application EduPocket : https://bkhmondocteur.github.io/EduPocket/`;

                    if (navigator.share) {
                        navigator.share({
                            title: `Codes EduPocket - ${student.prenom}`,
                            text: msg
                        }).catch(() => {
                            navigator.clipboard.writeText(msg).then(() => {
                                alert('Tous les codes d\'accès de ' + student.prenom + ' ont été copiés dans le presse-papier !');
                            });
                        });
                    } else {
                        navigator.clipboard.writeText(msg).then(() => {
                            alert('Tous les codes d\'accès de ' + student.prenom + ' ont été copiés dans le presse-papier !');
                        });
                    }
                });
            }

            container.appendChild(card);
        });
    }

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
                        <div style="margin-top: 6px; font-size: 0.82rem; display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #F8FAFC; padding: 6px 10px; border-radius: 8px; border: 1px solid #E2E8F0; flex-wrap: wrap;">
                            <div>
                                <span>👨‍🏫 <strong>${pc.nom}</strong> : <code class="code-badge-combined">${pc.code}</code></span>
                            </div>
                            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                                <button class="btn-sm btn-copy-prof-code-cfg" data-code="${pc.code}" style="padding: 3px 8px; font-size: 0.75rem; background: var(--sidi-blue); color: white;">📋 Copier</button>
                                <button class="btn-sm btn-edit-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pc.nom}" data-code="${pc.code}" style="padding: 3px 8px; font-size: 0.75rem; background: #F59E0B; color: white;">✏️ Modifier</button>
                                <button class="btn-sm btn-delete-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pc.nom}" style="padding: 3px 8px; font-size: 0.75rem; background: #EF4444; color: white;">🗑️ Supprimer</button>
                            </div>
                        </div>
                    `;
                });
            } else if (m.professeurs && m.professeurs.length > 0) {
                m.professeurs.forEach(pName => {
                    profsHtml += `
                        <div style="margin-top: 6px; font-size: 0.82rem; display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #F8FAFC; padding: 6px 10px; border-radius: 8px; border: 1px solid #E2E8F0; flex-wrap: wrap;">
                            <span>👨‍🏫 <strong>${pName}</strong></span>
                            <div style="display: flex; gap: 4px; align-items: center;">
                                <button class="btn-sm btn-edit-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pName}" style="padding: 3px 8px; font-size: 0.75rem; background: #F59E0B; color: white;">✏️ Modifier</button>
                                <button class="btn-sm btn-delete-prof-action" data-student-id="${student.id}" data-matiere="${m.nom}" data-prof="${pName}" style="padding: 3px 8px; font-size: 0.75rem; background: #EF4444; color: white;">🗑️ Supprimer</button>
                            </div>
                        </div>
                    `;
                });
            } else {
                profsHtml = `<div style="font-size: 0.8rem; color: #94A3B8; margin-top: 4px;">Aucun professeur assigné</div>`;
            }

            profsHtml += `
                <div style="margin-top: 8px;">
                    <button class="btn-sm btn-add-prof-direct" data-student-id="${student.id}" data-matiere="${m.nom}" style="background: #F1F5F9; color: var(--sidi-blue-dark); border: 1px dashed var(--sidi-blue); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600;">
                        ➕ Ajouter un professeur à ${m.nom}
                    </button>
                </div>
            `;

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
                    renderSettingsStudentsCodes();
                    populateMatieresSelect(student);
                }
            });

            item.querySelectorAll('.btn-copy-prof-code-cfg').forEach(b => {
                b.addEventListener('click', () => {
                    const c = b.getAttribute('data-code');
                    navigator.clipboard.writeText(c).then(() => {
                        alert(`Code Professeur copié : ${c}\\n\\nTransmettez ce code au professeur pour qu'il accède directement à l'élève pour la matière ${m.nom} uniquement.`);
                    });
                });
            });

            item.querySelectorAll('.btn-edit-prof-action').forEach(b => {
                b.addEventListener('click', () => {
                    const sId = b.getAttribute('data-student-id');
                    const mName = b.getAttribute('data-matiere');
                    const pName = b.getAttribute('data-prof');
                    const c = b.getAttribute('data-code') || '';
                    openEditProfessorModal(sId, mName, pName, c);
                });
            });

            item.querySelectorAll('.btn-delete-prof-action').forEach(b => {
                b.addEventListener('click', () => {
                    const sId = b.getAttribute('data-student-id');
                    const mName = b.getAttribute('data-matiere');
                    const pName = b.getAttribute('data-prof');
                    if (confirm(`Voulez-vous vraiment supprimer le professeur "${pName}" de la matière ${mName} ?`)) {
                        deleteProfessor(sId, mName, pName);
                        alert(`Professeur "${pName}" supprimé avec succès.`);
                    }
                });
            });

            const btnAddProf = item.querySelector('.btn-add-prof-direct');
            if (btnAddProf) {
                btnAddProf.addEventListener('click', () => {
                    const sId = btnAddProf.getAttribute('data-student-id');
                    const mName = btnAddProf.getAttribute('data-matiere');
                    const newProf = prompt(`Nom du professeur à ajouter pour la matière "${mName}" (ex: M. Ahmed Ben Salem) :`);
                    if (newProf && newProf.trim()) {
                        addProfessor(sId, mName, newProf.trim());
                        alert(`Professeur "${newProf.trim()}" ajouté avec succès à la matière ${mName} !`);
                    }
                });
            }

            container.appendChild(item);
        });
    }

    // --- GESTION DES PROFESSEURS : MODIFICATION ET SUPPRESSION ---
    const modalEditProf = document.getElementById('modal-edit-prof');
    const formEditProf = document.getElementById('form-edit-prof');
    const btnCloseEditProf = document.getElementById('btn-close-edit-prof');
    const btnCancelEditProf = document.getElementById('btn-cancel-edit-prof');

    function openEditProfessorModal(studentId, matiereName, profName, profCode) {
        const student = getStudent(studentId);
        if (!student) return;

        document.getElementById('edit-prof-student-id').value = studentId;
        document.getElementById('edit-prof-student-name').textContent = `${student.prenom} ${student.nom} (${student.classe || 'Élève'})`;
        document.getElementById('edit-prof-matiere').value = matiereName;
        document.getElementById('edit-prof-matiere-name').textContent = matiereName;
        document.getElementById('edit-prof-old-name').value = profName;
        document.getElementById('edit-prof-nom').value = profName;
        document.getElementById('edit-prof-current-code').textContent = profCode || '---';

        if (modalEditProf) {
            modalEditProf.style.display = 'flex';
            setTimeout(() => {
                const inp = document.getElementById('edit-prof-nom');
                if (inp) inp.focus();
            }, 50);
        }
    }

    if (btnCloseEditProf) {
        btnCloseEditProf.addEventListener('click', () => {
            if (modalEditProf) modalEditProf.style.display = 'none';
        });
    }
    if (btnCancelEditProf) {
        btnCancelEditProf.addEventListener('click', () => {
            if (modalEditProf) modalEditProf.style.display = 'none';
        });
    }

    if (formEditProf) {
        formEditProf.addEventListener('submit', (e) => {
            e.preventDefault();
            const studentId = document.getElementById('edit-prof-student-id').value;
            const matiere = document.getElementById('edit-prof-matiere').value;
            const oldName = document.getElementById('edit-prof-old-name').value;
            const newName = document.getElementById('edit-prof-nom').value.trim();

            if (!newName) {
                alert('Veuillez saisir le nom du professeur.');
                return;
            }

            const success = updateProfessor(studentId, matiere, oldName, newName);
            if (success) {
                if (modalEditProf) modalEditProf.style.display = 'none';
                alert(`Données du professeur mises à jour : "${newName}" !`);
            }
        });
    }

    function updateProfessor(studentId, matiereName, oldName, newName) {
        if (!newName || !newName.trim()) return false;
        const cleanNewName = newName.trim();
        const student = getStudent(studentId);
        if (!student || !student.matieres) return false;

        const matiere = student.matieres.find(m => m.nom.toLowerCase() === matiereName.toLowerCase());
        if (!matiere) return false;

        // 1. Mettre à jour dans m.professeurs
        if (matiere.professeurs) {
            const idx = matiere.professeurs.findIndex(p => {
                const pName = typeof p === 'string' ? p : (p.nom || '');
                return pName.toLowerCase() === oldName.toLowerCase();
            });
            if (idx >= 0) {
                matiere.professeurs[idx] = cleanNewName;
            } else {
                matiere.professeurs.push(cleanNewName);
            }
        } else {
            matiere.professeurs = [cleanNewName];
        }

        // 2. Mettre à jour dans m.profCodes
        if (matiere.profCodes) {
            const pc = matiere.profCodes.find(c => c.nom.toLowerCase() === oldName.toLowerCase());
            if (pc) {
                pc.nom = cleanNewName;
            }
        }

        // 3. Mettre à jour dans les séances passées
        if (student.sessions) {
            student.sessions.forEach(s => {
                if (s.matiere && s.matiere.toLowerCase() === matiereName.toLowerCase()) {
                    if (s.professeur && s.professeur.toLowerCase() === oldName.toLowerCase()) {
                        s.professeur = cleanNewName;
                    }
                }
            });
        }

        ensureProfCodes(student);
        saveData();
        renderSettingsStudentsCodes();
        renderMatieresConfigList();
        if (appState.currentStudentId === studentId) {
            loadDashboard(student);
        }
        return true;
    }

    function deleteProfessor(studentId, matiereName, profName) {
        const student = getStudent(studentId);
        if (!student || !student.matieres) return false;

        const matiere = student.matieres.find(m => m.nom.toLowerCase() === matiereName.toLowerCase());
        if (!matiere) return false;

        // Supprimer de m.professeurs
        if (matiere.professeurs) {
            matiere.professeurs = matiere.professeurs.filter(p => {
                const pName = typeof p === 'string' ? p : (p.nom || '');
                return pName.toLowerCase() !== profName.toLowerCase();
            });
        }

        // Supprimer de m.profCodes
        if (matiere.profCodes) {
            matiere.profCodes = matiere.profCodes.filter(c => c.nom.toLowerCase() !== profName.toLowerCase());
        }

        ensureProfCodes(student);
        saveData();
        renderSettingsStudentsCodes();
        renderMatieresConfigList();
        if (appState.currentStudentId === studentId) {
            loadDashboard(student);
        }
        return true;
    }

    function addProfessor(studentId, matiereName, profName) {
        if (!profName || !profName.trim()) return false;
        const cleanName = profName.trim();
        const student = getStudent(studentId);
        if (!student || !student.matieres) return false;

        const matiere = student.matieres.find(m => m.nom.toLowerCase() === matiereName.toLowerCase());
        if (!matiere) return false;

        if (!matiere.professeurs) matiere.professeurs = [];
        const exists = matiere.professeurs.some(p => {
            const pName = typeof p === 'string' ? p : (p.nom || '');
            return pName.toLowerCase() === cleanName.toLowerCase();
        });
        if (!exists) {
            matiere.professeurs.push(cleanName);
        }

        ensureProfCodes(student);
        saveData();
        renderSettingsStudentsCodes();
        renderMatieresConfigList();
        if (appState.currentStudentId === studentId) {
            loadDashboard(student);
        }
        return true;
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
            renderSettingsStudentsCodes();
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
