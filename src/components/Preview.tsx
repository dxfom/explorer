import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { DxfReadonly, getGroupCodeValue } from '@dxfom/dxf'
import { createSvgString } from '@dxfom/svg'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import svgDragSelect from 'svg-drag-select'
import 'svg-pan-zoom-container'
import { dxf } from '../state'

const textDecoder = new TextDecoder('ms932')
const styleElement = document.head.appendChild(document.createElement('style'))

const findEntityByHandle = (dxf: DxfReadonly, handle: string) => {
  {
    const entity = dxf.ENTITIES?.find(entity => getGroupCodeValue(entity, 5) === handle)
    if (entity) {
      return entity
    }
  }
  if (dxf.BLOCKS) {
    for (const block of Object.values(dxf.BLOCKS)) {
      const entity = block.find(entity => getGroupCodeValue(entity, 5) === handle)
      if (entity) {
        return entity
      }
    }
  }
}

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
  const [selectedHandles, setSelectedHandles] = createSignal<string[]>([])
  const selectedEntities = createMemo(() =>
    selectedHandles()
      .map(handle => findEntityByHandle(dxf(), handle))
      .filter(Boolean),
  )
  createEffect(() => {
    styleElement.textContent =
      selectedHandles()
        .map(handle => `[data-5="${handle}"]`)
        .join(',') + '{stroke-width:3px}'
  })
  return (
    <>
      <div
        data-zoom-on-wheel="max-scale: 10000"
        data-pan-on-drag
        style="height: 100%; contain: paint; background-color: #123"
        innerHTML={svgString()}
        ref={div =>
          setTimeout(() => {
            const coordinateElement = div.parentElement!.getElementsByClassName('coordinate')[0]
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
            svg.oncontextmenu = event => event.preventDefault()

            svgDragSelect({
              svg,
              selector: 'intersection',
              onSelectionStart: ({ pointerEvent, cancel }) => {
                if (pointerEvent.button === 2) {
                  setSelectedHandles([])
                } else {
                  cancel()
                }
              },
              onSelectionChange: ({ selectedElements }) => {
                const selectedSet = new Set<string>()
                for (const element of selectedElements) {
                  const handle = element.closest('[data-5]')?.getAttribute('data-5')
                  handle && selectedSet.add(handle)
                }
                setSelectedHandles([...selectedSet])
              },
            })
          })
        }
      />
      <a download href={svgDataUri()} style="position: absolute; right: 16px; top: 8px; color: cyan">
        Download SVG File
      </a>
      <div
        class="coordinate"
        style="pointer-events: none; position: absolute; right: 16px; bottom: 8px; text-align: right; color: #ddd; text-shadow: 0 1px #123,0 -1px #123,1px 0 #123,-1px 0 #123,0 0 4px #123"
      ></div>
      <Show when={selectedEntities().length !== 0}>
        <div style="position: absolute; right: 0; top: 0; bottom: 0; overflow: auto; background: white;">
          <table>
            <tbody>
              <For each={selectedEntities()}>
                {(entity, i) => [
                  <tr>
                    <th colSpan="2">
                      {i() === 0 ? `${selectedEntities().length} ${selectedEntities().length === 1 ? 'entity' : 'entities'}` : ` `}
                    </th>
                  </tr>,
                  <For each={entity!}>
                    {([groupCode, value]) => (
                      <tr>
                        <td style="text-align: right">{groupCode}</td>
                        <td>{value}</td>
                      </tr>
                    )}
                  </For>,
                ]}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </>
  )
}
