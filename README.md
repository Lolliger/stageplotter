# stageplot

Mobilfreundlicher Stageplot-Editor für Veranstaltungstechnik. Instrumente auf einem Bühnenplan
platzieren – das Tool ordnet jedes Instrument automatisch der nächstgelegenen Stagebox zu und
erzeugt daraus Inputliste, Outputliste und Patchplan. Läuft komplett im Browser, auch offline.

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
- **Vorlagen** für Bass, Gitarre, Akustik, Keys (mono/stereo), Lead/Backing Vox, Percussion;
  Kanäle frei bearbeitbar (Name, Mikro, Notiz, Reihenfolge)
- **Outputs**: Wedges, IEMs, Sidefills – jedes belegt einen Output seiner Box
- **Gebündelte Kabelwege**: rechtwinklige Strippen je Box, ohne Umweg zusammengelegt, Dicke und
  Anzahl je Bündel (alternativ Luftlinie)
- **Listen** je Box: Port, Quelle, Abnahme, Abstand; rote Warnungen mit konkretem Hinweis, was fehlt
- **Export**: PDF (Bühnenplan als Vektorgrafik + Input- und Outputliste), JSON-Projektdatei;
  Import mit Prüfung
- **Rückgängig/Wiederholen**, automatische Speicherung im Browser
- **Offline-fähig** und als App auf dem Home-Bildschirm installierbar
- Für Handy, iPad und Desktop, Dark/Light Mode automatisch

## Bedienung in Kürze

| Aktion | So geht's |
|---|---|
| Element hinzufügen | Toolbar: Instrument, Output, Stagebox |
| Verschieben | Element ziehen |
| Bearbeiten, Pin, Löschen | Element antippen |
| Bühnengröße, Kabelansicht, Raster | Toolbar: Bühne |
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
(nur beim Export nachgeladen). Kein Backend.

### Struktur

```
src/
  model/       Datenmodell, Standardwerte, Vorlagen, Drum-Konfiguration
  lib/         reine Logik: assign (Zuordnung), cables (Kabelbündel), geometry, viewport,
               schema (Import/Validierung), storage, export/ (JSON, PDF, Druck-SVG, Tabellen)
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
