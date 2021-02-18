import { createDxfFileString, DxfRecordReadonly, getGroupCodeValue, getGroupCodeValues } from '@dxfom/dxf'
import { Match, Switch } from 'solid-js'
import { For } from 'solid-js/web'
import 'svg-pan-zoom-container'
import { activeSectionName, dxf } from '../state'
import { DataTable } from './DataTable'
import { Preview } from './Preview'

const collectCodes = (records: readonly DxfRecordReadonly[]) => {
  const codes: number[] = []
  for (const record of records) {
    for (const [code] of record) {
      codes.includes(code) || codes.push(code)
    }
  }
  return codes.sort((a, b) => a - b)
}

export const Content = () => (
  <Switch>
    <Match when={!activeSectionName()}>
      <></>
    </Match>
    <Match when={activeSectionName() === 'PREVIEW'}>
      <Preview />
    </Match>
    <Match when={activeSectionName() === 'DXF'}>
      <textarea readonly style="width: 100%; height: 100%; resize: none;">
        {createDxfFileString(dxf())}
      </textarea>
    </Match>
    <Match when={activeSectionName() === 'JSON'}>
      <textarea readonly style="width: 100%; height: 100%; resize: none;">
        {JSON.stringify(dxf(), undefined, 2)}
      </textarea>
    </Match>
    <Match when={activeSectionName() === 'HEADER'}>
      <DataTable
        columns={[9, ...collectCodes(Object.values(dxf().HEADER!))]}
        records={Object.entries(dxf().HEADER!)}
        tdSelector={groupCode =>
          groupCode === 9 ? ([headerName]) => headerName : ([, record]) => getGroupCodeValues(record, groupCode).join('\n')
        }
      />
    </Match>
    <Match when={activeSectionName() === 'CLASSES'}>
      <DataTable
        columns={[1, ...collectCodes(Object.values(dxf().CLASSES!))]}
        records={Object.entries(dxf().CLASSES!)}
        tdSelector={groupCode =>
          groupCode === 1 ? ([className]) => className : ([, record]) => getGroupCodeValues(record, groupCode).join('\n')
        }
      />
    </Match>
    <Match when={activeSectionName() === 'TABLES'}>
      <DataTable
        columns={['TABLE', ...collectCodes(Object.values(dxf().TABLES!).flat())]}
        records={Object.entries(dxf().TABLES!).flatMap(([name, records]) => records.map(record => [name, record] as const))}
        tdSelector={groupCode =>
          groupCode === 'TABLE' ? ([name]) => name : ([, record]) => getGroupCodeValues(record, groupCode).join('\n')
        }
      />
    </Match>
    <Match when={activeSectionName() === 'BLOCKS'}>
      <DataTable
        columns={['BLOCK', ...collectCodes(Object.values(dxf().BLOCKS!).flat())]}
        records={Object.entries(dxf().BLOCKS!).flatMap(([name, records]) => records.map(record => [name, record] as const))}
        tdSelector={groupCode =>
          groupCode === 'BLOCK' ? ([name]) => name : ([, record]) => getGroupCodeValues(record, groupCode).join('\n')
        }
      />
    </Match>
    <Match when={activeSectionName() === 'ENTITIES'}>
      <DataTable
        columns={collectCodes(dxf().ENTITIES!)}
        records={dxf().ENTITIES!}
        tdSelector={groupCode => record => getGroupCodeValues(record, groupCode).join('\n')}
      />
    </Match>
    <Match when={activeSectionName() === 'OBJECTS'}>
      <section style="height: 100%; overflow: auto; padding: .5em 1em;">
        <For each={dxf().OBJECTS!}>
          {record => [
            <h3>{getGroupCodeValue(record, 0)}</h3>,
            <table style="margin-bottom: 1em;">
              <tbody>
                <For each={record}>
                  {([groupCode, value]) => (
                    <tr>
                      <td style="text-align: right">{groupCode}</td>
                      <td>{value}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>,
          ]}
        </For>
      </section>
    </Match>
    <Match when={activeSectionName() === 'ACDSDATA'}>
      <section style="height: 100%; overflow: auto; padding: 1em;">
        <For each={dxf().ACDSDATA!}>
          {records => (
            <div style="margin-bottom: 1em">
              <DataTable
                columns={collectCodes(records)}
                records={records}
                tdSelector={groupCode => record => getGroupCodeValues(record, groupCode).join('\n')}
              />
            </div>
          )}
        </For>
      </section>
    </Match>
  </Switch>
)
