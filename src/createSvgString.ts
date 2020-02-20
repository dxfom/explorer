import { DXF_COLOR_HEX } from '@dxfom/color/hex'
import { DxfReadonly } from '@dxfom/dxf'
import { DxfTextContentElement, parseDxfTextContent } from '@dxfom/text'

const PI2 = Math.PI + Math.PI
const groupCode = (entity: NonNullable<DxfReadonly['ENTITIES']>[0], code: number) => entity?.find(groupCode => groupCode[0] === code)?.[1]
const trim = (s: string | undefined) => s ? s.trim() : s
const negate = (s: string | undefined) => !s ? s : s[0] === '-' ? s.slice(1) : '-' + s
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

const entitySvgMap: Record<string, undefined | ((entity: NonNullable<DxfReadonly['ENTITIES']>[0], vertices: NonNullable<DxfReadonly['ENTITIES']>) => string | undefined)> = {
  LINE: entity => {
    const x1 = trim(groupCode(entity, 10))
    const y1 = negate(trim(groupCode(entity, 20)))
    const x2 = trim(groupCode(entity, 11))
    const y2 = negate(trim(groupCode(entity, 21)))
    if (isNumberStrings(x1, y1, x2, y2)) {
      return `<line data-8="${groupCode(entity, 8)}" vector-effect=non-scaling-stroke x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`
    }
  },
  CIRCLE: entity => {
    const cx = trim(groupCode(entity, 10))
    const cy = negate(trim(groupCode(entity, 20)))
    const r = trim(groupCode(entity, 40))
    if (isNumberStrings(cx, cy, r)) {
      return `<circle data-8="${groupCode(entity, 8)}" vector-effect=non-scaling-stroke cx=${cx} cy=${cy} r=${r} />`
    }
  },
  ARC: entity => {
    const _cx = trim(groupCode(entity, 10))
    const _cy = negate(trim(groupCode(entity, 20)))
    const _r = trim(groupCode(entity, 40))
    const _angle1 = trim(groupCode(entity, 50)) || '0'
    const _angle2 = trim(groupCode(entity, 51)) || '0'
    if (isNumberStrings(_cx, _cy, _r, _angle1, _angle2)) {
      const cx = +_cx!
      const cy = +_cy!
      const r = +_r!
      const angle1 = +_angle1
      const angle2 = +_angle2
      const x1 = r * Math.cos(angle1) + cx
      const y1 = r * Math.sin(angle1) + cy
      const x2 = r * Math.cos(angle2) + cx
      const y2 = r * Math.sin(angle2) + cy
      const large = (angle2 - angle1 + PI2) % PI2 <= Math.PI ? '0' : '1'
      return `<path data-8="${groupCode(entity, 8)}" vector-effect=non-scaling-stroke d="M ${x1} ${-y1} A ${_r} ${_r} 0 ${large} 0 ${x2} ${-y2}" />`
    }
  },
  TEXT: entity => {
    const x = trim(groupCode(entity, 10))
    const y = negate(trim(groupCode(entity, 20)))
    const h = trim(groupCode(entity, 40))
    const contents = parseDxfTextContent(groupCode(entity, 1) || '')
    if (contents.length === 1) {
      const content = contents[0]
      return `<text data-8="${groupCode(entity, 8)}" x=${x} y=${y} font-size=${h}${textDecorations(content)}>${content.text}</text>`
    } else {
      return `<text data-8="${groupCode(entity, 8)}" x=${x} y=${y} font-size=${h}>${contents.map(content => `<tspan${textDecorations(content)}>${content.text}</tspan>`)}</text>`
    }
  },
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
    const xs = [+groupCode(entity, 10)!, +groupCode(entity, 11)!, +groupCode(entity, 12)!].filter(isNotNaN)
    const ys = [-groupCode(entity, 20)!, -groupCode(entity, 21)!, -groupCode(entity, 22)!].filter(isNotNaN)
    minX = Math.min(minX, ...xs)
    maxX = Math.max(maxX, ...xs)
    minY = Math.min(minY, ...ys)
    maxY = Math.max(maxY, ...ys)
  }
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}

const entitiesToSvgString = (dxf: DxfReadonly, entities: DxfReadonly['ENTITIES']) => {
  let s = ''
  if (entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const entityType = groupCode(entity, 0)
      if (!entityType) {
        continue
      }
      if (entityType === 'INSERT') {
        const x = trim(groupCode(entity, 10))
        const y = negate(trim(groupCode(entity, 20)))
        const xscale = trim(groupCode(entity, 41)) || '1'
        const yscale = trim(groupCode(entity, 42)) || '1'
        const scale = +xscale !== 1 || +yscale !== 1 ? ` scale(${xscale},${yscale})` : ''
        s += `<g transform="translate(${x},${y})${scale}">`
        s += entitiesToSvgString(dxf, dxf.BLOCKS?.[groupCode(entity, 2)!])
        s += '</g>'
        continue
      }
      const vertices: NonNullable<DxfReadonly['ENTITIES']>[0][] = []
      while (groupCode(entities[i + 1], 0) === 'VERTEX') {
        vertices.push(entities[++i])
      }
      s += entitySvgMap[entityType]?.(entity, vertices) ?? ''
    }
  }
  return s
}

const styles = ({ TABLES }: DxfReadonly) => {
  let s = '<style>text{stroke:none;fill:currentColor}'
  const layers = TABLES?.LAYER
  if (layers) {
    for (const layer of layers) {
      if (groupCode(layer, 0) === 'LAYER') {
        s += `[data-8="${groupCode(layer, 2)}"]{color:${DXF_COLOR_HEX[trim(groupCode(layer, 62)) as string & number]}}`
      }
    }
  }
  s += '</style>'
  return s
}

export const createSvgString = (dxf: DxfReadonly) =>
  `<svg viewBox="${viewBox(dxf)}" stroke=currentColor fill=none>${styles(dxf)}${entitiesToSvgString(dxf, dxf.ENTITIES)}</svg>`
