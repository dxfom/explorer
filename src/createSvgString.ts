import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { DxfReadonly, DxfRecordReadonly, getGroupCodeValue, getGroupCodeValues } from '@dxfom/dxf'
import { parseDxfMTextContent } from '@dxfom/mtext'
import { DxfTextContentElement, parseDxfTextContent } from '@dxfom/text'
import { escapeHtml } from './escapeHtml'

const PI2 = Math.PI + Math.PI
const trim = (s: string | undefined) => s ? s.trim() : s
const negate = (s: string | undefined) => !s ? s : s.startsWith('-') ? s.slice(1) : '-' + s
const isNumberString = (s: unknown) => typeof s === 'string' && /^-?[0-9]+(\.[0-9]*)?$/.test(s)
const isNumberStrings = (...ss: readonly unknown[]) => ss.every(isNumberString)
const textDecorations = ({ k, o, u }: DxfTextContentElement) => {
  const decorations = []
  k && decorations.push('line-through')
  o && decorations.push('overline')
  u && decorations.push('underline')
  if (decorations.length === 0) {
    return ''
  } else if (decorations.length === 1) {
    return ' text-decoration=' + decorations[0]
  } else {
    return ' text-decorations="' + decorations.join(' ') + '"'
  }
}
const groupCodesToDataset = (entity: DxfRecordReadonly) =>
  entity
    .map(([key]) => key)
    .filter((key, i, a) => a.indexOf(key) === i)
    .map(key => {
      const value = escapeHtml(String(getGroupCodeValues(entity, key)))
      return value.includes(' ') ? `data-${key}="${value}"` : `data-${key}=${value}`
    })
    .join(' ')

const mtextAttachmentPointsToSvgAttributeString = [
  '',
  ' dominant-baseline=text-before-edge',
  ' dominant-baseline=text-before-edge text-anchor=middle',
  ' dominant-baseline=text-before-edge text-anchor=end',
  ' dominant-baseline=central',
  ' dominant-baseline=central text-anchor=middle',
  ' dominant-baseline=central text-anchor=end',
  ' dominant-baseline=text-after-edge',
  ' dominant-baseline=text-after-edge text-anchor=middle',
  ' dominant-baseline=text-after-edge text-anchor=end',
]

const textVerticalAlignmentToSvgAttributeString = [
  '',
  ' dominant-baseline=text-after-edge',
  ' dominant-baseline=central',
  ' dominant-baseline=text-before-edge',
]

const textHorizontalAlignmentToSvgAttributeString = [
  '',
  ' text-anchor=middle',
  ' text-anchor=end',
  '',
  ' text-anchor=middle',
]

