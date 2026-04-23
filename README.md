# Flowy Todo

[中文](./README.zh-CN.md) | [English](./README.md)

A lightweight desktop focus todo app built with AutoHotkey v2 and WebView2.

It combines task management, a 1-hour focus timer, daily reports, and daily statistics in one desktop workflow.

---

## Overview

Flowy Todo is a small desktop productivity tool for a personal focus workflow.  
It currently includes:

- task management
- a 1-hour focus timer bound to a task
- daily statistics
- daily report writing and archive browsing
- an AutoHotkey backend with a WebView2-based frontend

The desktop shell, timer logic, and persistence layer are implemented in AutoHotkey v2, while the UI is rendered through `UI.html + app.js`.

## Features

- Create and organize tasks by category
- Mark tasks as active or completed
- Start a focus session for a selected task
- Pause and resume the active timer
- View daily focus duration and full-session progress
- Write, save, and review daily reports
- Browse archived reports
- Keep runtime data separated from the source repository

## Tech Stack

- AutoHotkey v2
- Microsoft Edge WebView2
- HTML / CSS / JavaScript

## Project Structure

```text
todo-list/
|- FlowyTodo.ahk          # Desktop host, timer logic, persistence bridge
|- UI.html                # Frontend UI
|- app.js                 # Frontend behavior and state logic
|- 20260121190440.jpg     # Completion prompt image
`- ahk2_lib/              # Minimal dependency subset required by this project
   |- JSON.ahk
   |- ComVar.ahk
   |- Promise.ahk
   `- WebView2/
```

## Requirements

Before running the app, make sure you have:

1. AutoHotkey v2 installed
2. Microsoft Edge WebView2 Runtime available on Windows

## Run

Launch the app with:

```powershell
FlowyTodo.ahk
```

Or double-click `FlowyTodo.ahk` in Windows Explorer after associating `.ahk` files with AutoHotkey v2.

## Hotkeys

- `Ctrl+F1` - show the main task view
- `Ctrl+F2` - pause / resume the active focus timer
- `Ctrl+F3` - open the stats view

## Runtime Data

The application stores runtime data outside this repository:

```text
F:\A_phD\git_proj\FocusData
```

This directory mainly contains:

- `todo_state.json` - current task state
- `focus_log.csv` - focus session logs
- `Reports/` - daily report files in Markdown
- `WebView2UserData/` - WebView2 runtime data

These files are local runtime data and should not be committed to GitHub.

## Notes

- The timer state is owned by the AutoHotkey backend.
- The frontend restores timer state from the backend after reload.
- Daily reports are saved as Markdown files named by date, for example:

```text
Reports/2026-04-23.md
```

## Git Notes

This repository includes:

- source code
- the minimal `ahk2_lib` subset required to run the app

This repository excludes:

- local runtime data
- WebView2 user data
- logs, temporary files, and editor noise

See:

- [.gitignore](./.gitignore)
- [.gitattributes](./.gitattributes)
