"use strict"

/**
 * Контакты в одном месте: подставляются во все ссылки [data-phone].
 * TODO: заменить на реальные данные Бохо.
 */
const BOHO = {
    phone: "+70000000000",
    phoneLabel: "+7 (000) 000-00-00",
    // Номер WhatsApp без «+» (например, "79000000000") — заявки с формы брони
    // будут открываться в WhatsApp. Пока пусто, форма предлагает позвонить.
    whatsapp: ""
}

const root = document.documentElement
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined"
const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches
const zonesInteractive = () => window.matchMedia("(min-width: 900px)").matches

let smoother = null

// Со ScrollSmoother восстановление позиции после перезагрузки ломает интро и пины
if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual"
}

if (prefersReducedMotion || !hasGsap) {
    root.classList.add("reduced-motion")
}

/* ---------- Общие утилиты ---------- */

const lockScroll = (isLocked) => {
    if (smoother) {
        smoother.paused(isLocked)
        return
    }
    root.style.overflow = isLocked ? "hidden" : ""
}

const scrollToTarget = (target) => {
    if (smoother) {
        // У закреплённого hero смещение считается с учётом pin-spacer — в начало едем по нулю
        smoother.scrollTo(target.id === "top" ? 0 : target, !prefersReducedMotion, "top top")
        return
    }
    const behavior = prefersReducedMotion ? "auto" : "smooth"
    if (target.id === "top") {
        window.scrollTo({ top: 0, behavior })
        return
    }
    target.scrollIntoView({ behavior })
}

let toastTimer
const showToast = (message) => {
    const toast = document.querySelector(".toast")
    if (!toast) {
        return
    }
    toast.textContent = message
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        toast.hidden = true
    }, 2600)
}

const applyContacts = () => {
    document.querySelectorAll("[data-phone]").forEach((link) => {
        link.href = `tel:${BOHO.phone}`
        if (!link.children.length) {
            link.textContent = BOHO.phoneLabel
        }
    })
    document.querySelectorAll("[data-year]").forEach((item) => {
        item.textContent = new Date().getFullYear()
    })
}

/* ---------- Навигация ---------- */

const initNavigation = () => {
    const button = document.getElementById("menu-button")
    const nav = document.getElementById("nav")
    const page = document.getElementById("smooth-wrapper")
    if (!button || !nav) {
        return { close: () => {} }
    }

    let isOpen = false

    const open = () => {
        isOpen = true
        nav.hidden = false
        page.inert = true
        lockScroll(true)
        button.setAttribute("aria-expanded", "true")
        button.setAttribute("aria-label", "Закрыть меню")

        if (hasGsap && !prefersReducedMotion) {
            gsap.fromTo(nav, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })
            gsap.fromTo(
                nav.querySelectorAll(".nav-overlay__list li"),
                { y: 30, autoAlpha: 0 },
                { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: "power3.out", delay: 0.1 }
            )
        }
        nav.querySelector("a")?.focus({ preventScroll: true })
    }

    const close = ({ restoreFocus = true } = {}) => {
        if (!isOpen) {
            return
        }
        isOpen = false
        page.inert = false
        lockScroll(false)
        button.setAttribute("aria-expanded", "false")
        button.setAttribute("aria-label", "Открыть меню")

        const hide = () => {
            nav.hidden = true
        }
        if (hasGsap && !prefersReducedMotion) {
            gsap.to(nav, { autoAlpha: 0, duration: 0.25, onComplete: hide })
        } else {
            hide()
        }
        if (restoreFocus) {
            button.focus({ preventScroll: true })
        }
    }

    button.addEventListener("click", () => (isOpen ? close() : open()))
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen) {
            close()
        }
    })

    return { close }
}

/* ---------- Бронирование ---------- */

const formatDate = (value) => {
    const [year, month, day] = value.split("-")
    return `${day}.${month}.${year}`
}

const buildBookingMessage = (form) => {
    const data = new FormData(form)
    const zone = form.elements.zone.selectedOptions[0]?.textContent || ""
    return [
        "Бронирование в Бохо",
        `Имя: ${data.get("name")}`,
        `Телефон: ${data.get("phone")}`,
        `Дата: ${formatDate(data.get("date"))}, ${data.get("time")}`,
        `Гостей: ${data.get("guests")}`,
        `Зона: ${zone}`,
        data.get("table") ? `Столик: ${data.get("table")}` : "",
        data.get("comment") ? `Комментарий: ${data.get("comment")}` : ""
    ]
        .filter(Boolean)
        .join("\n")
}

