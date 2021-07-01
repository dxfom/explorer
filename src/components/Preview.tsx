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
      resolveLineWeight: lineWeight => (lineWeight === -3 ? 0.1 : lineWeight),
      resolveFont: font => ({ ...font, family: font.family + ',var(--font-family)' }),
      addAttributes: entity => ({ 'data-5': getGroupCodeValue(entity, 5) }),
      encoding: textDecoder,
    }),
  )
  const svgDataUri = createMemo(() => 'data:image/svg+xml,' + encodeURIComponent(svgString()))
  const [selectedHandles, setSelectedHandles] = createSignal<readonly string[]>([])
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
        data-zoom-on-wheel="min-scale: 0.9; max-scale: 10000"
        data-pan-on-drag
        class="h-full bg-hex-123"
        innerHTML={svgString()}
        ref={div =>
          setTimeout(() => {
            const coordinateElement = div.parentElement!.getElementsByClassName('coordinate')[0]
            const svg = div.getElementsByTagName('svg')[0]
            svg.style.padding = '8px 16px'
            svg.setAttribute('shape-rendering', 'optimizeSpeed')
            svg.setAttribute('text-rendering', 'optimizeSpeed')
            svg.onpointermove = ({ currentTarget, clientX, clientY }) => {
              const { x, y } = new DOMPoint(clientX, clientY).matrixTransform((currentTarget as SVGSVGElement).getScreenCTM()!.inverse())
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
      <a download href={svgDataUri()} class="absolute right-4 top-2 text-cyan-300">
        Download SVG File
      </a>
      <div
        class="coordinate pointer-events-none absolute right-16px bottom-8px text-right text-hex-ddd"
        style="text-shadow: 0 1px #123,0 -1px #123,1px 0 #123,-1px 0 #123,0 0 4px #123"
      ></div>
      <Show when={selectedEntities().length !== 0}>
        <div class="absolute top-0 bottom-0 right-0 overflow-auto bg-white">
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
                        <td class="text-right">{groupCode}</td>
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
