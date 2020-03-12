import { parseDxfFileBlob } from '@dxfom/dxf'
import { onDragDrop } from './onDragDrop'
import { render } from './render'

onDragDrop(document.body, file => {
  const startedAt = performance.now()
  parseDxfFileBlob(file, (error, dxf) => {
    const completedAt = performance.now()
    if (error) {
      console.error(file.name, (completedAt - startedAt) + ' [ms]', error)
      alert('エラーが発生しました。')
    } else {
      console.debug(file.name, (completedAt - startedAt) + ' [ms]')
      render({ filename: file.name, dxf: dxf || {}, activeSectionName: 'PREVIEW' })
    }
  })
})
