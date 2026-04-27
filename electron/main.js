const path = require("path");
const { app, BrowserWindow, shell } = require("electron");

const { startServer } = require(path.join(__dirname, "..", "server"));

let mainWindow = null;
let serverHandle = null;

async function ensureServer() {
  if (serverHandle) {
    return serverHandle;
  }

  serverHandle = await startServer(0);
  return serverHandle;
}

async function createMainWindow() {
  const { url } = await ensureServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#09111f",
    autoHideMenuBar: true,
    show: false,
    title: "Business Idea Pitcher",
    webPreferences: {
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    void shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

async function bootstrapDesktopApp() {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}

function closeServer() {
  if (!serverHandle?.server) {
    return;
  }

  serverHandle.server.close();
  serverHandle = null;
}

app.whenReady().then(bootstrapDesktopApp).catch((error) => {
  console.error(
    "Failed to launch Business Idea Pitcher desktop app:",
    error instanceof Error ? error.message : String(error),
  );
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeServer();
});
