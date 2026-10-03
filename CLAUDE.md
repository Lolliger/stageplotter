# CLAUDE.md

Stageplot-Editor (Vite + React + TypeScript), mobile-first, kein Backend. Details in
`docs/plan.md`, Entscheidungen in `docs/decisions.md`.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm test` – Vitest
- `npm run lint` – ESLint
- `npm run build` – Typecheck + Produktionsbuild
- `npm run preview` – Produktionsbuild lokal (Service Worker ist nur hier aktiv)

Vor jedem Commit: `npm run lint && npm test && npm run build` muss grün sein.

## Architekturregeln

- Das `Project` ist der einzige Zustand. Zuordnung, Ports, Abstände und Warnungen werden aus
  `assign(project)` abgeleitet und **nie** gespeichert.
- `src/lib/` und `src/model/` importieren kein React und keine UI. Neue Logik dort hinein und mit
  Vitest testen.
- `src/lib/assign.ts` bleibt eine reine Funktion. Die Distanzfunktion wird injiziert
  (`DistanceFn`), nicht fest verdrahtet.
- Koordinaten im Modell immer in Metern. Umrechnung nur beim Rendern über `PX_PER_M`.
- Reducer-Actions sind rein; Persistenz (localStorage) passiert außerhalb des Reducers.
- Touch: Pointer Events, `touch-action: none` nur auf verschiebbaren Elementen, Tap-Ziele
  ≥ 44 px.
- Farben nur über CSS-Variablen aus `src/styles/theme.css` (Dark/Light). Ausnahme: das Druck-SVG
  in `src/lib/export/plotSvg.ts` nutzt feste helle Farben (svg2pdf kennt keine CSS-Variablen).
- Bildschirm-Plan (`components/stage`) und Druck-SVG (`lib/export/plotSvg.ts`) zeichnen dieselben
  Elemente – Änderungen an der Darstellung in beiden nachziehen.
- Neue Projektfelder immer auch in `src/lib/schema.ts` (Import/localStorage) ergänzen.
- PDF-Bibliotheken nur per dynamischem `import()` laden, nie statisch im Hauptbundle.
- Projektänderungen laufen über `dispatch` und damit durch die Undo-History; Drag-Bewegungen
  tragen einen `coalesce`-Schlüssel.

## Konventionen

- UI-Texte Deutsch, Code und Commit-Messages Englisch.
- TypeScript strict, keine `any`.
- Kleine, fokussierte Commits nach jedem abgeschlossenen Schritt aus `docs/plan.md`.
- Bei Unklarheiten: sinnvolle Annahme treffen und als neuen Eintrag in `docs/decisions.md`
  festhalten, nicht nachfragen.
