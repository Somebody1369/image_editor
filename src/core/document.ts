/**
 * The serialized edit document (the JSON bonus).
 *
 * Shape rationale: a thin, self-describing recipe. `source` identifies the original
 * (name + dimensions) so the operations — which are in source pixels — replay
 * unambiguously. `operations` is the ordered pipeline. `embeddedSource` is optional:
 * omitted for a thin file that sits *alongside* the image (per the brief), or set to
 * a data URL so the document self-replays in one click for a demo.
 *
 * Because the app renders preview AND export from this same op list, replaying the
 * document on the original reproduces the result — the same pattern as a saved
 * web2print design that a backend can re-render for production output.
 */
import type { FilterName, Operation } from './operations'
import { sortOperations } from './operations'

export const DOCUMENT_VERSION = 1 as const

export interface SourceMeta {
  name: string
  width: number
  height: number
  type: string
}

export interface EditDocument {
  version: typeof DOCUMENT_VERSION
  source: SourceMeta
  operations: Operation[]
  /** Optional data URL of the original, so the document can self-replay. */
  embeddedSource?: string
}

export function createDocument(
  source: SourceMeta,
  operations: readonly Operation[],
  embeddedSource?: string,
): EditDocument {
  const doc: EditDocument = {
    version: DOCUMENT_VERSION,
    source,
    operations: sortOperations(operations),
  }
  if (embeddedSource) doc.embeddedSource = embeddedSource
  return doc
}

export function serializeDocument(doc: EditDocument): string {
  return JSON.stringify(doc, null, 2)
}

// ---- validation ------------------------------------------------------------

class DocumentError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function num(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new DocumentError(`Field "${field}" must be a number`)
  }
  return value
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

const FILTER_NAMES: readonly FilterName[] = ['greyscale', 'sepia']

function parseOperation(raw: unknown, index: number): Operation {
  if (!isRecord(raw)) throw new DocumentError(`operations[${index}] must be an object`)
  const type = raw['type']
  switch (type) {
    case 'crop':
      return {
        type: 'crop',
        x: num(raw['x'], `operations[${index}].x`),
        y: num(raw['y'], `operations[${index}].y`),
        width: num(raw['width'], `operations[${index}].width`),
        height: num(raw['height'], `operations[${index}].height`),
      }
    case 'adjust':
      return {
        type: 'adjust',
        brightness: clamp(num(raw['brightness'], `operations[${index}].brightness`), -100, 100),
        contrast: clamp(num(raw['contrast'], `operations[${index}].contrast`), -100, 100),
        saturation: clamp(num(raw['saturation'], `operations[${index}].saturation`), -100, 100),
      }
    case 'filter': {
      const name = raw['name']
      if (typeof name !== 'string' || !FILTER_NAMES.includes(name as FilterName)) {
        throw new DocumentError(`operations[${index}].name must be one of ${FILTER_NAMES.join(', ')}`)
      }
      return { type: 'filter', name: name as FilterName }
    }
    default:
      throw new DocumentError(`operations[${index}].type "${String(type)}" is not supported`)
  }
}

export function validateDocument(data: unknown): EditDocument {
  if (!isRecord(data)) throw new DocumentError('Document must be a JSON object')
  if (data['version'] !== DOCUMENT_VERSION) {
    throw new DocumentError(`Unsupported version: ${String(data['version'])} (expected ${DOCUMENT_VERSION})`)
  }
  const source = data['source']
  if (!isRecord(source)) throw new DocumentError('Missing "source" object')

  const meta: SourceMeta = {
    name: typeof source['name'] === 'string' ? source['name'] : 'image',
    width: num(source['width'], 'source.width'),
    height: num(source['height'], 'source.height'),
    type: typeof source['type'] === 'string' ? source['type'] : 'image/png',
  }

  const rawOps = data['operations']
  if (!Array.isArray(rawOps)) throw new DocumentError('"operations" must be an array')
  const operations = sortOperations(rawOps.map(parseOperation))

  const embeddedSource = data['embeddedSource']
  const doc: EditDocument = { version: DOCUMENT_VERSION, source: meta, operations }
  if (typeof embeddedSource === 'string' && embeddedSource.length > 0) {
    doc.embeddedSource = embeddedSource
  }
  return doc
}

/** Parse and validate a JSON string into an EditDocument (throws on malformed input). */
export function parseDocument(json: string): EditDocument {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new DocumentError('File is not valid JSON')
  }
  return validateDocument(data)
}
