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

## D19 – Dateien ausgeben: Teilen-Menü auf Touch-Geräten, sonst Download
Exporte (JSON, PDF) gehen auf Touch-Geräten über `navigator.share` mit Datei – auf iPhone/iPad
erscheint das Teilen-Menü („In Dateien sichern“, AirDrop, Mail). Auf Geräten mit Maus oder wenn
Teilen nicht verfügbar ist, wird normal heruntergeladen. Exportierte JSON-Dateien tragen
`"app": "stageplot"` und ein Exportdatum; der Import prüft beides nicht streng, lehnt aber
Dateien mit fremder `app`-Kennung ab und fragt vor dem Ersetzen des aktuellen Projekts nach.

## D20 – Eigenes Druck-SVG für das PDF
Der Bühnenplan im PDF wird nicht aus dem Bildschirm-SVG kopiert, sondern von
`lib/export/plotSvg.ts` als eigenständiger SVG-Text erzeugt: feste helle Farben statt
CSS-Variablen (svg2pdf löst diese nicht auf), Text manuell vertikal zentriert (svg2pdf kennt kein
`dominant-baseline`), enger Ausschnitt aus Bühne plus überstehenden Elementen und Knotengröße
passend zum Papier (Radius ca. 4,5 mm). Seite 1 ist A4 quer (Plan + Legende), die Listen folgen
auf A4 hoch; gepinnte Elemente sind mit „(fest)“ markiert, weil die Standardschrift keine Emojis
kann. Der PDF-Code (jsPDF, svg2pdf, autotable) ist ein eigener, nachgeladener Chunk.

## D21 – Zoom/Pan: Seite scrollt, solange nicht gezoomt ist
Der Plan lässt sich über Buttons (+ / − / ganze Bühne), Mausrad bzw. Trackpad-Pinch und
Zwei-Finger-Pinch zoomen (1- bis 5-fach). Ungezoomt hat der Plan `touch-action: pan-y`, damit
man auf dem Handy über den Plan hinweg zur Liste scrollen kann; erst gezoomt gehören alle Gesten
dem Plan (ein Finger auf freier Fläche verschiebt). Auf schmalen Layouts zoomt das Mausrad nur mit
Strg/Cmd. Knoten behalten beim Zoomen ihre Bildschirmgröße – Zoomen schafft Platz zwischen ihnen.
Der Ausschnitt ist reine Ansicht und wird nicht gespeichert.

## D22 – Offline-Fähigkeit mit eigenem, kleinem Service Worker
Statt einer PWA-Bibliothek gibt es `public/sw.js` (ca. 50 Zeilen). Ein kleines Vite-Plugin
schreibt beim Build `precache-manifest.json` mit allen erzeugten Dateien, auch den nachgeladenen
(PDF-Export) – der Worker legt beim Installieren alles in den Cache, die App inklusive PDF-Export
funktioniert danach ohne Netz. Seitenaufrufe gehen zuerst ans Netz (aktuelle Version), offline
wird die gecachte App geliefert. Die Build-Kennung steckt in der Registrierungs-URL
(`/sw.js?build=…`), damit jeder Deploy einen neuen Worker installiert und alte Caches löscht.
Registriert wird nur im Produktionsbuild. Mit Manifest und Icons lässt sich die App auf iPhone/iPad
„Zum Home-Bildschirm“ hinzufügen. `vercel.json` setzt `no-cache` für Worker und Manifest-Liste
und lange Cache-Zeiten für die gehashten Dateien unter `/assets`.

## D23 – Relative Pfade, Einbindung per Vercel-Rewrite
Der Build nutzt `base: './'`; Service Worker, Precache-Liste und Web-Manifest arbeiten mit Pfaden
relativ zum Worker. Dieselbe Version läuft dadurch unter eigener Domain und unter einem Unterpfad
einer anderen Seite. Vorgesehene Einbindung in die (ebenfalls auf Vercel laufende) AK-Seite: ein
Rewrite `/stageplot/:path*` → stageplot-Deployment plus Redirect `/stageplot` → `/stageplot/`
(ohne Schrägstrich am Ende würden relative Pfade ins Leere zeigen). Beide Projekte werden
getrennt deployt; die AK-Seite bekommt Updates automatisch. Gespeicherte Projekte hängen am
Origin: unter der AK-Domain sind es andere Daten als unter `*.vercel.app` (Umzug per JSON-Export).