const createEntitySvgMap: (dxf: DxfReadonly) => Record<string, undefined | ((entity: DxfRecordReadonly, vertices: readonly DxfRecordReadonly[]) => string | undefined)> = dxf => {
  const layerMap: Record<string, undefined | { color: string; ltype?: string }> = {}
  for (const layer of dxf.TABLES?.LAYER ?? []) {
    if (getGroupCodeValue(layer, 0) === 'LAYER') {
      const [h, s, l] = DXF_COLOR_HSL[trim(getGroupCodeValue(layer, 62)) as string & number] ?? [0, 0, 0]
      layerMap[getGroupCodeValue(layer, 2)!] = { color: `hsl(${h},${s}%,${l * .8}%)`, ltype: getGroupCodeValue(layer, 6) }
    }
  }

  const ltypeMap: Record<string, undefined | { strokeDasharray: string }> = {}
  for (const ltype of dxf.TABLES?.LTYPE ?? []) {
    if (getGroupCodeValue(ltype, 0) === 'LTYPE') {
      const strokeDasharray = getGroupCodeValues(ltype, 49).map(trim).map(s => s!.startsWith('-') ? s!.slice(1) : s!).join(' ')
      ltypeMap[getGroupCodeValue(ltype, 2)!] = { strokeDasharray }
    }
  }

  const color = (entity: DxfRecordReadonly, attributeName: 'color' | 'stroke' | 'fill') => {
    const colorIndex = trim(getGroupCodeValue(entity, 62)) as string & number
    if (colorIndex === '0') {
      return ` ${attributeName}=currentColor`
    }
    if (colorIndex && colorIndex !== '256') {
      const [h, s, l] = DXF_COLOR_HSL[colorIndex] ?? [0, 0, 0]
      return ` ${attributeName}=hsl(${h},${s}%,${l * .8}%)`
    }
    const layer = layerMap[trim(getGroupCodeValue(entity, 8))!]
    if (layer) {
      return ` ${attributeName}=${layer.color}`
    }
    if (attributeName !== 'color') {
      return ` ${attributeName}=currentColor`
    }
    return ''
  }

  const commonShapeAttributes = (entity: DxfRecordReadonly, options?: { extrusion: false }) => {
    let style = ''
    if (options?.extrusion !== false) {
      const extrusionZ = +trim(getGroupCodeValue(entity, 230))!
      if (extrusionZ && Math.abs(extrusionZ + 1) < 1 / 64) {
        style = ' style="transform:rotateY(180deg)"'
      }
    }
    const strokeDasharray = ltypeMap[getGroupCodeValue(entity, 6) ?? layerMap[getGroupCodeValue(entity, 8)!]?.ltype!]?.strokeDasharray
    return `${groupCodesToDataset(entity)}${color(entity, 'stroke')}${strokeDasharray ? ' stroke-dasharray="' + strokeDasharray + '"' : ''} fill=none vector-effect=non-scaling-stroke${style}`
  }

  return {
    LINE: entity => {
      const x1 = trim(getGroupCodeValue(entity, 10))
      const y1 = negate(trim(getGroupCodeValue(entity, 20)))
      const x2 = trim(getGroupCodeValue(entity, 11))
      const y2 = negate(trim(getGroupCodeValue(entity, 21)))
      if (isNumberStrings(x1, y1, x2, y2)) {
        return `<line ${commonShapeAttributes(entity)} x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`
      }
    },
    CIRCLE: entity => {
      const cx = trim(getGroupCodeValue(entity, 10))
      const cy = negate(trim(getGroupCodeValue(entity, 20)))
      const r = trim(getGroupCodeValue(entity, 40))
      if (isNumberStrings(cx, cy, r)) {
        return `<circle ${commonShapeAttributes(entity)} cx=${cx} cy=${cy} r=${r} />`
      }
    },
    ARC: entity => {
      const _cx = trim(getGroupCodeValue(entity, 10))
      const _cy = trim(getGroupCodeValue(entity, 20))
      const _r = trim(getGroupCodeValue(entity, 40))
      const _angle1 = trim(getGroupCodeValue(entity, 50)) || '0'
      const _angle2 = trim(getGroupCodeValue(entity, 51)) || '0'
      if (isNumberStrings(_cx, _cy, _r, _angle1, _angle2)) {
        const cx = +_cx!
        const cy = +_cy!
        const r = +_r!
        const angle1 = +_angle1
        const angle2 = +_angle2
        const x1 = r * Math.cos(angle1 * Math.PI / 180) + cx
        const y1 = r * Math.sin(angle1 * Math.PI / 180) + cy
        const x2 = r * Math.cos(angle2 * Math.PI / 180) + cx
        const y2 = r * Math.sin(angle2 * Math.PI / 180) + cy
        const large = (angle2 - angle1 + PI2) % PI2 <= Math.PI ? '0' : '1'
        return `<path ${commonShapeAttributes(entity)} d="M${x1} ${-y1} A${_r} ${_r} 0 ${large} 0 ${x2} ${-y2}" />`
      }
    },
    LEADER: entity => {
      const xs = getGroupCodeValues(entity, 10).map(trim)
      const ys = getGroupCodeValues(entity, 20).map(trim)
      let d = ''
      for (let i = 0; i < xs.length; i++) {
        d += d ? 'L' : 'M'
        d += xs[i]
        d += ' '
        d += negate(ys[i])
      }
      return `<path ${commonShapeAttributes(entity, { extrusion: false })} d="${d}" />`
    },
    TEXT: entity => {
      const x = trim(getGroupCodeValue(entity, 10))
      const y = negate(trim(getGroupCodeValue(entity, 20)))
      const h = trim(getGroupCodeValue(entity, 40))
      const alignH = textHorizontalAlignmentToSvgAttributeString[trim(getGroupCodeValue(entity, 72)) as string & number] ?? ''
      const alignV = textVerticalAlignmentToSvgAttributeString[trim(getGroupCodeValue(entity, 73)) as string & number] ?? ''
      const contents = parseDxfTextContent(getGroupCodeValue(entity, 1) || '')
      const attributes = `${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${alignH}${alignV}`
      if (contents.length === 1) {
        const content = contents[0]
        return `<text ${attributes}${textDecorations(content)}>${content.text}</text>`
      } else {
        return `<text ${attributes}>${contents.map(content => `<tspan${textDecorations(content)}>${content.text}</tspan>`)}</text>`
      }
    },
    MTEXT: entity => {
      const x = trim(getGroupCodeValue(entity, 10))
      const y = negate(trim(getGroupCodeValue(entity, 20)))
      const h = trim(getGroupCodeValue(entity, 40))
      const attachmentPoint = mtextAttachmentPointsToSvgAttributeString[trim(getGroupCodeValue(entity, 71)) as string & number] ?? ''
      const text = getGroupCodeValues(entity, 3).join('') + (getGroupCodeValue(entity, 1) ?? '')
      let tspans = text
      try {
        tspans = String(parseDxfMTextContent(text))
      } catch (error) {
        console.error(error)
      }
      return `<text ${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${attachmentPoint}>${tspans}</text>`
    },
    INSERT: entity => {
      const x = trim(getGroupCodeValue(entity, 10))
      const y = negate(trim(getGroupCodeValue(entity, 20)))
      const xscale = trim(getGroupCodeValue(entity, 41)) || 1
      const yscale = trim(getGroupCodeValue(entity, 42)) || 1
      const scale = +xscale !== 1 || +yscale !== 1 ? ` scale(${xscale},${yscale})` : ''
      const contents = entitiesToSvgString(dxf, dxf.BLOCKS?.[getGroupCodeValue(entity, 2)!])
      return `<g ${groupCodesToDataset(entity)}${color(entity, 'color')} transform="translate(${x},${y})${scale}">${contents}</g>`
    },
  }
}

