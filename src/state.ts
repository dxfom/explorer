import type { DxfReadonly } from "@dxfom/dxf";
import { createSignal } from "solid-js";

export const [dxf, setDxf] = createSignal<DxfReadonly>({});
export const [activeSectionName, setActiveSectionName] = createSignal<"" | "PREVIEW" | "DXF" | "JSON" | keyof DxfReadonly>("");
export const [filteringText, setFilteringText] = createSignal("");
