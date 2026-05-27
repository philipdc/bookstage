# BookStage User Getting Started

BookStage is a workbench for preparing accounting documents before they are loaded into TurboCASH. The first working area is the Bank screen, where bank statements are imported, checked, allocated, and prepared for a TurboCASH input batch.

This guide uses the demo data shipped with BookStage.

## Demo Data

BookStage ships demo TurboCASH books and workbench folders so you can try the program without using live client data.

The active demo workbench is:

```text
books\4-EN-SOUTH-AFRICA-GENERIC
```

This folder contains:

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

`books.fdb` is the TurboCASH Firebird database. `workbench.sqlite` is the BookStage workbench database used to store BookStage staging data, such as imported bank rows.

The demo bank statement files are in:

```text
books\4-EN-SOUTH-AFRICA-GENERIC\Bank Statements
```

Current example folders include:

```text
Bank Statements\absa
Bank Statements\firstnational
Bank Statements\nedbank
Bank Statements\paypal
```

These files are intended for testing import behaviour. They are not live banking data.

BookStage also ships clean template books in:

```text
bin\repository\4-DIGIT-BOOKS
```

These are source templates and examples. Normal users should start with the workbenches shown on the Open screen.

## Starting BookStage

Start BookStage from the Electron application. In a development folder this is usually:

```text
dist-electron\win-unpacked\BookStage.exe
```

When BookStage opens, use the left menu to go to the Open screen.

## Opening A Demo Workbench

On the Open screen:

1. Select `4-EN-SOUTH-AFRICA-GENERIC`.
2. Click `Open`, or double-click the workbench row.
3. BookStage reads the linked TurboCASH `books.fdb`.
4. The main pane shows the company data and lookup lists from TurboCASH.

If TurboCASH or another program has opened the Firebird book in a way that prevents BookStage from reading it, BookStage will show an error. If the book is available in normal Firebird multi-user mode, BookStage will read it.

## Understanding A Workbench

A BookStage workbench is a folder that contains:

- The TurboCASH book file, if linked locally.
- A BookStage SQLite database.
- Subfolders for incoming and supporting documents.

Think of a workbench as the electronic version of a lever arch file. It holds the documents and staging data that help prepare entries before they go into TurboCASH.

## Bank Screen Overview

After opening a workbench, go to the Bank screen.

At the top of the Bank screen:

- The current workbench name is shown.
- The bank account dropdown lists the bank accounts from TurboCASH.
- Changing the bank account refreshes the transaction list for that bank.
- The setup button stores the bank's import folder, opening balance, start date, icon, and input batch.

The transaction grid is a staging area. It is not the final TurboCASH transaction table.

## Bank Setup

Use `Setup` before importing statements for a bank.

Setup stores:

- Bank account.
- Input Batch.
- Starting date.
- Opening balance.
- Incoming statement folder.
- Bank icon.

The incoming statement folder is important. If you later browse to a file in another folder, BookStage will warn you. This helps prevent importing PayPal, ABSA, FNB, or Nedbank files into the wrong bank account.

## Importing Demo Bank Statements

On the Bank screen:

1. Choose the bank account at the top.
2. Click `Setup` and check the incoming statement folder.
3. Click `Import`.
4. Click `Browse`.
5. Choose a demo statement file from the matching bank folder.
6. Click `Open` in the import dialog.
7. Review the preview grid.
8. Click `Import all`, or `Import new only` if duplicates are detected.

BookStage currently supports CSV, OFX, OFC, QIF, OMC, and text-like statement files. PDF/OCR parsing is reserved for a later pass.

## PayPal CSV Files

PayPal statement CSV files can have a different structure from normal bank CSV files. BookStage looks for PayPal-style columns such as `Net`, `Gross`, and `Fee` to calculate the transaction amount.

If a PayPal import shows `0.00` amounts, check that the file has recognizable amount columns and that the file has not been exported in an unusual layout.

## Selecting And Editing Transactions

The square at the left of each row selects a transaction.

You can:

- Select one row.
- Select multiple rows.
- Use the top square to select or clear all visible rows.
- Delete selected rows.
- Use the date filter to work with a smaller range.

If no rows are selected and you click `Delete`, BookStage asks whether you want to delete all visible rows.

## Checking Balances

Use `Check` to compare the running balance against:

```text
previous balance + current transaction amount
```

Rows that do not balance are highlighted. This helps confirm that the imported list still matches the original bank statement.

## Account Allocation

The `Account allocation` column links a bank row to a TurboCASH account, debtor, creditor, or stock item.

The dropdown can be searched by keyboard:

- Press a number to move to the first matching account code.
- Press a letter to move to the first matching description.
- Click a row to select it.

The `Tax` column has its own dropdown and only offers TurboCASH tax accounts. It can be left empty.

## Loading To TurboCASH

The Bank screen has two load options:

1. Save a tab-delimited file for TurboCASH import.
2. Queue the rows for direct input batch loading.

The tab-delimited export is generated by BookStage in the TurboCASH import format. This format is sensitive, so do not edit the exported file unless you know the required column order.

Direct input batch loading is still being developed. BookStage currently confirms the selected input batch and row count, but does not yet post transactions directly into TurboCASH.

## Safe Testing

When learning BookStage:

- Use the shipped demo workbench.
- Do not use live client data for first tests.
- Keep backups of any TurboCASH books before testing direct database operations.
- Treat the Bank screen as a preprocessor and review stage, not as final posting.

The intended workflow is:

```text
Open workbench
Choose bank
Setup import folder
Import statement
Review rows
Check balances
Allocate accounts and tax
Export or load to input batch
Review in TurboCASH
Post from TurboCASH
```

