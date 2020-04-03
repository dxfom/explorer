/* eslint @typescript-eslint/camelcase: ["error", { allow: ["^WIP_"] }] */
import { DXF_COLOR_HSL } from '@dxfom/color/hsl'
import { createDxfFileString, Dxf, DxfRecordReadonly, getGroupCodeValue, getGroupCodeValues } from '@dxfom/dxf'
import { createSvgString } from '@dxfom/svg'
import { parseDxfTextContent } from '@dxfom/text'
import { html, render as _render } from 'lit-html'
import { repeat } from 'lit-html/directives/repeat'
import 'svg-pan-zoom-container'
import { renderDataTable } from './renderDataTable'

const identity = <T>(x: T) => x

let state = {
  filename: '',
  dxf: {} as Dxf,
  activeSectionName: '' as '' | 'PREVIEW' | 'DXF' | 'JSON' | keyof Dxf,
}

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

const collectCodes = (records: readonly DxfRecordReadonly[]) => {
  const codes: number[] = []
  for (const record of records) {
    for (const [code] of record) {
      codes.includes(code) || codes.push(code)
    }
  }
  return codes.sort((a, b) => a - b)
}

const renderDefaultSectionContent = (tableContainerElement: HTMLElement, filterInputElement: HTMLInputElement, section: Dxf['ENTITIES']) => {
  if (Array.isArray(section)) {
    renderDataTable(
      tableContainerElement,
      filterInputElement,
      collectCodes(section),
      section,
      code => record => record.filter(([n]) => n === code).map(([, value]) => value).join('\n'),
      code => code !== 1 ? undefined : record => {
        const value = getGroupCodeValue(record, 1)
        if (!value) {
          return
        }
        switch (getGroupCodeValue(record, 0)) {
          case 'TEXT': {
            const text = parseDxfTextContent(value).map(({ text }) => text).join('')
            return text === value ? undefined : ({ type: 'info', message: text })
          }
          case 'MTEXT': {
            const formattedText = getGroupCodeValues(record, 3).join('') + value
            // todo
            const text = formattedText
            return text === value ? undefined : ({ type: 'info', message: text })
          }
        }
      },
    )
  }
}

const renderHeaderOrClassesSectionContent = (
  parentElement: HTMLElement,
  section: Dxf['HEADER' | 'CLASSES'],
  nameGroupCode: number,
) => {
  if (section) {
    const filterInputElement = parentElement.appendChild(document.createElement('input'))
    const tableContainerElement = parentElement.appendChild(document.createElement('article'))
    tableContainerElement.style.height = `calc(100% - ${ filterInputElement.offsetHeight + 4 }px - 1em)`
    renderDataTable(
      tableContainerElement,
      filterInputElement,
      [nameGroupCode, ...collectCodes(Object.values(section) as DxfRecordReadonly[])],
      Object.entries(section),
      code => code === nameGroupCode ? ([name]) => name : ([name]) => getGroupCodeValue(section[name], code),
    )
  }
}

const resolveColorIndex = (index: number | string | undefined) => {
  const [h, s, l] = DXF_COLOR_HSL[index as number & string] ?? [0, 0, 50]
  return `hsl(${h},${s}%,${l * .8 + 20}%)`
}

const renderSectionContent = (parentElement: HTMLElement) => {
  parentElement.innerHTML = ''
  if (!state.activeSectionName) {
    return
  }
  const { dxf, activeSectionName } = state
  switch (activeSectionName) {
    case 'PREVIEW': {
      const svgString = createSvgString(state.dxf, { resolveColorIndex })
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
    case 'HEADER':
      return renderHeaderOrClassesSectionContent(parentElement, dxf[activeSectionName], 9)
    case 'CLASSES':
      return renderHeaderOrClassesSectionContent(parentElement, dxf[activeSectionName], 1)
    case 'OBJECTS':
      if (dxf[activeSectionName]) {
        const sectionElement = parentElement.appendChild(document.createElement('section'))
        for (const record of dxf[activeSectionName]!) {
          sectionElement.appendChild(document.createElement('h3')).textContent = getGroupCodeValue(record, 0)!
          const table = sectionElement.appendChild(document.createElement('article')).appendChild(document.createElement('table'))
          for (const [code, value] of record) {
            const row = table.insertRow()
            row.insertCell().textContent = code as number & string
            row.insertCell().textContent = value
          }
        }
      }
      break
    case 'TABLES':
    case 'BLOCKS':
      if (dxf[activeSectionName]) {
        const sectionElement = parentElement.appendChild(document.createElement('section'))
        const filterContainerElement = sectionElement.appendChild(document.createElement('div'))
        filterContainerElement.className = 'filter-input-container'
        const filterInputElement = filterContainerElement.appendChild(document.createElement('input'))
        sectionElement.style.paddingTop = `calc(${filterInputElement.offsetHeight + 4}px + 1em)`
        for (const name in dxf[activeSectionName]) {
          sectionElement.appendChild(document.createElement('h3')).textContent = name
          const tableContainerElement = sectionElement.appendChild(document.createElement('article'))
          tableContainerElement.tabIndex = 0
          tableContainerElement.style.display = 'flex'
          tableContainerElement.style.maxHeight = '30vh'
          renderDefaultSectionContent(tableContainerElement, filterInputElement, dxf[activeSectionName]![name])
        }
      }
      break
    case 'ACDSDATA':
      if (dxf[activeSectionName]) {
        const sectionElement = parentElement.appendChild(document.createElement('section'))
        const filterContainerElement = sectionElement.appendChild(document.createElement('div'))
        filterContainerElement.className = 'filter-input-container'
        const filterInputElement = filterContainerElement.appendChild(document.createElement('input'))
        sectionElement.style.paddingTop = `calc(${filterInputElement.offsetHeight + 4}px + 1em)`
        for (const records of dxf[activeSectionName]!) {
          const tableContainerElement = sectionElement.appendChild(document.createElement('article'))
          tableContainerElement.tabIndex = 0
          tableContainerElement.style.display = 'flex'
          tableContainerElement.style.maxHeight = '30vh'
          renderDefaultSectionContent(tableContainerElement, filterInputElement, records)
        }
      }
      break
    default:
      if (dxf[activeSectionName]) {
        const filterInputElement = parentElement.appendChild(document.createElement('input'))
        const tableContainerElement = parentElement.appendChild(document.createElement('article'))
        tableContainerElement.style.height = `calc(100% - ${ filterInputElement.offsetHeight + 4 }px - 1em)`
        renderDefaultSectionContent(tableContainerElement, filterInputElement, dxf[activeSectionName])
      }
      break
  }
}

const navElement = document.getElementsByTagName('nav')[0]
const contentElement = document.getElementsByTagName('main')[0]

export function render(_state: typeof state) {
  state = _state
  renderNavigation(navElement)
  renderSectionContent(contentElement)
  const start = performance.now()
  setTimeout(() => console.log(`Rendering takes ${performance.now() - start} [ms]`))
}
