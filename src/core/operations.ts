/**
 * The edit model.
 *
 * An edit is NOT baked into pixels — it is a small, ordered, serializable list of
 * operations that is *replayed* on the immutable original to derive every preview
 * and export. This is the spine of the app: non-destructive editing, reset,
 * view-original, undo/redo and the JSON export all fall out of this one model.
 *
 * The three tone controls are grouped into a single `adjust` operation on purpose:
 * they are applied simultaneously (as one filter pass), so modelling them as three
 * separate, individually-ordered ops would imply an ordering that does not exist.
 * Order therefore only matters *between stages* — and that order is fixed and
 * deliberate (see OPERATION_ORDER).
 */

/** Crop rectangle, expressed in ORIGINAL source pixels (resolution-independent, so it replays on the full-res original). */
export interface CropOp {
  type: 'crop'
  x: number
  y: number
  width: number
  height: number
}

/** Tone adjustments. Each value is a percentage in [-100, 100]; 0 means "no change". */
export interface AdjustOp {
  type: 'adjust'
  brightness: number
  contrast: number
  saturation: number
}

export type FilterName = 'greyscale' | 'sepia'

/** A creative colour filter applied after tone adjustments. */
export interface FilterOp {
  type: 'filter'
  name: FilterName
}

export type Operation = CropOp | AdjustOp | FilterOp
export type OperationType = Operation['type']

/**
 * Canonical pipeline order: geometry → tone → creative filter.
 * Chosen deliberately: cropping first keeps tone/filter math on the pixels that
 * survive; a filter such as greyscale is applied *after* tone so it lands on the
 * colour-corrected image (greyscale before saturation would discard the boost).
 */
export const OPERATION_ORDER: readonly OperationType[] = ['crop', 'adjust', 'filter']

export const NEUTRAL_ADJUST: Omit<AdjustOp, 'type'> = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
}

export function makeAdjust(partial: Partial<Omit<AdjustOp, 'type'>> = {}): AdjustOp {
  return { type: 'adjust', ...NEUTRAL_ADJUST, ...partial }
}

export function isNeutralAdjust(a: Omit<AdjustOp, 'type'>): boolean {
  return a.brightness === 0 && a.contrast === 0 && a.saturation === 0
}

/** Return a copy of `ops` sorted into the canonical pipeline order (stable within a type). */
export function sortOperations(ops: readonly Operation[]): Operation[] {
  return [...ops].sort(
    (a, b) => OPERATION_ORDER.indexOf(a.type) - OPERATION_ORDER.indexOf(b.type),
  )
}

/** Exhaustiveness guard for switch statements over Operation['type']. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled operation: ${JSON.stringify(value)}`)
}
