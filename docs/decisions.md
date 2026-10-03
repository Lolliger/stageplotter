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

## D13 – Bühnengröße in Phase 1, Verkleinern schiebt Elemente an den Rand
Breite und Tiefe sind in den Projekteinstellungen frei einstellbar (0,5-m-Schritte, 2–40 m).
Wird die Bühne verkleinert, werden Elemente, die außerhalb liegen, an den Bühnenrand geschoben
statt gelöscht. Stageboxen dürfen bis 1 m außerhalb der Bühne stehen (z. B. Box im Seitenbereich).

## D14 – Speichern in localStorage, Import-Validierung von Anfang an
Das Projekt wird 300 ms nach jeder Änderung gespeichert und zusätzlich sofort bei `pagehide`
bzw. wenn der Tab in den Hintergrund geht (iOS beendet Tabs ohne Vorwarnung). Gelesen wird über
dieselbe Validierung (`parseProject`), die später auch der JSON-Import nutzt: fehlende optionale
Felder werden ergänzt, Pins auf nicht vorhandene Boxen verworfen, unlesbare Daten führen zum
Standardprojekt statt zu einem Absturz.

## D15 – Zeichenreihenfolge im Plan
Instrumente unten, Stageboxen darüber (die Kapazitätsanzeige muss lesbar bleiben), das gerade
ausgewählte Element ganz oben. Knoten, Schrift und Trefferflächen haben auf dem Bildschirm eine
feste Größe (über SVG-Einheiten pro CSS-Pixel), unabhängig von Bühnengröße und Display.

## D16 – Kabelwege: rechtwinklige Bündel ohne Umweg
Kabel werden im Plan pro Stagebox als rechtwinkliger Baum gezeichnet (Rectilinear Steiner
Arborescence, Heuristik nach Rao et al.). Jedes Kabel bleibt dabei ein kürzester rechtwinkliger
Weg zur Box (Länge = Manhattan-Distanz); Kabel werden genau dort zu einer Strippe
zusammengelegt, wo sich ihre kürzesten Wege ohne Umweg überlappen können – das ist das
Kriterium für „wo es Sinn macht“. Die Strichstärke wächst mit der Kabelanzahl, am Abgang zur Box
steht die Anzahl. Die letzte Strecke zur Box läuft an der Wand entlang, an der die Box steht
(Box hinten/vorne → waagerecht, Box seitlich → senkrecht). Hindernisse werden nicht umgangen.
Outputs (Wedges usw.) laufen im selben Bündel. Die Zuordnung nutzt weiterhin die Luftlinie
(Vorgabe); `manhattan` steht als austauschbare `DistanceFn` bereit. Direkte Linien bleiben als
Ansicht wählbar.

## D17 – Drum-Kanäle haben feste Slots
Kanäle aus dem Konfigurator tragen einen Slot (`kick-in`, `tom-2`, …). Beim erneuten
Konfigurieren werden vorhandene Kanäle über den Slot wiederverwendet, eigene Namen, Mikros und
Notizen bleiben also erhalten; manuell hinzugefügte Kanäle (ohne Slot) bleiben am Ende stehen.
Ein von Hand gelöschter Slot-Kanal kommt beim nächsten Konfigurieren zurück, solange er in der
Konfiguration aktiv ist – der Konfigurator ist die Quelle für die Drum-Grundbelegung.

## D18 – Platzierung neuer Elemente
Neue Elemente landen auf dem nächsten freien Punkt eines 1,5-m-Rasters um einen bevorzugten Ort
(mind. 1,2 m Abstand zu allem anderen): Instrumente um die Bühnenmitte, Wedges in einer Reihe vor
der Bühnenkante, Sidefills abwechselnd links/rechts vorne, IEMs mittig. Neue Stageboxen suchen
einen Platz mit mind. 2 m Abstand zu anderen Boxen.
