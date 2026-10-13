#!/usr/bin/env python3
"""
EduPocket - Keygen CLI
Générateur officiel de clé de licence pour l'application EduPocket (Parent & Professeur)
Usage:
    python3 keygen.py "professeur" "M." "Sami" "Dubois"
    python3 keygen.py "parent" "M." "Hamed" "Ben Khalifa"
    ou simplement interactif :
    python3 keygen.py
"""
import sys
import hashlib
import unicodedata
import re

SECRET_SALT = 'EDUPOCKET-2026-KEYGEN-LIC-SECURE'

def normalize_text(text):
    if not text:
        return ''
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^A-Za-z0-9]', '', text)
    return text.upper().strip()

def normalize_civility(civ):
    if not civ:
        return 'M'
    c = civ.upper().strip()
    if 'MME' in c or 'MADAME' in c:
        return 'MME'
    return 'M'

def normalize_role(role):
    if not role:
        return 'PARENT'
    r = role.upper().strip()
    if 'PROF' in r or 'ENSEIGNANT' in r:
        return 'PROFESSEUR'
    return 'PARENT'

def generate_license_key(role, civilite, prenom, nom):
    norm_r = normalize_role(role)
    civ = normalize_civility(civilite)
    norm_nom = normalize_text(nom)
    norm_prenom = normalize_text(prenom)
    
    if not norm_nom or not norm_prenom:
        return ''
    
    prefix = 'EDUP-PRF' if norm_r == 'PROFESSEUR' else 'EDUP-PAR'
    payload = f"{norm_r}|{civ}|{norm_nom}|{norm_prenom}|{SECRET_SALT}"
    h = hashlib.sha256(payload.encode('utf-8')).hexdigest().upper()
    return f"{prefix}-{h[0:4]}-{h[4:8]}-{h[8:12]}"

def get_welcome_greeting(civilite, nom):
    is_mme = normalize_civility(civilite) == 'MME'
    title = 'Madame' if is_mme else 'Monsieur'
    return f"Bonjour {title} {nom.strip()}"

def main():
    if len(sys.argv) >= 5:
        role = sys.argv[1]
        civilite = sys.argv[2]
        prenom = sys.argv[3]
        nom = sys.argv[4]
    elif len(sys.argv) == 4:
        # Rétrocompatibilité : role parent implicite
        role = 'parent'
        civilite = sys.argv[1]
        prenom = sys.argv[2]
        nom = sys.argv[3]
    else:
        print("=" * 65)
        print("  🔑 EDUPOCKET - GÉNÉRATEUR DE LICENCE (PARENT & PROFESSEUR)")
        print("=" * 65)
        print("1. Parent")
        print("2. Professeur")
        choice = input("Choisissez le type de licence [1]: ").strip() or "1"
        role = 'professeur' if choice == '2' or 'prof' in choice.lower() else 'parent'
        
        civilite = input("Civilité (M. ou Mme) [M.] : ").strip() or "M."
        prenom = input("Prénom : ").strip()
        nom = input("Nom de famille : ").strip()

    if not prenom or not nom:
        print("Erreur : Le prénom et le nom sont requis.")
        sys.exit(1)

    role_norm = normalize_role(role)
    role_label = "Professeur" if role_norm == "PROFESSEUR" else "Parent"
    key = generate_license_key(role_norm, civilite, prenom, nom)
    greeting = get_welcome_greeting(civilite, nom)

    print("\n" + "=" * 65)
    print(f"🏷️  Rôle      : {role_label}")
    print(f"👤 Titulaire : {civilite} {prenom} {nom}")
    print(f"👋 Salutation : {greeting}")
    print(f"🔑 Clé       : {key}")
    print("=" * 65)
    print("\nMessage complet à copier pour le client :\n")

    if role_norm == "PROFESSEUR":
        print(f"""{greeting},

Merci pour votre souscription à l'application EduPocket (Espace Enseignant) !
Voici vos informations d'activation :
--------------------------------------------------
👤 Titulaire : {civilite} {prenom} {nom}
🏷️ Type : Licence Professeur
🔑 Clé de licence : {key}
🌐 Application : https://bkhmondocteur.github.io/EduPocket/
--------------------------------------------------

Instructions :
1. Ouvrez le lien de l'application.
2. Choisissez "Je suis Professeur".
3. Saisissez votre civilité ({civilite}), nom, prénom et votre clé de licence.
4. Vous pourrez ensuite ajouter vos élèves soit en saisissant le code transmis par les parents, soit en créant un élève directement pour lui générer son code famille à transmettre aux parents.

Bien cordialement,
L'équipe EduPocket
""")
    else:
        print(f"""{greeting},

Merci pour votre souscription à EduPocket !
Voici vos informations d'activation :
--------------------------------------------------
👤 Titulaire : {civilite} {prenom} {nom}
🏷️ Type : Licence Parent
🔑 Clé de licence : {key}
🌐 Application : https://bkhmondocteur.github.io/EduPocket/
--------------------------------------------------

Instructions :
1. Ouvrez le lien de l'application.
2. Choisissez "Je suis Parent".
3. Saisissez votre civilité ({civilite}), nom, prénom et votre clé de licence.
4. Vos enfants pourront ensuite se connecter avec leur Code Famille et leur Code Élève.

Bien cordialement,
L'équipe EduPocket
""")

if __name__ == '__main__':
    main()

