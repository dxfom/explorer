import { parseDxfFileArrayBuffer } from '@dxfom/dxf'
import { batch } from 'solid-js'
import { render } from 'solid-js/web'
import { Content } from './components/Content'
import { Navigation } from './components/Navigation'
import { onDragDrop } from './onDragDrop'
import { setActiveSectionName, setDxf } from './state'

render(() => <Navigation />, document.getElementsByTagName('nav')[0])
render(() => <Content />, document.getElementsByTagName('main')[0])

onDragDrop(document.body, file => {
  const startedAt = performance.now()
  void file.arrayBuffer().then(arrayBuffer => {
    const dxf = parseDxfFileArrayBuffer(arrayBuffer)
    const completedAt = performance.now()
    console.debug(file.name, `${completedAt - startedAt} [ms]`)
    document.getElementsByTagName('h2')[0].textContent = file.name
    batch(() => {
      setDxf(dxf)
      setActiveSectionName('PREVIEW')
    })
  })
})
