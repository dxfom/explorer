import Clusterize from 'clusterize.js'
import 'clusterize.js/clusterize.css'
import { createEffect, createMemo, For, JSX } from 'solid-js'
import { filteringText } from '../state'

interface ClusterizedTableOptions<Column extends string | number, RecordData> {
  columns: readonly Column[]
  records: readonly RecordData[]
  tdSelector: (column: Column) => (record: RecordData) => string
}

const tdWrap = (cell: string) => (cell.endsWith('</td>') ? cell : `<td>${cell}</td>`)

export const DataTable: <C extends string | number, T>(options: ClusterizedTableOptions<C, T>) => JSX.Element = ({
  columns,
  records,
  tdSelector,
}) => {
  let scrollHead: HTMLDivElement | undefined
  const tdSelectors = columns.map(column => tdSelector(column))
  const allRows = createMemo(() => records.map(record => `<tr>${tdSelectors.map(selector => tdWrap(selector(record))).join('')}</tr>`))
  const allRowsToSearch = createMemo(() =>
    records.map(record => tdSelectors.map(selector => selector(record)?.toLowerCase() ?? '').join('\n')),
  )
  const filteredRows = createMemo(() => {
    const text = filteringText().toLowerCase()
    return text ? allRows().filter((_, i) => allRowsToSearch()[i].includes(text)) : allRows()
  })
  let element: HTMLDivElement | undefined
  let clusterize: Clusterize | undefined
  createEffect(() => {
    if (clusterize) {
      clusterize.update(filteredRows())
      return
    }
    if (!element) {
      return
    }
    const headRow = element.getElementsByTagName('tr')[0]
    const tbody = element.getElementsByTagName('tbody')[0]
    if (!headRow || !tbody) {
      return
    }
    clusterize = new Clusterize({
      scrollElem: element.getElementsByClassName('clusterize-scroll')[0],
      contentElem: tbody,
      rows: filteredRows(),
      callbacks: {
        clusterChanged() {
          const bodyRow = tbody?.querySelector('tr:not(.clusterize-extra-row)') as HTMLTableRowElement | undefined
          if (!bodyRow || bodyRow.classList.contains('clusterize-no-data')) {
            return
          }
          for (let i = 0; i < headRow.cells.length; i++) {
            headRow.cells[i].style.width = `${bodyRow.cells[i].offsetWidth}px`
          }
        },
      },
    } as any)
  })
  return (
    <div ref={element} class="clusterize">
      <div ref={scrollHead} class="clusterize-header-scroll">
        <table>
          <thead>
            <tr>
              <For each={columns}>{column => <th>{column}</th>}</For>
            </tr>
          </thead>
        </table>
      </div>
      <div class="clusterize-scroll" onScroll={event => scrollHead && (scrollHead.scrollLeft = event.currentTarget.scrollLeft)}>
        <table>
          <tbody class="clusterize-content"></tbody>
        </table>
      </div>
    </div>
  )
}
