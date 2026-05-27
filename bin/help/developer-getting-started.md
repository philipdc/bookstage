# BookStage Developer Getting Started

BookStage is an Electron + React desktop application that acts as a pre-accounting workbench for TurboCASH. It prepares, validates, stages, and exports accounting data before it is loaded into TurboCASH.

The current working area is the Bank workflow.

## Project Layout

Important folders:

```text
src
src\components
server
server\db
lib\electron
bin
bin\docs\schema
bin\help
bin\images
bin\repository
books
dist
dist-electron
```

Main responsibilities:

```text
src\components
React screens and UI components.

server\db
Node-side database access for SQLite, Firebird, workbenches, and bank imports.

lib\electron
Electron main process and preload IPC bridge.

bin\docs\schema
Extracted TurboCASH schema documentation.

bin\help
User and developer help documents.

books
Demo workbenches and demo TurboCASH books shipped with the app.

bin\repository
Template/source TurboCASH books and repository examples.
```

## Running The App

From the project root:

```text
npm install
npm run dev
```

The dev script starts Vite and Electron together:

```text
vite
electron .
```

To build the unpacked Electron app:

```text
npm run build
```

The build output is:

```text
dist-electron\win-unpacked
```

The development executable is:

```text
dist-electron\win-unpacked\BookStage.exe
```

If the build fails with `Access is denied` for `BookStage.exe`, the app is probably still running. Close BookStage and rebuild.

## Runtime Architecture

BookStage has four main layers:

```text
React UI
Electron preload API
Electron main process
Node database modules
```

The renderer does not access Node directly. React calls functions exposed by:

```text
lib\electron\preload.js
```

Those functions call IPC handlers in:

```text
lib\electron\main.js
```

The main process then calls the database modules in:

```text
server\db
```

This keeps file access, Firebird access, SQLite writes, and dialogs out of the renderer.

## Key Technologies

BookStage currently uses:

```text
Electron
React
Vite
node-firebird
better-sqlite3
electron-builder
```

`node-firebird` reads TurboCASH `books.fdb` files.

`better-sqlite3` stores BookStage's own local settings, workbench profiles, audit rows, packets, and bank import staging data.

## Main Entry Points

Electron starts here:

```text
lib\electron\main.js
```

The preload bridge is here:

```text
lib\electron\preload.js
```

The main React screen shell is under:

```text
src\components
```

Important current components:

```text
src\components\OpenWorkbench.jsx
src\components\BankWorkbench.jsx
src\components\ScreenPage.jsx
```

## TurboCASH Schema

The extracted TurboCASH schema is stored here:

```text
bin\docs\schema\books-schema.md
bin\docs\schema\books-schema.json
```

Use these files before writing Firebird queries. They are the local reference for table names, column names, and relationships in `books.fdb`.

Common TurboCASH tables currently used or inspected:

```text
ACCOUNT
BANK
BATTYPES
DEBTOR
CREDITOR
STOCK
TAX
SYSVARS
PERIODS
```

The current Firebird access layer is:

```text
server\db\firebird.js
```

It provides functions such as:

```text
getAccounts
getBankAccounts
getTaxAccounts
getBatchTypes
getCompanyName
getCompanyDetails
getReportingDates
getDebtors
getCreditors
getStockItems
```

When supporting older or newer TurboCASH books, prefer fallback query lists. Some tables use different description column names, for example `SDESCRIPTION` versus `SUIDESCRIPTION`.

## Data Locations

### Demo Books

The current shipped demo workbench is:

```text
books\4-EN-SOUTH-AFRICA-GENERIC
```

It contains:

```text
books.fdb
workbench.sqlite
Bank Statements
Documents
Tax Returns
Debtors Reconciliations
Creditors Reconciliations
Supporting Documents
```

### Repository Templates

Template/source books are in:

```text
bin\repository\4-DIGIT-BOOKS
```

Examples include:

```text
4-AF-SUID-AFRIKA-GENERIES
4-EN-SOUTH-AFRICA-GENERIC
4-EN-UK-GENERIC
```

### BookStage Application SQLite

The central BookStage SQLite database is created by:

```text
server\db\sqlite.js
```

In development it defaults to:

```text
bookstage.sqlite
```

In a packaged Electron app it is placed beside the executable:

```text
dist-electron\win-unpacked\bookstage.sqlite
```

This database stores global BookStage data such as settings, workbench profiles, open audit rows, workbench packets, and imported bank staging rows.

### Workbench SQLite

Each workbench may also contain:

```text
workbench.sqlite
```

This is intended for workbench-local packets and folder metadata.

## Workbench Flow

The Open screen is implemented in:

