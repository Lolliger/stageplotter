# stageplot

Mobilfreundlicher Stageplot-Editor für Veranstaltungstechnik. Instrumente auf einem Bühnenplan
platzieren – das Tool ordnet jedes Instrument automatisch der nächstgelegenen Stagebox zu und
erzeugt daraus Inputliste und Patchplan.

> Status: Phase 2 fertig. Als Nächstes: PDF- und JSON-Export, Feinschliff (siehe
> [docs/plan.md](docs/plan.md)).

## Features

- Bühnenplan in Draufsicht mit einstellbarer Bühnengröße, Elemente per Touch oder Maus verschiebbar
- Stageboxen mit einstellbarer Input-/Output-Kapazität
- Automatische Zuordnung zur nächstgelegenen Box, Gruppen bleiben zusammen, Pins zum Festlegen
- Drum-Konfigurator mit Live-Anzeige der Kanäle und freien Inputs; Vorlagen für Keys, Gitarre,
  Bass, Vox, Percussion; Kanäle frei bearbeitbar
- Wedges, IEMs und Sidefills mit Output-Liste
- Gebündelte, rechtwinklige Kabelwege je Stagebox (alternativ Luftlinie)
- Inputliste und Output-Liste je Stagebox, Warnungen bei Kapazitätsüberschreitung
- Automatische Speicherung im Browser
- Für Handy, iPad und Desktop, Dark/Light Mode automatisch
- Geplant: PDF-Export, JSON-Export/-Import

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Unit-Tests (Vitest)
npm run lint
npm run build    # statischer Build nach dist/
```

## Deployment

Statische Seite, deploybar auf Vercel (Framework-Preset „Vite“, Output `dist/`). Kein Backend.

## Dokumentation

- [docs/plan.md](docs/plan.md) – Architektur, Ordnerstruktur, Reihenfolge
- [docs/decisions.md](docs/decisions.md) – getroffene Entscheidungen und Annahmen
