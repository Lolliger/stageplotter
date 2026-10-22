/** Position in Metern. Ursprung (0, 0) = hinten links (Upstage), y wächst Richtung Publikum. */
export interface Vec2 {
  x: number
  y: number
}

export type InstrumentType =
  | 'drums'
  | 'percussion'
  | 'bass'
  | 'guitar'
  | 'keys'
  | 'vocals'
  | 'other'

export interface Channel {
  id: string
  name: string
  /** Abnahme: Mikrofontyp oder "DI". Freitext. */
  pickup: string
  note?: string
  /** Fester Platz aus einem Konfigurator (z. B. "kick-in", "tom-2"). Manuelle Kanäle haben keinen. */
  slot?: string
}

export interface Stagebox {
  id: string
  name: string
  pos: Vec2
  inputs: number
  outputs: number
  color: string
}

export interface InstrumentGroup {
  id: string
  type: InstrumentType
  name: string
  pos: Vec2
  channels: Channel[]
  /** Manuell fest zugewiesene Stagebox. */
  pinnedBoxId?: string
  /** Nur Drums: Zustand des Konfigurators. */
  drumConfig?: DrumConfig
  /** Darstellung im Plan: 'amp' = Verstärker (Kasten statt Kreis). Typ bleibt für die Reihenfolge. */
  form?: GroupForm
  /** Drehung in Grad im Uhrzeigersinn (nur für Formen mit Richtung, z. B. Amps). */
  rotation?: number
}

export type GroupForm = 'amp'

export type KickMode = 'in' | 'out' | 'both'

export interface DrumConfig {
  kick: KickMode
  snareTop: boolean
  snareBottom: boolean
  hihat: boolean
  /** 0–4 */
  toms: number
  /** 0–2 */
  overheads: number
  /** 0–2 */
  rooms: number
  percussion: boolean
}

export type OutputKind = 'wedge' | 'iem' | 'sidefill' | 'pa' | 'sub'

export interface OutputElement {
  id: string
  kind: OutputKind
  name: string
  pos: Vec2
  pinnedBoxId?: string
  /** Drehung in Grad im Uhrzeigersinn; 0 = Grundausrichtung der Form (siehe model/shapes.ts). */
  rotation?: number
  /** Gespeist von einem Geräte-Ausgang (Weiche/Endstufe) statt direkt von der Stagebox. */
  source?: SignalSource
}

/** Verweis auf einen Ausgang eines Geräts (Frequenzweiche oder Endstufe). */
export interface SignalSource {
  deviceId: string
  /** Index des Ausgangs, ab 0. */
  output: number
}

export type DeviceKind = 'crossover' | 'amp'

export type ConnectorType = 'xlr' | 'aes' | 'dante' | 'jack' | 'speakon-nl4' | 'speakon-nl8' | 'binding'

/** Flankensteilheit in dB/Oktave. */
export type FilterSlope = 12 | 18 | 24 | 48

/** Filtercharakteristik: Linkwitz-Riley, Butterworth, Bessel. */
export type FilterType = 'lr' | 'bw' | 'bessel'

export interface DeviceInput {
  name: string
  connector: ConnectorType
  /** Nur Endstufe: gespeist von einem Weichen-Ausgang. Fehlt = von der Stagebox. */
  source?: SignalSource
}

export interface DeviceOutput {
  name: string
  connector: ConnectorType
  /** Nur Weiche: Hochpass in Hz (fehlt = aus). */
  hp?: number
  /** Nur Weiche: Tiefpass in Hz (fehlt = aus). */
  lp?: number
  slope?: FilterSlope
  filter?: FilterType
  /** Nur Weiche: welche Eingänge (Index) auf diesen Ausgang gemischt werden. */
  from?: number[]
}

export interface Device {
  id: string
  kind: DeviceKind
  name: string
  pos: Vec2
  pinnedBoxId?: string
  inputs: DeviceInput[]
  /** Endstufe: ein Ausgang je Kanal, gleiche Anzahl wie Eingänge. */
  outputs: DeviceOutput[]
  /** Nur Endstufe: Leistung pro Kanal. */
  power?: { watts: number; ohms: number }
}

/** Ton- oder Lichtplot (Ansicht, nicht im Projekt gespeichert). */
export type PlotMode = 'sound' | 'lighting'

// ---------- Licht ----------

/** Lampentyp aus der Bibliothek (model/lights.ts). */
export type FixtureKind =
  | 'par'
  | 'spot'
  | 'wash'
  | 'beam'
  | 'profile'
  | 'fresnel'
  | 'blinder'
  | 'strobe'
  | 'bar'
  | 'follow'
  | 'fog'
  | 'custom'

export interface Fixture {
  id: string
  kind: FixtureKind
  /** Lampennummer wie am Pult (#1, #2 …). */
  number: number
  name: string
  /** Position in Metern; darf außerhalb der Bühne liegen (FOH, Türme). */
  pos: Vec2
  /** Leuchtrichtung in Grad im Uhrzeigersinn; 0 = zum Publikum. */
  rotation?: number
  /** Belegte DMX-Kanäle im gewählten Modus. */
  channels: number
  /** Name des Modus, z. B. „8 Kanal“. */
  mode?: string
  /** Gerätebezeichnung, z. B. „Cameo Zenit W600“. */
  model?: string
  /** DMX-Universe ab 1. */
  universe: number
  /** Startadresse 1–512; fehlt = noch nicht adressiert. */
  address?: number
  /** Farbe/Filter als Text, z. B. „L201“ oder „Warmweiß“. */
  color?: string
  note?: string
  /** Hängt an dieser Traverse und wandert mit ihr. */
  trussId?: string
}

/** Traverse oder Lichtstange, als gerades Stück. */
export interface Truss {
  id: string
  name: string
  /** Mitte in Metern. */
  pos: Vec2
  /** Länge in Metern. */
  length: number
  /** Drehung in Grad im Uhrzeigersinn; 0 = quer (parallel zur Bühnenkante). */
  rotation?: number
}

/** Was vom jeweils anderen Gewerk im Plan (und im PDF) zu sehen ist. */
export interface ViewSettings {
  /** Lichtmodus: sichtbare Ton-Elemente (klein und grau). */
  sound: {
    instruments: boolean
    /** PA und Subs */
    pa: boolean
    /** Wedges, IEMs, Sidefills */
    monitors: boolean
    /** Stageboxen, Weichen, Endstufen */
    boxes: boolean
    cables: boolean
  }
  /** Tonmodus: Lampen und Traversen sichtbar. */
  lights: boolean
}

export interface StageSize {
  /** Breite in Metern (x). */
  width: number
  /** Tiefe in Metern (y). */
  depth: number
}

export type CableView = 'bundled' | 'direct'

export interface Project {
  version: 1
  name: string
  stage: StageSize
  /** Darstellung der Kabel im Plan; Standard gebündelt. */
  cableView?: CableView
  /** Beim Verschieben auf 25 cm einrasten. */
  snap?: boolean
  boxes: Stagebox[]
  /** Reihenfolge im Array = Erstellungsreihenfolge. */
  groups: InstrumentGroup[]
  outputs: OutputElement[]
  /** Frequenzweichen und Endstufen der PA. */
  devices: Device[]
  /** Lampen des Lichtplots. */
  fixtures: Fixture[]
  trusses: Truss[]
  /** Sichtbarkeit des Gegenparts je Modus; fehlt = Standard (DEFAULT_VIEW). */
  view?: ViewSettings
}

export type ElementKind = 'box' | 'group' | 'output' | 'device' | 'fixture' | 'truss'

export interface ElementRef {
  kind: ElementKind
  id: string
}
