import { DxfReadonly, DxfRecordReadonly, getGroupCodeValue, getGroupCodeValues } from '@dxfom/dxf'
import { parseDxfTextContent } from '@dxfom/text'
import { renderDataTable } from './renderDataTable'

const collectCodes = (records: readonly DxfRecordReadonly[]) => {
  const codes: number[] = []
  for (const record of records) {
    for (const [code] of record) {
      codes.includes(code) || codes.push(code)
    }
  }
  return codes.sort((a, b) => a - b)
}

const renderHeaderOrClassesSectionContent = (
  parentElement: HTMLElement,
  section: DxfReadonly['HEADER' | 'CLASSES'],
  nameGroupCode: number,
) => {
  if (section) {
    const filterInputElement = parentElement.appendChild(document.createElement('input'))
    const tableContainerElement = parentElement.appendChild(document.createElement('div'))
    tableContainerElement.style.height = `calc(100% - ${filterInputElement.offsetHeight + 4}px - 1em)`
    renderDataTable(
      tableContainerElement,
      filterInputElement,
      [nameGroupCode, ...collectCodes(Object.values(section) as DxfRecordReadonly[])],
      Object.entries(section),
      code => (code === nameGroupCode ? ([name]) => name : ([name]) => getGroupCodeValue(section[name], code)),
    )
  }
}

const renderDefaultSectionContent = (
  tableContainerElement: HTMLElement,
  filterInputElement: HTMLInputElement,
  records: readonly DxfRecordReadonly[] | undefined,
) => {
  if (!Array.isArray(records)) {
    return
  }
  renderDataTable<DxfRecordReadonly, number>(
    tableContainerElement,
    filterInputElement,
    collectCodes(records),
    records,
    code => record =>
      record
        .filter(([n]) => n === code)
        .map(([, value]) => value)
        .join('\n'),
    code =>
      code !== 1
        ? undefined
        : record => {
            const value = getGroupCodeValue(record, 1)
            if (!value) {
              return
            }
            switch (getGroupCodeValue(record, 0)) {
              case 'TEXT': {
                const text = parseDxfTextContent(value)
                  .map(({ text }) => text)
                  .join('')
                return text === value ? undefined : { type: 'info', message: text }
              }
              case 'MTEXT': {
                const formattedText = getGroupCodeValues(record, 3).join('') + value
                // todo
                const text = formattedText
                return text === value ? undefined : { type: 'info', message: text }
              }
            }
          },
  )
}

export const renderSectionContent = (parentElement: HTMLElement, dxf: DxfReadonly, sectionName: keyof DxfReadonly) => {
  switch (sectionName) {
    case 'HEADER':
      return renderHeaderOrClassesSectionContent(parentElement, dxf[sectionName], 9)
    case 'CLASSES':
      return renderHeaderOrClassesSectionContent(parentElement, dxf[sectionName], 1)
    case 'OBJECTS':
      if (dxf[sectionName]) {
        for (const record of dxf[sectionName]!) {
          parentElement.appendChild(document.createElement('h3')).textContent = getGroupCodeValue(record, 0)!
          const table = parentElement.appendChild(document.createElement('article')).appendChild(document.createElement('table'))
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
      if (dxf[sectionName]) {
        const filterContainerElement = parentElement.appendChild(document.createElement('div'))
        filterContainerElement.className = 'filter-input-container'
        const filterInputElement = filterContainerElement.appendChild(document.createElement('input'))
        let first = 1
        for (const name in dxf[sectionName]) {
          const subheaderElement = parentElement.appendChild(document.createElement('h3'))
          subheaderElement.textContent = name
          if (first) {
            first = 0
            subheaderElement.style.marginTop = `calc(${filterInputElement.offsetHeight + 4}px + 1em)`
          }
          const tableContainerElement = parentElement.appendChild(document.createElement('article'))
          tableContainerElement.tabIndex = 0
          tableContainerElement.style.display = 'flex'
          tableContainerElement.style.maxHeight = '30vh'
          renderDefaultSectionContent(tableContainerElement, filterInputElement, dxf[sectionName]![name])
        }
      }
      break
    case 'ACDSDATA':
      if (dxf[sectionName]) {
        const filterContainerElement = parentElement.appendChild(document.createElement('div'))
        filterContainerElement.className = 'filter-input-container'
        const filterInputElement = filterContainerElement.appendChild(document.createElement('input'))
        let first = 1
        for (const records of dxf[sectionName]!) {
          const tableContainerElement = parentElement.appendChild(document.createElement('article'))
          if (first) {
            first = 0
            tableContainerElement.style.marginTop = `calc(${filterInputElement.offsetHeight + 4}px + 1em)`
          }
          tableContainerElement.tabIndex = 0
          tableContainerElement.style.display = 'flex'
          tableContainerElement.style.maxHeight = '30vh'
          renderDefaultSectionContent(tableContainerElement, filterInputElement, records)
        }
      }
      break
    default:
      if (dxf[sectionName]) {
        const filterInputElement = parentElement.appendChild(document.createElement('input'))
        const tableContainerElement = parentElement.appendChild(document.createElement('div'))
        tableContainerElement.style.height = `calc(100% - ${filterInputElement.offsetHeight + 4}px - 1em)`
        renderDefaultSectionContent(tableContainerElement, filterInputElement, dxf[sectionName])
      }
      break
  }
}