const validateBooking = (form) => {
    let firstInvalid = null
    form.querySelectorAll("input[required]").forEach((input) => {
        const isPhone = input.name === "phone"
        const isValid = isPhone
            ? input.value.replace(/\D/g, "").length >= 10
            : input.checkValidity() && input.value.trim() !== ""
        input.setAttribute("aria-invalid", String(!isValid))
        if (!isValid && !firstInvalid) {
            firstInvalid = input
        }
    })
    return firstInvalid
}

const initHost = () => {
    const host = document.querySelector("[data-host]")
    const hero = document.getElementById("top")
    if (!host || !hero) {
        return
    }

    const HIDDEN_KEY = "boho-host-hidden"
    try {
        if (sessionStorage.getItem(HIDDEN_KEY)) {
            return
        }
    } catch {
        // без sessionStorage показываем каждый раз
    }

    const show = () => {
        if (!host.hidden) {
            return
        }
        host.hidden = false
        host.classList.add("is-in")
    }

    const hide = () => {
        host.hidden = true
        try {
            sessionStorage.setItem(HIDDEN_KEY, "1")
        } catch {
            // ignore
        }
    }

    host.querySelector("[data-host-dismiss]")?.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        hide()
    })

    // Появляется после первого экрана — не конкурирует с hero
    if (typeof IntersectionObserver === "undefined") {
        window.setTimeout(show, 2800)
        return
    }

    const observer = new IntersectionObserver(
        (entries) => {
            const heroVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.35)
            if (!heroVisible) {
                show()
                observer.disconnect()
            }
        },
        { threshold: [0, 0.35, 0.7] },
    )
    observer.observe(hero)
}

