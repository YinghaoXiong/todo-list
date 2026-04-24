#Requires AutoHotkey v2.0
#SingleInstance Force

#Include ahk2_lib\WebView2\WebView2.ahk
#Include ahk2_lib\JSON.ahk

Persistent()
SetWorkingDir(A_ScriptDir)

app := FlowyApp()
app.Run()

class FlowyApp {
    __New() {
        this.wtsSessionChangeMsg := 0x02B1
        this.wtsSessionLock := 0x7
        this.appTitle := ""
        appTitle := this.GetTodayTitle()
        this.gui := Gui("+Resize", appTitle)
        this.gui.MarginX := 0
        this.gui.MarginY := 0
        this.gui.BackColor := "FFFFFF"
        this.gui.OnEvent("Close", this.OnClose.Bind(this))
        this.gui.OnEvent("Size", this.OnSize.Bind(this))

        this.wv := 0
        this.lastScheduleMinute := ""
        this.host := this.gui.AddText("x0 y0 w400 h600")
        this.api := FlowyAPI()
        this.api.AttachGui(this.gui)

        A_IconTip := appTitle
        A_TrayMenu.Add("Show Flowy Todo", this.ShowMain.Bind(this))
        A_TrayMenu.Add()
        A_TrayMenu.Add("Exit", (*) => ExitApp())

        Hotkey("^F1", this.ShowTaskView.Bind(this))
        Hotkey("^F2", this.api.TogglePause.Bind(this.api))
        Hotkey("^F3", this.ShowStatsView.Bind(this))

        OnMessage(this.wtsSessionChangeMsg, this.OnSessionChange.Bind(this))
        try DllCall("wtsapi32\WTSRegisterSessionNotification", "ptr", this.gui.Hwnd, "uint", 0)

        this.RefreshDateTitle()
        SetTimer(this.RefreshDateTitle.Bind(this), 60 * 1000)
        SetTimer(this.CheckDailySchedule.Bind(this), 60 * 1000)
    }

    Run() {
        this.gui.Show("w400 h600")

        try {
            dllPath := this.ResolveWebView2Loader()
            userDataDir := this.GetDataDir() "\WebView2UserData"
            DirCreate(userDataDir)

            this.wvc := WebView2.CreateControllerAsync(this.host.Hwnd, 0, userDataDir, "", dllPath).await2()
            this.wv := this.wvc.CoreWebView2
            this.api.AttachWebView(this.wv)

            settings := this.wv.Settings
            settings.AreDefaultContextMenusEnabled := false
            settings.AreDevToolsEnabled := false

            this.wv.AddHostObjectToScript("ahk", this.BuildBridge())
            this.domToken := this.wv.DOMContentLoaded(this.OnDOMContentLoaded.Bind(this))
            this.wv.Navigate(this.ResolveIndexUri())
        } catch Error as e {
            MsgBox("WebView2 initialization failed:`n" e.Message "`n`n" e.Extra, "Flowy Todo Pro", "Iconx")
            ExitApp()
        }
    }

    OnSize(guiObj, minMax, width, height) {
        if (minMax = -1)
            return

        try {
            this.host.Move(0, 0, width, height)
            this.wvc.Fill()
        }
    }

    OnClose(*) {
        this.gui.Hide()
        return true
    }

    OnSessionChange(wParam, lParam, msg, hwnd) {
        if (hwnd != this.gui.Hwnd)
            return
        if (wParam = this.wtsSessionLock)
            this.api.CancelTimerOnSessionLock()
    }

    ShowMain(*) {
        this.gui.Show()
        try WinRestore("ahk_id " this.gui.Hwnd)
        try WinActivate("ahk_id " this.gui.Hwnd)
    }

    ShowTaskView(*) {
        this.ShowMain()
        if this.wv
            try this.wv.ExecuteScriptAsync("window.showTaskViewFromAhk && window.showTaskViewFromAhk();")
    }

    ShowStatsView(*) {
        this.ShowMain()
        if this.wv
            try this.wv.ExecuteScriptAsync("window.openStatsFromAhk && window.openStatsFromAhk();")
    }

    GetTodayTitle() {
        return FormatTime(A_Now, "M/d") " Todo"
    }

    GetDataDir() {
        return A_ScriptDir "\..\FocusData"
    }