## D24 – Einbindung als Reiter in die AK-App (Repo Lolliger/aktapp)
Statt eines Links auf eine fremde Seite gibt es in der AK-App einen Reiter `/stageplot`, der den
Editor per iframe unter der AK-Navigation zeigt. Das iframe lädt `/stageplot-app/index.html`
(Rewrite auf dieses Projekt) – direkt die Datei, weil Next.js `/stageplot-app/` auf den Pfad
ohne Schrägstrich umleitet und relative Pfade dann brechen würden. Aus demselben Grund cacht der
Service Worker `index.html` statt der Ordner-URL (umgeleitete Antworten taugen nicht als
Offline-Seite). Die AK-App setzt für diesen Pfad eine eigene CSP (`script-src 'self'`, kein
Nonce) und erlaubt Einbetten nur von der eigenen Domain. Konfiguriert wird dort über die
Umgebungsvariable `STAGEPLOT_ORIGIN`.

## D25 – Farben der AK-Technik-App
Die Farbvariablen in `src/styles/theme.css` übernehmen die Palette der AK-App
(`app/globals.css` in Lolliger/aktapp): Petrol als Akzent (hell `#0e7c86`, dunkel `#33d9c8`),
deren Grau- und Flächentöne sowie die Status-Farben für Fehler, Warnung und OK. Das PDF nutzt
dieselben Töne. Die Boxfarben bleiben bunt, weil sie Boxen unterscheiden und nicht zur
Oberfläche gehören. Schriften sind unverändert (Systemschrift), damit nichts extern geladen wird.

## D26 – Verstärker und PA
„Verstärker“ sind die Amps auf der Bühne (Gitarre, Bass, Keyboard): Instrumentengruppen mit
`form: 'amp'`, eigene Rubrik „Backline (Instrumenten-Amps)“ im Menü und Kasten-Symbol („AMP“) statt Kreis. Ihr
Typ (Gitarre/Bass/Keys) bleibt, damit ihre Kanäle in der Inputliste an der üblichen Stelle stehen.
PA-Endstufen siehe D28. „PA“ sind Output-Elemente: „PA (L + R)“ legt ein
Paar links und rechts neben der Bühnenkante an, „Sub“ einen Subwoofer vor der Bühne; jedes belegt
einen Output. PA und Subs dürfen wie Stageboxen bis 1 m neben/vor der Bühne stehen, die übrigen
Outputs bleiben auf der Bühne. Formen und Maße stehen gemeinsam in `src/model/shapes.ts` für
Bildschirm und PDF. Die Publikumszeile steht unter allem, was vor der Bühne steht; die
Zoom-Buttons liegen auf dem Handy unter dem Plan, damit sie nichts am Bühnenrand verdecken.

## D27 – Drehen von Elementen mit Richtung
Wedges, Sidefills, PA, Subs und Backline-Amps haben eine Drehung in ganzen Grad (im
Uhrzeigersinn, 0–359). Jede Form kennt ihre Abstrahlrichtung bei 0° (`front` in
`model/shapes.ts`: Wedge/Sidefill nach hinten zum Musiker, PA/Sub/Amp zum Publikum); ein kleiner
Pfeil vor der Front zeigt die aktuelle Richtung, die Beschriftung bleibt waagerecht. Gedreht wird
im Editor über Richtungsknöpfe („strahlt zum Publikum/nach links/…“) und Feinschritte ±15°/±45°
statt über eine Geste im Plan – auf dem Handy treffsicherer und ohne Konflikt mit Drag und Pinch.
Neue Sidefills zeigen automatisch zur Bühnenmitte. IEMs haben keine Richtung.

