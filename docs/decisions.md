# Entscheidungen und Annahmen

Kurze Einträge, neueste unten. Format: Kontext → Entscheidung → Begründung.

## D1 – Zuordnung wird abgeleitet, nicht gespeichert
Gespeichert werden nur Nutzereingaben (Positionen, Kanäle, Boxen, Pins). Ports, Box-Zuordnung,
Abstände und Warnungen berechnet `assign(project)` bei jeder Änderung neu. Damit gibt es keinen
Zustand, der veralten oder widersprüchlich werden kann; bei typischen Projektgrößen (< 100
Kanäle) ist die Neuberechnung vernachlässigbar.

## D2 – Koordinaten in Metern, Ursprung hinten links
Alle Positionen im Modell sind Meter. `PX_PER_M = 30` bestimmt die SVG-Einheiten der `viewBox`;
auf dem Bildschirm skaliert das SVG responsiv. Ursprung (0, 0) ist hinten links (Upstage, aus
Sicht des Publikums links), die Bühnenkante zum Publikum liegt unten im Plan – übliche
Stageplot-Konvention.

## D3 – Standardwerte
Bühne 10 × 6 m. Zwei Stageboxen A und B mit je 16 Inputs / 8 Outputs, hinten links und hinten
rechts platziert. Neue Elemente erscheinen in Bühnenmitte.

## D4 – Gepinnte Gruppen werden zuerst zugeordnet und nie umgeleitet
Pins reservieren ihre Kapazität vor allen automatischen Zuordnungen. Reicht die gepinnte Box
nicht, bleiben überzählige Kanäle ungepatcht und es gibt eine rote Warnung – der Nutzer hat die
Box bewusst gewählt, daher wird nicht stillschweigend auf eine andere Box ausgewichen.

## D5 – Gleichstände deterministisch auflösen
Gleiche Kanalzahl → Erstellungsreihenfolge. Gleiche Distanz → alphabetisch nach Boxname. Damit
liefert `assign` bei gleicher Eingabe immer das gleiche Ergebnis (wichtig für Tests und damit
nichts „flackert“).

## D6 – Port-Reihenfolge innerhalb einer Box nach Instrumententyp
Ports werden pro Box in der üblichen Inputlisten-Reihenfolge vergeben (Drums, Perc, Bass,
Gitarre, Keys, Vox, Sonstiges), nicht in Zuordnungsreihenfolge. Portnummern bleiben so stabil,
solange sich die Box-Zuordnung nicht ändert, und die Liste liest sich wie eine klassische
Inputliste.

## D7 – Greedy statt optimaler Verteilung
Der Algorithmus ist greedy (größte Gruppe zuerst, nächste passende Box). Das ist kein optimales
Bin-Packing, aber vorhersehbar und für Bandgrößen ausreichend. Kann später ersetzt werden, die
Schnittstelle `assign(project, distance)` bleibt.

## D8 – Outputs analog zu Inputs, aber einzeln
Jedes Output-Element belegt genau einen Output (kein Stereo-IEM als zwei Outputs in v1).
Zuordnung zur nächstgelegenen Box mit freiem Output, Pins wie bei Gruppen. Stereo-IEM kann
später als Option ergänzt werden.

## D9 – PDF per jsPDF statt Print-CSS
jsPDF + svg2pdf.js (Bühnenplan als Vektor) + jspdf-autotable (Listen). Grund: Auf iPhone/iPad
ist der Druckdialog umständlich und das Layout von Print-CSS schwer kontrollierbar; jsPDF erzeugt
direkt eine Datei zum Teilen/Speichern mit festem Layout und immer hellem Farbschema. Die
Bibliotheken werden per dynamischem `import()` erst beim Export geladen, damit der Start schnell
bleibt.

## D10 – State ohne zusätzliche Bibliothek
`useReducer` + Context. Der Reducer ist eine reine Funktion und direkt testbar; Undo/Redo lässt
sich später als Wrapper um den Reducer ergänzen.

## D11 – Responsives Layout mit einem Umbruchpunkt
Unter ca. 900 px: Bühne oben, Listen darunter, Toolbar unten fixiert, Bearbeiten im
Bottom-Sheet. Darüber: Bühne links, Listen in rechter Seitenleiste, Toolbar oben. Kein separates
Mobile-/Desktop-Frontend.

## D12 – Sprache
UI-Texte auf Deutsch, Code, Bezeichner und Commit-Messages auf Englisch.
