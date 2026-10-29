/**
 * Общее для страницы меню и редактора меню.
 */
;(function () {
    "use strict"

    const DRAFT_KEY = "boho-menu-draft"

    /** Метки блюд. Порядок здесь = порядок фильтров на странице. */
    const TAGS = {
        hit: { label: "Хит" },
        new: { label: "Новинка" },
        signature: { label: "Авторское" },
        veg: { label: "Вегетарианское" },
        spicy: { label: "Острое" }
    }

    const esc = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

    const formatPrice = (price, currency = "₽") => {
        if (price === "" || price === null || price === undefined || Number.isNaN(Number(price))) return ""
        return `${Number(price).toLocaleString("ru-RU")} ${currency}`
    }

    /** Разрешаем только безопасные адреса картинок: относительные пути и http(s). */
    const safePhoto = (src) => {
        const value = String(src || "").trim()
        if (!value) return ""
        if (/^(https?:)?\/\//i.test(value) || /^[\w./-]+$/.test(value.replace(/[а-яё]/gi, "a"))) return value
        return ""
    }

    /** Меню для страницы: опубликованное или черновик из редактора (?menu=draft). */
    const load = () => {
        if (new URLSearchParams(location.search).get("menu") === "draft") {
            try {
                const draft = JSON.parse(localStorage.getItem(DRAFT_KEY))
                if (Array.isArray(draft?.sections)) return draft
            } catch {
                // повреждённый черновик — показываем опубликованное меню
            }
        }
        return window.BOHO_MENU
    }

    window.BohoMenu = { TAGS, DRAFT_KEY, esc, formatPrice, safePhoto, load }
})()
