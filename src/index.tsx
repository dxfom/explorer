import { parseDxfFileArrayBuffer } from "@dxfom/dxf";
import { render } from "solid-js/web";
import { Content } from "./components/Content";
import { Navigation } from "./components/Navigation";
import { onDropFile } from "./onDropFile";
import { setActiveSectionName, setDxf } from "./state";

render(() => <Navigation />, document.getElementsByTagName("nav")[0]);
render(() => <Content />, document.getElementsByTagName("main")[0]);

const handleFile = (file: File) => {
  const startedAt = performance.now();
  void file.arrayBuffer().then(arrayBuffer => {
    const dxf = parseDxfFileArrayBuffer(arrayBuffer);
    const completedAt = performance.now();
    console.debug(file.name, `${completedAt - startedAt} [ms]`);
    document.getElementsByTagName("h2")[0].textContent = file.name;
    setActiveSectionName("");
    setDxf(dxf);
    setActiveSectionName("PREVIEW");
  });
};

onDropFile(document.body, handleFile);

// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/launch/launch_queue.idl
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => unknown): void;
}

// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/launch/launch_params.idl
interface LaunchParams {
  readonly targetURL: string;
  readonly files: readonly (FileSystemFileHandle | FileSystemDirectoryHandle)[];
}

declare global {
  interface Window {
    readonly launchQueue?: LaunchQueue | undefined;
  }
}

window.launchQueue?.setConsumer(async ({ files }) => {
  if (files.length === 1 && files[0].kind === "file") {
    handleFile(await files[0].getFile());
  }
});