## D28 – Frequenzweiche, Endstufe und PA-Signalweg
Auf Rückmeldung hin sind mit „Verstärker“ PA-Endstufen gemeint. Die Backline-Amps aus D26 bleiben
(Rubrik „Backline (Instrumenten-Amps)“); dazu kommen Geräte (`project.devices`) vom Typ
Frequenzweiche und Endstufe in der Output-Rubrik „PA-Technik“.
- **Erlaubte Kette:** Stagebox → Weiche → Endstufe → Lautsprecher. Ein Lautsprecher (jede
  Output-Art) hängt an einem Endstufen-Kanal oder einem Weichen-Ausgang (aktive Box), ein
  Endstufen-Kanal an einem Weichen-Ausgang, sonst an der Stagebox. Weichen-Eingänge kommen immer
  von der Stagebox. So entstehen keine Schleifen; ungültige Quellen werden beim Laden und nach
  Löschen entfernt (`cleanSources`).
- **Output-Belegung:** Nur was an der Stagebox hängt, belegt einen Box-Output. Endstufen-Kanäle,
  an denen nichts hängt, belegen keinen („frei“). Elemente bekommen ihre Ports vor den
  Geräte-Eingängen, damit Wedges ihre gewohnten Ports behalten.
- **Weiche:** 1–4 Eingänge, 1–8 Ausgänge, Anschluss je Ein-/Ausgang (XLR, AES, Dante).
  Jeder Ausgang summiert gewählte Eingänge (z. B. Sub = L + R) und hat optional Hochpass und
  Tiefpass (20 Hz–20 kHz), Flankensteilheit 12/18/24/48 dB/Okt und Charakteristik
  Linkwitz-Riley/Butterworth/Bessel; Steilheit und Charakteristik gelten für beide Filter eines
  Ausgangs. Vorlagen: Stereo + Mono-Sub (Standard, 100 Hz), Stereo 2-Wege, Stereo 3-Wege, Mono
  2-Wege. Hinweise bei HP ≥ LP oder Ausgängen ohne Eingang.
- **Endstufe:** 1–8 Kanäle, eine Leistungsangabe für alle (W @ Ω), Eingangs- und
  Ausgangsanschluss (XLR/Klinke/AES/Dante bzw. Speakon NL4/NL8/Klemmen). Vorlagen 2/4/8 Kanäle.
- **Plan:** Geräte erscheinen als Rack-Symbol neben der Bühne (rechts, dann links), sind frei
  verschiebbar und nicht drehbar. Kabel vom Gerät zu seinen Abnehmern sind gestrichelt und in der
  Farbe der speisenden Box.
- **Listen:** Die Outputliste zeigt Weichen-/Endstufen-Eingänge als Ziele der Box; der
  „PA-Signalweg“ (Seitenleiste und PDF) zeigt je Gerät Eingänge, Filter bzw. Leistung und
  Abnehmer. Im PDF werden „←/→/Ω“ als „<-/->/Ohm“ geschrieben, weil die Standardschrift sie nicht
  kennt.

## D29 – JSON-Export mit Patch und Export im iframe
Die Projektdatei enthält neben dem Projekt (alles, was zum Wiederherstellen nötig ist: Positionen,
Kanäle mit Mikro und Notiz, Pins, Drehung, Geräte, Signalquellen) einen Abschnitt `patch` mit den
abgeleiteten Daten zum Nachlesen: Inputs je Port mit Mikro, Notiz und Abstand, Outputs je Port,
PA-Signalweg und Hinweise. Er wird beim Import ignoriert und neu berechnet – so bleibt `Project`
der einzige Zustand, und eine von Hand geänderte Port-Zeile kann nichts verfälschen. Da die
Zuordnung deterministisch ist, ergibt der Import dieselben Ports.
Im Reiter der AK-Seite läuft der Editor im iframe; Safari ignoriert dort Downloads. Darum: der
Download-Link öffnet im iframe notfalls einen neuen Tab statt den Editor wegzunavigieren, und das
Projekt-Menü bietet „JSON in Zwischenablage kopieren“ sowie (nur eingebettet) „Im eigenen Tab
öffnen“. Der eigene Tab läuft auf derselben Domain und sieht deshalb dasselbe gespeicherte Projekt.
