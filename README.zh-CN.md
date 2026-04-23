# Flowy Todo

[中文](./README.zh-CN.md) | [English](./README.md)

一个基于 AutoHotkey v2 和 WebView2 的轻量桌面专注待办工具。

它把任务管理、1 小时专注计时、日报记录和每日统计放进了同一个桌面应用里。

---

## 项目简介

Flowy Todo 是一个面向个人专注工作流的桌面小工具，当前主要包含：

- 待办任务管理
- 按任务启动的 1 小时专注计时
- 每日专注统计
- 日报编写与归档
- AHK 后端与 WebView2 前端联动

应用由 AutoHotkey v2 负责桌面宿主、计时逻辑和本地持久化，界面由 `UI.html + app.js` 渲染。

## 功能特性

- 新建任务并按分类管理
- 将任务标记为完成 / 进行中
- 为指定任务启动专注计时
- 暂停 / 继续当前计时
- 查看每日专注时长与完整专注块进度
- 编写、保存、查看日报
- 浏览历史日报归档
- 运行数据与源码仓库分离存放

## 技术栈

- AutoHotkey v2
- Microsoft Edge WebView2
- HTML / CSS / JavaScript

## 项目结构

```text
todo-list/
|- FlowyTodo.ahk          # 桌面宿主、计时逻辑、数据桥接
|- UI.html                # 前端界面
|- app.js                 # 前端交互与状态逻辑
|- 20260121190440.jpg     # 完成专注后的提示图片
`- ahk2_lib/              # 当前项目所需的最小依赖集合
   |- JSON.ahk
   |- ComVar.ahk
   |- Promise.ahk
   `- WebView2/
```

## 运行环境

运行前请确保本机已安装：

1. AutoHotkey v2
2. Microsoft Edge WebView2 Runtime

## 启动方式

可以直接运行：

```powershell
FlowyTodo.ahk
```

或者在资源管理器中双击 `FlowyTodo.ahk`，前提是 `.ahk` 已正确关联到 AutoHotkey v2。

## 快捷键

- `Ctrl+F1`：显示主任务界面
- `Ctrl+F2`：暂停 / 继续当前专注计时
- `Ctrl+F3`：打开统计界面

## 数据目录

应用运行数据存放在仓库外：

```text
F:\A_phD\git_proj\FocusData
```

其中主要包含：

- `todo_state.json`：当前任务状态
- `focus_log.csv`：专注记录日志
- `Reports/`：日报 Markdown 文件
- `WebView2UserData/`：WebView2 运行时数据

这些内容属于本地运行数据，不建议提交到 GitHub。

## 实现说明

- 计时器的真实状态由 AHK 后端维护
- 前端启动后会主动向后端恢复当前计时状态
- 日报按日期保存为 Markdown 文件，例如：

```text
Reports/2026-04-23.md
```

## Git 说明

当前仓库包含：

- 应用源码
- 运行所需的最小 `ahk2_lib` 子集

当前仓库不包含：

- 本地运行数据
- WebView2 用户数据
- 日志、临时文件、编辑器噪音文件

可参考：

- [.gitignore](./.gitignore)
- [.gitattributes](./.gitattributes)
