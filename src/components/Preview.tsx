import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { createSvgString } from '@dxfom/svg'
import { createMemo } from 'solid-js'
import 'svg-pan-zoom-container'
import { dxf } from '../state'

const textDecoder = new TextDecoder('ms932')

export const Preview = () => {
  const svgString = createMemo(() =>
    createSvgString(dxf(), {
      resolveColorIndex: index => {
        const [h, s, l] = DXF_COLOR_HSL[index as number & string] ?? [0, 0, 50]
        return `hsl(${h},${s}%,${Math.round(l * 0.8 + 20)}%)`
      },
      resolveFont: font => ({ ...font, family: font.family + ',var(--font-family)' }),
      encoding: textDecoder,
    }),
  )
  const svgDataUri = createMemo(() => 'data:image/svg+xml,' + encodeURIComponent(svgString()))
  return (
    <>
      <div
        data-zoom-on-wheel="max-scale: 10000"
        data-pan-on-drag
        style="height: 100%; contain: paint; background-color: #123"
        innerHTML={svgString()}
        ref={div =>
          setTimeout(() => {
            const coordinateElement = div.parentElement!.lastElementChild!
            const svg = div.getElementsByTagName('svg')[0]
            svg.style.padding = '8px 16px'
            svg.setAttribute('buffered-rendering', 'static')
            svg.onpointermove = ({ currentTarget, clientX, clientY }) => {
              const svg = currentTarget as SVGSVGElement
              const { x, y } = Object.assign(svg.createSVGPoint(), {
                x: clientX,
                y: clientY,
              }).matrixTransform(svg.getScreenCTM()!.inverse())
              coordinateElement.textContent = `${Math.round(x)}, ${Math.round(-y)}`
            }
            svg.onpointerleave = () => (coordinateElement.textContent = '')
          })
        }
      />
      <a download href={svgDataUri()} style="position: absolute; right: 16px; top: 8px; color: cyan">
        Download SVG File
      </a>
      <div style="pointer-events: none; position: absolute; right: 16px; bottom: 8px; text-align: right; color: #ddd; text-shadow: 0 1px #123,0 -1px #123,1px 0 #123,-1px 0 #123,0 0 4px #123"></div>
    </>
  )
}
