# HRT Dashboard

Ein modernes Dashboard zur Verwaltung von Bonusauszahlungen für die HRT-Community.

## 📁 Projektstruktur

```
.
├── index.html          # Haupt-HTML-Datei
├── app.js              # Anwendungslogik
├── styles.css          # Stile und Design
├── .env                # Umgebungsvariablen (NICHT COMMITTEN!)
└── README.md           # Diese Datei
```

## 🚀 Schnellstart

1. **Klonen des Repositories**
   ```bash
   git clone https://github.com/xryven/Dashboard.git
   cd Dashboard
   ```

2. **Umgebungsvariablen einrichten**
   - Erstelle eine `.env`-Datei basierend auf `.env.example`
   - Trage deine Firebase-Konfiguration und Discord-Webhook ein

3. **Lokal ausführen**
   - Einfach die `index.html` in einem Browser öffnen
   - Oder einen lokalen Server starten:
     ```bash
     python -m http.server 8000
     ```

## 🔧 Firebase-Sicherheitsregeln

### Empfohlene Realtime Database Regeln

```json
{
  "rules": {
    "keys": {
      ".read": "auth != null && (root.child('keys/' + auth.uid).exists() || root.child('admins/' + auth.uid).exists())",
      ".write": "auth != null && root.child('admins/' + auth.uid).exists()"
    },
    "uploads": {
      ".read": "auth != null && (root.child('keys/' + auth.uid).exists() || root.child('admins/' + auth.uid).exists())",
      ".write": "auth != null && root.child('keys/' + auth.uid).exists()",
      "$entry": {
        ".validate": "newData.hasChildren(['name', 'activity', 'date', 'status'])"
      }
    },
    "admins": {
      ".read": "auth != null && root.child('admins/' + auth.uid).exists()",
      ".write": "auth != null && root.child('superadmins/' + auth.uid).exists()"
    }
  }
}
```

### Wichtige Sicherheitshinweise

1. **Firebase-Konfiguration** sollte NIE im Client-Code exponiert werden
2. **Webhook-URLs** sollten serverseitig verarbeitet werden
3. **Session-Management** sollte sicherer implementiert werden (z.B. mit HTTP-only Cookies)
4. **Datei-Uploads** sollten auf Größe und Typ validiert werden

## 🎨 Design-Änderungen

### Vorher vs. Nachher

- **Hintergrund**: Dunkles Design mit Fade-Effekt → Hellere, moderne Oberfläche
- **Animationen**: Fade-Übergänge → Scale, Slide, Bounce-Effekte
- **Layout**: Kompakter und übersichtlicher
- **Farben**: Konsistentes Farbschema mit besseren Kontrasten
- **Responsive**: Bessere Anpassung an mobile Geräte

### Neue Features

1. **Export in Admin-Bereich verschoben** - Alle Admin-Tools an einem Ort
2. **Verbesserte ID-Matching-Logik** - Einsendungen werden korrekt zu Benutzern zugeordnet
3. **Bessere Scrolling-Erfahrung** - Keine Scroll-Bugs mehr
4. **Kompakte Login/Registrierung** - Minimalistisches Design
5. **Schnellere Ladezeiten** - Optimierte Animationen und DOM-Manipulation

## 🐛 Bugfixes

1. **ID-basiertes Matching**: Einsendungen mit Spieler-ID werden korrekt zugeordnet
2. **Scrolling-Bugs**: Behoben durch bessere CSS-Container
3. **Export-Feature**: In Admin-Tools integriert
4. **Sicherheitslücken**: 
   - Input-Validierung für Datei-Uploads
   - XSS-Schutz durch escapeHtml()
   - Session-Management verbessert

## 📦 Abhängigkeiten

- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [JSZip](https://stuk.github.io/jszip/) für Export-Funktionalität

## 🔒 Sicherheitsempfehlungen

1. **Firebase-Regeln anpassen** (siehe oben)
2. **.env-Datei NICHT commiten**
3. **HTTPS erzwingen** für alle Verbindungen
4. **Rate-Limiting** auf dem Server implementieren
5. **Logging** für verdächtige Aktivitäten
6. **Regelmäßige Backups** der Datenbank

## 📝 Lizenz

Dieses Projekt ist für den internen Gebrauch der HRT-Community bestimmt.

## 🙏 Beitrag

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Erstelle einen Pull Request

## 📞 Support

Bei Fragen oder Problemen, wende dich an die HRT-Administration.
