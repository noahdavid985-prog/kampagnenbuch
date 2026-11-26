# Tales of Nalvair · Kampagnenbuch

Das Kampagnenbuch unserer D&D-Runde: Charakterbögen, Gruppe, Karte, Chronik und Notizen.
Es läuft als Web-App im Browser und lässt sich auf Mac, Windows und dem Handy als App installieren.
Der Look passt zum Kamera-Overlay: dunkel als Standard, hell nach Wahl (Konto → Darstellung oder Sonne/Mond oben).

- Daten und Anmeldung: Firebase (Firestore und Authentication). Die Verbindung steht in `config.js`.
- Wer was lesen und schreiben darf, regeln die Firestore-Sicherheitsregeln im Firebase-Projekt.
- Die Seite selbst wird über GitHub Pages aus diesem Repository ausgeliefert.

Bibliotheken: Preact und htm (MIT), TweetNaCl (Public Domain), Firebase JS SDK 10.12.2 (Apache 2.0), jsPDF 4.2.1 (MIT). Schriften im PDF: Outfit und Marcellus (SIL Open Font License).
