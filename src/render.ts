import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { createDxfFileString, DxfReadonly } from '@dxfom/dxf'
import { createSvgString, DxfFont } from '@dxfom/svg'
import { html, render as _render } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat'
import 'svg-pan-zoom-container'
import { renderSectionContent } from './renderSectionContent'

const textDecoder = new TextDecoder('ms932')

let state = {
  filename: '',
  dxf: {} as DxfReadonly,
  activeSectionName: '' as '' | 'PREVIEW' | 'DXF' | 'JSON' | keyof DxfReadonly,
}

const identity = <T>(x: T) => x

const onChangeActiveSection = (event: Event) => render({
  ...state,
  activeSectionName: (event.target as HTMLInputElement).value as typeof state.activeSectionName,
})
const renderNavigationItem = (sectionName: string) => html`
  <label>
    <input
      type="radio"
      name="section"
      hidden
      value=${sectionName}
      .checked=${state.activeSectionName === sectionName}
      @change=${onChangeActiveSection}
    >
    <span>${sectionName}</span>
  </label>
`

const renderNavigation = (parentElement: HTMLElement) =>
  _render(
    html`
      <h2 style="flex: auto; font-size: 100%;">${state.filename}</h2>
      ${renderNavigationItem('PREVIEW')}
      ${renderNavigationItem('DXF')}
      ${renderNavigationItem('JSON')}
      ${repeat(Object.keys(state.dxf), identity, renderNavigationItem)}
    `,
    parentElement,
  )

const resolveColorIndex = (index: number | string | undefined) => {
  const [h, s, l] = DXF_COLOR_HSL[index as number & string] ?? [0, 0, 50]
  return `hsl(${h},${s}%,${l * .8 + 20}%)`
}
const resolveFont = (font: DxfFont) => ({ ...font, family: font.family + ',var(--font-family)' })

const renderTabContent = (parentElement: HTMLElement) => {
  parentElement.innerHTML = ''
  if (!state.activeSectionName) {
    return
  }
  const { dxf, activeSectionName } = state
  switch (activeSectionName) {
    case 'PREVIEW': {
      const svgString = createSvgString(state.dxf, { resolveColorIndex, resolveFont, encoding: textDecoder })
      parentElement.innerHTML = `
        <div data-zoom-on-wheel="max-scale: 10000" data-pan-on-drag style="height: 100%">${svgString}</div>
        <a target=_blank href="data:image/svg+xml,${encodeURIComponent(svgString)}" style="position: absolute; right: 16px; top: 8px">SVG File</a>
        <div style="pointer-events: none; position: absolute; right: 16px; bottom: 8px; text-align: right; color: #ddd; text-shadow: 0 1px #123,0 -1px #123,1px 0 #123,-1px 0 #123,0 0 4px #123"></div>
      `
      const coordinateElement = parentElement.lastElementChild!
      const svg = parentElement.getElementsByTagName('svg')[0]
      const bbox = svg.getBBox()
      svg.setAttribute('viewBox', `${bbox.x - 10} ${bbox.y - 10} ${bbox.width + 20} ${bbox.height + 20}`)
      svg.onpointermove = ({ currentTarget, clientX, clientY }) => {
        const svg = currentTarget as SVGSVGElement
        const { x, y } = Object.assign(svg.createSVGPoint(), { x: clientX, y: clientY }).matrixTransform(svg.getScreenCTM()!.inverse())
        coordinateElement.textContent = `${Math.round(x)}, ${Math.round(-y)}`
      }
      svg.onpointerleave = () => coordinateElement.textContent = ''
      return
    }
    case 'DXF':
      return parentElement.innerHTML = `<textarea readonly style="width: 100%; height: 100%; resize: none;">${createDxfFileString(state.dxf)}</textarea>`
    case 'JSON':
      return parentElement.innerHTML = `<textarea readonly style="width: 100%; height: 100%; resize: none;">${JSON.stringify(state.dxf, undefined, 2)}</textarea>`
    default:
      return renderSectionContent(parentElement, dxf, activeSectionName)
  }
}

const navElement = document.getElementsByTagName('nav')[0]
const contentElement = document.getElementsByTagName('main')[0]

export function render(_state: typeof state) {
  state = _state
  renderNavigation(navElement)
  renderTabContent(contentElement)
  const start = performance.now()
  setTimeout(() => console.log(`Rendering takes ${performance.now() - start} [ms]`))
}
