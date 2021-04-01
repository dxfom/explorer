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
        style="border: none; border-bottom: 1px solid #ccc; font-size: 0.875em; padding: .125rem .5rem"
      />
    </Show>
    <div class="flex-auto" />
    <NavigationItem sectionName="PREVIEW" />
    <NavigationItem sectionName="DXF" />
    <NavigationItem sectionName="JSON" />
    <For each={Object.keys(dxf())}>{sectionName => <NavigationItem sectionName={sectionName} />}</For>
  </Show>
)
