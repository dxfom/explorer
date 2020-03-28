import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { DxfReadonly, DxfRecordReadonly, getGroupCodeValue as $, getGroupCodeValues as $$ } from '@dxfom/dxf'
import { DxfMTextContentElement, parseDxfMTextContent } from '@dxfom/mtext'
import { DxfTextContentElement, parseDxfTextContent } from '@dxfom/text'
import { escapeHtml } from './escapeHtml'

const resolveColorIndex = (index: number | string | undefined) => {
  const [h, s, l] = DXF_COLOR_HSL[index as number & string] ?? [0, 0, 50]
  return `hsl(${h},${s}%,${l * .8 + 20}%)`
}
const smallNumber = 1 / 64
const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < smallNumber
const round = (() => {
  const _shift = (n: number, precision: number): number => {
    const [d, e] = ('' + n).split('e')
    return +(d + 'e' + (e ? +e + precision : precision))
  }
  return (n: number, precision: number) => _shift(Math.round(_shift(n, precision)), -precision)
})()
const isNumberString = (s: unknown) => typeof s === 'string' && /^-?[0-9]+(\.[0-9]*)?$/.test(s)
const isNumberStrings = (...ss: readonly unknown[]) => ss.every(isNumberString)

const trim = (s: string | undefined) => s ? s.trim() : s
const negate = (s: string | undefined) => !s ? s : s.startsWith('-') ? s.slice(1) : '-' + s
const $trim = (record: DxfRecordReadonly | undefined, groupCode: number) => trim($(record, groupCode))
const $negate = (record: DxfRecordReadonly | undefined, groupCode: number) => negate(trim($(record, groupCode)))
const $number = (record: DxfRecordReadonly | undefined, groupCode: number, defaultValue?: number) => {
  const value = +$(record, groupCode)!
  if (!isNaN(value)) {
    return value
  }
  if (defaultValue === undefined) {
    console.debug(`Group code ${groupCode} must be a number, but "${value}".`, record)
    return NaN
  }
  return defaultValue
}

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
    .sort((a, b) => a - b)
    .map(key => {
      const value = escapeHtml(String($$(entity, key)))
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
    if ($(layer, 0) === 'LAYER') {
      layerMap[$(layer, 2)!] = { color: resolveColorIndex($trim(layer, 62)), ltype: $(layer, 6) }
    }
  }

  const ltypeMap: Record<string, undefined | { strokeDasharray: string }> = {}
  for (const ltype of dxf.TABLES?.LTYPE ?? []) {
    if ($(ltype, 0) === 'LTYPE') {
      const _strokeDasharray = $$(ltype, 49).map(trim).map(s => s!.startsWith('-') ? s!.slice(1) : s!)
      const strokeDasharray = _strokeDasharray.length % 2 === 1 ? _strokeDasharray : _strokeDasharray[0] === '0' ? _strokeDasharray.slice(1) : _strokeDasharray.concat('0')
      ltypeMap[$(ltype, 2)!] = { strokeDasharray: strokeDasharray.join(' ') }
    }
  }

  const color = (entity: DxfRecordReadonly, attributeName: 'color' | 'stroke' | 'fill') => {
    const colorIndex = $trim(entity, 62) as string & number
    if (colorIndex === '0') {
      return ` ${attributeName}=currentColor`
    }
    if (colorIndex && colorIndex !== '256') {
      return ` ${attributeName}=${resolveColorIndex(colorIndex)}`
    }
    const layer = layerMap[$trim(entity, 8)!]
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
      const extrusionZ = +$trim(entity, 230)!
      if (extrusionZ && Math.abs(extrusionZ + 1) < 1 / 64) {
        style = ' style="transform:rotateY(180deg)"'
      }
    }
    const strokeDasharray = ltypeMap[$(entity, 6) ?? layerMap[$(entity, 8)!]?.ltype!]?.strokeDasharray
    return `${groupCodesToDataset(entity)}${color(entity, 'stroke')}${strokeDasharray ? ' stroke-dasharray="' + strokeDasharray + '"' : ''} fill=none vector-effect=non-scaling-stroke${style}`
  }

  return {
    LINE: entity => {
      const x1 = $trim(entity, 10)
      const y1 = $negate(entity, 20)
      const x2 = $trim(entity, 11)
      const y2 = $negate(entity, 21)
      if (isNumberStrings(x1, y1, x2, y2)) {
        return `<line ${commonShapeAttributes(entity)} x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`
      }
    },
    POLYLINE: (entity, vertices) => {
      const flags = +($(entity, 70) ?? 0)
      let d = ''
      for (const vertex of vertices) {
        d += d ? 'L' : 'M'
        d += $trim(vertex, 10)
        d += ' '
        d += $negate(vertex, 20)
      }
      if (flags & 1) {
        d += 'Z'
      }
      return `<path ${commonShapeAttributes(entity)} d="${d}" />`
    },
    LWPOLYLINE: entity => {
      const flags = +($(entity, 70) ?? 0)
      const xs = $$(entity, 10)
      const ys = $$(entity, 20)
      let d = ''
      for (let i = 0; i < xs.length; i++) {
        d += d ? 'L' : 'M'
        d += trim(xs[i])
        d += ' '
        d += negate(trim(ys[i]))
      }
      if (flags & 1) {
        d += 'Z'
      }
      return `<path ${commonShapeAttributes(entity)} d="${d}" />`
    },
    CIRCLE: entity => {
      const cx = $trim(entity, 10)
      const cy = $negate(entity, 20)
      const r = $trim(entity, 40)
      if (isNumberStrings(cx, cy, r)) {
        return `<circle ${commonShapeAttributes(entity)} cx=${cx} cy=${cy} r=${r} />`
      }
    },
    ARC: entity => {
      const cx = $number(entity, 10)
      const cy = $number(entity, 20)
      const r = $number(entity, 40)
      const degAngle1 = $number(entity, 50, 0)
      const degAngle2 = $number(entity, 51, 0)
      if (isNaN(cx) || isNaN(cy) || isNaN(r)) {
        return ''
      }
      const radAngle1 = degAngle1 * Math.PI / 180
      const radAngle2 = degAngle2 * Math.PI / 180
      const x1 = cx + r * Math.cos(radAngle1)
      const y1 = cy + r * Math.sin(radAngle1)
      const x2 = cx + r * Math.cos(radAngle2)
      const y2 = cy + r * Math.sin(radAngle2)
      const large = (degAngle2 - degAngle1 + 360) % 360 <= 180 ? '0' : '1'
      return `<path ${commonShapeAttributes(entity)} d="M${x1} ${-y1}A${r} ${r} 0 ${large} 0 ${x2} ${-y2}" />`
    },
    ELLIPSE: entity => {
      // https://wiki.gz-labs.net/index.php/ELLIPSE
      const cx = $number(entity, 10)
      const cy = $number(entity, 20)!
      const majorX = $number(entity, 11)
      const majorY = $number(entity, 21)
      const majorR = Math.sqrt(majorX * majorX + majorY * majorY)
      const minorR = $number(entity, 40)! * majorR
      const radAngleOffset = -Math.atan2(majorY, majorX)
      const radAngle1 = $number(entity, 41, 0)
      const radAngle2 = $number(entity, 42, 2 * Math.PI)
      if (nearlyEqual(radAngle1, 0) && nearlyEqual(radAngle2, 2 * Math.PI)) {
        const transform = radAngleOffset ? ` transform="rotate(${radAngleOffset * 180 / Math.PI} ${cx} ${-cy})"` : ''
        return `<ellipse ${commonShapeAttributes(entity)} cx=${cx} cy=${-cy} rx=${majorR} ry=${minorR}${transform} />`
      } else {
        console.debug('Elliptical arc cannot be rendered yet.')
        return ''
      }
    },
    LEADER: entity => {
      const xs = $$(entity, 10).map(trim)
      const ys = $$(entity, 20).map(trim)
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
      const x1s = $$(paths, 10).map(trim)
      const y1s = $$(paths, 20).map(trim).map(negate)
      const x2s = $$(paths, 11).map(trim)
      const y2s = $$(paths, 21).map(trim).map(negate)
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
      const x1 = $trim(entity, 10)
      const y1 = $negate(entity, 20)
      const x2 = $trim(entity, 11)
      const y2 = $negate(entity, 21)
      const x3 = $trim(entity, 12)
      const y3 = $negate(entity, 22)
      const x4 = $trim(entity, 13)
      const y4 = $negate(entity, 23)
      const d = `M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}${x3 !== x4 || y3 !== y4 ? `L${x4} ${y4}` : ''}Z`
      return `<path ${groupCodesToDataset(entity)}${color(entity, 'fill')} d="${d}" />`
    },
    TEXT: entity => {
      const x = $trim(entity, 10)
      const y = $negate(entity, 20)
      const h = $trim(entity, 40)
      const angle = $negate(entity, 50)
      const alignH = textHorizontalAlignmentToSvgAttributeString[$trim(entity, 72) as string & number] ?? ''
      const alignV = textVerticalAlignmentToSvgAttributeString[$trim(entity, 73) as string & number] ?? ''
      const contents = parseDxfTextContent($(entity, 1) || '')
      const attributes = `${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${alignH}${alignV}${angle ? ` transform="rotate(${angle} ${x} ${y})"` : ''}`
      if (contents.length === 1) {
        const content = contents[0]
        return `<text ${attributes}${textDecorations(content)}>${content.text}</text>`
      } else {
        return `<text ${attributes}>${contents.map(content => `<tspan${textDecorations(content)}>${content.text}</tspan>`)}</text>`
      }
    },
    MTEXT: entity => {
      const x = $trim(entity, 10)
      const y = $negate(entity, 20)
      const h = $trim(entity, 40)
      const attachmentPoint = mtextAttachmentPointsToSvgAttributeString[$trim(entity, 71) as string & number] ?? ''
      const text = $$(entity, 3).join('') + ($(entity, 1) ?? '')
      const tspans = tspansFromMTextContents(parseDxfMTextContent(text))
      return `<text ${groupCodesToDataset(entity)}${color(entity, 'fill')} stroke=none x=${x} y=${y} font-size=${h}${attachmentPoint}>${tspans}</text>`
    },
    DIMENSION: entity => {
      const styleName = $(entity, 3)
      const style = dxf.TABLES?.DIMSTYLE?.find(style => $(style, 2) === styleName)
      let lineElements = ''
      let value = $number(entity, 42, 0)
      switch ($number(entity, 70, 0) & 7) {
        case 0: // Rotated, Horizontal, or Vertical
        case 1: // Aligned
        {
          const x1 = $trim(entity, 13)
          const y1 = $negate(entity, 23)
          const x3 = $trim(entity, 10)
          const y3 = $negate(entity, 20)
          const x4 = $trim(entity, 14)
          const y4 = $negate(entity, 24)
          const [x2, y2] = x3 === x4 ? [x1, y3] : [x3, y1]
          value = value || (Math.abs(x3 === x4 ? +y3! - +y1! : +x3! - +x1!) * $number(style, 144, 1))
          lineElements = `<path vector-effect=non-scaling-stroke d="M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}L${x4} ${y4}" />`
          break
        }
        case 2: // Angular
        case 5: // Angular 3-point
          console.debug('Angular dimension cannot be rendered yet.', entity)
          break
        case 3: // Diameter
        case 4: // Radius
          console.debug('Diameter / radius dimension cannot be rendered yet.', entity)
          break
        case 6: // Ordinate
          console.debug('Ordinate dimension cannot be rendered yet.', entity)
          break
      }
      value = round(value, +$(style, 271)! || +$(dxf.HEADER?.$DIMDEC, 70)! || 4)
      let textElement: string
      {
        const x = $trim(entity, 11)
        const y = $negate(entity, 21)
        const h = (+$(style, 140)! || +$(dxf.HEADER?.$DIMTXT, 40)!) * (+$(style, 40)! || +$(dxf.HEADER?.$DIMSCALE, 40)! || 1)
        const angle = $negate(entity, 50)
        const text = $(entity, 1)?.replace(/<>/, value as string & number) ?? String(value)
        const tspans = tspansFromMTextContents(parseDxfMTextContent(text))
        textElement = `<text${color(entity, 'fill')} dominant-baseline=text-after-edge text-anchor=middle stroke=none x=${x} y=${y} font-size=${h}${angle ? ` transform="rotate(${angle} ${x} ${y})"` : ''}>${tspans}</text>`
      }
      return `<g ${commonShapeAttributes(entity)}${color(entity, 'stroke')}>${lineElements}${textElement}</g>`
    },
    INSERT: entity => {
      const x = $trim(entity, 10)
      const y = $negate(entity, 20)
      const rotate = $negate(entity, 50)
      const xscale = $trim(entity, 41) || 1
      const yscale = $trim(entity, 42) || 1
      const transform = [
        +x! || +y! ? `translate(${x},${y})` : '',
        +xscale !== 1 || +yscale !== 1 ? `scale(${xscale},${yscale})` : '',
        rotate ? `rotate(${rotate})` : ''
      ].filter(Boolean).join(' ')
      const _block = dxf.BLOCKS?.[$(entity, 2)!]
      const block = _block?.slice(
        $(_block[0], 0) === 'BLOCK' ? 1 : 0,
        $(_block[_block.length - 1], 0) === 'ENDBLK' ? -1 : undefined,
      )
      const contents = entitiesToSvgString(dxf, block)
      return `<g ${groupCodesToDataset(entity)}${color(entity, 'color')}${transform ? ` transform="${transform}"` : ''}>${contents}</g>`
    },
    SEQEND: () => '',
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
    const xs = [+$(entity, 10)!, +$(entity, 11)!, +$(entity, 12)!].filter(isNotNaN)
    const ys = [-$(entity, 20)!, -$(entity, 21)!, -$(entity, 22)!].filter(isNotNaN)
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
      const entityType = $(entity, 0)
      if (!entityType) {
        continue
      }
      const vertices: NonNullable<DxfReadonly['ENTITIES']>[0][] = []
      while ($(entities[i + 1], 0) === 'VERTEX') {
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