    RefreshDateTitle(*) {
        title := this.GetTodayTitle()
        if (title = this.appTitle)
            return

        this.appTitle := title
        A_IconTip := title
        try this.gui.Title := title
        try WinSetTitle(title, "ahk_id " this.gui.Hwnd)
    }

    CheckDailySchedule(*) {
        if !this.wv
            return

        minuteKey := FormatTime(A_Now, "yyyy-MM-dd HH:mm")
        if (minuteKey = this.lastScheduleMinute)
            return
        this.lastScheduleMinute := minuteKey

        if (FormatTime(A_Now, "HHmm") = "2130")
            this.ShowMain()

        try this.wv.ExecuteScriptAsync("window.runScheduledMinuteTasksFromAhk && window.runScheduledMinuteTasksFromAhk();")
    }

    BuildBridge() {
        bridge := {}
        bridge.StartTimer := this.api.StartTimer.Bind(this.api)
        bridge.SaveTaskState := this.api.SaveTaskState.Bind(this.api)
        bridge.GetTodayStats := this.api.GetTodayStats.Bind(this.api)
        bridge.GetStats := this.api.GetStats.Bind(this.api)
        bridge.GetTimerState := this.api.GetTimerState.Bind(this.api)
        bridge.SaveDailyReport := this.api.SaveDailyReport.Bind(this.api)
        bridge.LoadDailyReport := this.api.LoadDailyReport.Bind(this.api)
        bridge.ListDailyReports := this.api.ListDailyReports.Bind(this.api)
        bridge.GenerateReport := this.api.GenerateReport.Bind(this.api)
        bridge.TogglePause := this.api.TogglePause.Bind(this.api)
        bridge.CancelTimer := this.api.CancelTimer.Bind(this.api)
        return bridge
    }

    OnDOMContentLoaded(wv, args) {
        this.api.PushStateToUI()
        this.CheckDailySchedule()
    }

    ResolveIndexUri() {
        indexPath := A_ScriptDir "\UI.html"
        if !FileExist(indexPath) {
            FileAppend(this.DefaultIndexHtml(), indexPath, "UTF-8")
        }
        return "file:///" StrReplace(indexPath, "\", "/") "?v=" A_TickCount
    }

    ResolveWebView2Loader() {
        candidates := [
            A_ScriptDir "\WebView2Loader.dll",
            A_ScriptDir "\lib\WebView2\" (A_PtrSize * 8) "bit\WebView2Loader.dll",
            A_ScriptDir "\ahk2_lib\WebView2\" (A_PtrSize * 8) "bit\WebView2Loader.dll"
        ]

        for path in candidates {
            if FileExist(path)
                return path
        }

        throw Error("WebView2Loader.dll was not found. Put it beside FlowyTodo.ahk or under lib/WebView2/64bit or 32bit.")
    }

    DefaultIndexHtml() {
        html := '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        html .= '<meta name="viewport" content="width=device-width,initial-scale=1">'
        html .= '<title>Flowy Todo Pro</title></head><body>'
        html .= '<main id="app"></main><script src="./app.js"></script></body></html>'
        return html
    }
}

class FlowyAPI {
    __New() {
        this.gui := 0
        this.wv := 0
        this.dataDir := A_ScriptDir "\..\FocusData"
        this.reportDir := this.dataDir "\Reports"
        this.statePath := this.dataDir "\todo_state.json"
        this.logPath := this.dataDir "\focus_log.csv"

        this.timerDurationSec := 60 * 60
        this.timerDurationMs := this.timerDurationSec * 1000
        this.timerTaskId := ""
        this.timerStartedAt := 0
        this.timerStartedTick := 0
        this.timerRemainingSec := 0
        this.timerRunning := false
        this.timerPaused := false
        this.pauseStartedTick := 0
        this.totalPausedMs := 0
        this.tickFn := this.TickTimer.Bind(this)
        this.progressGui := 0
        this.progressBar := 0
        this.progressDots := []
        this.currentBarColor := "90EE90"

        this.EnsureStorage()
    }

    AttachGui(guiObj) {
        this.gui := guiObj
    }

    AttachWebView(wv) {
        this.wv := wv
    }

