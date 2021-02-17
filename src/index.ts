import { parseDxfFileArrayBuffer } from '@dxfom/dxf'
import { batch } from 'solid-js'
import { onDragDrop } from './onDragDrop'
import './render'
import { setActiveSectionName, setDxf, setFilename } from './state'

onDragDrop(document.body, file => {
  const startedAt = performance.now()
  void file.arrayBuffer().then(arrayBuffer => {
    const dxf = parseDxfFileArrayBuffer(arrayBuffer)
    const completedAt = performance.now()
    console.debug(file.name, `${completedAt - startedAt} [ms]`)
    batch(() => {
      setFilename(file.name)
      setDxf(dxf)
      setActiveSectionName('PREVIEW')
    })
  })
})
