# Plan: stageplot

Mobilfreundlicher Stageplot-Editor für Veranstaltungstechnik. Instrumente werden auf einem
Bühnenplan (Draufsicht) platziert, automatisch der nächstgelegenen Stagebox zugeordnet, daraus
entstehen Inputliste und Patchplan.

## 1. Architektur

```
┌──────────────────────────── UI (React) ─────────────────────────────┐
│  StagePlot (SVG, Drag)   Listen (Input/Output)   Toolbar   Sheets   │
└───────────────▲──────────────────────▲───────────────────┬──────────┘
                │ useMemo(assign(project))                 │ dispatch(action)
┌───────────────┴──────────────────────┴───────────────────▼──────────┐
│  State: Project (useReducer, reiner Reducer) ──► localStorage        │
└───────────────▲─────────────────────────────────────────────────────┘
                │ reine Funktionen, ohne React-Import
┌───────────────┴─────────────────────────────────────────────────────┐
│  lib/: distance · assign · templates/drums · schema (Import/Migrate) │
│        export/json · export/pdf (lazy geladen)                       │
└─────────────────────────────────────────────────────────────────────┘
```

Grundprinzipien:

- **Ein Zustand: das `Project`.** Gespeichert wird nur, was der Nutzer eingibt (Positionen,
  Kanäle, Boxen, Pins). Zuordnung, Ports, Abstände und Warnungen sind **abgeleitet** und werden bei
  jeder Änderung neu aus `assign(project)` berechnet (per `useMemo`). Dadurch kann der gespeicherte
  Zustand nie inkonsistent zur Zuordnung werden.
- **Koordinaten immer in Metern.** Erst beim Rendern wird mit `PX_PER_M = 30` in SVG-Einheiten
  umgerechnet. Das SVG nutzt eine `viewBox` in diesen Einheiten und skaliert responsiv auf die
  verfügbare Breite – auf dem Handy wird also kleiner gezeichnet, das Modell bleibt gleich.
- **`lib/` ist UI-frei** und vollständig mit Vitest testbar. Die Distanzfunktion ist eigenständig
  und wird in `assign` injiziert (später austauschbar gegen Kabelweg).
- **Kein Backend.** localStorage (automatisch, debounced) plus JSON-Export/-Import mit
  Schema-Version.

### Datenmodell (`src/model/types.ts`)

```ts
type Vec2 = { x: number; y: number };           // Meter, Ursprung oben links (hinten links)

interface Stagebox    { id; name; pos: Vec2; inputs: number; outputs: number; color: string }
interface Channel     { id; name; pickup: string; note?: string }   // pickup: z. B. "SM57", "DI"
interface InstrumentGroup {
  id; type: InstrumentType; name; pos: Vec2;
  channels: Channel[];
  pinnedBoxId?: string;                          // manuelle Zuweisung
  config?: DrumConfig;                           // nur Drums: Konfigurator-Zustand
}
interface OutputElement { id; kind: 'wedge' | 'iem' | 'sidefill'; name; pos: Vec2; pinnedBoxId?: string }
interface Project {
  version: 1; name; stage: { width: number; depth: number };   // Meter
  boxes: Stagebox[]; groups: InstrumentGroup[]; outputs: OutputElement[];
}
```

### Zuordnung (`src/lib/assign.ts`)

```ts
type DistanceFn = (a: Vec2, b: Vec2) => number;           // Default: euclidean (Luftlinie)
function assign(project: Project, distance: DistanceFn = euclidean): Assignment
```

`Assignment` enthält: Ports je Box (Port-Label, Quelle, Abnahme, Abstand), Output-Belegung je Box,
Box(en) je Gruppe, Auslastung je Box (`used/capacity` für In und Out), nicht gepatchte Kanäle und
eine Liste `warnings` (`level: 'error' | 'warning'`, konkreter Text, betroffene IDs).

Algorithmus Inputs:

1. **Gepinnte Gruppen zuerst** auf ihre Box. Reicht die Kapazität nicht, bleiben die übrigen
   Kanäle ungepatcht → rote Warnung („Box A: 3 Inputs fehlen für Drums – Box auf 24 Inputs
   erhöhen oder Pin lösen“). Ein Pin wird nie stillschweigend umgangen.
2. **Übrige Gruppen nach Kanalzahl absteigend** (Gleichstand: Erstellungsreihenfolge, stabil).
3. Für jede Gruppe Boxen nach Distanz sortieren (Gleichstand: Boxname) → erste Box mit genug
   freien Inputs bekommt die ganze Gruppe.
