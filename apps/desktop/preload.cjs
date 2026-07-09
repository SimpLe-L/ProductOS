const { contextBridge, ipcRenderer } = require("electron");

const api = {
  listWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  openWorkspace: (id) => ipcRenderer.invoke("workspace:open", id),
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  createWorkspace: (input) => ipcRenderer.invoke("workspace:create", input),
  renameWorkspace: (input) => ipcRenderer.invoke("workspace:rename", input),
  deleteWorkspace: (id) => ipcRenderer.invoke("workspace:delete", id),
  saveArtifact: (type, content) => ipcRenderer.invoke("artifact:save", { type, content }),
  getProviderConfig: () => ipcRenderer.invoke("provider:get"),
  setProviderConfig: (config) => ipcRenderer.invoke("provider:set", config),
  checkProviderHealth: () => ipcRenderer.invoke("provider:health"),
  getVerificationConfig: () => ipcRenderer.invoke("verification:get"),
  setVerificationConfig: (config) => ipcRenderer.invoke("verification:set", config),
  readRun: (fileName) => ipcRenderer.invoke("run:read", fileName),
  readLog: (fileName) => ipcRenderer.invoke("log:read", fileName),
  runAgent: (input) => ipcRenderer.invoke("agent:run", input),
  runPlanning: () => ipcRenderer.invoke("agent:run-planning"),
  runMvpChain: () => ipcRenderer.invoke("agent:run-chain"),
  cancelAgentRun: () => ipcRenderer.invoke("agent:cancel"),
  onAgentRunEvent: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("agent:stream", handler);
    return () => ipcRenderer.off("agent:stream", handler);
  },
};

contextBridge.exposeInMainWorld("openFounder", api);
