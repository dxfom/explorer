import cheetahGrid from 'cheetah-grid'
import { Message } from 'cheetah-grid/ts-types'

cheetahGrid.themes.setDefault(cheetahGrid.themes.BASIC.extends({
  borderColor: '#ccc',
  frozenRowsBorderColor: '#ccc',
  font: `13px ${getComputedStyle(document.documentElement).fontFamily}`,
}))

export const renderDataTable = <T, C>(
  parentElement: HTMLElement,
  filterInputElement: HTMLInputElement,
  columns: C[],
  records: T[],
  cellContentSelector: (column: C) => (record: T) => string | undefined,
  messageSelector?: (column: C) => undefined | ((record: T) => undefined | Message),
) => {
  const grid = new cheetahGrid.ListGrid({
    parentElement,
    header: columns.map(code => ({
      field: cellContentSelector(code),
      message: messageSelector?.(code) as (record: T) => Message,
      caption: String(code),
      columnType: 'multilinetext',
      style: {
        textOverflow: 'ellipsis',
      },
    })),
    records,
    frozenColCount: 1,
    defaultColWidth: 120,
    defaultRowHeight: 30,
  })
  filterInputElement.placeholder = 'filter'
  filterInputElement.addEventListener('input', function () {
    const filteringText = this.value.toLowerCase()
    if (filteringText) {
      grid.records = records.filter(record => columns.some(column => cellContentSelector(column)(record)?.toLowerCase().includes(filteringText)))
    } else {
      grid.records = records
    }
  })
}