const isNotNaN = (n: number) => !isNaN(n)
const viewBox = ({ ENTITIES }: DxfReadonly) => {
  if (!ENTITIES) {
    return ''
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const entity of ENTITIES) {
    const xs = [+getGroupCodeValue(entity, 10)!, +getGroupCodeValue(entity, 11)!, +getGroupCodeValue(entity, 12)!].filter(isNotNaN)
    const ys = [-getGroupCodeValue(entity, 20)!, -getGroupCodeValue(entity, 21)!, -getGroupCodeValue(entity, 22)!].filter(isNotNaN)
    minX = Math.min(minX, ...xs)
    maxX = Math.max(maxX, ...xs)
    minY = Math.min(minY, ...ys)
    maxY = Math.max(maxY, ...ys)
  }
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}

const entitiesToSvgString = (dxf: DxfReadonly, entities: DxfReadonly['ENTITIES']) => {
  const entitySvgMap = createEntitySvgMap(dxf)
  let s = ''
  if (entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const entityType = getGroupCodeValue(entity, 0)
      if (!entityType) {
        continue
      }
      const vertices: NonNullable<DxfReadonly['ENTITIES']>[0][] = []
      while (getGroupCodeValue(entities[i + 1], 0) === 'VERTEX') {
        vertices.push(entities[++i])
      }
      s += entitySvgMap[entityType]?.(entity, vertices) ?? ''
    }
  }
  return s
}

export const createSvgString = (dxf: DxfReadonly) =>
  `<svg viewBox="${viewBox(dxf)}">${entitiesToSvgString(dxf, dxf.ENTITIES)}</svg>`