```text
src\components\OpenWorkbench.jsx
```

Its Node-side logic is in:

```text
server\db\workbenches.js
```

Opening a workbench:

1. Finds or creates the workbench profile.
2. Finds the linked TurboCASH `books.fdb`.
3. Reads company details and lookup lists from Firebird.
4. Saves an open packet to SQLite.
5. Saves recent/audit data.
6. Stores the opened workbench in renderer `localStorage` as `bookstage:active-workbench`.

If Firebird cannot retrieve TurboCASH data, the open packet includes an `openError` warning. The UI displays this rather than silently continuing as though all data was loaded.

## Bank Flow

The Bank screen is implemented in:

```text
src\components\BankWorkbench.jsx
```

The bank parser and SQLite staging logic are in:

```text
server\db\bank.js
```

The bank workflow is:

```text
Open workbench
Load bank accounts from TurboCASH BANK table
Select bank account
Load saved staged transactions for that workbench and bank
Import statement
Preview parsed rows
Save imported rows to SQLite
Allocate account and tax
Check balances
Export tab-delimited TurboCASH import file
```

Direct Firebird input batch loading is not complete yet. The UI currently confirms the selected input batch and row count, but does not write batch rows into TurboCASH.

Do not write directly to TurboCASH posting/transaction tables until the batch table mapping and validation rules are implemented and tested.

## Bank Import Parsers

The current parser supports:

```text
CSV
OFX
OFC
QIF
OMC
TXT-like delimited files
```

PDF/OCR parsing is accepted as a placeholder but does not yet extract transactions.

Parsing is intentionally staged:

1. Parse source file into normalized rows.
2. Preview the rows.
3. Import into BookStage SQLite staging tables.
4. Allocate accounts and tax.
5. Export or load to TurboCASH input batch.

Do not generate TurboCASH import files directly from a source bank file. Always normalize into the internal transaction shape first.

The normalized bank transaction shape is:

```text
date
description
amount
balance
accountCode
taxCode
status
source
importRef
```

## LLM-Assisted Imports

Bank formats change often. BookStage can use LLMs as an assisted mapping layer, but the final parser and export should remain deterministic.

Recommended pattern:

```text
Unknown bank file
LLM identifies columns and sign rules
BookStage stores a reusable mapping
BookStage deterministic parser reads the file
User reviews preview
BookStage deterministic exporter writes TurboCASH tab format
```

Avoid relying on an LLM to produce the final TurboCASH import file directly inside the app. The TurboCASH format is sensitive and must be reproducible.

## TurboCASH Tab Export

The Bank screen exports a 10-column tab-delimited file for TurboCASH import.

The current export format is:

```text
Reference
Date
Description
Debit account
Credit account
Tax
Amount
False
Empty
Empty
```

Empty tax exports as:

```text
T
```

If an account is not allocated, the account column is exported as an empty value.

The final file generation should remain code-driven, not LLM-driven.

## IPC API

The renderer API is exposed as:

```text
window.bookStageAPI
window.tcAPI
```

Current API functions include:

```text
getAccounts
getBankAccounts
getTaxAccounts
getBatchTypes
getCompanyName
listWorkbenches
getRecentWorkbenches
openWorkbench
purgeWorkbench
addExistingWorkbench
createWorkbench
deleteWorkbench
selectDirectory
selectBankStatement
parseBankStatement
saveBankImport
listBankTransactions
saveBankExport
```

When adding new renderer features, add IPC in this order:

1. Add or update the Node-side function in `server\db`.
2. Add an IPC handler in `lib\electron\main.js`.
3. Expose the function in `lib\electron\preload.js`.
4. Call it from React.

## Packaging Resources

The build includes extra resources from `package.json`:

```text
books
bin/docs/schema
bin/images
bin/help
```

If a runtime file is needed in the packaged app, make sure it is either bundled by Vite or listed in `extraResources`.

## Development Rules Of Thumb

- Keep React UI code in `src\components`.
- Keep database and filesystem code out of the renderer.
- Use IPC for all Node/Electron operations.
- Treat TurboCASH `books.fdb` as the accounting system of record.
- Treat BookStage SQLite as staging and workflow state.
- Read from TurboCASH freely, but write only through explicit, reviewed workflows.
- Prefer fallback Firebird queries when supporting multiple TurboCASH versions.
- Keep final TurboCASH export formats deterministic and testable.

## Useful Commands

Start development app:

```text
npm run dev
```

Build unpacked Electron app:

```text
npm run build
```

Build installer:

```text
npm run dist:installer
```

Run Vite only:

```text
npm run dev:web
```

Preview production web build:

```text
npm run preview
```

