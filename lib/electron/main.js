const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { getAccounts, getBankAccounts, getTaxAccounts, getBatchTypes, getCompanyName } = require('../../server/db/firebird');
const { getSetting, setSetting } = require('../../server/db/sqlite');
const { listWorkbenches, getRecentWorkbenches, openWorkbench, purgeWorkbench, addWorkbenchProfile, createWorkbench, deleteWorkbench } = require('../../server/db/workbenches');
const { parseBankStatement, saveBankImport, listBankTransactions } = require('../../server/db/bank');

const isDev = !app.isPackaged;
const VITE_PORT = 5173;
const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, 'bin/images/BSlogo.jpg')
  : path.join(__dirname, '../../bin/images/BSlogo.jpg');

function getRuntimeRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '../..');
}

function getHelpDir() {
  return path.join(getRuntimeRoot(), 'bin', 'help');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: 'BookStage',
    icon: appIcon,
  });

  if (isDev) {
    win.loadURL(`http://localhost:${VITE_PORT}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

// IPC handlers — UI calls these via window.tcAPI
ipcMain.handle('db:getAccounts', async (_event, companyPath) => {
  return getAccounts(companyPath);
});

ipcMain.handle('db:getBankAccounts', async (_event, companyPath) => {
  return getBankAccounts(companyPath);
});

ipcMain.handle('db:getTaxAccounts', async (_event, companyPath) => {
  return getTaxAccounts(companyPath);
});

ipcMain.handle('db:getBatchTypes', async (_event, companyPath) => {
  return getBatchTypes(companyPath);
});

ipcMain.handle('db:getCompanyName', async (_event, companyPath) => {
  return getCompanyName(companyPath);
});

ipcMain.handle('settings:get', async (_event, key) => {
  return getSetting(key);
});

ipcMain.handle('settings:set', async (_event, key, value) => {
  return setSetting(key, value);
});

ipcMain.handle('workbenches:list', async () => {
  return listWorkbenches();
});

ipcMain.handle('workbenches:recent', async () => {
  return getRecentWorkbenches();
});

ipcMain.handle('workbenches:open', async (_event, workbenchPath) => {
  return openWorkbench(workbenchPath);
});

ipcMain.handle('workbenches:purge', async (_event, workbenchPath) => {
  return purgeWorkbench(workbenchPath);
});

ipcMain.handle('workbenches:addExisting', async (_event, workbenchPath) => {
  return addWorkbenchProfile(workbenchPath);
});

ipcMain.handle('workbenches:create', async (_event, details) => {
  return createWorkbench(details);
});

ipcMain.handle('workbenches:delete', async (_event, workbenchPath, options) => {
  return deleteWorkbench(workbenchPath, options);
});

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select BookStage workbench folder',
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:selectBankStatement', async (_event, defaultPath = '') => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Select bank statement',
    defaultPath: defaultPath || undefined,
    filters: [
      { name: 'Bank statements', extensions: ['csv', 'ofx', 'ofc', 'qif', 'omc', 'txt', 'pdf'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('help:listDocs', async () => {
  const helpDir = getHelpDir();
  if (!fs.existsSync(helpDir)) return [];
  return fs.readdirSync(helpDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      title: name.replace(/\.md$/i, '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));
});

ipcMain.handle('help:readDoc', async (_event, name) => {
  const safeName = path.basename(String(name || ''));
  if (!safeName.toLowerCase().endsWith('.md')) throw new Error('Only Markdown help files can be opened.');
  const filePath = path.join(getHelpDir(), safeName);
  if (!fs.existsSync(filePath)) throw new Error(`Help file was not found: ${safeName}`);
  return fs.readFileSync(filePath, 'utf8');
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
  const target = String(url || '');
  if (!/^https?:\/\//i.test(target)) throw new Error('Only web links can be opened externally.');
  await shell.openExternal(target);
  return true;
});

ipcMain.handle('bank:parseStatement', async (_event, filePath) => {
  return parseBankStatement(filePath);
});

ipcMain.handle('bank:saveImport', async (_event, details) => {
  return saveBankImport(details);
});

ipcMain.handle('bank:listTransactions', async (_event, workbenchPath, bankCode) => {
  return listBankTransactions(workbenchPath, bankCode);
});

ipcMain.handle('bank:saveExport', async (_event, defaultName, text) => {
  const result = await dialog.showSaveDialog({
    title: 'Save TurboCASH bank import file',
    defaultPath: defaultName || 'bookstage-bank-import.csv',
    filters: [
      { name: 'Tab delimited import', extensions: ['csv', 'txt'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, text, 'utf8');
  return result.filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
