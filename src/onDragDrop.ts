export const onDragDrop = (element: HTMLElement, listener: (file: File) => unknown) => {
  let dragEnter = false

  element.addEventListener('dragenter', () => {
    dragEnter = true
    element.classList.add('dragging')
  })

  element.addEventListener('dragover', event => {
    dragEnter = false
    const dataTransfer = event.dataTransfer
    if (dataTransfer) {
      const items = dataTransfer.items
      if (items.length === 1 && items[0].kind === 'file') {
        dataTransfer.dropEffect = 'copy'
        event.stopPropagation()
        event.preventDefault()
      }
    }
  })

  element.addEventListener('dragleave', () => {
    if (!dragEnter) {
      element.classList.remove('dragging')
    }
  })

  element.addEventListener('drop', event => {
    event.stopPropagation()
    event.preventDefault()
    element.classList.remove('dragging')
    const dataTransfer = event.dataTransfer
    if (dataTransfer) {
      listener(dataTransfer.files[0])
    }
  })
}
