import { parseDxfFileArrayBuffer } from '@dxfom/dxf'
import { onDragDrop } from './onDragDrop'
import { render } from './render'

onDragDrop(document.body, file => {
  const startedAt = performance.now()
  file.arrayBuffer().then(arrayBuffer => {
    const dxf = parseDxfFileArrayBuffer(arrayBuffer)
    const completedAt = performance.now()
    console.debug(file.name, (completedAt - startedAt) + ' [ms]')
    render({ filename: file.name, dxf: dxf || {}, activeSectionName: 'PREVIEW' })
  })
})