    StartTimer(taskId) {
        try {
            taskId := Trim(String(taskId))
            if (taskId = "")
                throw ValueError("StartTimer requires a non-empty taskId.")

            if this.timerRunning
                throw Error("A focus timer is already running.")

            this.timerTaskId := taskId
            this.timerStartedAt := A_Now
            this.timerStartedTick := A_TickCount
            this.totalPausedMs := 0
            this.pauseStartedTick := 0
            this.timerPaused := false
            this.timerRemainingSec := this.timerDurationSec
            this.timerRunning := true
            this.currentBarColor := "90EE90"

            SetTimer(this.tickFn, 100)
            this.HideMainWindow()
            this.ShowTimerOverlay()
            this.ShowPrettyAlert("Focus started", "25-minute focus mode is running.")
            this.CallJS("window.updateTimerProgress", 0, false)
            return this.Ok("timer-started")
        } catch Error as e {
            return this.Fail(e)
        }
    }

    TogglePause(*) {
        try {
            if !this.timerRunning {
                this.ShowPrettyAlert("Flowy Todo Pro", "No active focus timer.")
                return this.Ok("no-active-timer")
            }

            if !this.timerPaused {
                this.timerPaused := true
                this.pauseStartedTick := A_TickCount
                SetTimer(this.tickFn, 0)
                if this.progressBar
                    try this.progressBar.Opt("c808080")
                this.ShowPrettyAlert("Focus paused", "Press Ctrl+F2 to continue.")
                return this.Ok("paused")
            }

            this.timerPaused := false
            this.totalPausedMs += A_TickCount - this.pauseStartedTick
            this.pauseStartedTick := 0
            if this.progressBar
                try this.progressBar.Opt("c" this.currentBarColor)
            SetTimer(this.tickFn, 100)
            this.ShowPrettyAlert("Focus resumed", "Timer continues.")
            return this.Ok("resumed")
        } catch Error as e {
            return this.Fail(e)
        }
    }

    CancelTimer(taskId := "") {
        try {
            result := this.StopActiveTimer(taskId, "stopped", false)
            if !result["ok"]
                throw Error(result["message"])

            minutes := result["minutes"]
            this.ShowPrettyAlert("Focus stopped", "Recorded " minutes " minutes before stopping.")
            return this.Ok("cancelled:" minutes)
        } catch Error as e {
            return this.Fail(e)
        }
    }

    CancelTimerOnSessionLock() {
        result := this.StopActiveTimer("", "locked", false)
        if result["ok"] && result["minutes"] > 0
            TrayTip("Focus stopped because Windows was locked.", "Flowy Todo Pro", 16)
        return result["ok"]
    }

    StopActiveTimer(taskId := "", outcome := "stopped", showUiSync := true) {
        if !this.timerRunning
            return Map("ok", true, "minutes", 0, "message", "no-active-timer")

        taskId := Trim(String(taskId))
        if (taskId != "" && String(taskId) != String(this.timerTaskId))
            return Map("ok", false, "minutes", 0, "message", "This task is not the active focus timer.")

        activeTaskId := this.timerTaskId
        elapsedMs := this.GetElapsedMs()
        minutes := elapsedMs > 0 ? Max(1, Ceil(elapsedMs / 60000)) : 0

        SetTimer(this.tickFn, 0)
        this.timerRunning := false
        this.timerPaused := false
        this.timerTaskId := ""
        this.timerRemainingSec := 0
        this.pauseStartedTick := 0
        this.totalPausedMs := 0
        this.DestroyTimerOverlay()

        if (minutes > 0) {
            this.AppendFocusLog(activeTaskId, minutes, outcome)
            this.AddFocusMinutes(activeTaskId, minutes)
            if showUiSync
                this.PushStateToUI()
            else
                try this.PushStateToUI()
        }

        this.CallJS("window.updateTimerProgress", 0, false)
        return Map("ok", true, "minutes", minutes, "message", "")
    }

    SaveTaskState(jsonString := "[]") {
        try {
            jsonString := String(jsonString)
            this.ValidateTaskStateJson(jsonString)
            this.WriteTextAtomic(this.statePath, jsonString)
            return this.Ok("saved")
        } catch Error as e {
            return this.Fail(e)
        }
    }

