import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateWorkspaceRequest,
  DesktopApi,
  MvpArtifactType,
  RunAgentRequest,
} from "./shared.js";

const api: DesktopApi = {
  listWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  openWorkspace: (id: string) => ipcRenderer.invoke("workspace:open", id),
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  createWorkspace: (input: CreateWorkspaceRequest) => ipcRenderer.invoke("workspace:create", input),
  saveArtifact: (type: MvpArtifactType, content: string) =>
    ipcRenderer.invoke("artifact:save", { type, content }),
  runAgent: (input: RunAgentRequest) => ipcRenderer.invoke("agent:run", input),
  runMvpChain: () => ipcRenderer.invoke("agent:run-chain"),
};

contextBridge.exposeInMainWorld("openFounder", api);
