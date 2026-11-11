# Hollowmere Kampagnenbuch

Das Kampagnenbuch unserer D&D-Runde: Charakterbögen, Gruppe, Karte, Chronik und Notizen.
Es läuft als Web-App im Browser und lässt sich auf Mac, Windows und dem Handy als App installieren.

- Daten und Anmeldung: Firebase (Firestore und Authentication). Die Verbindung steht in `config.js`.
- Wer was lesen und schreiben darf, regeln die Firestore-Sicherheitsregeln im Firebase-Projekt.
- Die Seite selbst wird über GitHub Pages aus diesem Repository ausgeliefert.

Bibliotheken: Preact und htm (MIT), TweetNaCl (Public Domain), Firebase JS SDK 10.12.2 (Apache 2.0).
