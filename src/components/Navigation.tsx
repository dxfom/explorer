import { For, Show } from 'solid-js'
import { activeSectionName, dxf, filteringText, setActiveSectionName, setFilteringText } from '../state'

const NavigationItem = ({ sectionName }: { sectionName: string }) => (
  <label>
    <input
      type="radio"
      name="section"
      hidden
      value={sectionName}
      checked={activeSectionName() === sectionName}
      onChange={event =>
        event.currentTarget.checked && setActiveSectionName(event.currentTarget.value as ReturnType<typeof activeSectionName>)
      }
    />
    <span>{sectionName}</span>
  </label>
)

export const Navigation = () => (
  <Show when={activeSectionName()}>
    <Show when={['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(activeSectionName())}>
      <input
        placeholder="filter"
        value={filteringText()}
        onInput={event => setFilteringText(event.currentTarget.value)}
        class="border-b border-hex-ccc text-sm leading-none px-2 py-0.5"
      />
    </Show>
    <div class="flex-auto" />
    <NavigationItem sectionName="PREVIEW" />
    <NavigationItem sectionName="DXF" />
    <NavigationItem sectionName="JSON" />
    <For each={Object.keys(dxf())}>{sectionName => <NavigationItem sectionName={sectionName} />}</For>
  </Show>
)
