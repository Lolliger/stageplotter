# stageplot

Mobilfreundlicher Stageplot-Editor für Veranstaltungstechnik. Instrumente auf einem Bühnenplan
platzieren – das Tool ordnet jedes Instrument automatisch der nächstgelegenen Stagebox zu und
erzeugt daraus Inputliste, Outputliste und Patchplan. Per Schalter wird daraus ein Lichtplot mit
Lampen, Traversen und DMX-Adressliste. Läuft komplett im Browser, auch offline.

## Features

- **Bühnenplan** in Draufsicht, Bühnengröße frei einstellbar (mit Schnellauswahl), Elemente per
  Finger oder Maus verschiebbar, optional mit 25-cm-Raster, Zoom und Verschieben (Pinch, Mausrad,
  Buttons)
- **Stageboxen** mit einstellbaren Inputs/Outputs und Farbe, Auslastung direkt im Plan
  (z. B. `11/16 In · 3/8 Out`)
- **Auto-Zuordnung** zur nächstgelegenen Box mit genug freien Inputs; Gruppen (z. B. ein Drumset)
  bleiben zusammen, werden nur notfalls mit Warnung aufgeteilt; feste Zuordnung per Pin
- **Drum-Konfigurator** (Kick In/Out, Snare Top/Bottom, Hi-Hat, Toms, OH, Room, Percussion;
  Vorlagen Minimal/Standard/Voll) mit Live-Anzeige der Kanäle und freien Inputs
- **Vorlagen** für Bass, Gitarre, Akustik, Keys (mono/stereo), Lead/Backing Vox, Percussion
  und **Backline-Amps** (Gitarre, Bass, Keyboard); Kanäle frei bearbeitbar (Name, Mikro,
  Notiz, Reihenfolge)
- **Outputs**: Wedges, IEMs, Sidefills, **PA (L + R)** und **Subs** – jedes belegt einen Output
  seiner Box; PA und Subs stehen neben bzw. vor der Bühne; alles mit Abstrahlrichtung drehbar
- **PA-Technik**: Frequenzweiche (Ein-/Ausgänge, Anschlusstyp, Hoch-/Tiefpass, Steilheit,
  Charakteristik, Vorlagen) und Endstufe (Kanäle, Leistung, Anschlüsse); Signalweg
  Stagebox → Weiche → Endstufe → Lautsprecher frei verknüpfbar
- **Gebündelte Kabelwege**: rechtwinklige Strippen je Box, ohne Umweg zusammengelegt, Dicke und
  Anzahl je Bündel (alternativ Luftlinie)
- **Listen** je Box: Port, Quelle, Abnahme, Abstand; rote Warnungen mit konkretem Hinweis, was fehlt
- **Lichtplot** (Schalter „Ton | Licht“, eigene Optik): Lampen aus einer Bibliothek (PAR, Moving
  Heads, Profiler, Blinder, Strobe, LED-Bar, Nebel …) mit Nummer, Modus/Kanälen, Universe,
  Adresse, Leuchtrichtung, Farbe; Traversen mit Länge und Richtung, Lampen rasten ein und wandern
  mit; auch neben, vor und hinter der Bühne. Auto-Adressierung, Adressliste je Universe,
  Warnungen bei Überschneidungen. Je Modus einstellbar, was vom anderen Gewerk grau zu sehen ist
- **Export**: PDF Ton, Licht oder komplett (Pläne als Vektorgrafik, Input-, Outputliste,
  PA-Signalweg, DMX-Adressliste), JSON-Projektdatei mit Patch und Adressliste; Import mit Prüfung
- **Rückgängig/Wiederholen**, automatische Speicherung im Browser
- **Offline-fähig** und als App auf dem Home-Bildschirm installierbar
- Für Handy, iPad und Desktop, Dark/Light Mode automatisch

## Bedienung in Kürze

| Aktion | So geht's |
|---|---|
| Element hinzufügen | Toolbar: Instrument, Output, Stagebox |
| Verschieben | Element ziehen |
| Bearbeiten, Pin, Löschen | Element antippen |
| Bühnengröße, Kabelansicht, Raster, Sichtbarkeit | Toolbar: Bühne |
| Lichtplot | Schalter „Ton \| Licht“ oben, dann Lampe, Traverse, Adressen |
| PDF / JSON / Neues Projekt | Teilen-Symbol oben rechts |
| Zoomen | `+` / `−` am Plan, Pinch, Mausrad (Handy: Strg/Cmd + Mausrad) |
| Rückgängig | Pfeile oben rechts, Strg/Cmd+Z |

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Unit-Tests (Vitest)
npm run lint
npm run build    # Typecheck + statischer Build nach dist/
npm run preview  # Build lokal ansehen (inkl. Service Worker)
```

Stack: Vite, React, TypeScript (strict), Vitest; PDF mit jsPDF, svg2pdf.js und jspdf-autotable
(nur beim Export nachgeladen). Kein eigenes Backend: Plots liegen im Browser („Meine Plots“), in
der AK-Technik-App mit `?event=<id>` beim Event (siehe docs/decisions.md, D33).

### Struktur

```
src/
  model/       Datenmodell, Standardwerte, Vorlagen, Drum-Konfiguration, Geräte, Lampen
  lib/         reine Logik: assign (Zuordnung), cables (Kabelbündel), dmx (Adressen), geometry, viewport,
               schema (Import/Validierung), library (Meine Plots), remote (Plot zum Event), export/ (JSON, PDF, Druck-SVG, Tabellen)
  state/       Reducer, Undo/Redo-History, Provider
  components/  stage/ (SVG-Plan), lists/, editors/, toolbar/, ui/
  styles/      Theme (Dark/Light), Layout
```

Die Zuordnung ist nie gespeichert, sondern wird aus dem Projekt abgeleitet (`assign(project)`).
Details: [docs/plan.md](docs/plan.md), Entscheidungen: [docs/decisions.md](docs/decisions.md).

## Deployment

Statische Seite auf Vercel: Repository importieren, Einstellungen kommen aus `vercel.json`
(Framework Vite, Build `npm run build`, Output `dist/`, Cache-Header für Service Worker und
Assets). Keine Umgebungsvariablen nötig.

### In eine andere Vercel-Seite einbinden (z. B. `ak-seite.de/stageplot`)

Alle Pfade sind relativ, die App läuft deshalb auch unter einem Unterpfad. In der
**anderen** Seite (nicht in diesem Repo) in deren `vercel.json` ergänzen – Adresse des
stageplot-Deployments anpassen:

```json
{
  "redirects": [{ "source": "/stageplot", "destination": "/stageplot/", "permanent": true }],
  "rewrites": [{ "source": "/stageplot/:path*", "destination": "https://stageplotter.vercel.app/:path*" }]
}
```

Bei einer Next.js-Seite geht dasselbe in `next.config.js` über `redirects()` und `rewrites()`.
Die Seite zeigt dann `/stageplot/`, ausgeliefert wird weiter vom stageplot-Projekt – Updates
kommen automatisch. Der Schrägstrich am Ende ist wichtig, darum der Redirect. Alternativ direkt
`/stageplot/index.html` verlinken bzw. einbetten.

Die AK-App (Repo `Lolliger/aktapp`) bindet den Editor als Reiter `/stageplot` per iframe ein;
dort reicht die Umgebungsvariable `STAGEPLOT_ORIGIN` (siehe deren `ARCHITECTURE.md`).
