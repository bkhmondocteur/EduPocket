#!/usr/bin/env python3
"""
EduPocket - Keygen CLI
Générateur de clé de licence pour l'application EduPocket
Usage:
    python3 keygen.py "M." "Hamed" "Ben Khalifa"
    ou simplement:
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

def generate_license_key(civilite, prenom, nom):
    civ = normalize_civility(civilite)
    norm_nom = normalize_text(nom)
    norm_prenom = normalize_text(prenom)
    
    if not norm_nom or not norm_prenom:
        return ''
    
    payload = f"{civ}|{norm_nom}|{norm_prenom}|{SECRET_SALT}"
    h = hashlib.sha256(payload.encode('utf-8')).hexdigest().upper()
    return f"EDUP-{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

def get_welcome_greeting(civilite, nom):
    is_mme = normalize_civility(civilite) == 'MME'
    title = 'Madame' if is_mme else 'Monsieur'
    return f"Bonjour {title} {nom.strip()}"

def main():
    if len(sys.argv) >= 4:
        civilite = sys.argv[1]
        prenom = sys.argv[2]
        nom = sys.argv[3]
    else:
        print("=" * 60)
        print("  🔑 EDUPOCKET - GÉNÉRATEUR DE CLÉ DE LICENCE PARENT")
        print("=" * 60)
        civilite = input("Civilité (M. ou Mme) [M.] : ").strip() or "M."
        prenom = input("Prénom du parent : ").strip()
        nom = input("Nom de famille du parent : ").strip()

    if not prenom or not nom:
        print("Erreur : Le prénom et le nom sont requis.")
        sys.exit(1)

    key = generate_license_key(civilite, prenom, nom)
    greeting = get_welcome_greeting(civilite, nom)

    print("\n" + "-" * 60)
    print(f"👤 Titulaire : {civilite} {prenom} {nom}")
    print(f"👋 Salutation : {greeting}")
    print(f"🔑 Clé de licence : {key}")
    print("-" * 60)
    print("\nMessage pour le client :\n")
    print(f"""{greeting},

Merci pour votre souscription à EduPocket !
Voici vos informations d'activation :
- Titulaire : {civilite} {prenom} {nom}
- Clé de licence : {key}
- Lien : https://bkhmondocteur.github.io/EduPocket/

À la première ouverture, choisissez 'Je suis Parent' et saisissez votre civilité, nom, prénom et votre clé.
""")

if __name__ == '__main__':
    main()
