import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  CreateWorkspaceRequest,
  DesktopApi,
  DesktopAgentRunEvent,
  DesktopProviderConfig,
  DesktopVerificationConfig,
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
  getProviderConfig: () => ipcRenderer.invoke("provider:get"),
  setProviderConfig: (config: DesktopProviderConfig) => ipcRenderer.invoke("provider:set", config),
  checkProviderHealth: () => ipcRenderer.invoke("provider:health"),
  getVerificationConfig: () => ipcRenderer.invoke("verification:get"),
  setVerificationConfig: (config: DesktopVerificationConfig) => ipcRenderer.invoke("verification:set", config),
  readRun: (fileName: string) => ipcRenderer.invoke("run:read", fileName),
  readLog: (fileName: string) => ipcRenderer.invoke("log:read", fileName),
  runAgent: (input: RunAgentRequest) => ipcRenderer.invoke("agent:run", input),
  runPlanning: () => ipcRenderer.invoke("agent:run-planning"),
  runMvpChain: () => ipcRenderer.invoke("agent:run-chain"),
  onAgentRunEvent: (listener: (event: DesktopAgentRunEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: DesktopAgentRunEvent) => listener(payload);
    ipcRenderer.on("agent:stream", handler);
    return () => ipcRenderer.off("agent:stream", handler);
  },
};

contextBridge.exposeInMainWorld("openFounder", api);
