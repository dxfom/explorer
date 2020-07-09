import 'clusterize.js/clusterize.css'
import Clusterize from 'clusterize.js'
import { escapeHtml } from './escapeHtml'

interface Message {
  type: "error" | "info" | "warning"
  message: string | null
}

export const renderDataTable = <T, C extends string | number>(
  parentElement: HTMLElement,
  filterInputElement: HTMLInputElement,
  columns: readonly C[],
  records: readonly T[],
  cellContentSelector: (column: C) => (record: T) => string | undefined,
  messageSelector?: (column: C) => undefined | ((record: T) => undefined | Message),
) => {
  parentElement.innerHTML = `
<div class="clusterize">
  <div class="clusterize-header-scroll">
    <table><thead></thead></table>
  </div>
  <div class="clusterize-scroll">
    <table><tbody class="clusterize-content"></tbody></table>
  </div>
</div>
`

  const scrollBody = parentElement.getElementsByClassName('clusterize-scroll')[0]
  {
    const scrollHead = parentElement.getElementsByClassName('clusterize-header-scroll')[0]
    scrollBody.addEventListener('scroll', function (this: typeof scrollBody) { scrollHead.scrollLeft = this.scrollLeft })
  }

  const headRow = parentElement.getElementsByTagName('thead')[0].insertRow()
  for (const column of columns) {
    headRow.appendChild(document.createElement('th')).textContent = column as string
  }

  const tbody = parentElement.getElementsByTagName('tbody')[0]

  const cellContentSelectors = columns.map(column => [cellContentSelector(column), messageSelector?.(column)] as const)
  const rows = records.map(record =>
    `<tr>${
      cellContentSelectors
        .map(([cell, message]) => {
          const title = message?.(record)?.message
          return `<td${title ? ' title="' + escapeHtml(title) + '"' : ''}>${cell(record) || ''}</td>`
        })
        .join('')
    }</tr>`
  )

  const clusterize = new Clusterize({
    scrollElem: scrollBody,
    contentElem: tbody,
    rows,
    callbacks: {
      clusterChanged() {
        const bodyRow = tbody.querySelector('tr:not(.clusterize-extra-row)') as HTMLTableRowElement
        if (bodyRow.classList.contains('clusterize-no-data')) {
          return
        }
        for (let i = 0; i < headRow.cells.length; i++) {
          headRow.cells[i].style.width = `${bodyRow.cells[i].offsetWidth}px`
        }
      },
    },
  } as any)
  filterInputElement.placeholder = 'filter'
  filterInputElement.addEventListener('input', function () {
    const filteringText = this.value.toLowerCase()
    const filteredRows = filteringText ? rows.filter((_, i) => cellContentSelectors.some(([cell]) => cell(records[i])?.toLowerCase().includes(filteringText))) : rows
    clusterize.update(filteredRows)
  })
}
