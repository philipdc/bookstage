const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (React UI)
// All calls go through IPC — renderer never touches Node directly
const api = {
  getAccounts: (companyPath) => ipcRenderer.invoke('db:getAccounts', companyPath),
  getBankAccounts: (companyPath) => ipcRenderer.invoke('db:getBankAccounts', companyPath),
  getTaxAccounts: (companyPath) => ipcRenderer.invoke('db:getTaxAccounts', companyPath),
  getBatchTypes: (companyPath) => ipcRenderer.invoke('db:getBatchTypes', companyPath),
  getCompanyName: (companyPath) => ipcRenderer.invoke('db:getCompanyName', companyPath),
  getSetting:  (key)         => ipcRenderer.invoke('settings:get', key),
  setSetting:  (key, value)  => ipcRenderer.invoke('settings:set', key, value),
  listWorkbenches: () => ipcRenderer.invoke('workbenches:list'),
  getRecentWorkbenches: () => ipcRenderer.invoke('workbenches:recent'),
  openWorkbench: (workbenchPath) => ipcRenderer.invoke('workbenches:open', workbenchPath),
  purgeWorkbench: (workbenchPath) => ipcRenderer.invoke('workbenches:purge', workbenchPath),
  addExistingWorkbench: (workbenchPath) => ipcRenderer.invoke('workbenches:addExisting', workbenchPath),
  createWorkbench: (details) => ipcRenderer.invoke('workbenches:create', details),
  deleteWorkbench: (workbenchPath, options) => ipcRenderer.invoke('workbenches:delete', workbenchPath, options),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectBankStatement: (defaultPath) => ipcRenderer.invoke('dialog:selectBankStatement', defaultPath),
  listHelpDocs: () => ipcRenderer.invoke('help:listDocs'),
  readHelpDoc: (name) => ipcRenderer.invoke('help:readDoc', name),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  parseBankStatement: (filePath) => ipcRenderer.invoke('bank:parseStatement', filePath),
  saveBankImport: (details) => ipcRenderer.invoke('bank:saveImport', details),
  listBankTransactions: (workbenchPath, bankCode) => ipcRenderer.invoke('bank:listTransactions', workbenchPath, bankCode),
  saveBankExport: (defaultName, text) => ipcRenderer.invoke('bank:saveExport', defaultName, text),
};

contextBridge.exposeInMainWorld('bookStageAPI', api);
contextBridge.exposeInMainWorld('tcAPI', api);
