import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { createDxfFileString, DxfReadonly } from '@dxfom/dxf'
import { createSvgString } from '@dxfom/svg'
import { createEffect, createMemo, Match, Show, Switch } from 'solid-js'
import { For, render } from 'solid-js/web'
import 'svg-pan-zoom-container'
import { renderSectionContent } from './renderSectionContent'
import { activeSectionName, dxf, filename, setActiveSectionName } from './state'

const textDecoder = new TextDecoder('ms932')

const NavigationItem = ({ sectionName }: { sectionName: string }) => (
  <label>
    <input
      type="radio"
      name="section"
      hidden
      value={sectionName}
      checked={activeSectionName() === sectionName}
      onChange={event => event.target.checked && setActiveSectionName(event.target.value as ReturnType<typeof activeSectionName>)}
    />
    <span>{sectionName}</span>
  </label>
)

const Navigation = () => (
  <Show when={filename()}>
    <h2 style="flex: auto; font-size: 100%;">{filename()}</h2>
    <NavigationItem sectionName="PREVIEW" />
    <NavigationItem sectionName="DXF" />
    <NavigationItem sectionName="JSON" />
    <For each={Object.keys(dxf())}>{sectionName => <NavigationItem sectionName={sectionName} />}</For>
  </Show>
)

const Preview = () => {
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

const SectionContent = () => {
  let div: HTMLDivElement | undefined
  createEffect(() => {
    div!.innerHTML = ''
    renderSectionContent(div!, dxf(), activeSectionName() as keyof DxfReadonly)
  })
  return <section ref={div} style="height: 100%; overflow: auto;" />
}

const Content = () => (
  <Switch fallback={<SectionContent />}>
    <Match when={!activeSectionName()}>
      <></>
    </Match>
    <Match when={activeSectionName() === 'PREVIEW'}>
      <Preview />
    </Match>
    <Match when={activeSectionName() === 'DXF'}>
      <textarea readonly style="width: 100%; height: 100%; resize: none;">
        {createDxfFileString(dxf())}
      </textarea>
    </Match>
    <Match when={activeSectionName() === 'JSON'}>
      <textarea readonly style="width: 100%; height: 100%; resize: none;">
        {JSON.stringify(dxf(), undefined, 2)}
      </textarea>
    </Match>
  </Switch>
)

render(() => <Navigation />, document.getElementsByTagName('nav')[0])
render(() => <Content />, document.getElementsByTagName('main')[0])
