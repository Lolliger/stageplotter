# stageplot

Mobilfreundlicher Stageplot-Editor für Veranstaltungstechnik. Instrumente auf einem Bühnenplan
platzieren – das Tool ordnet jedes Instrument automatisch der nächstgelegenen Stagebox zu und
erzeugt daraus Inputliste und Patchplan.

> Status: Phase 1 (MVP) fertig – Bühne, Stageboxen, Instrumente, Auto-Zuordnung, Inputliste.
> Nächste Schritte siehe [docs/plan.md](docs/plan.md).

## Features (geplant)

- Bühnenplan in Draufsicht, Elemente per Touch oder Maus verschiebbar
- Stageboxen mit einstellbarer Input-/Output-Kapazität
- Automatische Zuordnung zur nächstgelegenen Box, Gruppen bleiben zusammen, Pins zum Festlegen
- Drum-Konfigurator und Vorlagen für Keys, Gitarre, Bass, Vox
- Inputliste und Output-Liste je Stagebox, Warnungen bei Kapazitätsüberschreitung
- PDF-Export, JSON-Export/-Import, automatische Speicherung im Browser
- Für Handy, iPad und Desktop, Dark/Light Mode automatisch

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
