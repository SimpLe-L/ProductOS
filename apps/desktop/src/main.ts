import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CreateWorkspaceRequest,
  type MvpArtifactType,
  type RunAgentRequest,
} from "./shared.js";
import { DesktopService } from "./desktop-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let desktopService: DesktopService;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "OpenFounder",
    backgroundColor: "#f7f4ec",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on("before-input-event", (event, input) => {
    const opensDevTools =
      input.key === "F12" ||
      (input.key.toLowerCase() === "i" && input.alt && (input.meta || input.control));

    if (opensDevTools) {
      event.preventDefault();
      window.webContents.openDevTools({ mode: "detach" });
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  const rendererPath = path.join(__dirname, "renderer/index.html");
  await window.loadFile(rendererPath);
}

app.whenReady().then(async () => {
  desktopService = new DesktopService({
    workspaceBaseDir: path.join(app.getPath("userData"), "workspaces"),
  });
  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpc(): void {
  ipcMain.handle("workspace:list", () => desktopService.listWorkspaces());

  ipcMain.handle("workspace:open", (_event, id: string) => desktopService.openWorkspace(id));

  ipcMain.handle("workspace:load", () => desktopService.loadWorkspace());

  ipcMain.handle("workspace:create", (_event, input: CreateWorkspaceRequest) =>
    desktopService.createWorkspace(input),
  );

  ipcMain.handle("artifact:save", (_event, input: { type: MvpArtifactType; content: string }) =>
    desktopService.saveArtifact(input.type, input.content),
  );

  ipcMain.handle("agent:run", (_event, input: RunAgentRequest) => desktopService.runAgent(input));

  ipcMain.handle("agent:run-chain", () => desktopService.runMvpChain());
}
