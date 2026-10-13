/**
 * EduPocket - Système de Licence et Cryptographie
 * Générateur et Vérificateur de Clé de Licence pour les Parents
 */
(function(global) {
    'use strict';

    // Sel cryptographique secret pour EduPocket
    const SECRET_SALT = 'EDUPOCKET-2026-KEYGEN-LIC-SECURE';

    /**
     * Implémentation pure JavaScript autonome de SHA-256 (100% hors-ligne & cross-plateforme)
     */
    function sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var lengthProperty = "length";
        var i, j;
        var result = "";
        var words = [];
        var asciiBitLength = ascii[lengthProperty] * 8;
        var hash = [];
        var k = [];
        var primeCounter = 0;
        var isComposite = {};
        for (var candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        ascii += "\x80";
        while (ascii[lengthProperty] % 64 - 56) ascii += "\x00";
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return "";
            words[i >> 2] |= j << ((3 - i) % 4) * 8;
        }
        words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
        words[words[lengthProperty]] = (asciiBitLength);
        for (j = 0; j < words[lengthProperty];) {
            var w = words.slice(j, j += 16);
            var oldHash = hash;
            hash = hash.slice(0, 8);
            for (i = 0; i < 64; i++) {
                var w15 = w[i - 15], w2 = w[i - 2];
                var a = hash[0], e = hash[4];
                var temp1 = hash[7]
                    + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                    + ((e & hash[5]) ^ ((~e) & hash[6]))
                    + k[i]
                    + (w[i] = (i < 16) ? w[i] : (
                            w[i - 16]
                            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
                            + w[i - 7]
                            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                        ) | 0
                    );
                var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                    + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
            }
            for (i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }
        for (i = 0; i < 8; i++) {
            for (var i2 = 3; i2 >= 0; i2--) {
                var c = (hash[i] >> (i2 * 8)) & 255;
                result += ((c < 16) ? "0" : "") + c.toString(16);
            }
        }
        return result;
    }

    /**
     * Normalise une chaîne de texte (supprime accents, tirets, espaces, majuscules)
     */
    function normalizeText(text) {
        if (!text) return "";
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase()
            .trim();
    }

    /**
     * Normalise la civilité ('M.' ou 'Mme')
     */
    function normalizeCivility(civ) {
        if (!civ) return 'M';
        const c = civ.toUpperCase().trim();
        if (c.includes('MME') || c.includes('MADAME')) {
            return 'MME';
        }
        return 'M';
    }

    /**
     * Normalise le rôle ('parent' ou 'professeur')
     */
    function normalizeRole(role) {
        if (!role) return 'PARENT';
        const r = role.toUpperCase().trim();
        if (r.includes('PROF') || r.includes('ENSEIGNANT')) {
            return 'PROFESSEUR';
        }
        return 'PARENT';
    }

    /**
     * Génère la clé de licence EduPocket
     * Supporte :
     * - generateLicenseKey('parent', 'M.', 'Hamed', 'Ben Khalifa') -> EDUP-PAR-XXXX-XXXX-XXXX
     * - generateLicenseKey('professeur', 'M.', 'Sami', 'Dubois') -> EDUP-PRF-XXXX-XXXX-XXXX
     * - generateLicenseKey('M.', 'Hamed', 'Ben Khalifa') -> mode rétrocompatible parent
     */
    function generateLicenseKey(roleOrCiv, civOrPrenom, prenomOrNom, maybeNom) {
        let role = 'PARENT';
        let rawCiv = 'M.';
        let rawPrenom = '';
        let rawNom = '';

        if (maybeNom !== undefined) {
            role = normalizeRole(roleOrCiv);
            rawCiv = civOrPrenom;
            rawPrenom = prenomOrNom;
            rawNom = maybeNom;
        } else {
            // Mode 3 arguments : rôle parent par défaut
            role = 'PARENT';
            rawCiv = roleOrCiv;
            rawPrenom = civOrPrenom;
            rawNom = prenomOrNom;
        }

        const civ = normalizeCivility(rawCiv);
        const normNom = normalizeText(rawNom);
        const normPrenom = normalizeText(rawPrenom);
        
        if (!normNom || !normPrenom) return '';

        const prefix = role === 'PROFESSEUR' ? 'EDUP-PRF' : 'EDUP-PAR';
        const payload = `${role}|${civ}|${normNom}|${normPrenom}|${SECRET_SALT}`;
        const hash = sha256(payload).toUpperCase();

        if (!hash || hash.length < 16) return '';

        return `${prefix}-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
    }

    /**
     * Génération de l'ancien format parent pour rétrocompatibilité
     */
    function generateLegacyParentKey(civilite, prenom, nom) {
        const civ = normalizeCivility(civilite);
        const normNom = normalizeText(nom);
        const normPrenom = normalizeText(prenom);
        if (!normNom || !normPrenom) return '';
        const payload = `${civ}|${normNom}|${normPrenom}|${SECRET_SALT}`;
        const hash = sha256(payload).toUpperCase();
        return `EDUP-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
    }

    /**
     * Vérifie si une clé de licence est valide pour un rôle et utilisateur donnés
     * Supporte:
     * - verifyLicenseKey('parent', civ, prenom, nom, key)
     * - verifyLicenseKey('professeur', civ, prenom, nom, key)
     * - verifyLicenseKey(civ, prenom, nom, key) (défaut parent)
     */
    function verifyLicenseKey(roleOrCiv, civOrPrenom, prenomOrNom, keyOrNom, maybeKey) {
        let role = 'PARENT';
        let civ = 'M.';
        let prenom = '';
        let nom = '';
        let keyToTest = '';

        if (maybeKey !== undefined) {
            role = normalizeRole(roleOrCiv);
            civ = civOrPrenom;
            prenom = prenomOrNom;
            nom = keyOrNom;
            keyToTest = maybeKey;
        } else {
            role = 'PARENT';
            civ = roleOrCiv;
            prenom = civOrPrenom;
            nom = prenomOrNom;
            keyToTest = keyOrNom;
        }

        if (!keyToTest) return false;

        const cleanInput = keyToTest.trim().toUpperCase().replace(/\s+/g, '');

        // 1. Vérification avec le rôle demandé
        const expected = generateLicenseKey(role, civ, prenom, nom);
        if (expected && cleanInput === expected.replace(/\s+/g, '')) {
            return true;
        }

        // 2. Tolérance rétrocompatible pour parent (si ancienne clé à 4 blocs)
        if (role === 'PARENT') {
            const legacyExpected = generateLegacyParentKey(civ, prenom, nom);
            if (legacyExpected && cleanInput === legacyExpected.replace(/\s+/g, '')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Construit le message de bienvenue avec civilité
     * Ex: "Bonjour Monsieur Ben Khalifa" ou "Bonjour Madame Ben Khalifa"
     */
    function getWelcomeGreeting(civilite, nom) {
        const isMme = normalizeCivility(civilite) === 'MME';
        const title = isMme ? 'Madame' : 'Monsieur';
        const cleanNom = (nom || '').trim();
        return `Bonjour ${title} ${cleanNom}`;
    }

    // Export de l'API
    const EduPocketLicense = {
        generateLicenseKey,
        verifyLicenseKey,
        getWelcomeGreeting,
        normalizeCivility,
        normalizeText,
        sha256
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EduPocketLicense;
    }
    if (typeof window !== 'undefined') {
        window.EduPocketLicense = EduPocketLicense;
    }

})(typeof window !== 'undefined' ? window : this);