4. Passt sie nirgends komplett, aber in Summe: entlang der Distanzreihenfolge **aufteilen**,
   gelbe Warnung („Drums (9 Kanäle) auf A (5) und B (4) aufgeteilt“).
5. Reicht die Gesamtkapazität nicht: Rest ungepatcht, rote Warnung mit Anzahl fehlender Inputs.

Algorithmus Outputs: jedes Output-Element belegt genau einen Output. Gepinnte zuerst, dann
nächstgelegene Box mit freiem Output; keine frei → rote Warnung.

Port-Vergabe: pro Box fortlaufend (`A1, A2, …`, `A-Out 1, …`). Reihenfolge innerhalb einer Box nach
der üblichen Inputlisten-Ordnung (Drums, Perc, Bass, Gitarre, Keys, Vox, Sonstiges), dann
Erstellungsreihenfolge, dann Kanalreihenfolge in der Gruppe. So springen Portnummern nicht, wenn
man nur ein Element ein paar Zentimeter verschiebt.

Tests (`assign.test.ts`): nächste Box gewinnt, Gruppe bleibt zusammen, große Gruppen zuerst,
Aufteilen mit Warnung, Kapazitätsüberschreitung, Pins (inkl. Überlauf), Outputs, Portnummerierung,
austauschbare Distanzfunktion, Sonderfälle (keine Box, leere Gruppe, Gleichstand).

## 2. UI-Konzept (Mobile + Desktop)

Ein responsives Layout mit Umbruch bei ca. 900 px Breite:

| | Handy (Hochformat) | iPad quer / Desktop |
|---|---|---|
| Bühnenplan | oben, volle Breite | links, groß |
| Listen (Input/Output, Warnungen) | darunter, scrollbar | rechte Seitenleiste, eigener Scroll |
| Toolbar | unten fixiert (Daumenreichweite) | oben |
| Bearbeiten (Umbenennen, Kanäle, Pin, Löschen, Konfigurator) | Bottom-Sheet | Seitenpanel / Dialog |

- **Drag per Pointer Events** mit `setPointerCapture`; `touch-action: none` nur auf
  verschiebbaren Elementen, damit die Seite sonst normal scrollt. Unterscheidung Tap/Drag über
  eine Schwelle von ca. 6 px: Tap öffnet den Editor, Drag verschiebt.
- **Große Tap-Ziele:** jedes SVG-Element hat eine unsichtbare Trefferfläche ≥ 44 × 44 CSS-px
  (auf Basis der tatsächlichen Darstellungsgröße berechnet); Buttons ≥ 44 px.
- Positionen werden auf die Bühne begrenzt; optionales Raster-Snapping (0,25 m).
- Linien vom Instrument zur zugeordneten Box in Boxfarbe; Box zeigt `11/16 In · 3/8 Out`, rot
  bei Überschreitung.
- **Dark/Light** automatisch über `prefers-color-scheme` und CSS-Variablen; Boxfarben so gewählt,
  dass sie auf beiden Hintergründen lesbar sind.
- UI-Sprache Deutsch, Code und Bezeichner Englisch.

## 3. Ordnerstruktur

```
stageplotter/
├── README.md               Zweck, Features, Entwicklung, Deployment
├── CLAUDE.md               Arbeitsregeln für Claude (Architektur, Befehle, Konventionen)
├── docs/
│   ├── plan.md             dieser Plan
│   └── decisions.md        getroffene Annahmen und Entscheidungen (ADR-light)
├── public/                 Favicon, Icons, ggf. Manifest
├── src/
│   ├── main.tsx · App.tsx
│   ├── model/
│   │   ├── types.ts        Datenmodell
│   │   ├── defaults.ts     Standardprojekt, Konstanten (PX_PER_M, Boxfarben)
│   │   ├── templates.ts    Vorlagen: Keys, Gitarre, Bass, Vox …
│   │   └── drums.ts        DrumConfig → Kanäle, Vorlagen Minimal/Standard/Voll
│   ├── lib/
│   │   ├── geometry.ts     distance (euclidean), clamp, snap
│   │   ├── assign.ts       reine Zuordnungslogik      + assign.test.ts
│   │   ├── schema.ts       Validierung/Migration für Import + Tests
│   │   ├── storage.ts      localStorage laden/speichern
│   │   └── export/         json.ts, pdf.ts
│   ├── state/
│   │   ├── reducer.ts      reine Actions (add/move/rename/delete/pin/…) + reducer.test.ts
│   │   └── ProjectContext.tsx
│   ├── components/
│   │   ├── stage/          StagePlot, StageboxNode, GroupNode, OutputNode, Links, useDrag
│   │   ├── lists/          InputList, OutputList, Warnings
│   │   ├── toolbar/        Toolbar, AddMenu
│   │   └── editors/        Sheet, GroupEditor, StageboxEditor, OutputEditor,
│   │                       DrumConfigurator, ProjectSettings
│   └── styles/             theme.css (Farben, Dark/Light), layout.css
├── index.html · vite.config.ts · tsconfig*.json · eslint.config.js
└── .gitignore
```

