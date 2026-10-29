"use strict"

/**
 * Страница меню: разделы, категории, поиск, фильтры по меткам и карточка блюда.
 * Данные — assets/js/menu-data.js (window.BOHO_MENU), предпросмотр черновика — menu.html?menu=draft
 */
;(() => {
    const { TAGS, esc, formatPrice, safePhoto, load } = window.BohoMenu
    const menu = load()
    const list = document.querySelector("[data-menu-list]")

    if (!menu?.sections?.length) {
        list.innerHTML = `<p class="menu-empty">Меню скоро появится.</p>`
        return
    }

    const tabs = document.querySelector("[data-menu-tabs]")
    const cats = document.querySelector("[data-menu-cats]")
    const filters = document.querySelector("[data-menu-filters]")
    const search = document.querySelector("[data-menu-search]")
    const adultNote = document.querySelector("[data-menu-adult]")
    const dialog = document.querySelector("[data-dish-dialog]")
    const currency = menu.currency || "₽"

    document.querySelector("[data-menu-note]").textContent = menu.note || ""

    const visibleItems = (category) => (category.items || []).filter((item) => !item.hidden)
    const sections = menu.sections.filter((section) => section.categories?.some((category) => visibleItems(category).length))

    let activeSection = sections.find((section) => `#${section.id}` === location.hash)?.id || sections[0].id
    const activeTags = new Set()
    let query = ""

    /* ---------- Разметка ---------- */

    const placeholder = (section) => `<span class="dish__placeholder" aria-hidden="true"><span>${esc(section.name.slice(0, 1))}</span></span>`

    const photo = (item, section) => {
        const src = safePhoto(item.photo)
        if (!src) return placeholder(section)
        return `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" data-fallback="${esc(section.name.slice(0, 1))}">`
    }

    const tagBadges = (item) =>
        (item.tags || [])
            .filter((tag) => TAGS[tag])
            .map((tag) => `<li class="dish-tag dish-tag--${tag}">${TAGS[tag].label}</li>`)
            .join("")

    const card = (item, section, category) => `
        <article class="dish${item.soldOut ? " is-sold-out" : ""}">
            <button type="button" class="dish__btn" data-dish="${esc(section.id)}/${esc(category.id)}/${esc(item.id)}" aria-label="${esc(item.name)}, ${formatPrice(item.price, currency)}${item.soldOut ? ", нет в наличии" : ""}">
                <span class="dish__media">${photo(item, section)}
                    ${item.tags?.length ? `<ul class="dish-tags dish-tags--overlay">${tagBadges(item)}</ul>` : ""}
                    ${item.soldOut ? `<span class="dish__sold">Нет в наличии</span>` : ""}
                </span>
                <span class="dish__body">
                    <span class="dish__name">${esc(item.name)}</span>
                    ${item.desc ? `<span class="dish__desc">${esc(item.desc)}</span>` : ""}
                    <span class="dish__meta">
                        <span class="dish__unit">${esc(item.unit || "")}</span>
                        <span class="dish__price">${formatPrice(item.price, currency)}</span>
                    </span>
                </span>
            </button>
        </article>`

    const matches = (item) => {
        if (activeTags.size && ![...activeTags].every((tag) => item.tags?.includes(tag))) return false
        if (!query) return true
        const haystack = `${item.name} ${item.desc || ""}`.toLowerCase()
        return query.split(/\s+/).every((word) => haystack.includes(word))
    }

    /* ---------- Отрисовка ---------- */

    const renderTabs = () => {
        tabs.innerHTML = sections
            .map((section) => {
                const count = section.categories.reduce((sum, category) => sum + visibleItems(category).length, 0)
                const selected = section.id === activeSection && !query
                return `<button type="button" role="tab" class="menu-tab-btn${selected ? " is-active" : ""}" aria-selected="${selected}" data-section="${esc(section.id)}">
                    <span class="menu-tab-btn__name">${esc(section.name)}</span><span class="menu-tab-btn__count">${count}</span></button>`
            })
            .join("")
    }

    const renderFilters = () => {
        const used = new Set(sections.flatMap((section) => section.categories.flatMap((category) => visibleItems(category).flatMap((item) => item.tags || []))))
        filters.innerHTML = Object.entries(TAGS)
            .filter(([id]) => used.has(id))
            .map(([id, tag]) => `<button type="button" class="menu-filter menu-filter--${id}${activeTags.has(id) ? " is-active" : ""}" aria-pressed="${activeTags.has(id)}" data-tag="${id}">${tag.label}</button>`)
            .join("")
    }

    const renderList = () => {
        // При поиске показываем совпадения из всех разделов
        const scope = query ? sections : sections.filter((section) => section.id === activeSection)
        const blocks = []
        const catLinks = []

        scope.forEach((section) => {
            section.categories.forEach((category) => {
                const items = visibleItems(category).filter(matches)
                if (!items.length) return
                const anchor = `cat-${section.id}-${category.id}`
                catLinks.push(`<a class="menu-cat" href="#${esc(anchor)}" data-cat="${esc(anchor)}">${esc(category.name)}</a>`)
                blocks.push(`
                    <section class="menu-category" id="${esc(anchor)}" aria-labelledby="${esc(anchor)}-title">
                        <header class="menu-category__head">
                            <h2 class="menu-category__title" id="${esc(anchor)}-title">${esc(category.name)}</h2>
                            ${query ? `<span class="menu-category__section">${esc(section.name)}</span>` : ""}
                        </header>
                        <div class="dish-grid">${items.map((item) => card(item, section, category)).join("")}</div>
                    </section>`)
            })
        })

        const current = sections.find((section) => section.id === activeSection)
        const intro = !query && current?.intro ? `<p class="menu-intro">${esc(current.intro)}</p>` : ""

        list.innerHTML = blocks.length
            ? intro + blocks.join("")
            : `<div class="menu-empty"><p>Ничего не нашлось.</p><button type="button" class="btn btn--ghost" data-reset>Сбросить поиск и фильтры</button></div>`
        cats.innerHTML = catLinks.join("")
        adultNote.hidden = !(query ? scope.some((section) => section.adult) : current?.adult)

        attachImageFallbacks()
        observeCategories()
    }

    const renderAll = () => {
        renderTabs()
        renderFilters()
        renderList()
    }

    /* ---------- Картинки: если внешняя ссылка не загрузилась — заглушка ---------- */

    const attachImageFallbacks = () => {
        list.querySelectorAll("img[data-fallback]").forEach((img) => {
            img.addEventListener(
                "error",
                () => {
                    const fallback = document.createElement("span")
                    fallback.className = "dish__placeholder"
                    fallback.innerHTML = `<span>${esc(img.dataset.fallback)}</span>`
                    img.replaceWith(fallback)
                },
                { once: true }
            )
        })
    }

    /* ---------- Подсветка текущей категории при прокрутке ---------- */

    let observer
    const observeCategories = () => {
        observer?.disconnect()
        const links = new Map([...cats.querySelectorAll("[data-cat]")].map((link) => [link.dataset.cat, link]))
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return
                    links.forEach((link) => link.classList.remove("is-active"))
                    const link = links.get(entry.target.id)
                    if (!link) return
                    link.classList.add("is-active")
                    link.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
                })
            },
            { rootMargin: "-35% 0px -60% 0px" }
        )
        list.querySelectorAll(".menu-category").forEach((section) => observer.observe(section))
    }

    cats.addEventListener("click", (event) => {
        const link = event.target.closest("[data-cat]")
        if (!link) return
        event.preventDefault()
        const target = document.getElementById(link.dataset.cat)
        const offset = document.querySelector("[data-menu-toolbar]").offsetHeight + 72
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" })
    })

    /* ---------- Разделы, поиск, фильтры ---------- */

    tabs.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-section]")
        if (!tab) return
        activeSection = tab.dataset.section
        if (query) {
            query = ""
            search.value = ""
        }
        history.replaceState(null, "", `#${activeSection}`)
        renderAll()
        const top = document.querySelector("[data-menu-toolbar]").getBoundingClientRect().top + window.scrollY - 60
        if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" })
    })

    // Стрелки влево/вправо по вкладкам разделов
    tabs.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return
        const buttons = [...tabs.querySelectorAll("[data-section]")]
        const index = buttons.indexOf(document.activeElement)
        const next = buttons[(index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]
        next.click()
        tabs.querySelector(`[data-section="${CSS.escape(next.dataset.section)}"]`)?.focus()
    })

    filters.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tag]")
        if (!button) return
        const tag = button.dataset.tag
        activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag)
        renderFilters()
        renderList()
    })

    let searchTimer
    search.addEventListener("input", () => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => {
            query = search.value.trim().toLowerCase()
            renderTabs()
            renderList()
        }, 120)
    })

    list.addEventListener("click", (event) => {
        if (event.target.closest("[data-reset]")) {
            query = ""
            search.value = ""
            activeTags.clear()
            renderAll()
            return
        }
        const button = event.target.closest("[data-dish]")
        if (button) openDish(button.dataset.dish)
    })

    /* ---------- Карточка блюда ---------- */

    const openDish = (path) => {
        const [sectionId, categoryId, itemId] = path.split("/")
        const section = sections.find((s) => s.id === sectionId)
        const category = section?.categories.find((c) => c.id === categoryId)
        const item = category?.items.find((i) => i.id === itemId)
        if (!item) return

        dialog.querySelector("[data-dish-media]").innerHTML = photo(item, section)
        dialog.querySelector("[data-dish-media] img")?.removeAttribute("loading")
        dialog.querySelector("[data-dish-category]").textContent = `${section.name} · ${category.name}`
        dialog.querySelector("[data-dish-title]").textContent = item.name
        dialog.querySelector("[data-dish-tags]").innerHTML = tagBadges(item) + (item.soldOut ? `<li class="dish-tag dish-tag--sold">Нет в наличии</li>` : "")
        dialog.querySelector("[data-dish-desc]").textContent = item.desc || ""
        dialog.querySelector("[data-dish-unit]").textContent = item.unit || ""
        dialog.querySelector("[data-dish-price]").textContent = formatPrice(item.price, currency)
        dialog.showModal()
    }

    dialog.querySelector("[data-dish-close]").addEventListener("click", () => dialog.close())
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close()
    })

    window.addEventListener("hashchange", () => {
        const section = sections.find((s) => `#${s.id}` === location.hash)
        if (section && section.id !== activeSection) {
            activeSection = section.id
            renderAll()
        }
    })

    renderAll()
})()
