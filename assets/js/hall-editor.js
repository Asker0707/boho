"use strict"

/**
 * Редактор схемы зала Бохо.
 * Перетаскивание, изменение размера и поворот элементов, свойства, отмена,
 * автосохранение черновика и сохранение в файл сайта assets/js/hall-layout.js.
 */
;(() => {
    const { TYPES, render, zoneOf, zonesOf, isTable, tableTitle } = window.BohoHall

    const AUTOSAVE_KEY = "boho-hall-editor"
    const DRAFT_KEY = "boho-hall-draft"
    const HISTORY_LIMIT = 100

    const canvas = document.getElementById("canvas")
    const wrap = document.getElementById("canvas-wrap")
    const inspector = document.getElementById("inspector")
    const palette = document.getElementById("palette")
    const statusLine = document.getElementById("status")
    const fileInput = document.getElementById("file-input")
    const saveButton = document.querySelector("[data-act='save']")

    const clone = (value) => JSON.parse(JSON.stringify(value))
    const published = clone(window.BOHO_HALL || { version: 1, width: 1200, height: 800, items: [] })

    let layout = clone(published)
    let selectedId = null
    let history = []
    let future = []
    let gridStep = 10
    let showGrid = true
    let zoom = 1
    let isDirty = false

    /* ---------- Состояние и история ---------- */

    const selected = () => layout.items.find((item) => item.id === selectedId) || null
    const snapshot = () => JSON.stringify(layout)

    const setStatus = (text, tone = "") => {
        statusLine.textContent = text
        statusLine.dataset.tone = tone
    }

    const markDirty = (dirty) => {
        isDirty = dirty
        document.body.classList.toggle("is-dirty", dirty)
        saveButton.textContent = dirty ? "Сохранить •" : "Сохранено"
    }

    const autosave = () => {
        try {
            localStorage.setItem(AUTOSAVE_KEY, snapshot())
        } catch {
            // хранилище недоступно (приватный режим) — работаем без автосохранения
        }
    }

    let lastCommitted = snapshot()
    /** Фиксирует изменение: история для отмены, автосохранение, перерисовка. */
    const commit = () => {
        const current = snapshot()
        if (current === lastCommitted) return
        history.push(lastCommitted)
        if (history.length > HISTORY_LIMIT) history.shift()
        future = []
        lastCommitted = current
        autosave()
        markDirty(true)
        draw()
    }

    const undo = () => {
        if (!history.length) return
        future.push(snapshot())
        layout = JSON.parse(history.pop())
        lastCommitted = snapshot()
        if (!selected()) selectedId = null
        autosave()
        markDirty(true)
        draw()
    }

    const redo = () => {
        if (!future.length) return
        history.push(snapshot())
        layout = JSON.parse(future.pop())
        lastCommitted = snapshot()
        if (!selected()) selectedId = null
        autosave()
        markDirty(true)
        draw()
    }

    /* ---------- Геометрия ---------- */

    const snap = (value, free) => (free ? Math.round(value) : Math.round(value / gridStep) * gridStep)

    const toSvgPoint = (event) => {
        const point = canvas.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        return point.matrixTransform(canvas.getScreenCTM().inverse())
    }

    /** Переводит точку схемы в систему координат элемента (с учётом поворота). */
    const toLocal = (item, point) => {
        const angle = (-(item.r || 0) * Math.PI) / 180
        const dx = point.x - item.x
        const dy = point.y - item.y
        return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) }
    }

    /* ---------- Отрисовка ---------- */

    const drawSelection = (item) => {
        const { svgEl } = window.BohoHall
        const pad = 8
        const group = svgEl("g", { class: "ed-selection", transform: `translate(${item.x} ${item.y}) rotate(${item.r || 0})` }, canvas)
        svgEl("rect", { class: "ed-sel-box", x: -item.w / 2 - pad, y: -item.h / 2 - pad, width: item.w + pad * 2, height: item.h + pad * 2, rx: 6 }, group)
        if (item.locked) return
        svgEl("line", { class: "ed-sel-stem", x1: 0, y1: -item.h / 2 - pad, x2: 0, y2: -item.h / 2 - pad - 26 }, group)
        svgEl("circle", { class: "ed-handle ed-handle--rotate", "data-handle": "rotate", cx: 0, cy: -item.h / 2 - pad - 32, r: 8 }, group)
        svgEl("rect", { class: "ed-handle ed-handle--resize", "data-handle": "resize", x: item.w / 2 + pad - 8, y: item.h / 2 + pad - 8, width: 16, height: 16, rx: 3 }, group)
    }

    const draw = () => {
        render(canvas, layout, { grid: showGrid ? gridStep : 0 })
        canvas.querySelectorAll(".hall-item").forEach((node) => {
            const item = layout.items.find((other) => other.id === node.dataset.id)
            node.classList.toggle("is-selected-edit", node.dataset.id === selectedId)
            node.classList.toggle("is-locked", Boolean(item?.locked))
        })
        const item = selected()
        if (item) drawSelection(item)
        canvas.style.width = `${Math.round(wrap.clientWidth * zoom - 48)}px`
        renderInspector()
        renderStats()
    }

    /* ---------- Палитра ---------- */

    const makePreview = (type) => {
        const spec = TYPES[type]
        const scale = Math.max(spec.w, spec.h)
        const item = { id: "preview", type, x: scale / 2 + 30, y: scale / 2 + 30, w: spec.w, h: spec.h, r: 0, num: "", seats: spec.seats, name: "", color: "#cbbfa9" }
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        render(svg, { width: scale + 60, height: scale + 60, items: [item] })
        svg.querySelector(".hall-floor")?.remove()
        svg.querySelectorAll("text").forEach((text) => text.remove())
        svg.setAttribute("aria-hidden", "true")
        return svg
    }

    const buildPalette = () => {
        const groups = {}
        Object.entries(TYPES).forEach(([type, spec]) => {
            ;(groups[spec.group] ||= []).push([type, spec])
        })
        Object.entries(groups).forEach(([name, entries]) => {
            const section = document.createElement("section")
            section.className = "ed-palette__group"
            section.innerHTML = `<h3>${name}</h3>`
            const grid = document.createElement("div")
            grid.className = "ed-palette__grid"
            entries.forEach(([type, spec]) => {
                const button = document.createElement("button")
                button.type = "button"
                button.className = "ed-tool"
                button.dataset.add = type
                button.title = `Добавить: ${spec.label}`
                button.append(makePreview(type))
                const label = document.createElement("span")
                label.textContent = spec.label
                button.append(label)
                grid.append(button)
            })
            section.append(grid)
            palette.append(section)
        })
    }

    const nextNumber = () => {
        const numbers = layout.items.filter(isTable).map((item) => parseInt(item.num, 10)).filter(Number.isFinite)
        return String(numbers.length ? Math.max(...numbers) + 1 : 1)
    }

    const newId = (type) => `${type.split("-")[0]}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

    const visibleCenter = () => {
        const rect = canvas.getBoundingClientRect()
        const wrapRect = wrap.getBoundingClientRect()
        const cx = (Math.max(rect.left, wrapRect.left) + Math.min(rect.right, wrapRect.right)) / 2
        const cy = (Math.max(rect.top, wrapRect.top) + Math.min(rect.bottom, wrapRect.bottom)) / 2
        return toSvgPoint({ clientX: cx, clientY: cy })
    }

    const addItem = (type) => {
        const spec = TYPES[type]
        const center = visibleCenter()
        const item = { id: newId(type), type, x: snap(center.x), y: snap(center.y), w: spec.w, h: spec.h, r: 0 }
        if (spec.table) Object.assign(item, { num: nextNumber(), seats: spec.seats, minSeats: 1, features: "" })
        if (type === "zone") {
            const count = zonesOf(layout).length + 1
            Object.assign(item, { zoneId: `zone-${Date.now().toString(36)}`, name: `Зона ${count}`, color: "#7fa3c4" })
        }
        if (spec.text) item.text = spec.text
        layout.items.push(item)
        selectedId = item.id
        commit()
        setStatus(`Добавлено: ${spec.label}. Перетащите его на нужное место.`)
    }

    palette.addEventListener("click", (event) => {
        const button = event.target.closest("[data-add]")
        if (button) addItem(button.dataset.add)
    })

    /* ---------- Мышь и тач на холсте ---------- */

    let gesture = null

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return
        const handle = event.target.closest("[data-handle]")
        const node = event.target.closest(".hall-item")
        const point = toSvgPoint(event)

        if (handle && selected()) {
            const item = selected()
            gesture = { mode: handle.dataset.handle, item, start: point, origin: { ...item } }
        } else if (node) {
            selectedId = node.dataset.id
            const item = selected()
            gesture = item.locked ? null : { mode: "move", item, start: point, origin: { ...item } }
            draw()
        } else {
            selectedId = null
            draw()
            return
        }
        canvas.setPointerCapture(event.pointerId)
        event.preventDefault()
    })

    canvas.addEventListener("pointermove", (event) => {
        if (!gesture) return
        const point = toSvgPoint(event)
        const { item, origin, start, mode } = gesture
        const free = event.altKey

        if (mode === "move") {
            item.x = snap(origin.x + point.x - start.x, free)
            item.y = snap(origin.y + point.y - start.y, free)
        } else if (mode === "resize") {
            const local = toLocal(origin, point)
            const min = 10
            let w = Math.max(min, snap(Math.abs(local.x) * 2 - 16, free))
            let h = Math.max(min, snap(Math.abs(local.y) * 2 - 16, free))
            if (TYPES[item.type]?.square || event.shiftKey) w = h = Math.max(w, h)
            item.w = w
            item.h = h
        } else if (mode === "rotate") {
            const angle = (Math.atan2(point.y - item.y, point.x - item.x) * 180) / Math.PI + 90
            const step = event.shiftKey ? 1 : 15
            item.r = ((Math.round(angle / step) * step) % 360 + 360) % 360
        }
        gesture.changed = true
        draw()
    })

    const finishGesture = () => {
        if (gesture?.changed) commit()
        gesture = null
    }
    canvas.addEventListener("pointerup", finishGesture)
    canvas.addEventListener("pointercancel", finishGesture)

    // Двойной клик по столу — сразу к полю номера
    canvas.addEventListener("dblclick", () => inspector.querySelector("[data-field='num'], [data-field='name'], [data-field='text']")?.focus())

    /* ---------- Масштаб холста ---------- */

    const setZoom = (value) => {
        zoom = Math.min(3, Math.max(0.5, value))
        document.querySelector("[data-zoom-label]").textContent = `${Math.round(zoom * 100)}%`
        draw()
    }
    document.querySelectorAll("[data-zoom]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.zoom
            setZoom(action === "in" ? zoom * 1.25 : action === "out" ? zoom / 1.25 : 1)
        })
    })
    wrap.addEventListener(
        "wheel",
        (event) => {
            if (!event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            setZoom(zoom * (event.deltaY < 0 ? 1.1 : 0.9))
        },
        { passive: false }
    )

    /* ---------- Инспектор свойств ---------- */

    const field = (label, name, value, attrs = "") =>
        `<label class="ed-field"><span>${label}</span><input data-field="${name}" value="${String(value ?? "").replace(/"/g, "&quot;")}" ${attrs}></label>`

    const numberField = (label, name, value, attrs = "") => field(label, name, value, `type="number" ${attrs}`)

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])

    const renderInspector = () => {
        const item = selected()
        if (!item) {
            renderCanvasSettings()
            return
        }
        // не перерисовываем, пока пользователь печатает в поле
        if (inspector.dataset.itemId === item.id && inspector.contains(document.activeElement) && gesture === null) {
            syncGeometryFields(item)
            return
        }
        inspector.dataset.itemId = item.id
        const spec = TYPES[item.type]
        const parts = [`<div class="ed-insp__head"><p class="ed-insp__type">${spec.label}</p>${spec.table ? `<p class="ed-insp__title">${escapeHtml(tableTitle(item))}</p>` : ""}</div>`]

        if (spec.table) {
            const autoZone = (() => {
                const copy = { ...item, zone: undefined }
                const id = zoneOf(layout, copy)
                return zonesOf(layout).find((zone) => zone.id === id)?.name || "нет зоны"
            })()
            const zoneOptions = zonesOf(layout)
                .map((zone) => `<option value="${escapeHtml(zone.id)}" ${item.zone === zone.id ? "selected" : ""}>${escapeHtml(zone.name)}</option>`)
                .join("")
            parts.push(`
                <fieldset class="ed-group"><legend>Стол</legend>
                    ${field("Номер", "num", item.num, 'maxlength="6"')}
                    <div class="ed-row">
                        ${numberField("Мест (макс.)", "seats", item.seats, 'min="1" max="40"')}
                        ${numberField("Гостей от", "minSeats", item.minSeats || 1, 'min="1" max="40"')}
                    </div>
                    ${field("Особенности", "features", item.features, 'placeholder="у окна, у камина"')}
                    <label class="ed-field"><span>Зона</span>
                        <select data-field="zone"><option value="">Авто — по расположению (${escapeHtml(autoZone)})</option>${zoneOptions}</select>
                    </label>
                    <label class="ed-check"><input type="checkbox" data-field="bookable" ${item.bookable === false ? "" : "checked"}> Можно выбрать при бронировании</label>
                </fieldset>`)
        }

        if (item.type === "zone") {
            parts.push(`
                <fieldset class="ed-group"><legend>Зона</legend>
                    ${field("Название", "name", item.name)}
                    <label class="ed-field"><span>Цвет</span><input type="color" data-field="color" value="${escapeHtml(item.color || "#7fa3c4")}"></label>
                    <p class="ed-note">Код зоны: <code>${escapeHtml(item.zoneId)}</code>. Столы внутри зоны получают её автоматически. Несколько прямоугольников с одинаковым кодом считаются одной зоной.</p>
                </fieldset>`)
        }

        if (spec.text) {
            parts.push(`<fieldset class="ed-group"><legend>Подпись</legend>${field("Текст", "text", item.text ?? spec.text)}
                ${item.type === "label" ? numberField("Размер шрифта", "size", item.size || 14, 'min="8" max="60"') : ""}</fieldset>`)
        }

        parts.push(`
            <fieldset class="ed-group"><legend>Положение и размер</legend>
                <div class="ed-row">${numberField("X", "x", item.x)}${numberField("Y", "y", item.y)}</div>
                <div class="ed-row">${numberField("Ширина", "w", item.w, 'min="4"')}${numberField("Высота", "h", item.h, 'min="4"')}</div>
                <div class="ed-row ed-row--rotate">${numberField("Поворот, °", "r", item.r || 0, 'step="15"')}
                    <button type="button" class="ed-btn" data-act="rotate-left" title="Повернуть на −90° (Shift+R)">⟲ 90°</button>
                    <button type="button" class="ed-btn" data-act="rotate-right" title="Повернуть на 90° (R)">⟳ 90°</button>
                </div>
                <label class="ed-check"><input type="checkbox" data-field="locked" ${item.locked ? "checked" : ""}> Закрепить (не двигать мышью)</label>
            </fieldset>
            <div class="ed-actions-row">
                <button type="button" class="ed-btn" data-act="duplicate" title="Ctrl+D">Дублировать</button>
                <button type="button" class="ed-btn" data-act="raise" title="Поднять над соседями">Выше</button>
                <button type="button" class="ed-btn" data-act="lower" title="Опустить под соседей">Ниже</button>
                <button type="button" class="ed-btn ed-btn--danger" data-act="delete" title="Delete">Удалить</button>
            </div>`)

        inspector.innerHTML = parts.join("")
    }

    const syncGeometryFields = (item) => {
        ;["x", "y", "w", "h", "r"].forEach((name) => {
            const input = inspector.querySelector(`[data-field='${name}']`)
            if (input && document.activeElement !== input) input.value = item[name] || 0
        })
    }

    const validate = () => {
        const problems = []
        const tables = layout.items.filter(isTable)
        const seen = new Map()
        tables.forEach((table) => {
            const key = String(table.num).trim()
            if (!key) problems.push({ id: table.id, text: "У стола нет номера" })
            if (seen.has(key)) problems.push({ id: table.id, text: `Номер ${key} используется дважды` })
            seen.set(key, table.id)
            if (!zoneOf(layout, table)) problems.push({ id: table.id, text: `${tableTitle(table)} вне зон` })
            if ((table.minSeats || 1) > table.seats) problems.push({ id: table.id, text: `${tableTitle(table)}: «гостей от» больше числа мест` })
            const half = Math.max(table.w, table.h) / 2
            if (table.x - half < 0 || table.y - half < 0 || table.x + half > layout.width || table.y + half > layout.height) {
                problems.push({ id: table.id, text: `${tableTitle(table)} выходит за границы зала` })
            }
        })
        return problems
    }

    const renderCanvasSettings = () => {
        inspector.dataset.itemId = ""
        const problems = validate()
        inspector.innerHTML = `
            <div class="ed-insp__head"><p class="ed-insp__type">Зал</p><p class="ed-insp__title">Настройки схемы</p></div>
            <p class="ed-note">Выберите элемент на схеме, чтобы изменить его, или добавьте новый из панели слева.</p>
            <fieldset class="ed-group"><legend>Размер зала</legend>
                <div class="ed-row">
                    ${field("Ширина", "canvas-width", layout.width, 'type="number" min="300" step="10"')}
                    ${field("Высота", "canvas-height", layout.height, 'type="number" min="300" step="10"')}
                </div>
                <label class="ed-field"><span>Шаг сетки</span>
                    <select data-field="grid-step">${[5, 10, 20, 25, 50].map((step) => `<option ${step === gridStep ? "selected" : ""}>${step}</option>`).join("")}</select>
                </label>
            </fieldset>
            <fieldset class="ed-group"><legend>Проверка схемы</legend>
                ${problems.length
                    ? `<ul class="ed-problems">${problems.map((p) => `<li><button type="button" data-goto="${p.id}">${escapeHtml(p.text)}</button></li>`).join("")}</ul>`
                    : `<p class="ed-ok">Ошибок нет — схему можно сохранять.</p>`}
            </fieldset>`
    }

    const renderStats = () => {
        const tables = layout.items.filter(isTable)
        const zones = zonesOf(layout)
        const rows = zones
            .map((zone) => {
                const inZone = tables.filter((table) => zoneOf(layout, table) === zone.id)
                return `<li><i style="background:${escapeHtml(zone.color)}"></i>${escapeHtml(zone.name)}<span>${inZone.length} ст. · ${inZone.reduce((sum, t) => sum + (Number(t.seats) || 0), 0)} мест</span></li>`
            })
            .join("")
        document.getElementById("stats").innerHTML = `
            <p class="ed-stats__total"><b>${tables.length}</b> столов · <b>${tables.reduce((sum, t) => sum + (Number(t.seats) || 0), 0)}</b> мест</p>
            <ul>${rows}</ul>`
        const problems = validate().length
        const badge = document.querySelector("[data-problems]")
        badge.hidden = problems === 0
        badge.textContent = problems
    }

    // Изменение полей инспектора
    inspector.addEventListener("input", (event) => {
        const input = event.target.closest("[data-field]")
        if (!input) return
        const name = input.dataset.field

        if (name === "canvas-width" || name === "canvas-height") {
            const value = Math.max(300, parseInt(input.value, 10) || 0)
            layout[name === "canvas-width" ? "width" : "height"] = value
            render(canvas, layout, { grid: showGrid ? gridStep : 0 })
            return
        }
        if (name === "grid-step") {
            gridStep = parseInt(input.value, 10)
            draw()
            return
        }

        const item = selected()
        if (!item) return
        const numeric = ["x", "y", "w", "h", "r", "seats", "minSeats", "size"]
        if (input.type === "checkbox") {
            if (name === "bookable") {
                if (input.checked) delete item.bookable
                else item.bookable = false
            } else if (name === "locked") {
                if (input.checked) item.locked = true
                else delete item.locked
            }
        } else if (numeric.includes(name)) {
            const value = parseFloat(input.value)
            if (!Number.isFinite(value)) return
            item[name] = name === "r" ? ((value % 360) + 360) % 360 : value
            if (TYPES[item.type]?.square && (name === "w" || name === "h")) item.w = item.h = value
        } else if (name === "zone") {
            if (input.value) item.zone = input.value
            else delete item.zone
        } else {
            item[name] = input.value
        }
        // перерисовываем рисунок, не трогая поля, в которых пользователь печатает
        render(canvas, layout, { grid: showGrid ? gridStep : 0 })
        canvas.querySelector(`[data-id="${CSS.escape(item.id)}"]`)?.classList.add("is-selected-edit")
        drawSelection(item)
        renderStats()
    })
    inspector.addEventListener("change", (event) => {
        if (event.target.closest("[data-field]")) commit()
    })

    inspector.addEventListener("click", (event) => {
        const goto = event.target.closest("[data-goto]")
        if (goto) {
            selectedId = goto.dataset.goto
            draw()
            return
        }
        const action = event.target.closest("[data-act]")?.dataset.act
        if (action) runAction(action)
    })

    /* ---------- Действия ---------- */

    const runAction = (action) => {
        const item = selected()
        switch (action) {
            case "undo":
                return undo()
            case "redo":
                return redo()
            case "delete":
                if (!item) return
                layout.items = layout.items.filter((other) => other.id !== item.id)
                selectedId = null
                commit()
                setStatus("Элемент удалён. Ctrl+Z — вернуть.")
                return
            case "duplicate": {
                if (!item) return
                const copy = { ...clone(item), id: newId(item.type), x: item.x + gridStep * 3, y: item.y + gridStep * 3 }
                if (isTable(copy)) copy.num = nextNumber()
                if (copy.type === "zone") delete copy.locked
                layout.items.push(copy)
                selectedId = copy.id
                commit()
                return
            }
            case "raise":
            case "lower": {
                if (!item) return
                const index = layout.items.indexOf(item)
                const target = action === "raise" ? index + 1 : index - 1
                if (target < 0 || target >= layout.items.length) return
                ;[layout.items[index], layout.items[target]] = [layout.items[target], layout.items[index]]
                commit()
                return
            }
            case "rotate-left":
            case "rotate-right":
                if (!item) return
                item.r = (((item.r || 0) + (action === "rotate-right" ? 90 : -90)) % 360 + 360) % 360
                commit()
                return
            case "save":
                return save()
            case "import":
                return fileInput.click()
            case "preview":
                return preview()
            case "reset":
                if (confirm("Вернуть схему, опубликованную на сайте? Несохранённые изменения пропадут.")) {
                    layout = clone(published)
                    selectedId = null
                    commit()
                    markDirty(false)
                    setStatus("Загружена схема с сайта.")
                }
                return
            case "help":
                return document.getElementById("help").showModal()
            case "grid":
                showGrid = !showGrid
                document.querySelector("[data-act='grid']").setAttribute("aria-pressed", String(showGrid))
                return draw()
        }
    }

    document.querySelectorAll(".ed-top [data-act]").forEach((button) => {
        button.addEventListener("click", () => runAction(button.dataset.act))
    })
    document.querySelector("[data-help-close]").addEventListener("click", () => document.getElementById("help").close())

    /* ---------- Клавиатура ---------- */

    document.addEventListener("keydown", (event) => {
        const typing = event.target instanceof Element && event.target.closest("input, textarea, select")
        const mod = event.ctrlKey || event.metaKey
        const key = event.key.toLowerCase()

        if (mod && (key === "z" || key === "я")) {
            if (typing) return
            event.preventDefault()
            return event.shiftKey ? redo() : undo()
        }
        if (mod && (key === "y" || key === "н")) {
            event.preventDefault()
            return redo()
        }
        if (mod && (key === "s" || key === "ы")) {
            event.preventDefault()
            return save()
        }
        if (typing) return

        const item = selected()
        if (mod && (key === "d" || key === "в")) {
            event.preventDefault()
            return runAction("duplicate")
        }
        if (!item) return
        if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault()
            return runAction("delete")
        }
        if (event.key === "Escape") {
            selectedId = null
            return draw()
        }
        if (key === "r" || key === "к") {
            return runAction(event.shiftKey ? "rotate-left" : "rotate-right")
        }
        const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
        if (arrows[event.key] && !item.locked) {
            event.preventDefault()
            const step = event.shiftKey ? gridStep * 5 : event.altKey ? 1 : gridStep
            item.x += arrows[event.key][0] * step
            item.y += arrows[event.key][1] * step
            commit()
        }
    })

    /* ---------- Файл схемы ---------- */

    /** Красиво форматирует файл: каждый элемент — одна строка, удобно читать и сравнивать. */
    const formatFile = () => {
        const items = layout.items.map((item) => `        ${JSON.stringify(item).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }")}`)
        return `/*
 * Схема зала Бохо.
 * Этот файл создаёт редактор схемы (editor.html) — править вручную не обязательно.
 * После изменений в редакторе сохраните файл сюда же: assets/js/hall-layout.js
 */
window.BOHO_HALL = {
    "version": 1,
    "width": ${layout.width},
    "height": ${layout.height},
    "items": [
${items.join(",\n")}
    ]
}
`
    }

    const saveFile = window.BohoFile.createSaver({ filename: "hall-layout.js", sitePath: "assets/js/hall-layout.js", description: "Схема зала" })

    const save = async () => {
        const problems = validate()
        if (problems.length && !confirm(`В схеме есть замечания (${problems.length}): ${problems[0].text}… Всё равно сохранить?`)) return
        const result = await saveFile(formatFile())
        if (!result) return
        if (result.ok) markDirty(false)
        setStatus(result.message, result.tone)
    }

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0]
        if (!file) return
        try {
            const text = await file.text()
            const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))
            if (!Array.isArray(json.items)) throw new Error("нет списка элементов")
            layout = { version: 1, width: json.width || 1200, height: json.height || 800, items: json.items }
            selectedId = null
            commit()
            setStatus(`Открыт файл «${file.name}».`, "ok")
        } catch (error) {
            setStatus(`Не удалось открыть файл: ${error.message}`, "warn")
        }
        fileInput.value = ""
    })

    const preview = () => {
        try {
            localStorage.setItem(DRAFT_KEY, snapshot())
        } catch {
            setStatus("Браузер не дал сохранить черновик для предпросмотра.", "warn")
            return
        }
        window.open("index.html?hall=draft#hall", "_blank")
    }

    window.addEventListener("beforeunload", (event) => {
        if (isDirty) event.preventDefault()
    })

    window.addEventListener("resize", () => draw())

    /* ---------- Старт ---------- */

    buildPalette()
    const publishedBroken = !Array.isArray(window.BOHO_HALL?.items) || window.BOHO_HALL.items.length === 0
    try {
        const saved = localStorage.getItem(AUTOSAVE_KEY)
        if (saved && saved !== JSON.stringify(published)) {
            layout = JSON.parse(saved)
            lastCommitted = snapshot()
            markDirty(true)
            setStatus("Восстановлен несохранённый черновик. «Схема с сайта» — вернуть опубликованную версию.", "warn")
        } else {
            markDirty(false)
            setStatus("Перетаскивайте элементы мышью. Колёсико с Ctrl — масштаб. «?» — подсказки.")
        }
        if (publishedBroken) {
            setStatus("Внимание: файл assets/js/hall-layout.js на сайте пуст или повреждён — схема на сайте не показывается. Откройте копию или сохраните схему заново.", "warn")
        }
    } catch {
        markDirty(false)
    }
    draw()
})()
