export const onDragDrop = (element: HTMLElement, listener: (file: File) => unknown) => {
  let dragEnter = false

  element.addEventListener('dragenter', () => {
    dragEnter = true
    element.classList.add('dragging')
  })

  element.addEventListener('dragover', event => {
    event.preventDefault()
    dragEnter = false
    const dataTransfer = event.dataTransfer
    if (dataTransfer) {
      if (
        (dataTransfer.types.length === 1 && dataTransfer.types[0] === 'Files') || 
        (dataTransfer.items && dataTransfer.items.length === 1 && dataTransfer.items[0].kind === 'file')
      ) {
        dataTransfer.dropEffect = 'copy'
      } else {
        dataTransfer.dropEffect = 'none'
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