## 4. Tech-Stack

- Vite + React 18 + TypeScript (strict), ESLint
- Vitest für `lib/`, `model/` und `state/`
- Keine State-Library: `useReducer` + Context reicht und hält den Reducer testbar
- PDF: **jsPDF + svg2pdf.js + jspdf-autotable**, per dynamischem Import nur bei Bedarf geladen
  (Begründung in `docs/decisions.md`)
- Deployment: Vercel, statischer Build (`npm run build` → `dist/`), kein Server nötig

## 5. Reihenfolge

Nach jedem Schritt: `npm run lint && npm test && npm run build`, dann Commit.

### Phase 1 – MVP
1. Projekt-Setup: Vite/React/TS, Vitest, ESLint, Ordnerstruktur, Theme-Grundlage (Dark/Light)
2. Datenmodell, Standardprojekt (2 Boxen à 16/8, Bühne 10 × 6 m), Reducer mit Tests
3. `geometry.ts` + `assign.ts` mit vollständigen Unit-Tests
4. Bühnenplan als SVG: Maßstab, Raster, Bühnenkante/Publikum, Drag per Pointer Events
5. Stageboxen: anzeigen, verschieben, hinzufügen, umbenennen, Kapazität einstellen, löschen,
   Kapazitätsanzeige
6. Instrumente aus einfachen Vorlagen hinzufügen, verschieben, umbenennen, löschen;
   Verbindungslinien in Boxfarbe
7. Bühnengröße einstellbar (Breite × Tiefe in Metern, Projekteinstellungen); Elemente außerhalb
   werden beim Verkleinern an den Bühnenrand geschoben
8. Inputliste je Box (Port, Quelle, Abnahme, Abstand) + Warnungen; localStorage; responsives
   Layout Handy/Desktop

→ **Stopp und Zusammenfassung.**

### Phase 2 – Konfigurator, Outputs, Pinning
9. Drum-Konfigurator: Kick (In/Out/beides), Snare (Top/Bottom), Hi-Hat, Toms 0–4,
   OH 0–2, Room 0–2, Percussion; Vorlagen Minimal/Standard/Voll; Live-Anzeige „X Kanäle“ und
   freie Kapazität je Box (Vorschau über `assign` mit dem Entwurf)
10. Gruppen-Editor: Kanäle umbenennen, Abnahme/Notiz ändern, hinzufügen/entfernen; Vorlagen für
   Keys (mono/stereo), Gitarre (1/2 Mikros), Bass (DI + Mikro), Lead/Backing Vox
11. Output-Elemente (Wedge, IEM, Sidefill): platzieren, Zuordnung, Output-Liste
12. Pinning für Gruppen und Outputs: Box fest zuweisen/lösen, Pin-Symbol im Plan, bleibt beim
    Verschieben erhalten

### Phase 3 – Export und Feinschliff
13. JSON-Export/-Import (Datei-Download bzw. Share-Sheet, Validierung, Fehlermeldung bei
    ungültiger Datei, Schema-Version)
14. PDF-Export: Seite 1 Bühnenplan (Vektor), danach Inputliste und Output-Liste als Tabellen,
    immer helles Farbschema
15. Feinschliff: Undo/Redo, Raster-Snapping, Zoom/Pan der Bühne auf kleinen Displays, leere
    Zustände, Bestätigung beim Löschen, neues Projekt/Zurücksetzen, Barrierefreiheit (Labels,
    Fokus), optional PWA für Offline-Nutzung in Venues ohne Netz
16. README finalisieren, Vercel-Deployment prüfen

## 6. Risiken

- **Drag auf iOS:** Safari-Gesten (Zurück-Wischen, Scroll) können mit Drag kollidieren →
  `touch-action` gezielt setzen, früh auf echtem Gerät testen.
- **Kleine Displays:** 10 m Bühne auf 375 px Breite = ca. 33 px pro Meter → Trefferflächen
  unabhängig von der Grafikgröße halten, Zoom in Phase 3.
- **Greedy-Zuordnung ist nicht optimal** (Bin-Packing). Für typische Bandgrößen ausreichend und
  vorhersehbar; dokumentiert in `decisions.md`.
