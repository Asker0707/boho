/**
 * Отрисовка схемы зала Бохо в SVG.
 * Общий модуль для сайта (выбор столика при бронировании) и редактора схемы.
 *
 * Схема — это объект { width, height, items: [...] }.
 * Каждый элемент: { id, type, x, y, w, h, r, ... }, где x/y — центр, r — поворот в градусах.
 */
;(function () {
    "use strict"

    const NS = "http://www.w3.org/2000/svg"

    /** Каталог элементов: подпись, группа в палитре редактора, размеры по умолчанию. */
    const TYPES = {
        "table-round": { label: "Круглый стол", group: "Столы", table: true, w: 80, h: 80, seats: 4, square: true },
        "table-rect": { label: "Прямоугольный стол", group: "Столы", table: true, w: 100, h: 70, seats: 4 },
        sofa: { label: "Диван-лаунж", group: "Столы", table: true, w: 150, h: 110, seats: 4 },
        zone: { label: "Зона", group: "Зоны", w: 300, h: 240 },
        bar: { label: "Барная стойка", group: "Объекты", w: 300, h: 50, text: "Бар" },
        stage: { label: "Сцена", group: "Объекты", w: 180, h: 200, text: "Сцена" },
        fireplace: { label: "Камин", group: "Объекты", w: 24, h: 120, text: "Камин" },
        kitchen: { label: "Кухня", group: "Объекты", w: 220, h: 70, text: "Кухня" },
        entrance: { label: "Вход", group: "Объекты", w: 90, h: 12, text: "Вход" },
        wc: { label: "Туалет", group: "Объекты", w: 80, h: 80, text: "WC" },
        wardrobe: { label: "Гардероб", group: "Объекты", w: 120, h: 50, text: "Гардероб" },
        window: { label: "Окно", group: "Стены", w: 160, h: 8 },
        wall: { label: "Стена", group: "Стены", w: 200, h: 10 },
        column: { label: "Колонна", group: "Стены", w: 26, h: 26 },
        plant: { label: "Растение", group: "Декор", w: 40, h: 40, square: true },
        label: { label: "Надпись", group: "Декор", w: 120, h: 30, text: "Надпись" }
    }

    const DRAW_ORDER = ["zone", "objects", "tables"]

    const svgEl = (tag, attrs = {}, parent) => {
        const node = document.createElementNS(NS, tag)
        Object.entries(attrs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) node.setAttribute(key, value)
        })
        if (parent) parent.append(node)
        return node
    }

    const isTable = (item) => Boolean(TYPES[item.type]?.table)

    /** Зона стола: явно заданная или та, внутри которой лежит центр стола. */
    const zoneOf = (layout, item) => {
        if (item.zone) {
            return item.zone
        }
        const zones = layout.items.filter((other) => other.type === "zone")
        // Последняя по порядку зона — верхняя, она и выигрывает при наложении
        for (let i = zones.length - 1; i >= 0; i -= 1) {
            const zone = zones[i]
            if (Math.abs(item.x - zone.x) <= zone.w / 2 && Math.abs(item.y - zone.y) <= zone.h / 2) {
                return zone.zoneId
            }
        }
        return null
    }

    /** Список зон без повторов: [{ id, name, color }]. */
    const zonesOf = (layout) => {
        const seen = new Map()
        layout.items
            .filter((item) => item.type === "zone")
            .forEach((zone) => {
                if (!seen.has(zone.zoneId)) {
                    seen.set(zone.zoneId, { id: zone.zoneId, name: zone.name, color: zone.color })
                }
            })
        return [...seen.values()]
    }

    const tableTitle = (item) => (item.type === "sofa" ? `Лаунж ${item.num}` : `Стол ${item.num}`)

    /* ---------- Стулья вокруг стола ---------- */

    const chairsRound = (group, item) => {
        const radius = Math.min(item.w, item.h) / 2
        for (let i = 0; i < item.seats; i += 1) {
            const angle = (360 / item.seats) * i - 90
            svgEl("rect", {
                class: "hall-chair",
                x: -9,
                y: -radius - 16,
                width: 18,
                height: 12,
                rx: 4,
                transform: `rotate(${angle + 90})`
            }, group)
        }
    }

    const chairsRect = (group, item) => {
        const { w, h, seats } = item
        const place = (count, length, makeTransform) => {
            for (let i = 0; i < count; i += 1) {
                const offset = (length / count) * (i + 0.5) - length / 2
                svgEl("rect", { class: "hall-chair", x: -9, y: -6, width: 18, height: 12, rx: 4, transform: makeTransform(offset) }, group)
            }
        }
        // Квадратный стол на 4 — по стулу с каждой стороны
        if (seats === 4 && Math.abs(w - h) < 20) {
            place(1, w, (o) => `translate(${o} ${-h / 2 - 10})`)
            place(1, w, (o) => `translate(${o} ${h / 2 + 10})`)
            place(1, h, (o) => `translate(${-w / 2 - 10} ${o}) rotate(90)`)
            place(1, h, (o) => `translate(${w / 2 + 10} ${o}) rotate(90)`)
            return
        }
        const long = w >= h
        const top = Math.ceil(seats / 2)
        const bottom = seats - top
        if (long) {
            place(top, w, (o) => `translate(${o} ${-h / 2 - 10})`)
            place(bottom, w, (o) => `translate(${o} ${h / 2 + 10})`)
        } else {
            place(top, h, (o) => `translate(${-w / 2 - 10} ${o}) rotate(90)`)
            place(bottom, h, (o) => `translate(${w / 2 + 10} ${o}) rotate(90)`)
        }
    }

    /* ---------- Рисование элементов ---------- */

    const drawTable = (group, item) => {
        if (item.type === "sofa") {
            // Диван буквой П вокруг низкого столика
            const { w, h } = item
            const band = Math.min(26, h * 0.28)
            svgEl("path", {
                class: "hall-sofa",
                d: `M ${-w / 2} ${h / 2} V ${-h / 2 + 10} Q ${-w / 2} ${-h / 2} ${-w / 2 + 10} ${-h / 2} H ${w / 2 - 10} Q ${w / 2} ${-h / 2} ${w / 2} ${-h / 2 + 10} V ${h / 2} H ${w / 2 - band} V ${-h / 2 + band} H ${-w / 2 + band} V ${h / 2} Z`
            }, group)
            svgEl("rect", { class: "hall-top", x: -w / 4, y: -h / 2 + band + 12, width: w / 2, height: h / 2 - band, rx: 8 }, group)
        } else if (item.type === "table-round") {
            chairsRound(group, item)
            svgEl("circle", { class: "hall-top", r: Math.min(item.w, item.h) / 2 }, group)
        } else {
            chairsRect(group, item)
            svgEl("rect", { class: "hall-top", x: -item.w / 2, y: -item.h / 2, width: item.w, height: item.h, rx: 8 }, group)
        }
        const numberY = item.type === "sofa" ? item.h / 8 + 6 : 7
        const text = svgEl("text", { class: "hall-num", y: numberY, transform: `rotate(${-(item.r || 0)})` }, group)
        text.textContent = item.num
    }

    const drawObject = (group, item) => {
        const { w, h, type } = item
        const box = (cls, rx = 6) => svgEl("rect", { class: cls, x: -w / 2, y: -h / 2, width: w, height: h, rx }, group)
        const caption = (value, cls = "hall-caption") => {
            if (!value) return
            const text = svgEl("text", { class: cls, y: 4, transform: `rotate(${-(item.r || 0)})` }, group)
            text.textContent = value
        }
        const label = item.text ?? TYPES[type]?.text

        switch (type) {
            case "zone": {
                svgEl("rect", { class: "hall-zone-area", x: -w / 2, y: -h / 2, width: w, height: h, rx: 18 }, group)
                const name = svgEl("text", { class: "hall-zone-name", x: -w / 2 + 16, y: -h / 2 + 26 }, group)
                name.textContent = item.name
                break
            }
            case "bar": {
                box("hall-bar", 14)
                const stools = Math.max(2, Math.floor(w / 48))
                for (let i = 0; i < stools; i += 1) {
                    svgEl("circle", { class: "hall-stool", cx: (w / stools) * (i + 0.5) - w / 2, cy: -h / 2 - 14, r: 8 }, group)
                }
                caption(label)
                break
            }
            case "stage":
                box("hall-stage", 12)
                svgEl("path", { class: "hall-stage-lines", d: `M ${-w / 2 + 14} ${h / 2 - 14} H ${w / 2 - 14} M ${-w / 2 + 14} ${h / 2 - 24} H ${w / 2 - 14}` }, group)
                caption(label, "hall-caption hall-caption--strong")
                break
            case "fireplace":
                box("hall-fire", 4)
                caption(label, "hall-caption hall-caption--side")
                break
            case "kitchen":
                box("hall-service hall-service--hatch", 8)
                caption(label)
                break
            case "wc":
            case "wardrobe":
                box("hall-service", 8)
                caption(label)
                break
            case "entrance":
                box("hall-door", 3)
                // створка и дуга открывания внутрь зала
                svgEl("path", { class: "hall-door-swing", d: `M ${-w / 2} ${-h / 2} V ${-h / 2 - w} A ${w} ${w} 0 0 1 ${w / 2} ${-h / 2}` }, group)
                caption(label, "hall-caption hall-caption--door")
                break
            case "window":
                box("hall-window", 2)
                break
            case "wall":
                box("hall-wall", 2)
                break
            case "column":
                box("hall-column", 4)
                break
            case "plant":
                svgEl("circle", { class: "hall-plant", r: Math.min(w, h) / 2 }, group)
                svgEl("circle", { class: "hall-plant-core", r: Math.min(w, h) / 5 }, group)
                break
            case "label": {
                const text = svgEl("text", { class: "hall-label", y: 5, style: item.size ? `font-size:${item.size}px` : null }, group)
                text.textContent = label
                break
            }
            default:
                box("hall-service")
        }
    }

    const categoryOf = (item) => (item.type === "zone" ? "zone" : isTable(item) ? "tables" : "objects")

    /**
     * Рисует схему в <svg>. Возвращает Map(id → <g>) для навешивания интерактива.
     * options.grid — показать сетку (редактор).
     */
    const render = (svg, layout, options = {}) => {
        svg.replaceChildren()
        svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`)
        svg.classList.add("hall-svg")

        const defs = svgEl("defs", {}, svg)
        const hatch = svgEl("pattern", { id: "hall-hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs)
        svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 10, class: "hall-hatch-line" }, hatch)

        svgEl("rect", { class: "hall-floor", x: 8, y: 8, width: layout.width - 16, height: layout.height - 16, rx: 24 }, svg)

        if (options.grid) {
            const step = options.grid
            const grid = svgEl("pattern", { id: "hall-grid", width: step, height: step, patternUnits: "userSpaceOnUse" }, defs)
            svgEl("path", { d: `M ${step} 0 H 0 V ${step}`, class: "hall-grid-line" }, grid)
            svgEl("rect", { x: 0, y: 0, width: layout.width, height: layout.height, fill: "url(#hall-grid)", "pointer-events": "none" }, svg)
        }

        const nodes = new Map()
        DRAW_ORDER.forEach((category) => {
            layout.items
                .filter((item) => categoryOf(item) === category)
                .forEach((item) => {
                    const group = svgEl("g", {
                        class: `hall-item hall-item--${item.type}${isTable(item) ? " hall-table" : ""}`,
                        "data-id": item.id,
                        transform: `translate(${item.x} ${item.y}) rotate(${item.r || 0})`
                    }, svg)
                    if (item.type === "zone" && item.color) {
                        group.style.setProperty("--zone", item.color)
                    }
                    if (isTable(item)) {
                        const zone = zonesOf(layout).find((z) => z.id === zoneOf(layout, item))
                        if (zone?.color) group.style.setProperty("--zone", zone.color)
                        drawTable(group, item)
                    } else {
                        drawObject(group, item)
                    }
                    nodes.set(item.id, group)
                })
        })
        return nodes
    }

    window.BohoHall = { TYPES, render, zoneOf, zonesOf, isTable, tableTitle, svgEl }
})()