    GetTodayStats() {
        try {
            return this.Ok(this.BuildStatsJson(FormatTime(A_Now, "yyyy-MM-dd")))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    GetStats(date := "") {
        try {
            date := this.NormalizeDate(date)
            return this.Ok(this.BuildStatsJson(date))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    GetTimerState() {
        try {
            elapsedMs := this.timerRunning ? this.GetElapsedMs() : 0
            percent := this.timerRunning ? Min(100, Round(elapsedMs * 100 / this.timerDurationMs, 2)) : 0
            return this.Ok(JSON.stringify(Map(
                "running", this.timerRunning,
                "paused", this.timerPaused,
                "taskId", this.timerTaskId,
                "percent", percent
            )))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    SaveDailyReport(date := "", content := "") {
        try {
            date := this.NormalizeDate(date)

            path := this.reportDir "\" date ".md"
            this.WriteTextAtomic(path, String(content))
            return this.Ok(path)
        } catch Error as e {
            return this.Fail(e)
        }
    }

    LoadDailyReport(date := "") {
        try {
            date := this.NormalizeDate(date)

            path := this.reportDir "\" date ".md"
            content := FileExist(path) ? FileRead(path, "UTF-8") : ""
            return this.Ok(JSON.stringify(Map("date", date, "content", content)))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    ListDailyReports() {
        try {
            reports := []
            Loop Files this.reportDir "\*.md", "F" {
                SplitPath(A_LoopFileName, , , , &nameNoExt)
                if RegExMatch(nameNoExt, "^\d{4}-\d{2}-\d{2}$")
                    reports.Push(Map("date", nameNoExt, "path", A_LoopFileFullPath))
            }
            return this.Ok(JSON.stringify(reports))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    GenerateReport() {
        try {
            today := FormatTime(A_Now, "yyyy-MM-dd")
            return this.Ok(this.BuildReportDraft(today))
        } catch Error as e {
            return this.Fail(e)
        }
    }

    PushStateToUI() {
        try {
            stateJson := this.ReadTaskState()
            this.CallJS("window.updateUI", stateJson)
        } catch Error as e {
            this.ShowPrettyAlert("State sync failed", e.Message)
        }
    }

    TickTimer() {
        if !this.timerRunning {
            SetTimer(this.tickFn, 0)
            return
        }

        if this.timerPaused
            return

        elapsedMs := this.GetElapsedMs()
        remainingMs := this.timerDurationMs - elapsedMs
        if (remainingMs < 0)
            remainingMs := 0

        this.timerRemainingSec := Ceil(remainingMs / 1000)
        elapsedPercent := Min(100, Round(elapsedMs * 100 / this.timerDurationMs, 2))
        remainingPercent := Min(100, Max(0, remainingMs * 100 / this.timerDurationMs))
        this.UpdateTimerOverlay(remainingPercent)
        this.CallJS("window.updateTimerProgress", elapsedPercent, false)

        if (remainingMs <= 0) {
            SetTimer(this.tickFn, 0)
            this.CompleteTimer()
        }
    }

    CompleteTimer() {
        taskId := this.timerTaskId
        minutes := Round(this.timerDurationSec / 60)

        this.timerRunning := false
        this.timerPaused := false
        this.timerTaskId := ""
        this.timerRemainingSec := 0

        this.DestroyTimerOverlay()
        this.AppendFocusLog(taskId, minutes, "complete")
        this.AddFocusMinutes(taskId, minutes)
        completedCount := this.GetFullSessionCount(FormatTime(A_Now, "yyyy-MM-dd"))
        this.ShowFocusCompleteAlert(minutes, completedCount)
        this.ShowMainWindow()
        this.PushStateToUI()
        this.CallJS("window.updateTimerProgress", 100, false)
    }

    GetElapsedMs() {
        pausedMs := this.totalPausedMs
        if (this.timerPaused && this.pauseStartedTick)
            pausedMs += A_TickCount - this.pauseStartedTick

        elapsedMs := A_TickCount - this.timerStartedTick - pausedMs
        return Max(0, elapsedMs)
    }

    HideMainWindow() {
        if this.gui {
            try this.gui.Hide()
        }
    }

    ShowMainWindow() {
        if this.gui {
            try {
                this.gui.Show()
                WinRestore("ahk_id " this.gui.Hwnd)
                WinActivate("ahk_id " this.gui.Hwnd)
            }
        }
    }

    ShowTimerOverlay() {
        this.DestroyTimerOverlay()

        barWidth := 64
        barHeight := 8
        medalW := Floor(barWidth / 8)
        medalH := barHeight
        progInnerH := 5
        borderSize := 1
        containerH := progInnerH + borderSize * 2
        containerY := medalH
        overlayH := medalH + containerH

        this.progressGui := Gui("+AlwaysOnTop +ToolWindow -Caption +E0x20", "FlowyTimer")
        this.progressGui.MarginX := 0
        this.progressGui.MarginY := 0
        this.progressGui.BackColor := "FF00FF"

        fullSessions := this.GetFullSessionCount(FormatTime(A_Now, "yyyy-MM-dd"))
        Loop 8 {
            xPos := (A_Index - 1) * medalW
            color := A_Index > fullSessions ? "D1D5DB" : A_Index <= 3 ? "7BA7E8" : A_Index <= 6 ? "72D6A4" : "F08A8A"
            dot := this.progressGui.Add("Text", "x" (xPos + 1) " y1 w" (medalW - 2) " h6 Background" color)
            this.progressDots.Push(dot)
        }

        this.progressGui.SetFont("s9", "Microsoft YaHei")
        this.progressGui.Add("Text", "x0 y" containerY " w" barWidth " h" containerH " Background000000")
        this.progressBar := this.progressGui.Add("Progress", "x" borderSize " y" (containerY + borderSize) " w" (barWidth - borderSize * 2) " h" progInnerH " c90EE90 BackgroundE0E0E0 Range0-100", 100)

        screenX := A_ScreenWidth - barWidth
        screenY := A_ScreenHeight - overlayH - 24
        this.progressGui.Show("NoActivate x" screenX " y" screenY " w" barWidth " h" overlayH)
        WinSetTransColor("FF00FF", this.progressGui.Hwnd)
        this.UpdateTimerOverlay(100)
    }

    UpdateTimerOverlay(remainingPercent) {
        if !this.progressGui
            return

        remainingPercent := Max(0, Min(100, remainingPercent + 0))

        targetColor := "90EE90"
        if (this.timerDurationSec >= 35 * 60 && this.timerRemainingSec <= 35 * 60)
            targetColor := "32CD32"
        if (this.timerRemainingSec <= 10 * 60)
            targetColor := "006400"

        if (targetColor != this.currentBarColor) {
            this.currentBarColor := targetColor
            if !this.timerPaused
                try this.progressBar.Opt("c" targetColor)
        }

        try this.progressBar.Value := remainingPercent
        try WinSetAlwaysOnTop(true, this.progressGui.Hwnd)
    }

    DestroyTimerOverlay() {
        if this.progressGui {
            try this.progressGui.Destroy()
        }
        this.progressGui := 0
        this.progressBar := 0
        this.progressDots := []
    }

    AppendFocusLog(taskId, minutes, outcome := "complete") {
        line := FormatTime(A_Now, "yyyy-MM-dd HH:mm:ss") "," this.CsvEscape(taskId) "," minutes "," this.CsvEscape(outcome) "`n"
        FileAppend(line, this.logPath, "UTF-8")
    }

    BuildStatsJson(date) {
        tasks := JSON.parse(this.ReadTaskState(), false, true)
        minutesByTask := this.GetMinutesByTask(date)
        items := []
        total := 0

        for task in tasks {
            id := String(task["id"])
            minutes := minutesByTask.Has(id) ? minutesByTask[id] : 0
            total += minutes
            items.Push(Map(
                "id", id,
                "title", task["title"],
                "category", task["category"],
                "status", task["status"],
                "minutes", minutes,
                "time_spent", task["time_spent"]
            ))
        }

        return JSON.stringify(Map("date", date, "total", total, "full_sessions", this.GetFullSessionCount(date), "items", items))
    }

    GetFullSessionCount(date) {
        count := 0
        if !FileExist(this.logPath)
            return 0

        rows := StrSplit(FileRead(this.logPath, "UTF-8"), "`n", "`r")
        for idx, row in rows {
            row := Trim(row)
            if (idx = 1 || row = "")
                continue
            if (SubStr(row, 1, 10) != date)
                continue

            cols := StrSplit(row, ",")
            if (cols.Length < 4)
                continue
            if (Integer(cols[3]) >= 60 && cols[4] = "complete")
                count += 1
        }
        return Min(8, count)
    }

    BuildReportDraft(date) {
        stats := JSON.parse(this.BuildStatsJson(date), false, true)
        lines := []
        lines.Push("Date: " date)
        lines.Push("")
        lines.Push("Task statistics:")

        if (stats["items"].Length = 0) {
            lines.Push("- No tasks recorded.")
        } else {
            for item in stats["items"] {
                minutes := item["minutes"]
                statusText := item["status"] = "done" ? "completed" : "not completed"
                lines.Push("- " item["title"] ": " minutes " minutes (" statusText ")")
            }
        }

        lines.Push("")
        lines.Push("My notes:")
        lines.Push("")

        report := ""
        for line in lines
            report .= line "`n"
        return report
    }

    GetMinutesByTask(date) {
        minutesByTask := Map()
        if !FileExist(this.logPath)
            return minutesByTask

        rows := StrSplit(FileRead(this.logPath, "UTF-8"), "`n", "`r")
        for idx, row in rows {
            row := Trim(row)
            if (idx = 1 || row = "")
                continue
            if (SubStr(row, 1, 10) != date)
                continue

            cols := StrSplit(row, ",")
            if (cols.Length < 3)
                continue

            taskId := cols[2]
            minutes := Integer(cols[3])
            minutesByTask[taskId] := minutesByTask.Get(taskId, 0) + minutes
        }
        return minutesByTask
    }

    AddFocusMinutes(taskId, minutes) {
        try {
            tasks := JSON.parse(this.ReadTaskState(), false, true)
            for task in tasks {
                if (String(task["id"]) = String(taskId)) {
                    task["time_spent"] := Integer(task["time_spent"]) + minutes
                    if (task["status"] = "todo")
                        task["status"] := "doing"
                    this.WriteTextAtomic(this.statePath, JSON.stringify(tasks))
                    return
                }
            }
        } catch Error {
        }
    }

    EnsureStorage() {
        DirCreate(this.dataDir)
        DirCreate(this.reportDir)

        if !FileExist(this.statePath) {
            FileAppend("[]", this.statePath, "UTF-8")
        } else {
            content := Trim(FileRead(this.statePath, "UTF-8"))
            if (content = "") {
                this.WriteTextAtomic(this.statePath, "[]")
            } else {
                try {
                    this.ValidateTaskStateJson(content)
                } catch Error as e {
                    this.BackupBadStateFile(e.Message)
                    this.WriteTextAtomic(this.statePath, "[]")
                }
            }
        }

        if !FileExist(this.logPath) {
            FileAppend("created_at,task_id,minutes,outcome`n", this.logPath, "UTF-8")
        }
    }

    ReadTaskState() {
        if !FileExist(this.statePath) {
            this.WriteTextAtomic(this.statePath, "[]")
            return "[]"
        }

        content := Trim(FileRead(this.statePath, "UTF-8"))
        if (content = "") {
            this.WriteTextAtomic(this.statePath, "[]")
            return "[]"
        }

        try {
            this.ValidateTaskStateJson(content)
        } catch Error as e {
            this.BackupBadStateFile(e.Message)
            this.WriteTextAtomic(this.statePath, "[]")
            return "[]"
        }

        return content
    }

    BackupBadStateFile(reason) {
        if !FileExist(this.statePath)
            return

        backupPath := this.statePath ".bad-" FormatTime(A_Now, "yyyyMMdd-HHmmss")
        try FileMove(this.statePath, backupPath, true)
        this.ShowPrettyAlert("State file reset", "Invalid todo_state.json was backed up. " reason)
    }

    ValidateTaskStateJson(jsonString) {
        data := JSON.parse(jsonString, false, true)
        if !(data is Array)
            throw TypeError("todo_state.json must be a JSON array.")

        for item in data {
            if !(item is Map)
                throw TypeError("Each task must be a JSON object.")

            for key in ["id", "title", "category", "status", "time_spent"] {
                if !item.Has(key)
                    throw ValueError("Task is missing required field: " key)
            }

            status := item["status"]
            if !(status = "todo" || status = "doing" || status = "done")
                throw ValueError("Invalid task status: " status)
        }
    }

    GetTodayLogMarkdown(today) {
        if !FileExist(this.logPath)
            return "_No records yet_`n"

        rows := StrSplit(FileRead(this.logPath, "UTF-8"), "`n", "`r")
        output := "| Time | Task ID | Minutes |`n| --- | --- | --- |`n"
        count := 0

        for idx, row in rows {
            if (idx = 1 || Trim(row) = "")
                continue
            if (SubStr(row, 1, 10) != today)
                continue

            cols := StrSplit(row, ",")
            if (cols.Length < 3)
                continue

            output .= "| " cols[1] " | " cols[2] " | " cols[3] " |`n"
            count += 1
        }

        return count ? output : "_No records yet_`n"
    }

    CallJS(functionName, value, asString := true) {
        if !this.wv
            return

        argument := asString ? this.JsQuote(value) : this.JsValue(value)
        script := functionName "(" argument ");"
        try this.wv.ExecuteScriptAsync(script)
    }

    JsValue(value) {
        valueType := Type(value)
        if (valueType = "Integer" || valueType = "Float")
            return String(value)
        if (valueType = "String")
            return value
        return JSON.stringify(value)
    }

    JsQuote(value) {
        text := String(value)
        text := StrReplace(text, "\", "\\")
        text := StrReplace(text, '"', '\"')
        text := StrReplace(text, "`r", "\r")
        text := StrReplace(text, "`n", "\n")
        text := StrReplace(text, "`t", "\t")
        return '"' text '"'
    }

    WriteTextAtomic(path, content) {
        SplitPath(path, , &dir)
        DirCreate(dir)

        tmpPath := path ".tmp." A_TickCount
        if FileExist(tmpPath)
            FileDelete(tmpPath)

        FileAppend(content, tmpPath, "UTF-8")
        try {
            FileMove(tmpPath, path, true)
        } catch Error as e {
            if FileExist(tmpPath)
                try FileDelete(tmpPath)
            throw e
        }
    }

    NormalizeDate(date := "") {
        date := Trim(String(date))
        if (date = "")
            date := FormatTime(A_Now, "yyyy-MM-dd")
        if !RegExMatch(date, "^\d{4}-\d{2}-\d{2}$")
            throw ValueError("Invalid date format. Expected YYYY-MM-DD.")
        return date
    }

    CsvEscape(value) {
        value := String(value)
        if RegExMatch(value, '[,"\r\n]')
            return '"' StrReplace(value, '"', '""') '"'
        return value
    }

    ShowPrettyAlert(title, message) {
        TrayTip(message, title, 16)
    }

    ShowFocusCompleteAlert(minutes, completedCount) {
        goalCount := 8
        completedCount := Max(0, Min(goalCount, completedCount + 0))
        message := "Recorded " minutes " minutes.`nThis is completed focus block " completedCount " of " goalCount " today."
        TrayTip(message, "Focus complete", 16)

        try {
            if this.completeAlertGui
                this.completeAlertGui.Destroy()
        }

        alert := Gui("+AlwaysOnTop +ToolWindow", "Focus complete")
        this.completeAlertGui := alert
        alert.BackColor := "FFFFFF"
        alert.MarginX := 14
        alert.MarginY := 14

        imagePath := A_ScriptDir "\20260121190440.jpg"
        if FileExist(imagePath)
            alert.Add("Picture", "w300 h170", imagePath)

        alert.SetFont("s13 w800", "Microsoft YaHei")
        alert.Add("Text", "w300 Center c0F766E", "Focus complete")
        alert.SetFont("s9 w600", "Microsoft YaHei")
        alert.Add("Text", "w300 Center c172033", "Recorded " minutes " minutes.`nThis is completed focus block " completedCount " of " goalCount " today.")

        closeBtn := alert.Add("Button", "x116 w96 h30 Default", "OK")
        closeBtn.OnEvent("Click", (*) => this.CloseFocusCompleteAlert(alert))
        alert.OnEvent("Close", (*) => this.CloseFocusCompleteAlert(alert))
        alert.Show("AutoSize Center")
        SetTimer(() => this.CloseFocusCompleteAlert(alert), -15000)
    }

    CloseFocusCompleteAlert(alert) {
        try alert.Destroy()
        try {
            if (this.completeAlertGui && this.completeAlertGui.Hwnd = alert.Hwnd)
                this.completeAlertGui := 0
        }
    }

    Ok(message := "") {
        return JSON.stringify(Map("ok", JSON.true, "message", message))
    }

    Fail(err) {
        msg := err.Message
        if (err.Extra != "")
            msg .= " " err.Extra
        this.ShowPrettyAlert("Flowy Todo Pro error", msg)
        return JSON.stringify(Map("ok", JSON.false, "message", msg))
    }
}
