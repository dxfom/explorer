import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { DxfReadonly, DxfRecordReadonly, getGroupCodeValue, getGroupCodeValues } from '@dxfom/dxf'
import { DxfMTextContentElement, parseDxfMTextContent } from '@dxfom/mtext'
import { DxfTextContentElement, parseDxfTextContent } from '@dxfom/text'
import { escapeHtml } from './escapeHtml'

const _shift = (n: number, precision: number): number => {
  const [d, e] = ('' + n).split('e')
  return +(d + 'e' + (e ? +e + precision : precision))
}
const round = (n: number, precision: number): number => _shift(Math.round(_shift(n, precision)), -precision)
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

const tspansFromMTextContents = (contents: readonly DxfMTextContentElement[], i = 0): string => {
  if (contents.length <= i) {
    return ''
  }
  const restContents = tspansFromMTextContents(contents, i + 1)
  const content = contents[i]
  if (typeof content === 'string') {
    return content + restContents
  }
  if (Array.isArray(content)) {
    return tspansFromMTextContents(content) + restContents
  }
  if (content.S) {
    return `<tspan><tspan dy=-.5em>${content.S[0]}</tspan><tspan dy=.5em>${content.S[2]}</tspan></tspan>` + restContents
  }
  if (content.f) {
    return `<tspan font-family="${content.f}"${content.b ? ' font-weight=bold' : ''}${content.i ? ' font-style=italic' : ''}>${restContents}</tspan>`
  }
  if (content.Q) {
    return `<tspan font-style="oblique ${content.Q}deg">${restContents}</tspan>`
  }
  return restContents
}

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
        const large = (angle2 - angle1 + 360) % 360 <= 180 ? '0' : '1'
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
    HATCH: entity => {
      const paths = entity.slice(
        entity.findIndex(groupCode => groupCode[0] === 92),
        entity.findIndex(groupCode => groupCode[0] === 97),
      )
      const x1s = getGroupCodeValues(paths, 10).map(trim)
      const y1s = getGroupCodeValues(paths, 20).map(trim).map(negate)
      const x2s = getGroupCodeValues(paths, 11).map(trim)
      const y2s = getGroupCodeValues(paths, 21).map(trim).map(negate)
      let d = ''
      for (let i = 0; i < x1s.length; i++) {
        if (!x2s[i]) {
          d += `${i === 0 ? 'M' : 'L'}${x1s[i]} ${y1s[i]}`
        } else if (x1s[i] === x2s[i - 1] && y1s[i] === y2s[i - 1]) {
          d += `L${x2s[i]} ${y2s[i]}`
        } else {
          d += `M${x1s[i]} ${y1s[i]}L${x2s[i]} ${y2s[i]}`
        }
      }
      return `<path ${groupCodesToDataset(entity)}${color(entity, 'fill')} fill-opacity=.3 d="${d}" />`
    },
    SOLID: entity => {
      const x1 = trim(getGroupCodeValue(entity, 10))
      const y1 = negate(trim(getGroupCodeValue(entity, 20)))
      const x2 = trim(getGroupCodeValue(entity, 11))
      const y2 = negate(trim(getGroupCodeValue(entity, 21)))
      const x3 = trim(getGroupCodeValue(entity, 12))
      const y3 = negate(trim(getGroupCodeValue(entity, 22)))
      const x4 = trim(getGroupCodeValue(entity, 13))
      const y4 = negate(trim(getGroupCodeValue(entity, 23)))
      const d = `M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}${x3 !== x4 || y3 !== y4 ? `L${x4} ${y4}` : ''}Z`
      return `<path ${groupCodesToDataset(entity)}${color(entity, 'fill')} d="${d}" />`
    },
    TEXT: entity => {
      const x = trim(getGroupCodeValue(entity, 10))
      const y = negate(trim(getGroupCodeValue(entity, 20)))
      const h = trim(getGroupCodeValue(entity, 40))
      const angle = negate(trim(getGroupCodeValue(entity, 50)))
      const alignH = textHorizontalAlignmentToSvgAttributeString[trim(getGroupCodeValue(entity, 72)) as string & number] ?? ''
      const alignV = textVerticalAlignmentToSvgAttributeString[trim(getGroupCodeValue(entity, 73)) as string & number] ?? ''
      const contents = parseDxfTextContent(getGroupCodeValue(entity, 1) || '')
      const attributes = `${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${alignH}${alignV}${angle ? ` transform="rotate(${angle} ${x} ${y})"` : ''}`
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
      const tspans = tspansFromMTextContents(parseDxfMTextContent(text))
      return `<text ${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${attachmentPoint}>${tspans}</text>`
    },
    DIMENSION: entity => {
      const styleName = getGroupCodeValue(entity, 3)
      const style = dxf.TABLES?.DIMSTYLE?.find(style => getGroupCodeValue(style, 2) === styleName)
      let lineElements = ''
      let value = +getGroupCodeValue(entity, 42)!
      switch (+getGroupCodeValue(entity, 70)! & 7) {
        case 0: // Rotated, Horizontal, or Vertical
        case 1: // Aligned
        {
          const x1 = trim(getGroupCodeValue(entity, 13))
          const y1 = negate(trim(getGroupCodeValue(entity, 23)))
          const x3 = trim(getGroupCodeValue(entity, 10))
          const y3 = negate(trim(getGroupCodeValue(entity, 20)))
          const x4 = trim(getGroupCodeValue(entity, 14))
          const y4 = negate(trim(getGroupCodeValue(entity, 24)))
          const [x2, y2] = x3 === x4 ? [x1, y3] : [x3, y1]
          value = value || (Math.abs(x3 === x4 ? +y3! - +y1! : +x3! - +x1!) * +(getGroupCodeValue(style, 144)! || 1))
          lineElements = `<path vector-effect=non-scaling-stroke d="M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}L${x4} ${y4}" />`
          break
        }
        case 2: // Angular
        case 5: // Angular 3-point
          console.warn('Angular dimension cannot be rendered yet.', entity)
          break
        case 3: // Diameter
        case 4: // Radius
          console.warn('Diameter / radius dimension cannot be rendered yet.', entity)
          break
        case 6: // Ordinate
          console.warn('Ordinate dimension cannot be rendered yet.', entity)
          break
      }
      value = round(value, +getGroupCodeValue(style, 271)! || +getGroupCodeValue(dxf.HEADER?.$DIMDEC, 70)! || 4)
      let textElement: string
      {
        const x = trim(getGroupCodeValue(entity, 11))
        const y = negate(trim(getGroupCodeValue(entity, 21)))
        const h = +getGroupCodeValue(style, 140)! * (+getGroupCodeValue(style, 40)! || +getGroupCodeValue(dxf.HEADER?.$DIMSCALE, 40)! || 1)
        const angle = negate(trim(getGroupCodeValue(entity, 50)))
        const attachmentPoint = mtextAttachmentPointsToSvgAttributeString[trim(getGroupCodeValue(entity, 71)) as string & number] ?? ''
        const textOriginal = getGroupCodeValue(entity, 1) ?? '<>'
        const text = parseDxfTextContent(textOriginal.replace(/<>/, value as string & number)).map(({ text }) => text).join('')
        const tspans = tspansFromMTextContents(parseDxfMTextContent(text))
        textElement = `<text${color(entity, 'fill')}${attachmentPoint} stroke=none x=${x} y=${y} font-size=${h}${angle ? ` transform="rotate(${angle} ${x} ${y})"` : ''}>${tspans}</text>`
      }
      return `<g ${commonShapeAttributes(entity)}${color(entity, 'stroke')}>${lineElements}${textElement}</g>`
    },
    INSERT: entity => {
      const x = trim(getGroupCodeValue(entity, 10))
      const y = negate(trim(getGroupCodeValue(entity, 20)))
      const rotate = negate(trim(getGroupCodeValue(entity, 50)))
      const xscale = trim(getGroupCodeValue(entity, 41)) || 1
      const yscale = trim(getGroupCodeValue(entity, 42)) || 1
      const transform = [
        +x! || +y! ? `translate(${x},${y})` : '',
        +xscale !== 1 || +yscale !== 1 ? `scale(${xscale},${yscale})` : '',
        rotate ? `rotate(${rotate})` : ''
      ].filter(Boolean).join(' ')
      const _block = dxf.BLOCKS?.[getGroupCodeValue(entity, 2)!]
      const block = _block?.slice(
        getGroupCodeValue(_block[0], 0) === 'BLOCK' ? 1 : 0,
        getGroupCodeValue(_block[_block.length - 1], 0) === 'ENDBLK' ? -1 : undefined,
      )
      const contents = entitiesToSvgString(dxf, block)
      return `<g ${groupCodesToDataset(entity)}${color(entity, 'color')}${transform ? ` transform="${transform}"` : ''}>${contents}</g>`
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
      const entitySvg = entitySvgMap[entityType]
      if (entitySvg) {
        s += entitySvg(entity, vertices)
      } else {
        console.debug('Unknown entity type:', entityType, entity)
      }
    }
  }
  return s
}

export const createSvgString = (dxf: DxfReadonly) =>
  `<svg viewBox="${viewBox(dxf)}">${entitiesToSvgString(dxf, dxf.ENTITIES)}</svg>`
