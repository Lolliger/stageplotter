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
}

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

export type OutputKind = 'wedge' | 'iem' | 'sidefill'

export interface OutputElement {
  id: string
  kind: OutputKind
  name: string
  pos: Vec2
  pinnedBoxId?: string
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
  boxes: Stagebox[]
  /** Reihenfolge im Array = Erstellungsreihenfolge. */
  groups: InstrumentGroup[]
  outputs: OutputElement[]
}

export type ElementKind = 'box' | 'group' | 'output'

export interface ElementRef {
  kind: ElementKind
  id: string
}