const initBooking = (navigation) => {
    const dialog = document.getElementById("booking")
    if (!dialog || typeof dialog.showModal !== "function") {
        return
    }
    const form = dialog.querySelector("form")
    const status = dialog.querySelector(".booking__status")
    const dateInput = form.elements.date

    const today = new Date()
    const toIso = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    dateInput.min = toIso(today)
    dateInput.value = toIso(today)

    const open = (zone) => {
        navigation.close({ restoreFocus: false })
        // Зоны берутся из схемы зала (hall-picker.js), поэтому проверяем по списку
        if (zone && [...form.elements.zone.options].some((option) => option.value === zone)) {
            form.elements.zone.value = zone
            form.elements.zone.dispatchEvent(new Event("change", { bubbles: true }))
        }
        status.textContent = ""
        dialog.showModal()
        lockScroll(true)
    }

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-booking]")
        if (trigger) {
            event.preventDefault()
            open(trigger.dataset.booking)
        }
    })

    dialog.querySelector("[data-booking-close]").addEventListener("click", () => dialog.close())
    // Клик по подложке закрывает окно
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            dialog.close()
        }
    })
    dialog.addEventListener("close", () => lockScroll(false))

    // Ссылка index.html#booking (например, со страницы меню) сразу открывает бронь
    if (location.hash === "#booking") {
        window.addEventListener("load", () => setTimeout(() => open(), 300))
    }

    form.addEventListener("input", (event) => {
        if (event.target.getAttribute("aria-invalid") === "true") {
            event.target.removeAttribute("aria-invalid")
        }
    })

    form.addEventListener("submit", (event) => {
        event.preventDefault()
        const firstInvalid = validateBooking(form)
        if (firstInvalid) {
            status.textContent = "Проверьте выделенные поля."
            firstInvalid.focus()
            return
        }

        const message = buildBookingMessage(form)

        if (BOHO.whatsapp) {
            window.open(`https://wa.me/${BOHO.whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener")
            status.textContent = "Открываем WhatsApp — отправьте сообщение, и мы подтвердим бронь."
            return
        }

        status.innerHTML = `Онлайн-заявки скоро заработают. Пожалуйста, позвоните нам: <a href="tel:${BOHO.phone}">${BOHO.phoneLabel}</a>`
    })
}

/* ---------- Якорные ссылки и заглушки ---------- */

const initLinks = (navigation) => {
    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href^='#']")
        if (!link) {
            return
        }

        if (link.dataset.todo) {
            event.preventDefault()
            showToast(`«${link.dataset.todo}» — ссылка появится совсем скоро`)
            return
        }

        const hash = link.getAttribute("href")
        const target = hash.length > 1 && document.querySelector(hash)
        if (!target) {
            return
        }
        event.preventDefault()
        // close() снимает паузу со скролла синхронно, поэтому можно ехать сразу
        navigation.close({ restoreFocus: false })
        scrollToTarget(target)
    })
}

/* ---------- Окна (блок из travelluv) ---------- */

const initZones = () => {
    const stage = document.querySelector("[data-zones]")
    if (!stage) {
        return
    }
    const zones = [...stage.querySelectorAll(".zone")]
    let activeZone = null

    const reveal = () => stage.classList.remove("is-inactive")
    if (hasGsap && !prefersReducedMotion) {
        ScrollTrigger.create({ trigger: stage, start: "top 75%", once: true, onEnter: reveal })
    } else {
        reveal()
    }

    const openZone = (zone) => {
        if (!zonesInteractive() || activeZone) {
            return
        }
        activeZone = zone
        stage.classList.add("has-active")
        zone.classList.add("is-active")
        zone.querySelector(".zone__preview").setAttribute("aria-expanded", "true")
        zones.filter((item) => item !== zone).forEach((item) => (item.inert = true))
        setTimeout(() => zone.querySelector(".zone__close").focus({ preventScroll: true }), prefersReducedMotion ? 0 : 1400)
    }

    const closeZone = () => {
        if (!activeZone) {
            return
        }
        const zone = activeZone
        activeZone = null
        stage.classList.remove("has-active")
        zone.classList.remove("is-active")
        zones.forEach((item) => (item.inert = false))
        const preview = zone.querySelector(".zone__preview")
        preview.setAttribute("aria-expanded", "false")
        preview.focus({ preventScroll: true })
    }

    zones.forEach((zone) => {
        zone.querySelector(".zone__preview").addEventListener("click", () => openZone(zone))
        zone.querySelector(".zone__close").addEventListener("click", (event) => {
            event.stopPropagation()
            closeZone()
        })
    })

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && activeZone && !document.querySelector("dialog[open]")) {
            closeZone()
        }
    })

    window.addEventListener("resize", () => {
        if (!zonesInteractive()) {
            closeZone()
        }
    })
}

/* ---------- Колода карточек (слайдер из travelluv) ---------- */

const initDeck = () => {
    const deck = document.querySelector("[data-deck]")
    if (!deck) {
        return
    }
    const cards = [...deck.querySelectorAll(".deck__card")]
    const counter = deck.querySelector("[data-deck-current]")
    const total = deck.querySelector("[data-deck-total]")
    let current = 0

    const pad = (value) => String(value).padStart(2, "0")
    total.textContent = pad(cards.length)

    const render = () => {
        cards.forEach((card, index) => {
            const position = (index - current + cards.length) % cards.length
            card.dataset.pos = String(position)
            card.setAttribute("aria-hidden", String(position !== 0))
        })
        counter.textContent = pad(current + 1)
    }

    const DURATION = 950
    const EASING = "cubic-bezier(0.65, 0, 0.35, 1)"
    let isAnimating = false

    // Маска-прямоугольник: откуда «раскрывается» новая карточка
    const revealStart = (card, direction) => {
        const box = deck.getBoundingClientRect()
        const rect = card.getBoundingClientRect()
        const style = getComputedStyle(card)
        const isVisible = style.opacity !== "0" && rect.width > 0 && rect.right <= box.right + 1
        if (isVisible) {
            const radius = style.borderTopLeftRadius
            return `inset(${rect.top - box.top}px ${box.right - rect.right}px ${box.bottom - rect.bottom}px ${rect.left - box.left}px round ${radius})`
        }
        // Карточки не видно (листаем назад) — шторка с края
        return direction > 0 ? "inset(0px 0px 0px 100% round 0px)" : "inset(0px 100% 0px 0px round 0px)"
    }

    const show = (nextIndex, direction) => {
        if (isAnimating || nextIndex === current) {
            return
        }
        const outgoing = cards[current]
        const incoming = cards[nextIndex]

        if (prefersReducedMotion || typeof incoming.animate !== "function") {
            current = nextIndex
            render()
            return
        }

        isAnimating = true
        const from = revealStart(incoming, direction)

        // Старая карточка остаётся фоном, пока новая не раскроется поверх
        outgoing.classList.add("is-leaving")
        incoming.classList.add("is-entering")
        current = nextIndex
        render()

        const reveal = incoming.animate(
            [{ clipPath: from }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
            { duration: DURATION, easing: EASING }
        )
        incoming.querySelector("img").animate(
            [{ transform: "scale(1.06)" }, { transform: "scale(1)" }],
            { duration: DURATION + 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        )

        reveal.finished.then(() => {
            // Возвращаем старую карточку в стопку без «схлопывания» и мягко проявляем
            outgoing.style.transition = "none"
            outgoing.classList.remove("is-leaving")
            outgoing.getBoundingClientRect()
            outgoing.style.transition = ""
            if (getComputedStyle(outgoing).opacity !== "0") {
                outgoing.animate(
                    [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
                    { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
                )
            }
            incoming.classList.remove("is-entering")
            isAnimating = false
        })
    }

    const go = (step) => show((current + step + cards.length) % cards.length, step)

    deck.querySelector("[data-deck-next]").addEventListener("click", () => go(1))
    deck.querySelector("[data-deck-prev]").addEventListener("click", () => go(-1))

    // Клик по маленькой карточке открывает её
    cards.forEach((card, index) => {
        card.addEventListener("click", () => {
            if (card.dataset.pos !== "0") {
                show(index, 1)
            }
        })
    })

    deck.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") go(1)
        if (event.key === "ArrowLeft") go(-1)
    })

    // Свайп на тач-устройствах
    let startX = null
    deck.addEventListener("pointerdown", (event) => {
        startX = event.clientX
    })
    deck.addEventListener("pointerup", (event) => {
        if (startX === null) {
            return
        }
        const deltaX = event.clientX - startX
        startX = null
        if (Math.abs(deltaX) > 50) {
            go(deltaX < 0 ? 1 : -1)
        }
    })

    render()
}

/* ---------- Анимации GSAP ---------- */

// Разбивает текст на буквы: <span.hero__mask><span.hero__char>…</span></span>; пробелы остаются
const splitHeroChars = (node, withMask) => {
    const text = node.textContent
    node.setAttribute("aria-label", text)
    node.innerHTML = [...text]
        .map((char) => {
            if (char === " ") return " "
            const inner = `<span class="hero__char" aria-hidden="true">${char}</span>`
            return withMask ? `<span class="hero__mask" aria-hidden="true">${inner}</span>` : inner
        })
        .join("")
    return [...node.querySelectorAll(".hero__char")]
}

const playHeroIntro = () => {
    const header = document.querySelector(".site-header")
    const menuTab = document.querySelector(".menu-tab")
    const glow = document.querySelector(".hero__glow")
    const wordChars = splitHeroChars(document.querySelector(".hero__word"), true)
    const eyebrowChars = splitHeroChars(document.querySelector(".hero__eyebrow"), false)
    const line = document.querySelector(".hero__line")
    const hint = document.querySelector(".hero__hint")

    // Снимаем стартовые CSS-смещения до создания твинов, чтобы GSAP не «запомнил» их
    gsap.set(header, { opacity: 1 })
    gsap.set(menuTab, { clearProps: "transform" })
    menuTab.style.transform = "none"

    // Буквы «Boho» по очереди поднимаются из-под маски с лёгким поворотом,
    // надпись над ними проявляется по буквам, черта прочерчивается из центра
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: "power1.out" }, 0)
        .fromTo(wordChars, { yPercent: 110, rotation: 8 }, { yPercent: 0, rotation: 0, duration: 1.1, stagger: 0.09, ease: "expo.out" }, 0.15)
        .fromTo(eyebrowChars, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.025 }, 0.55)
        .fromTo(line, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1, ease: "power2.inOut" }, 0.9)
        .fromTo(header, { y: -32, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7 }, 0.3)
        .fromTo(menuTab, { yPercent: 120 }, { yPercent: 0, duration: 0.8 }, 0.4)
        .fromTo(hint, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 1.4)
}

const initHeroScroll = () => {
    const hero = document.querySelector(".hero")
    // разлетаются маски целиком — иначе маска обрезает уезжающую букву
    const letters = hero.querySelectorAll(".hero__word .hero__mask")
    const middle = (letters.length - 1) / 2

    // Прокрутка: буквы разлетаются от центра, растут и тают; надпись и черта уходят вверх.
    // Анимируются сами буквы и мелкие элементы, а не обёртки — их ведёт интро
    const tl = gsap.timeline({ defaults: { ease: "none" } })
    tl.fromTo(letters, { x: 0, scale: 1, opacity: 1 }, {
        x: (i) => `${(i - middle) * 22}vw`,
        scale: 1.6,
        opacity: 0,
        ease: "power1.in"
    }, 0)
        .fromTo(".hero__eyebrow", { y: 0, opacity: 1 }, { y: -80, opacity: 0 }, 0)
        .fromTo(".hero__line", { scaleY: 1, opacity: 1 }, { scaleY: 1, opacity: 0, duration: 0.5 }, 0)
        .fromTo(".hero__hint", { opacity: 1 }, { opacity: 0, duration: 0.25 }, 0)
        .fromTo(".hero__glow", { opacity: 1 }, { opacity: 0 }, 0)

    ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "+=70%",
        pin: true,
        anticipatePin: 1,
        scrub: 0.5,
        animation: tl,
        invalidateOnRefresh: true
    })
}

const initHeaderState = () => {
    const header = document.querySelector(".site-header")
    ScrollTrigger.create({
        start: () => window.innerHeight * 0.6,
        onToggle: (self) => header.classList.toggle("is-scrolled", self.isActive)
    })
}

const initSplitLines = (isDesktopLayout) => {
    gsap.utils.toArray(".split-lines").forEach((item) => {
        const split = new SplitText(item, { type: "lines" })
        const tl = gsap.timeline({ paused: true })
        tl.from(split.lines, {
            duration: 1,
            y: isDesktopLayout ? 60 : 20,
            autoAlpha: 0,
            ease: "power3",
            stagger: 0.07
        })
        ScrollTrigger.create({
            trigger: item,
            start: "top 88%",
            animation: tl,
            toggleActions: "play none none reverse"
        })
    })
    root.classList.add("split-ready")
}

const initRevealImages = () => {
    gsap.utils.toArray(".reveal-image").forEach((item) => {
        const image = item.querySelector("img")
        const isVertical = item.classList.contains("reveal-image--vertical")
        // У параллакс-фото базовый масштаб больше — иначе при сдвиге видны края
        const restScale = image?.classList.contains("parallax-media") ? 1.1 : 1
        const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } })

        tl.fromTo(
            item,
            { clipPath: isVertical ? "inset(14% 0% 14% 0%)" : "inset(0% 14% 0% 14%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1 }
        )
        if (image) {
            tl.fromTo(image, { scale: restScale + 0.14, autoAlpha: 0.7 }, { scale: restScale, autoAlpha: 1, duration: 1.4 }, 0)
        }

        ScrollTrigger.create({
            trigger: item,
            start: "top 85%",
            animation: tl,
            toggleActions: "play none none reverse"
        })
    })
}

const initParallax = () => {
    gsap.utils.toArray(".parallax-media").forEach((image) => {
        gsap.fromTo(
            image,
            { yPercent: -4 },
            {
                yPercent: 4,
                ease: "none",
                scrollTrigger: {
                    trigger: image.closest(".reveal-image") || image.parentElement,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            }
        )
    })
}

const initAboutPin = () => {
    // В «О нас» сейчас галерея интерьера без закреплённого текста — пин не нужен
    if (!document.querySelector("[data-about-pin]") || !document.querySelector("[data-about-scroll]")) {
        return
    }
    ScrollTrigger.create({
        trigger: "[data-about-pin]",
        start: "top 20%",
        endTrigger: "[data-about-scroll]",
        end: "bottom bottom",
        pin: true,
        anticipatePin: 1,
        pinSpacing: false
    })
}

const initTripleScroll = () => {
    const triple = document.querySelector(".triple")
    const track = document.querySelector("[data-triple]")
    if (!triple || !track) {
        return
    }
    const distance = () => track.scrollWidth - triple.clientWidth

    gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
            trigger: triple,
            start: "center center",
            end: () => `+=${distance()}`,
            pin: true,
        anticipatePin: 1,
            scrub: true,
            invalidateOnRefresh: true
        }
    })
}

const initFooterTagline = () => {
    const tagline = document.querySelector(".footer-tagline")
    if (!tagline) {
        return
    }
    const split = new SplitText(tagline, { type: "words", wordsClass: "word" })
    const tl = gsap.timeline({ paused: true })
    tl.from(split.words, {
        yPercent: 120,
        autoAlpha: 0,
        rotate: 1.5,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.06
    })
    ScrollTrigger.create({
        trigger: tagline,
        start: "top 90%",
        animation: tl,
        toggleActions: "play none none reverse"
    })
}

const initCtaHover = () => {
    if (ScrollTrigger.isTouch === 1) {
        return
    }
    document.querySelectorAll(".cta-hover").forEach((item) => {
        const label = item.querySelector(".cta-hover-label")
        const icon = item.querySelector(".cta-hover-icon")
        const tl = gsap.timeline({ paused: true, defaults: { duration: 0.25, ease: "power2.out" } })

        tl.to(item, { y: -3, boxShadow: "0 14px 30px rgba(214, 161, 90, 0.18)" })
        if (label) tl.to(label, { x: 3 }, 0)
        if (icon) tl.to(icon, { scale: 1.08 }, 0)

        item.addEventListener("mouseenter", () => tl.play())
        item.addEventListener("mouseleave", () => tl.reverse())
        item.addEventListener("focusin", () => tl.play())
        item.addEventListener("focusout", () => tl.reverse())
    })
}

/* ---------- Сцена «Арка» (приём из grow-lesson) ---------- */

/** Разбивает заголовок на буквы-«колоду»: каждая следующая под предыдущей и падает чуть позже. */
const splitStackedLetters = () => {
    document.querySelectorAll("[data-stacked]").forEach((title) => {
        title.innerHTML = [...title.textContent.trim()]
            .map((char, index) => `<span class="letter" aria-hidden="true" style="z-index:${-index};transition-duration:${1 + index / 5}s">${char}</span>`)
            .join("")
    })
}

const initScene = () => {
    const scene = document.querySelector(".scene")
    if (!scene) return
    const stage = scene.querySelector("[data-scene]")
    const title = scene.querySelector(".scene__title")
    const back = scene.querySelector(".scene__layer--back")
    const lights = scene.querySelector(".scene__layer--lights")
    const smoke = scene.querySelector(".scene__layer--smoke")
    const portal = scene.querySelector(".scene__portal")
    const lead = scene.querySelector(".scene__lead")

    const doors = scene.querySelector(".scene__doors")
    const doorLeft = scene.querySelector(".scene__door--left")
    const doorRight = scene.querySelector(".scene__door--right")
    const doorShades = scene.querySelectorAll(".scene__door-shade")
    const glow = scene.querySelector(".scene__glow")
    const gap = scene.querySelector(".scene__gap")
    const guy = scene.querySelector(".scene__guy")
    const guyBob = scene.querySelector(".scene__guy-bob")
    const guyBody = scene.querySelector(".scene__guy-body")
    const guyFront = scene.querySelector(".scene__guy-front")
    const arm = scene.querySelector(".scene__guy-arm")
    const forearm = scene.querySelector(".scene__guy-forearm")
    const shadow = scene.querySelector(".scene__guy-shadow")
    const [poseA, poseB] = scene.querySelectorAll(".scene__guy-pose")
    const guyBack = scene.querySelector(".scene__guy-back")
    const stars = scene.querySelector(".scene__guy-stars")
    const bonk = scene.querySelector(".scene__guy-bonk")
    const fallRight = window.matchMedia("(max-width: 767px)").matches

    // Куда бежать: низ человечка — к порогу левой створки, рост — ~60% двери.
    // Меряем по offset* (без transform), значения пересчитываются при ресайзе
    const target = () => {
        const doorBottom = doors.offsetTop + doors.offsetHeight
        const doorX = doors.offsetLeft - doors.offsetWidth * 0.25 // у .scene__doors translateX(-50%)
        return {
            x: doorX - (guy.offsetLeft + guy.offsetWidth / 2),
            y: doorBottom - (guy.offsetTop + guy.offsetHeight),
            scale: (doors.offsetHeight * 0.6) / guy.offsetHeight
        }
    }

    // Бег: шаги считаются от прокрутки — позы чередуются, человечек подпрыгивает
    const run = { step: 0 }
    const setStep = () => {
        const odd = Math.floor(run.step) % 2 === 1
        poseA.style.opacity = odd ? "0" : "1"
        poseB.style.opacity = odd ? "1" : "0"
        guyBob.style.transform = `translateY(${(-Math.abs(Math.sin(run.step * Math.PI)) * 5).toFixed(2)}%)`
    }

    // Прокрутка: человечек стоит лицом и машет → разворачивается → бежит к дальней двери,
    // врезается и падает с отскоком → от удара створки распахиваются и дверь приближается
    // → камера проходит в зал
    const tl = gsap.timeline({ defaults: { ease: "none" } })
    // центрирование дверей — через xPercent, иначе «вздрагивание» по x сбрасывает translateX(-50%)
    gsap.set(doors, { xPercent: -50, x: 0 })

    // Машет всей рукой: плечо слегка покачивается, предплечье — сильнее и с запаздыванием,
    // в конце рука опускается вдоль тела. Атрибут transform поворачивает группу вокруг её
    // начала координат (плечо и локоть)
    const wave = { t: 0 }
    const smooth = (x) => x * x * (3 - 2 * x)
    const setWave = () => {
        const t = wave.t
        const up = 1 - smooth(gsap.utils.clamp(0, 1, (t - 0.8) / 0.2)) // 1 — поднята, 0 — опущена
        const phase = gsap.utils.clamp(0, 1, t / 0.8) * Math.PI * 2 * 3 // три взмаха
        const shoulder = 145 * (1 - up) + Math.sin(phase) * 12 * up
        // предплечье ходит в основном наружу — ладонь не закрывает лицо
        const elbow = 40 * (1 - up) + (6 - Math.sin(phase - 0.8) * 20) * up
        arm.setAttribute("transform", `rotate(${shoulder.toFixed(1)})`)
        forearm.setAttribute("transform", `rotate(${elbow.toFixed(1)})`)
    }
    setWave()
    tl.to(wave, { t: 1, duration: 0.31, onUpdate: setWave }, 0)
        // разворот: сжимается по ширине, вид спереди сменяется видом со спины
        .to(guyBody, { scaleX: 0.04, duration: 0.04, ease: "power1.in" }, 0.32)
        .set(guyFront, { opacity: 0 }, 0.36)
        .set(guyBack, { opacity: 1 }, 0.36)
        .to(guyBody, { scaleX: 1, duration: 0.04, ease: "power1.out" }, 0.36)
        // бег к двери: уменьшается с расстоянием
        .to(guy, { x: () => target().x, y: () => target().y, scale: () => target().scale, duration: 0.44, ease: "power1.out" }, 0.4)
        .fromTo(run, { step: 0 }, { step: 9, duration: 0.44, onUpdate: setStep }, 0.4)
        // удар: сплющивается о дверь, двери вздрагивают, вокруг головы вспышка
        .to(guyBody, { scaleX: 1.14, scaleY: 0.88, duration: 0.04 }, 0.84)
        .fromTo(bonk, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1.1, duration: 0.03 }, 0.84)
        .to(bonk, { opacity: 0, duration: 0.06 }, 0.89)
        .to(doors, { keyframes: { x: [0, -5, 4, -3, 2, 0] }, duration: 0.1 }, 0.84)
        .to(gap, { opacity: 0.4, duration: 0.02, yoyo: true, repeat: 3 }, 0.84)
        // отлетает и падает на пол с отскоком; поворот вокруг нижнего угла — ложится на пол,
        // на телефоне падает вправо, к центру, иначе уходит за край экрана
        .to(guyBody, { scaleX: 1, scaleY: 1, duration: 0.04 }, 0.88)
        // отлетает от двери к зрителю: ниже по экрану и чуть крупнее — лежит на полу перед дверью
        .to(guy, { y: () => target().y + doors.offsetHeight * 0.16, scale: () => target().scale * 1.15, duration: 0.14, ease: "power2.out" }, 0.88)
        // тень растягивается под лежащим телом (центр тела — на 1 ширину рамки левее/правее)
        .to(shadow, { xPercent: fallRight ? 178 : -178, scaleX: 3, scaleY: 1.4, duration: 0.12, ease: "power2.in" }, 0.92)
        // Падает вбок, опора — внешний край стопы (x≈40 из 120 в рисунке): ноги остаются на полу,
        // тело ложится боком. Сначала заваливается (power2.in), потом отскок об пол
        .to(guyBody, { rotation: fallRight ? 92 : -92, transformOrigin: fallRight ? "67% 100%" : "33% 100%", duration: 0.12, ease: "power2.in" }, 0.92)
        .to(guyBody, { keyframes: { rotation: fallRight ? [92, 84, 90, 88, 90] : [-92, -84, -90, -88, -90] }, duration: 0.08, ease: "power1.out" }, 1.04)
        .fromTo(stars, { opacity: 0, rotation: 0 }, { opacity: 1, duration: 0.05 }, 1.0)
        .to(stars, { rotation: 900, duration: 1, ease: "none" }, 1.0)
        // от удара двери открываются — и по мере открытия приближаются
        .to(gap, { opacity: 0, duration: 0.06 }, 0.95)
        .fromTo(doorLeft, { rotateY: 0 }, { rotateY: 84, duration: 0.45, ease: "power2.inOut" }, 0.95)
        .fromTo(doorRight, { rotateY: 0 }, { rotateY: -84, duration: 0.45, ease: "power2.inOut" }, 0.97)
        .fromTo(doorShades, { opacity: 0 }, { opacity: 0.6, duration: 0.45 }, 0.95)
        .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.18 }, 1.0)
        .to(glow, { opacity: 0, duration: 0.25 }, 1.3)
        .fromTo(portal, { scale: 1, autoAlpha: 1 }, { scale: 1.9, duration: 0.5, ease: "power1.inOut" }, 0.97)
        .fromTo(title, { yPercent: 0, scale: 1, autoAlpha: 1 }, { yPercent: -60, scale: 1.15, autoAlpha: 0, duration: 0.5, ease: "power1.in" }, 1.1)
        // проход в дверь: стена растёт быстрее всего, зал медленнее
        .to(portal, { scale: 14, duration: 0.7, ease: "power3.in" }, 1.47)
        .to(portal, { autoAlpha: 0, duration: 0.15 }, 2.0)
        .fromTo(back, { scale: 1.25 }, { scale: 1.02, duration: 2.15 }, 0)
        .fromTo(lights, { scale: 1, yPercent: 0 }, { scale: 1.1, yPercent: -3, duration: 2.15 }, 0)
        .fromTo(smoke, { scale: 1, yPercent: 0 }, { scale: 1.12, yPercent: -4, duration: 2.15 }, 0)
        .fromTo(scene.querySelector(".scene__shade"), { opacity: 1 }, { opacity: 0.5, duration: 2.15 }, 0)
        .fromTo(lead, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 1.95)
        .to({}, { duration: 0.15 }) // короткая пауза на финальном кадре

    ScrollTrigger.create({
        trigger: scene,
        start: "top top",
        end: () => `+=${window.innerHeight * 3.6}`,
        pin: stage,
        anticipatePin: 1,
        scrub: 0.6,
        animation: tl,
        invalidateOnRefresh: true
    })

    // Буквы падают, когда сцена появляется, и поднимаются при прокрутке назад.
    // refreshPriority −1: граница считается после пина сцены, иначе буквы гасли посреди сцены
    ScrollTrigger.create({
        trigger: scene,
        start: "top 65%",
        end: "bottom top",
        refreshPriority: -1,
        toggleClass: { targets: title, className: "is-in" }
    })

    // Мышь: слои смещаются тем сильнее, чем они «ближе» (data-depth) — объём при наведении
    if (ScrollTrigger.isTouch === 1) return
    const movers = [...stage.querySelectorAll("[data-depth]")].map((node) => {
        const target = node.matches("img") ? node : node.querySelector("img") || node
        return {
            depth: parseFloat(node.dataset.depth),
            x: gsap.quickTo(target, "x", { duration: 0.9, ease: "power3.out" }),
            y: gsap.quickTo(target, "y", { duration: 0.9, ease: "power3.out" })
        }
    })
    const titleX = gsap.quickTo(title, "x", { duration: 1, ease: "power3.out" })
    const titleY = gsap.quickTo(title, "y", { duration: 1, ease: "power3.out" })

    stage.addEventListener("pointermove", (event) => {
        const rect = stage.getBoundingClientRect()
        const nx = (event.clientX - rect.left) / rect.width - 0.5
        const ny = (event.clientY - rect.top) / rect.height - 0.5
        movers.forEach(({ depth, x, y }) => {
            x(-nx * depth * 60)
            y(-ny * depth * 40)
        })
        titleX(-nx * 22)
        titleY(-ny * 14)
    })
    stage.addEventListener("pointerleave", () => {
        movers.forEach(({ x, y }) => {
            x(0)
            y(0)
        })
        titleX(0)
        titleY(0)
    })
}

const initMotion = () => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText)

    // Строка адреса на телефоне то появляется, то прячется — без этого каждый раз
    // пересчитывались бы все сцены и страница дёргалась
    ScrollTrigger.config({ ignoreMobileResize: true })

    // ScrollSmoother только для мыши. На сенсорных экранах он сдвигал весь контент
    // скриптом вслед за родной прокруткой — кадры расходились, страница «тряслась».
    // Там остаётся родная прокрутка, а закреплённые сцены держатся через position: fixed
    if (ScrollTrigger.isTouch !== 1) {
        smoother = ScrollSmoother.create({
            wrapper: "#smooth-wrapper",
            content: "#smooth-content",
            smooth: 1.2,
            effects: false,
            ignoreMobileResize: true
        })
    }

    playHeroIntro()
    initHeroScroll()
    initScene()
    initHeaderState()
    initCtaHover()

    const mm = gsap.matchMedia()
    mm.add({ desktop: "(min-width: 1024px)", mobile: "(max-width: 1023px)" }, (context) => {
        const { desktop } = context.conditions

        initRevealImages()
        initParallax()

        if (desktop) {
            initAboutPin()
        } else {
            initTripleScroll()
        }

        const runTextAnimations = () => {
            initSplitLines(desktop)
            initFooterTagline()
            ScrollTrigger.refresh()
        }
        // SplitText должен мерить строки уже в загруженном шрифте
        if (document.fonts?.ready) {
            document.fonts.ready.then(() => context.add(runTextAnimations))
        } else {
            runTextAnimations()
        }
    })

    window.addEventListener("load", () => ScrollTrigger.refresh())
}

/* ---------- Старт ---------- */

applyContacts()
splitStackedLetters()
const navigation = initNavigation()
initLinks(navigation)
initBooking(navigation)
initDeck()

if (hasGsap && !prefersReducedMotion) {
    initMotion()
} else {
    root.classList.add("split-ready")
    document.querySelector(".site-header").style.opacity = "1"
    document.querySelector(".menu-tab").style.transform = "none"
    if (hasGsap) {
        gsap.registerPlugin(ScrollTrigger)
    }
}

initZones()
initHost()
