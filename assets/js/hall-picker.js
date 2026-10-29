"use strict"

/**
 * Выбор столика на схеме зала в форме бронирования.
 * Схема берётся из assets/js/hall-layout.js (window.BOHO_HALL).
 * Для предпросмотра из редактора: index.html?hall=draft#hall — берётся черновик из localStorage.
 */
;(() => {
    const dialog = document.getElementById("hall")
    const form = document.querySelector(".booking__form")
    if (!dialog || !form || !window.BohoHall) {
        return
    }

    const { render, zoneOf, zonesOf, isTable, tableTitle } = window.BohoHall
    const DRAFT_KEY = "boho-hall-draft"
    const MIN_TOUCH_WIDTH = 880 // ширина схемы на телефоне, при которой столы удобно нажимать

    const loadLayout = () => {
        if (new URLSearchParams(location.search).get("hall") === "draft") {
            try {
                const draft = JSON.parse(localStorage.getItem(DRAFT_KEY))
                if (draft?.items) return draft
            } catch {
                // повреждённый черновик — используем опубликованную схему
            }
        }
        return window.BOHO_HALL
    }

    const layout = loadLayout()
    if (!layout?.items) {
        document.querySelector("[data-table-pick]")?.closest(".field")?.remove()
        return
    }

    // Тексты схемы попадают в разметку — экранируем их
    const esc = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

    const zones = zonesOf(layout).map((zone) => ({ ...zone, name: esc(zone.name), color: /^#[0-9a-f]{3,8}$/i.test(zone.color) ? zone.color : "#cbbfa9" }))
    const tables = layout.items.filter(isTable).map((table) => ({ ...table, num: esc(table.num), features: esc(table.features) }))
    const zoneName = (id) => zones.find((zone) => zone.id === id)?.name || "Без зоны"
    const zoneColor = (id) => zones.find((zone) => zone.id === id)?.color || "#cbbfa9"

    /* ---------- Элементы ---------- */

    const svg = dialog.querySelector("[data-hall-map] svg")
    const map = dialog.querySelector("[data-hall-map]")
    const stage = dialog.querySelector("[data-hall-stage]")
    const list = dialog.querySelector("[data-hall-list]")
    const panel = dialog.querySelector("[data-hall-panel]")
    const chips = dialog.querySelector("[data-hall-zones]")
    const confirmButton = dialog.querySelector("[data-hall-confirm]")
    const guestsLabel = dialog.querySelector("[data-hall-guests]")

    const fieldTitle = form.querySelector("[data-table-title]")
    const fieldMeta = form.querySelector("[data-table-meta]")
    const fieldInput = form.elements.table
    const zoneSelect = form.elements.zone
    const guestsInput = form.elements.guests

    let picked = null // выбран в окне схемы, ещё не подтверждён
    let confirmed = null // подтверждён и записан в форму
    let zoneFilter = "all"
    let nodes = new Map()
    let zoom = 1
    let baseWidth = 0

    /* ---------- Зоны в форме берём из схемы ---------- */

    if (zones.length) {
        const current = zoneSelect.value
        zoneSelect.replaceChildren(
            ...zones.map((zone) => {
                const option = document.createElement("option")
                option.value = zone.id
                option.textContent = zonesOf(layout).find((raw) => raw.id === zone.id)?.name || zone.id
                return option
            })
        )
        if (zones.some((zone) => zone.id === current)) zoneSelect.value = current
    }

    /* ---------- Помощники ---------- */

    const guests = () => Math.max(1, parseInt(guestsInput.value, 10) || 1)
    const byId = (id) => tables.find((table) => table.id === id)
    const seatsText = (table) => {
        const min = table.minSeats || 1
        return min > 1 ? `${min}–${table.seats} гостей` : `до ${table.seats} гостей`
    }
    const plural = (n, one, few, many) => {
        const mod10 = n % 10
        const mod100 = n % 100
        if (mod10 === 1 && mod100 !== 11) return one
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
        return many
    }

    /** Подходит ли стол: { ok, reason } */
    const fitOf = (table) => {
        const count = guests()
        if (table.bookable === false) return { ok: false, short: "Не бронируется", reason: "Этот стол не бронируется онлайн" }
        if (count > table.seats) return { ok: false, short: "Мало мест", reason: `${tableTitle(table)} рассчитан максимум на ${table.seats} ${plural(table.seats, "гостя", "гостей", "гостей")}` }
        if (count < (table.minSeats || 1)) return { ok: false, short: `От ${table.minSeats} гостей`, reason: `${tableTitle(table)} — для компании от ${table.minSeats} гостей` }
        return { ok: true, short: "Подходит", reason: "" }
    }

    const features = (table) =>
        (table.features || "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)

    const describe = (table) => [seatsText(table), zoneName(zoneOf(layout, table)), ...features(table)].join(" · ")

    /* ---------- Отрисовка схемы и состояний ---------- */

    const paintStates = () => {
        nodes.forEach((node, id) => {
            const table = byId(id)
            if (!table) return
            const { ok } = fitOf(table)
            const zone = zoneOf(layout, table)
            node.classList.toggle("is-fit", ok)
            node.classList.toggle("is-unfit", !ok && table.bookable !== false)
            node.classList.toggle("is-closed", table.bookable === false)
            node.classList.toggle("is-selected", picked === id)
            node.classList.toggle("is-other-zone", zoneFilter !== "all" && zone !== zoneFilter)
            node.setAttribute("aria-pressed", String(picked === id))
            node.setAttribute("aria-label", `${tableTitle(table)}, ${describe(table)}${ok ? "" : ". Не подходит по числу гостей"}`)
        })
        svg.classList.toggle("has-zone-filter", zoneFilter !== "all")
        svg.querySelectorAll(".hall-item--zone").forEach((node) => {
            const zone = layout.items.find((item) => item.id === node.dataset.id)
            node.classList.toggle("is-active-zone", zone?.zoneId === zoneFilter)
        })
    }

    const drawMap = () => {
        nodes = render(svg, layout)
        nodes.forEach((node, id) => {
            if (!byId(id)) return
            node.setAttribute("role", "button")
            node.setAttribute("tabindex", "0")
        })
        paintStates()
    }

    /* ---------- Масштаб и перемещение ---------- */

    const measureBase = () => {
        const width = map.clientWidth
        const height = map.clientHeight
        baseWidth = Math.min(width, height * (layout.width / layout.height))
    }

    const applyZoom = (next, anchor) => {
        const previousWidth = svg.getBoundingClientRect().width || baseWidth
        // точка, которая должна остаться на месте (центр видимой области)
        const focusX = anchor ? anchor.x : map.scrollLeft + map.clientWidth / 2
        const focusY = anchor ? anchor.y : map.scrollTop + map.clientHeight / 2
        const ratioX = focusX / previousWidth
        const ratioY = focusY / (previousWidth * (layout.height / layout.width))

        zoom = Math.min(4, Math.max(1, next))
        const width = Math.round(baseWidth * zoom)
        svg.style.width = `${width}px`
        stage.classList.toggle("is-zoomed", zoom > 1.01)

        const height = width * (layout.height / layout.width)
        map.scrollLeft = ratioX * width - map.clientWidth / 2
        map.scrollTop = ratioY * height - map.clientHeight / 2
    }

    const scrollToPoint = (x, y, smooth = true) => {
        const width = baseWidth * zoom
        const height = width * (layout.height / layout.width)
        map.scrollTo({
            left: (x / layout.width) * width - map.clientWidth / 2,
            top: (y / layout.height) * height - map.clientHeight / 2,
            behavior: smooth ? "smooth" : "auto"
        })
    }

    const focusZone = (zoneId, smooth = true) => {
        const rects = layout.items.filter((item) => item.type === "zone" && item.zoneId === zoneId)
        if (!rects.length) return
        const x = rects.reduce((sum, rect) => sum + rect.x, 0) / rects.length
        const y = rects.reduce((sum, rect) => sum + rect.y, 0) / rects.length
        scrollToPoint(x, y, smooth)
    }

    // Перетаскивание схемы мышью (на телефоне работает обычная прокрутка пальцем)
    let drag = null
    map.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse" || zoom <= 1.01 || event.target.closest(".hall-table")) return
        drag = { x: event.clientX, y: event.clientY, left: map.scrollLeft, top: map.scrollTop }
        map.setPointerCapture(event.pointerId)
        stage.classList.add("is-dragging")
    })
    map.addEventListener("pointermove", (event) => {
        if (!drag) return
        map.scrollLeft = drag.left - (event.clientX - drag.x)
        map.scrollTop = drag.top - (event.clientY - drag.y)
    })
    const endDrag = () => {
        drag = null
        stage.classList.remove("is-dragging")
    }
    map.addEventListener("pointerup", endDrag)
    map.addEventListener("pointercancel", endDrag)

    // Масштаб колесом с Ctrl/⌘ или щипком на тачпаде
    map.addEventListener(
        "wheel",
        (event) => {
            if (!event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            const rect = map.getBoundingClientRect()
            applyZoom(zoom * (event.deltaY < 0 ? 1.15 : 0.87), {
                x: map.scrollLeft + event.clientX - rect.left,
                y: map.scrollTop + event.clientY - rect.top
            })
        },
        { passive: false }
    )

    dialog.querySelectorAll("[data-hall-zoom]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.hallZoom
            if (action === "in") applyZoom(zoom * 1.4)
            if (action === "out") applyZoom(zoom / 1.4)
            if (action === "fit") applyZoom(1)
        })
    })

    /* ---------- Панель с деталями ---------- */

    const renderPanel = () => {
        const table = picked && byId(picked)
        if (!table) {
            const fitting = tables.filter((item) => fitOf(item).ok).length
            panel.innerHTML = `
                <p class="hall-panel__lead">Нажмите на столик, чтобы увидеть детали.</p>
                <p class="hall-panel__stat"><b>${fitting}</b> ${plural(fitting, "стол подходит", "стола подходят", "столов подходят")} для ${guests()} ${plural(guests(), "гостя", "гостей", "гостей")}</p>
                <p class="hall-panel__note">Мы постараемся посадить вас за выбранный стол — администратор подтвердит бронь по телефону.</p>`
            confirmButton.disabled = true
            return
        }

        const zone = zoneOf(layout, table)
        const fit = fitOf(table)
        const tags = features(table)
            .map((feature) => `<li>${feature}</li>`)
            .join("")
        panel.innerHTML = `
            <p class="hall-panel__zone"><i style="--zone:${zoneColor(zone)}"></i>${zoneName(zone)}</p>
            <h3 class="hall-panel__title">${tableTitle(table)}</h3>
            <p class="hall-panel__seats">${seatsText(table)}</p>
            ${tags ? `<ul class="hall-panel__tags">${tags}</ul>` : ""}
            <p class="hall-panel__fit ${fit.ok ? "is-ok" : "is-bad"}">${fit.ok ? `Подходит для ${guests()} ${plural(guests(), "гостя", "гостей", "гостей")}` : fit.reason}</p>`
        confirmButton.disabled = !fit.ok
    }

    /* ---------- Список (альтернатива схеме) ---------- */

    const renderList = () => {
        const groups = zones.length ? zones : [{ id: null, name: "Зал" }]
        list.innerHTML = groups
            .filter((zone) => zoneFilter === "all" || zone.id === zoneFilter)
            .map((zone) => {
                const rows = tables
                    .filter((table) => zoneOf(layout, table) === zone.id)
                    .sort((a, b) => Number(a.num) - Number(b.num) || String(a.num).localeCompare(String(b.num)))
                    .map((table) => {
                        const fit = fitOf(table)
                        return `<li><button type="button" class="hall-row${fit.ok ? "" : " is-unfit"}${picked === table.id ? " is-selected" : ""}" data-table-id="${table.id}" aria-pressed="${picked === table.id}">
                            <span class="hall-row__num">${table.num}</span>
                            <span class="hall-row__info"><b>${tableTitle(table)}</b><span>${[seatsText(table), ...features(table)].join(" · ")}</span></span>
                            <span class="hall-row__state">${fit.short}</span>
                        </button></li>`
                    })
                    .join("")
                return rows ? `<section class="hall-list__group"><h3 style="--zone:${zone.color || "#cbbfa9"}">${zone.name}</h3><ul>${rows}</ul></section>` : ""
            })
            .join("")
    }

    /* ---------- Фильтр по зонам ---------- */

    const renderChips = () => {
        const options = [{ id: "all", name: "Весь зал" }, ...zones]
        chips.innerHTML = options
            .map(
                (zone) => `<button type="button" role="radio" class="hall-chip${zoneFilter === zone.id ? " is-active" : ""}" data-zone="${zone.id}" aria-checked="${zoneFilter === zone.id}" style="--zone:${zone.color || "#cbbfa9"}">
                    ${zone.id === "all" ? "" : "<i></i>"}${zone.name}</button>`
            )
            .join("")
    }

    chips.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-zone]")
        if (!chip) return
        zoneFilter = chip.dataset.zone
        renderChips()
        paintStates()
        renderList()
        if (zoneFilter === "all") {
            if (zoom > 1.01) scrollToPoint(layout.width / 2, layout.height / 2)
        } else {
            if (zoom <= 1.01 && window.matchMedia("(max-width: 899px)").matches) applyZoom(MIN_TOUCH_WIDTH / baseWidth)
            focusZone(zoneFilter)
        }
    })

    /* ---------- Выбор ---------- */

    const pick = (id) => {
        picked = id
        paintStates()
        renderPanel()
        renderList()
        // на телефоне панель под схемой — показываем её
        if (window.matchMedia("(max-width: 899px)").matches) {
            panel.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
    }

    svg.addEventListener("click", (event) => {
        const node = event.target.closest(".hall-table")
        if (node) pick(node.dataset.id)
    })
    svg.addEventListener("keydown", (event) => {
        const node = event.target.closest(".hall-table")
        if (node && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault()
            pick(node.dataset.id)
        }
    })
    list.addEventListener("click", (event) => {
        const row = event.target.closest("[data-table-id]")
        if (row) pick(row.dataset.tableId)
    })

    /* ---------- Вид: схема / список ---------- */

    dialog.querySelectorAll("[data-hall-view]").forEach((button) => {
        button.addEventListener("click", () => {
            const isList = button.dataset.hallView === "list"
            list.hidden = !isList
            stage.hidden = isList
            dialog.querySelectorAll("[data-hall-view]").forEach((other) => {
                const active = other === button
                other.classList.toggle("is-active", active)
                other.setAttribute("aria-pressed", String(active))
            })
            if (!isList) requestAnimationFrame(() => applyZoom(zoom))
        })
    })

    /* ---------- Поле в форме ---------- */

    const updateField = (note) => {
        const table = confirmed && byId(confirmed)
        if (!table) {
            fieldTitle.textContent = "Любой свободный"
            fieldMeta.textContent = note || "Администратор подберёт лучший стол"
            fieldMeta.classList.toggle("is-warning", Boolean(note))
            fieldInput.value = ""
            return
        }
        const fit = fitOf(table)
        fieldTitle.textContent = tableTitle(table)
        fieldMeta.textContent = fit.ok ? describe(table) : `${fit.reason} — выберите другой`
        fieldMeta.classList.toggle("is-warning", !fit.ok)
        fieldInput.value = `${tableTitle(table)} (${describe(table)})`
    }

    guestsInput.addEventListener("input", () => updateField())
    zoneSelect.addEventListener("change", () => {
        zoneSelect.dataset.chosen = "1"
        const table = confirmed && byId(confirmed)
        if (table && zoneOf(layout, table) !== zoneSelect.value) {
            confirmed = null
            updateField("Стол сброшен: он в другой зоне")
        }
    })

    /* ---------- Открытие и закрытие ---------- */

    const open = () => {
        picked = confirmed
        // Фильтр включаем, только если гость сам выбрал зону (или пришёл из «окна» зоны)
        const chosenZone = zoneSelect.dataset.chosen === "1" && zones.some((zone) => zone.id === zoneSelect.value)
        zoneFilter = chosenZone ? zoneSelect.value : "all"
        guestsLabel.textContent = guests()
        renderChips()
        drawMap()
        renderPanel()
        renderList()
        dialog.showModal()

        requestAnimationFrame(() => {
            measureBase()
            const isPhone = window.matchMedia("(max-width: 899px)").matches
            applyZoom(isPhone ? MIN_TOUCH_WIDTH / baseWidth : 1)
            const table = picked && byId(picked)
            if (table) {
                scrollToPoint(table.x, table.y, false)
            } else if (zoneFilter !== "all") {
                focusZone(zoneFilter, false)
            }
        })
    }

    const close = () => dialog.close()

    form.querySelector("[data-hall-open]").addEventListener("click", open)
    dialog.querySelector("[data-hall-close]").addEventListener("click", close)
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) close()
    })

    confirmButton.addEventListener("click", () => {
        const table = picked && byId(picked)
        if (!table || !fitOf(table).ok) return
        confirmed = table.id
        const zone = zoneOf(layout, table)
        if (zone && [...zoneSelect.options].some((option) => option.value === zone)) {
            zoneSelect.value = zone
        }
        updateField()
        close()
        form.querySelector("[data-hall-open]").focus()
    })

    dialog.querySelector("[data-hall-any]").addEventListener("click", () => {
        confirmed = null
        picked = null
        updateField()
        close()
    })

    let resizeTimer
    window.addEventListener("resize", () => {
        if (!dialog.open) return
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
            measureBase()
            applyZoom(zoom)
        }, 150)
    })

    // Ссылка вида index.html#hall (или предпросмотр из редактора) сразу открывает схему
    if (location.hash === "#hall") {
        window.addEventListener("load", () => {
            document.querySelector("[data-booking]")?.click()
            setTimeout(open, 350)
        })
    }
})()
