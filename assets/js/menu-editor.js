"use strict"

/**
 * Редактор меню Бохо: разделы → категории → блюда.
 * Отмена действий, автосохранение черновика, предпросмотр, проверенное сохранение
 * в assets/js/menu-data.js и копирование фото в assets/img/menu (Chrome/Edge).
 */
;(() => {
    const { TAGS, DRAFT_KEY, esc, formatPrice, safePhoto } = window.BohoMenu

    const AUTOSAVE_KEY = "boho-menu-editor"
    const PHOTO_DIR = "assets/img/menu/"
    const HISTORY_LIMIT = 100

    const clone = (value) => JSON.parse(JSON.stringify(value))
    const published = clone(window.BOHO_MENU || { version: 1, currency: "₽", note: "", sections: [] })

    const sectionsList = document.querySelector("[data-sections]")
    const categoriesList = document.querySelector("[data-categories]")
    const itemsList = document.querySelector("[data-items]")
    const itemsTitle = document.querySelector("[data-items-title]")
    const crumbs = document.querySelector("[data-crumbs]")
    const inspector = document.getElementById("inspector")
    const statusLine = document.getElementById("status")
    const searchInput = document.querySelector("[data-search]")
    const saveButton = document.querySelector("[data-act='save']")
    const fileInput = document.getElementById("file-input")
    const photoInput = document.getElementById("photo-input")

    let menu = clone(published)
    let history = []
    let future = []
    let lastCommitted = JSON.stringify(menu)
    let isDirty = false
    let query = ""
    let photoDir = null // папка assets/img/menu, выбранная пользователем
    const localPreviews = new Map() // путь фото → временная ссылка, пока файл не лежит в папке сайта

    /** Что выбрано: раздел, категория, блюдо и «уровень» инспектора. */
    const sel = { section: null, category: null, item: null, focus: "item" }

    /* ---------- Доступ к данным ---------- */

    const section = () => menu.sections.find((s) => s.id === sel.section) || null
    const category = () => section()?.categories.find((c) => c.id === sel.category) || null
    const item = () => category()?.items.find((i) => i.id === sel.item) || null

    const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

    const ensureSelection = () => {
        if (!section()) sel.section = menu.sections[0]?.id || null
        if (!category()) sel.category = section()?.categories[0]?.id || null
        if (!item()) sel.item = null
    }

    const findItem = (itemId) => {
        for (const s of menu.sections) {
            for (const c of s.categories) {
                const found = c.items.find((i) => i.id === itemId)
                if (found) return { s, c, i: found }
            }
        }
        return null
    }

    const photoSrc = (path) => localPreviews.get(path) || safePhoto(path)

    /* ---------- История и сохранение черновика ---------- */

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
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(menu))
        } catch {
            // хранилище недоступно — работаем без автосохранения
        }
    }

    const commit = ({ redraw = true } = {}) => {
        const current = JSON.stringify(menu)
        if (current === lastCommitted) return
        history.push(lastCommitted)
        if (history.length > HISTORY_LIMIT) history.shift()
        future = []
        lastCommitted = current
        autosave()
        markDirty(true)
        if (redraw) draw()
    }

    const restore = (snapshot) => {
        menu = JSON.parse(snapshot)
        lastCommitted = snapshot
        ensureSelection()
        autosave()
        markDirty(true)
        draw()
    }

    const undo = () => {
        if (!history.length) return
        future.push(JSON.stringify(menu))
        restore(history.pop())
    }

    const redo = () => {
        if (!future.length) return
        history.push(JSON.stringify(menu))
        restore(future.pop())
    }

    /* ---------- Левая колонка: разделы и категории ---------- */

    const count = (s) => s.categories.reduce((sum, c) => sum + c.items.length, 0)

    const renderTree = () => {
        sectionsList.innerHTML = menu.sections
            .map(
                (s) => `<li><button type="button" class="me-row${s.id === sel.section ? " is-active" : ""}${s.id === sel.section && sel.focus === "section" ? " is-focused" : ""}" data-section="${esc(s.id)}">
                    <span class="me-row__name">${esc(s.name || "Без названия")}</span>${s.adult ? `<span class="me-pill">18+</span>` : ""}<span class="me-row__count">${count(s)}</span></button></li>`
            )
            .join("")

        const current = section()
        categoriesList.innerHTML = current
            ? current.categories
                  .map(
                      (c) => `<li><button type="button" class="me-row${c.id === sel.category ? " is-active" : ""}${c.id === sel.category && sel.focus === "category" ? " is-focused" : ""}" data-category="${esc(c.id)}">
                        <span class="me-row__name">${esc(c.name || "Без названия")}</span><span class="me-row__count">${c.items.length}</span></button></li>`
                  )
                  .join("") || `<li class="me-empty">В разделе пока нет категорий</li>`
            : ""
    }

    sectionsList.addEventListener("click", (event) => {
        const row = event.target.closest("[data-section]")
        if (!row) return
        const changed = sel.section !== row.dataset.section
        sel.section = row.dataset.section
        if (changed) {
            sel.category = section()?.categories[0]?.id || null
            sel.item = null
        }
        sel.focus = "section"
        clearSearch()
        draw()
    })

    categoriesList.addEventListener("click", (event) => {
        const row = event.target.closest("[data-category]")
        if (!row) return
        if (sel.category !== row.dataset.category) sel.item = null
        sel.category = row.dataset.category
        sel.focus = "category"
        clearSearch()
        draw()
    })

    /* ---------- Центр: список блюд ---------- */

    const dishRow = (dish, context) => {
        const src = photoSrc(dish.photo)
        const tags = (dish.tags || []).filter((tag) => TAGS[tag]).map((tag) => `<span class="me-tag">${TAGS[tag].label}</span>`).join("")
        const flags = `${dish.soldOut ? `<span class="me-flag me-flag--sold">Нет в наличии</span>` : ""}${dish.hidden ? `<span class="me-flag">Скрыто</span>` : ""}`
        return `<li class="me-dish${dish.id === sel.item ? " is-active" : ""}${dish.hidden ? " is-hidden" : ""}" data-item="${esc(dish.id)}" draggable="${context ? "false" : "true"}">
            <span class="me-dish__grip" aria-hidden="true">⋮⋮</span>
            <span class="me-dish__thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span>${esc((dish.name || "?").slice(0, 1))}</span>`}</span>
            <span class="me-dish__info">
                <span class="me-dish__name">${esc(dish.name || "Без названия")}</span>
                <span class="me-dish__sub">${context ? `${esc(context)} · ` : ""}${esc(dish.unit || "")} ${tags}${flags}</span>
            </span>
            <span class="me-dish__price">${formatPrice(dish.price, menu.currency) || "—"}</span>
        </li>`
    }

    const renderItems = () => {
        if (query) {
            const found = []
            menu.sections.forEach((s) =>
                s.categories.forEach((c) =>
                    c.items.forEach((dish) => {
                        if (`${dish.name} ${dish.desc || ""}`.toLowerCase().includes(query)) found.push(dishRow(dish, `${s.name} → ${c.name}`))
                    })
                )
            )
            crumbs.textContent = "Поиск"
            itemsTitle.textContent = `Найдено: ${found.length}`
            itemsList.innerHTML = found.join("") || `<li class="me-empty">Ничего не нашлось</li>`
            return
        }
        const s = section()
        const c = category()
        crumbs.textContent = s ? s.name : ""
        itemsTitle.textContent = c ? c.name : s ? "Создайте категорию" : "Создайте раздел"
        itemsList.innerHTML = c ? c.items.map((dish) => dishRow(dish)).join("") || `<li class="me-empty">В категории пока нет блюд — нажмите «+ Блюдо»</li>` : ""
    }

    itemsList.addEventListener("click", (event) => {
        const row = event.target.closest("[data-item]")
        if (!row) return
        const found = findItem(row.dataset.item)
        if (!found) return
        sel.section = found.s.id
        sel.category = found.c.id
        sel.item = found.i.id
        sel.focus = "item"
        draw()
    })

    // Перетаскивание строк для смены порядка
    let dragId = null
    itemsList.addEventListener("dragstart", (event) => {
        const row = event.target.closest("[data-item]")
        if (!row) return
        dragId = row.dataset.item
        row.classList.add("is-dragging")
        event.dataTransfer.effectAllowed = "move"
    })
    itemsList.addEventListener("dragover", (event) => {
        if (!dragId) return
        event.preventDefault()
        const row = event.target.closest("[data-item]")
        itemsList.querySelectorAll(".is-drop-before, .is-drop-after").forEach((node) => node.classList.remove("is-drop-before", "is-drop-after"))
        if (!row || row.dataset.item === dragId) return
        const rect = row.getBoundingClientRect()
        row.classList.add(event.clientY < rect.top + rect.height / 2 ? "is-drop-before" : "is-drop-after")
    })
    itemsList.addEventListener("drop", (event) => {
        event.preventDefault()
        const row = itemsList.querySelector(".is-drop-before, .is-drop-after")
        const c = category()
        if (row && c && dragId) {
            const moving = c.items.find((dish) => dish.id === dragId)
            const rest = c.items.filter((dish) => dish.id !== dragId)
            let index = rest.findIndex((dish) => dish.id === row.dataset.item)
            if (row.classList.contains("is-drop-after")) index += 1
            rest.splice(index, 0, moving)
            c.items = rest
            commit()
        }
        dragId = null
    })
    itemsList.addEventListener("dragend", () => {
        dragId = null
        draw()
    })

    const clearSearch = () => {
        query = ""
        searchInput.value = ""
    }
    searchInput.addEventListener("input", () => {
        query = searchInput.value.trim().toLowerCase()
        renderItems()
    })

    /* ---------- Инспектор ---------- */

    const input = (label, name, value, attrs = "") =>
        `<label class="ed-field"><span>${label}</span><input data-field="${name}" value="${esc(value ?? "")}" ${attrs}></label>`
    const textarea = (label, name, value, rows = 3) =>
        `<label class="ed-field"><span>${label}</span><textarea data-field="${name}" rows="${rows}">${esc(value ?? "")}</textarea></label>`
    const check = (label, name, checked) => `<label class="ed-check"><input type="checkbox" data-field="${name}" ${checked ? "checked" : ""}> ${label}</label>`

    const renderItemInspector = (dish) => {
        const src = photoSrc(dish.photo)
        const categoryOptions = menu.sections
            .map((s) => `<optgroup label="${esc(s.name)}">${s.categories.map((c) => `<option value="${esc(s.id)}/${esc(c.id)}" ${c.id === sel.category && s.id === sel.section ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>`)
            .join("")
        const tagChecks = Object.entries(TAGS)
            .map(([id, tag]) => `<label class="me-chip"><input type="checkbox" data-tag="${id}" ${dish.tags?.includes(id) ? "checked" : ""}><span>${tag.label}</span></label>`)
            .join("")

        inspector.innerHTML = `
            <div class="ed-insp__head"><p class="ed-insp__type">Блюдо</p><p class="ed-insp__title">${esc(dish.name || "Без названия")}</p></div>
            <fieldset class="ed-group"><legend>Описание</legend>
                ${input("Название", "name", dish.name, 'maxlength="80"')}
                ${textarea("Состав / описание", "desc", dish.desc)}
                <div class="ed-row">
                    ${input(`Цена, ${esc(menu.currency || "₽")}`, "price", dish.price, 'type="number" min="0" step="10"')}
                    ${input("Выход / объём", "unit", dish.unit, 'placeholder="250 г, 300 мл"')}
                </div>
            </fieldset>
            <fieldset class="ed-group"><legend>Фото</legend>
                <div class="me-photo">${src ? `<img src="${esc(src)}" alt="">` : `<span>Нет фото — на сайте будет красивая заглушка</span>`}</div>
                <div class="ed-row">
                    <button type="button" class="ed-btn" data-act="pick-photo">Выбрать файл…</button>
                    <button type="button" class="ed-btn" data-act="clear-photo" ${dish.photo ? "" : "disabled"}>Убрать фото</button>
                </div>
                ${input("Путь или ссылка на фото", "photo", dish.photo, 'placeholder="assets/img/menu/borsch.webp или https://…"')}
            </fieldset>
            <fieldset class="ed-group"><legend>Метки</legend><div class="me-chips">${tagChecks}</div></fieldset>
            <fieldset class="ed-group"><legend>Показ на сайте</legend>
                ${check("Нет в наличии (блюдо видно, но серое)", "soldOut", dish.soldOut)}
                ${check("Скрыть с сайта", "hidden", dish.hidden)}
                <label class="ed-field"><span>Категория</span><select data-field="move">${categoryOptions}</select></label>
            </fieldset>
            <div class="ed-actions-row">
                <button type="button" class="ed-btn" data-act="item-up" title="Alt+↑">↑ Выше</button>
                <button type="button" class="ed-btn" data-act="item-down" title="Alt+↓">↓ Ниже</button>
                <button type="button" class="ed-btn" data-act="item-duplicate" title="Ctrl+D">Дублировать</button>
                <button type="button" class="ed-btn ed-btn--danger" data-act="item-delete" title="Delete">Удалить</button>
            </div>`
    }

    const renderCategoryInspector = (c) => {
        inspector.innerHTML = `
            <div class="ed-insp__head"><p class="ed-insp__type">Категория</p><p class="ed-insp__title">${esc(c.name || "Без названия")}</p></div>
            <fieldset class="ed-group"><legend>Категория</legend>
                ${input("Название", "category-name", c.name, 'maxlength="60"')}
                <p class="ed-note">Блюд: ${c.items.length}. На странице меню категория — отдельный блок со своим пунктом в навигации.</p>
            </fieldset>
            <div class="ed-actions-row">
                <button type="button" class="ed-btn" data-act="category-up">↑ Выше</button>
                <button type="button" class="ed-btn" data-act="category-down">↓ Ниже</button>
                <button type="button" class="ed-btn" data-act="add-item">+ Блюдо</button>
                <button type="button" class="ed-btn ed-btn--danger" data-act="category-delete">Удалить</button>
            </div>`
    }

    const renderSectionInspector = (s) => {
        inspector.innerHTML = `
            <div class="ed-insp__head"><p class="ed-insp__type">Раздел</p><p class="ed-insp__title">${esc(s.name || "Без названия")}</p></div>
            <fieldset class="ed-group"><legend>Раздел</legend>
                ${input("Название вкладки", "section-name", s.name, 'maxlength="30"')}
                ${textarea("Вступление", "section-intro", s.intro, 3)}
                ${check("Только 18+ (показывать предупреждение)", "section-adult", s.adult)}
                <p class="ed-note">Адрес вкладки: <code>menu.html#${esc(s.id)}</code></p>
            </fieldset>
            <div class="ed-actions-row">
                <button type="button" class="ed-btn" data-act="section-up">↑ Выше</button>
                <button type="button" class="ed-btn" data-act="section-down">↓ Ниже</button>
                <button type="button" class="ed-btn" data-act="add-category">+ Категория</button>
                <button type="button" class="ed-btn ed-btn--danger" data-act="section-delete">Удалить</button>
            </div>`
    }

    const validate = () => {
        const problems = []
        menu.sections.forEach((s) => {
            if (!s.name?.trim()) problems.push({ text: "Раздел без названия", target: { section: s.id, focus: "section" } })
            s.categories.forEach((c) => {
                if (!c.name?.trim()) problems.push({ text: `${s.name}: категория без названия`, target: { section: s.id, category: c.id, focus: "category" } })
                c.items.forEach((dish) => {
                    const target = { section: s.id, category: c.id, item: dish.id, focus: "item" }
                    if (!dish.name?.trim()) problems.push({ text: `${c.name}: блюдо без названия`, target })
                    if (dish.price === "" || dish.price === undefined || dish.price === null) problems.push({ text: `«${dish.name}» — не указана цена`, target })
                    if (dish.photo && !safePhoto(dish.photo)) problems.push({ text: `«${dish.name}» — некорректный путь к фото`, target })
                })
            })
        })
        return problems
    }

    const renderMenuInspector = () => {
        const problems = validate()
        const dishes = menu.sections.reduce((sum, s) => sum + count(s), 0)
        const withoutPhoto = menu.sections.flatMap((s) => s.categories.flatMap((c) => c.items)).filter((dish) => !dish.photo).length
        inspector.innerHTML = `
            <div class="ed-insp__head"><p class="ed-insp__type">Меню</p><p class="ed-insp__title">Настройки</p></div>
            <fieldset class="ed-group"><legend>Общее</legend>
                ${textarea("Примечание под заголовком", "menu-note", menu.note, 2)}
                ${input("Валюта", "menu-currency", menu.currency || "₽", 'maxlength="5"')}
            </fieldset>
            <fieldset class="ed-group"><legend>Сводка</legend>
                <p class="ed-note">Разделов: ${menu.sections.length} · блюд: ${dishes} · без фото: ${withoutPhoto}</p>
            </fieldset>
            <fieldset class="ed-group"><legend>Проверка меню</legend>
                ${problems.length
                    ? `<ul class="ed-problems">${problems.map((p, index) => `<li><button type="button" data-goto="${index}">${esc(p.text)}</button></li>`).join("")}</ul>`
                    : `<p class="ed-ok">Ошибок нет — меню можно сохранять.</p>`}
            </fieldset>`
        inspector.problems = problems
    }

    const renderInspector = () => {
        // Пока пользователь печатает в поле — не перерисовываем инспектор под ним
        if (inspector.contains(document.activeElement) && document.activeElement.matches("input:not([type=checkbox]), textarea") && inspector.dataset.key === inspectorKey()) return
        inspector.dataset.key = inspectorKey()
        if (sel.focus === "menu") return renderMenuInspector()
        if (sel.focus === "item" && item()) return renderItemInspector(item())
        if (sel.focus === "section" && section()) return renderSectionInspector(section())
        if (category()) return renderCategoryInspector(category())
        if (section()) return renderSectionInspector(section())
        renderMenuInspector()
    }

    const inspectorKey = () => `${sel.focus}:${sel.section}/${sel.category}/${sel.item}`

    const renderBadge = () => {
        const problems = validate().length
        const badge = document.querySelector("[data-problems]")
        badge.hidden = problems === 0
        badge.textContent = problems
    }

    const draw = () => {
        ensureSelection()
        renderTree()
        renderItems()
        renderInspector()
        renderBadge()
    }

    /* ---------- Правка полей ---------- */

    const applyField = (field, value, target) => {
        const dish = item()
        const s = section()
        const c = category()
        switch (field) {
            case "name":
            case "desc":
            case "unit":
                dish[field] = value
                break
            case "price":
                dish.price = value === "" ? "" : Math.max(0, Number(value))
                break
            case "photo":
                dish.photo = value.trim()
                break
            case "soldOut":
            case "hidden":
                if (target.checked) dish[field] = true
                else delete dish[field]
                break
            case "category-name":
                c.name = value
                break
            case "section-name":
                s.name = value
                break
            case "section-intro":
                s.intro = value
                break
            case "section-adult":
                if (target.checked) s.adult = true
                else delete s.adult
                break
            case "menu-note":
                menu.note = value
                break
            case "menu-currency":
                menu.currency = value || "₽"
                break
        }
    }

    inspector.addEventListener("input", (event) => {
        const target = event.target
        if (target.dataset.tag) {
            const dish = item()
            const tags = new Set(dish.tags || [])
            target.checked ? tags.add(target.dataset.tag) : tags.delete(target.dataset.tag)
            dish.tags = Object.keys(TAGS).filter((tag) => tags.has(tag))
            commit({ redraw: false })
            renderItems()
            return
        }
        const field = target.dataset.field
        if (!field || field === "move") return
        applyField(field, target.value, target)
        // Текстовые поля: обновляем списки сразу, а в историю записываем по окончании правки (change)
        if (target.type === "checkbox") commit({ redraw: false })
        renderTree()
        renderItems()
        renderBadge()
        const title = inspector.querySelector(".ed-insp__title")
        if (title && ["name", "category-name", "section-name"].includes(field)) title.textContent = target.value || "Без названия"
        if (field === "photo") updatePhotoPreview()
    })

    inspector.addEventListener("change", (event) => {
        const target = event.target
        if (target.dataset.field === "move") {
            moveItem(target.value)
            return
        }
        if (target.dataset.field && target.type !== "checkbox") commit({ redraw: false })
    })

    inspector.addEventListener("click", (event) => {
        const goto = event.target.closest("[data-goto]")
        if (goto) {
            const problem = inspector.problems?.[Number(goto.dataset.goto)]
            if (problem) {
                Object.assign(sel, { section: null, category: null, item: null }, problem.target)
                draw()
            }
            return
        }
        const action = event.target.closest("[data-act]")?.dataset.act
        if (action) run(action)
    })

    const updatePhotoPreview = () => {
        const box = inspector.querySelector(".me-photo")
        if (!box) return
        const src = photoSrc(item()?.photo)
        box.innerHTML = src ? `<img src="${esc(src)}" alt="">` : `<span>Нет фото — на сайте будет красивая заглушка</span>`
    }

    const moveItem = (value) => {
        const [sectionId, categoryId] = value.split("/")
        const dish = item()
        const from = category()
        const to = menu.sections.find((s) => s.id === sectionId)?.categories.find((c) => c.id === categoryId)
        if (!dish || !to || to === from) return
        from.items = from.items.filter((other) => other.id !== dish.id)
        to.items.push(dish)
        sel.section = sectionId
        sel.category = categoryId
        commit()
        setStatus(`«${dish.name}» перенесено в «${to.name}».`, "ok")
    }

    /* ---------- Фото ---------- */

    const slug = (name) => {
        const map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" }
        return name.toLowerCase().split("").map((char) => map[char] ?? char).join("").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "")
    }

    const choosePhotoFolder = async () => {
        if (!("showDirectoryPicker" in window)) {
            setStatus("Этот браузер не умеет копировать файлы сам. Кладите фото в папку assets/img/menu вручную — путь редактор подставит.", "warn")
            return false
        }
        try {
            photoDir = await window.showDirectoryPicker({ id: "boho-menu-photos", mode: "readwrite" })
            setStatus(`Папка фото: «${photoDir.name}». Новые фото будут копироваться туда автоматически.`, "ok")
            if (photoDir.name !== "menu") setStatus(`Выбрана папка «${photoDir.name}». Убедитесь, что это assets/img/menu — иначе фото не найдутся на сайте.`, "warn")
            return true
        } catch {
            return false
        }
    }

    photoInput.addEventListener("change", async () => {
        const file = photoInput.files[0]
        photoInput.value = ""
        const dish = item()
        if (!file || !dish) return
        const extension = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase()
        const filename = `${slug(dish.name || "dish") || "dish"}-${Date.now().toString(36).slice(-4)}${extension}`
        const path = PHOTO_DIR + filename
        localPreviews.set(path, URL.createObjectURL(file))
        dish.photo = path
        commit()

        if (photoDir) {
            try {
                const handle = await photoDir.getFileHandle(filename, { create: true })
                const writable = await handle.createWritable()
                await writable.write(file)
                await writable.close()
                setStatus(`Фото скопировано: ${path}`, "ok")
                return
            } catch {
                setStatus(`Не удалось скопировать фото. Положите файл «${file.name}» в assets/img/menu под именем ${filename}.`, "warn")
                return
            }
        }
        setStatus(`Путь подставлен: ${path}. Скопируйте файл «${file.name}» в папку assets/img/menu под именем ${filename} — или нажмите «Папка фото», чтобы редактор делал это сам.`, "warn")
    })

    /* ---------- Действия ---------- */

    const moveInArray = (array, index, step) => {
        const target = index + step
        if (index < 0 || target < 0 || target >= array.length) return false
        ;[array[index], array[target]] = [array[target], array[index]]
        return true
    }

    const run = async (action) => {
        const s = section()
        const c = category()
        const dish = item()
        switch (action) {
            case "undo":
                return undo()
            case "redo":
                return redo()
            case "save":
                return save()
            case "preview":
                return preview()
            case "import":
                return fileInput.click()
            case "help":
                return document.getElementById("help").showModal()
            case "photo-folder":
                return choosePhotoFolder()
            case "menu-settings":
                sel.focus = "menu"
                return draw()
            case "reset":
                if (confirm("Загрузить меню, опубликованное на сайте? Несохранённые изменения пропадут.")) {
                    menu = clone(published)
                    ensureSelection()
                    commit()
                    markDirty(false)
                    setStatus("Загружено меню с сайта.")
                }
                return

            case "add-section": {
                const created = { id: newId("s"), name: "Новый раздел", intro: "", categories: [{ id: newId("c"), name: "Новая категория", items: [] }] }
                menu.sections.push(created)
                Object.assign(sel, { section: created.id, category: created.categories[0].id, item: null, focus: "section" })
                commit()
                inspector.querySelector("[data-field='section-name']")?.select()
                return
            }
            case "add-category": {
                if (!s) return run("add-section")
                const created = { id: newId("c"), name: "Новая категория", items: [] }
                s.categories.push(created)
                Object.assign(sel, { category: created.id, item: null, focus: "category" })
                commit()
                inspector.querySelector("[data-field='category-name']")?.select()
                return
            }
            case "add-item": {
                if (!c) return run("add-category")
                const created = { id: newId("i"), name: "Новое блюдо", desc: "", price: "", unit: "", photo: "", tags: [] }
                c.items.push(created)
                Object.assign(sel, { item: created.id, focus: "item" })
                clearSearch()
                commit()
                inspector.querySelector("[data-field='name']")?.select()
                return
            }

            case "item-up":
            case "item-down":
                if (dish && moveInArray(c.items, c.items.indexOf(dish), action === "item-up" ? -1 : 1)) commit()
                return
            case "item-duplicate": {
                if (!dish) return
                const copy = { ...clone(dish), id: newId("i"), name: `${dish.name} (копия)` }
                c.items.splice(c.items.indexOf(dish) + 1, 0, copy)
                sel.item = copy.id
                commit()
                return
            }
            case "item-delete":
                if (!dish || !confirm(`Удалить «${dish.name}»?`)) return
                c.items = c.items.filter((other) => other.id !== dish.id)
                sel.item = null
                sel.focus = "category"
                commit()
                setStatus("Блюдо удалено. Ctrl+Z — вернуть.")
                return
            case "pick-photo":
                return photoInput.click()
            case "clear-photo":
                if (!dish) return
                dish.photo = ""
                commit()
                return

            case "category-up":
            case "category-down":
                if (c && moveInArray(s.categories, s.categories.indexOf(c), action === "category-up" ? -1 : 1)) commit()
                return
            case "category-delete":
                if (!c || !confirm(c.items.length ? `Удалить категорию «${c.name}» вместе с блюдами (${c.items.length})?` : `Удалить категорию «${c.name}»?`)) return
                s.categories = s.categories.filter((other) => other.id !== c.id)
                sel.category = null
                commit()
                return

            case "section-up":
            case "section-down":
                if (s && moveInArray(menu.sections, menu.sections.indexOf(s), action === "section-up" ? -1 : 1)) commit()
                return
            case "section-delete":
                if (!s || !confirm(`Удалить раздел «${s.name}» со всеми категориями и блюдами (${count(s)})?`)) return
                menu.sections = menu.sections.filter((other) => other.id !== s.id)
                Object.assign(sel, { section: null, category: null, item: null, focus: "section" })
                commit()
                return
        }
    }

    document.querySelectorAll(".ed-top [data-act], .me-tree [data-act], .me-items__head [data-act]").forEach((button) => {
        button.addEventListener("click", () => run(button.dataset.act))
    })
    document.querySelector("[data-help-close]").addEventListener("click", () => document.getElementById("help").close())

    document.addEventListener("keydown", (event) => {
        const typing = event.target instanceof Element && event.target.closest("input, textarea, select")
        const mod = event.ctrlKey || event.metaKey
        const key = event.key.toLowerCase()
        if (mod && (key === "s" || key === "ы")) {
            event.preventDefault()
            return save()
        }
        if (typing) return
        if (mod && (key === "z" || key === "я")) {
            event.preventDefault()
            return event.shiftKey ? redo() : undo()
        }
        if (mod && (key === "y" || key === "н")) {
            event.preventDefault()
            return redo()
        }
        if (!item()) return
        if (mod && (key === "d" || key === "в")) {
            event.preventDefault()
            return run("item-duplicate")
        }
        if (event.key === "Delete") return run("item-delete")
        if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault()
            return run(event.key === "ArrowUp" ? "item-up" : "item-down")
        }
    })

    /* ---------- Файл меню ---------- */

    /** Файл читается и правится руками: каждое блюдо — одна строка. */
    const formatFile = () => {
        const line = (value) => JSON.stringify(value).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }")
        const sectionsText = menu.sections
            .map((s) => {
                const { categories, ...meta } = s
                const metaText = Object.entries(meta).map(([key, value]) => `            ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join("\n")
                const categoriesText = categories
                    .map((c) => {
                        const items = c.items.map((dish) => `                        ${line(dish)}`).join(",\n")
                        return `                {\n                    "id": ${JSON.stringify(c.id)},\n                    "name": ${JSON.stringify(c.name)},\n                    "items": [\n${items}\n                    ]\n                }`
                    })
                    .join(",\n")
                return `        {\n${metaText}\n            "categories": [\n${categoriesText}\n            ]\n        }`
            })
            .join(",\n")
        return `/*
 * Меню Бохо.
 * Этот файл создаёт редактор меню (menu-editor.html) — править вручную не обязательно.
 * После изменений в редакторе сохраните файл сюда же: assets/js/menu-data.js
 */
window.BOHO_MENU = {
    "version": 1,
    "currency": ${JSON.stringify(menu.currency || "₽")},
    "note": ${JSON.stringify(menu.note || "")},
    "sections": [
${sectionsText}
    ]
}
`
    }

    const saveFile = window.BohoFile.createSaver({ filename: "menu-data.js", sitePath: "assets/js/menu-data.js", description: "Меню" })

    const save = async () => {
        const problems = validate()
        if (problems.length && !confirm(`В меню есть замечания (${problems.length}): ${problems[0].text}… Всё равно сохранить?`)) return
        const result = await saveFile(formatFile())
        if (!result) return
        if (result.ok) markDirty(false)
        setStatus(result.message, result.tone)
    }

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0]
        fileInput.value = ""
        if (!file) return
        try {
            const text = await file.text()
            const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1))
            if (!Array.isArray(json.sections)) throw new Error("нет списка разделов")
            menu = { version: 1, currency: json.currency || "₽", note: json.note || "", sections: json.sections }
            Object.assign(sel, { section: null, category: null, item: null })
            commit()
            setStatus(`Открыт файл «${file.name}».`, "ok")
        } catch (error) {
            setStatus(`Не удалось открыть файл: ${error.message}`, "warn")
        }
    })

    const preview = () => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(menu))
        } catch {
            setStatus("Браузер не дал сохранить черновик для предпросмотра.", "warn")
            return
        }
        const hash = section() ? `#${section().id}` : ""
        window.open(`menu.html?menu=draft${hash}`, "_blank")
    }

    window.addEventListener("beforeunload", (event) => {
        if (isDirty) event.preventDefault()
    })

    /* ---------- Старт ---------- */

    const publishedBroken = !Array.isArray(window.BOHO_MENU?.sections) || window.BOHO_MENU.sections.length === 0
    try {
        const saved = localStorage.getItem(AUTOSAVE_KEY)
        if (saved && saved !== JSON.stringify(published)) {
            menu = JSON.parse(saved)
            lastCommitted = saved
            markDirty(true)
            setStatus("Восстановлен несохранённый черновик. «Меню с сайта» — вернуть опубликованную версию.", "warn")
        } else {
            markDirty(false)
            setStatus("Выберите раздел и категорию слева, блюдо — в списке. «?» — подсказки.")
        }
    } catch {
        markDirty(false)
    }
    if (publishedBroken) {
        setStatus("Внимание: файл assets/js/menu-data.js на сайте пуст или повреждён — меню на сайте не показывается. Откройте копию или сохраните меню заново.", "warn")
    }
    draw()
})()
