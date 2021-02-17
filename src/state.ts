import { DxfReadonly } from '@dxfom/dxf'
import { createSignal } from 'solid-js'

export const [filename, setFilename] = createSignal('')
export const [dxf, setDxf] = createSignal<DxfReadonly>({})
export const [activeSectionName, setActiveSectionName] = createSignal<'' | 'PREVIEW' | 'DXF' | 'JSON' | keyof DxfReadonly>('')
