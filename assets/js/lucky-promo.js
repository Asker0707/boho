"use strict"

/**
 * Реклама «Испытай удачу» на первом экране: карточка-арка с мини-барабанами.
 * Появление: арка поднимается, огоньки загораются по дуге, барабаны
 * прокручиваются и встают на Boho×3, вспышка огней и блик, заголовок
 * поднимается по буквам, кнопка «Крутить». Дальше раз в несколько секунд
 * барабаны прокручиваются снова.
 * За пределами первого экрана карточка сворачивается в ярлык, у автомата
 * и в подвале прячется; крестик скрывает рекламу до конца сеанса.
 * Анимируются только transform/opacity.
 */
;(() => {
    const promo = document.querySelector("[data-promo]")
    const chip = document.querySelector("[data-promo-chip]")
    const hero = document.getElementById("top")
    const lucky = document.getElementById("lucky")
    const footer = document.getElementById("contacts")
    if (!promo || !chip || !hero || !lucky) {
        return
    }

    const HIDDEN_KEY = "boho-promo-hidden"
    try {
        if (sessionStorage.getItem(HIDDEN_KEY)) {
            return
        }
    } catch {
        // без sessionStorage реклама просто показывается каждый раз
    }

    const hasGsap = typeof window.gsap !== "undefined"
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !hasGsap
    const INTRO_DELAY = reducedMotion ? 0.8 : 2.4 // после интро hero
    const RESPIN_EVERY = 9

    /* ---------- Сборка: барабаны, огни, буквы ---------- */

    // Полоса начинается и заканчивается на Boho — повторная прокрутка бесшовна
    const FILLERS = ["percent", "dessert", "hookah", "dish", "cocktail", "percent", "dish"]
    const strips = [...promo.querySelectorAll(".promo__strip")]
    strips.forEach((strip, i) => {
        const middle = [...FILLERS.slice(i * 2), ...FILLERS.slice(0, i * 2)]
        strip.innerHTML = ["boho", ...middle, "boho"]
            .map((id) => `<span class="promo__cell"><svg viewBox="0 0 100 100"><use href="#ss-${id}"/></svg></span>`)
            .join("")
    })
    const lastShift = -((FILLERS.length + 1) / (FILLERS.length + 2)) * 100

    // Огоньки рамкой-«вывеской»: вверх по левой стороне, по верху, вниз по правой.
    // Окно 1 × 0.78 (как aspect-ratio в CSS), огни идут равным шагом по этой ломаной.
    const bulbBox = promo.querySelector(".promo__bulbs")
    const BULBS = 15
    const RATIO = 0.78
    const EDGE_X = 0.07
    const EDGE_Y = 0.09 * RATIO
    const SIDE_END = 0.6 * RATIO // до какой высоты огни спускаются по бокам
    const side = SIDE_END - EDGE_Y
    const top = 1 - 2 * EDGE_X
    const pathLength = side * 2 + top
    const pointAt = (distance) => {
        if (distance <= side) {
            return [EDGE_X, SIDE_END - distance]
        }
        if (distance <= side + top) {
            return [EDGE_X + (distance - side), EDGE_Y]
        }
        return [1 - EDGE_X, EDGE_Y + (distance - side - top)]
    }
    bulbBox.innerHTML = Array.from({ length: BULBS }, (item, i) => {
        const [x, y] = pointAt((i / (BULBS - 1)) * pathLength)
        return `<i class="promo__bulb promo__bulb--${"abc"[i % 3]}" style="left:${(x * 100).toFixed(2)}%;top:${((y / RATIO) * 100).toFixed(2)}%"></i>`
    }).join("")
    const bulbs = [...bulbBox.children]

    // Заголовок по буквам: слова не разрываются, буквы поднимаются из-под маски
    const title = promo.querySelector(".promo__title")
    title.setAttribute("aria-label", title.textContent)
    title.innerHTML = title.textContent
        .split(" ")
        .map((word) => `<span class="promo__word" aria-hidden="true">${[...word].map((char) => `<span class="promo__char">${char}</span>`).join("")}</span>`)
        .join(" ")
    const chars = [...title.querySelectorAll(".promo__char")]

    const reels = [...promo.querySelectorAll(".promo__reel")]
    const shine = promo.querySelector(".promo__shine")
    const brand = promo.querySelector(".promo__brand")
    const parts = ["eyebrow", "text", "cta"].map((name) => promo.querySelector(`.promo__${name}`))

    /* ---------- Анимации ---------- */

    // firstTime: при появлении барабаны стартуют с разных символов, а не с Boho
    const spinReels = (firstTime = false) => {
        const tl = gsap.timeline()
        strips.forEach((strip, i) => {
            const start = firstTime ? (-(i * 2 + 1) / (FILLERS.length + 2)) * 100 : 0
            tl.fromTo(
                strip,
                { yPercent: start },
                { yPercent: lastShift, duration: 1.1 + i * 0.3, ease: "back.out(1.1)" },
                i * 0.08
            )
            // окошко барабана «щёлкает» в момент остановки
            tl.fromTo(reels[i], { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.out" }, 1.0 + i * 0.38)
        })
        tl.add(() => {
            promo.classList.add("is-win")
            setTimeout(() => promo.classList.remove("is-win"), 1100)
        })
        tl.fromTo(shine, { xPercent: -130, opacity: 1 }, { xPercent: 230, opacity: 1, duration: 0.9, ease: "power2.inOut" }, "<")
        return tl
    }

    let entered = false
    let respin = null

    const scheduleRespin = () => {
        respin?.kill()
        if (reducedMotion) {
            return
        }
        respin = gsap.delayedCall(RESPIN_EVERY, () => {
            if (current === "card" && !document.hidden) {
                spinReels()
            }
            scheduleRespin()
        })
    }

    const enter = () => {
        entered = true
        promo.hidden = false
        if (reducedMotion) {
            promo.classList.add("is-lit")
            return
        }
        gsap.set(parts, { opacity: 0, y: 10 })
        gsap.set(chars, { yPercent: 110 })
        gsap.set(bulbs, { opacity: 0, scale: 0.3 })
        strips.forEach((strip, i) => gsap.set(strip, { yPercent: (-(i * 2 + 1) / (FILLERS.length + 2)) * 100 }))
        gsap.timeline({ onComplete: scheduleRespin })
            .fromTo(promo, { opacity: 0, y: 48, scale: 0.86 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(1.5)" })
            .to(bulbs, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.045, ease: "back.out(3)" }, 0.45)
            .fromTo(brand, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2.4)" }, 0.7)
            .add(spinReels(true), 0.6)
            .to(parts[0], { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 1.5)
            .to(chars, { yPercent: 0, duration: 0.55, stagger: 0.035, ease: "back.out(2.2)" }, 1.6)
            .to(parts[1], { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 2.1)
            .fromTo(parts[2], { opacity: 0, y: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(3)" }, 2.35)
            .add(() => promo.classList.add("is-lit"), 2.4)
    }

    /* ---------- Состояния: карточка / ярлык / скрыто ---------- */

    let current = "none"
    let closed = false
    const visible = { hero: true, lucky: false, footer: false }

    const show = (element) => {
        element.hidden = false
        if (!reducedMotion) {
            gsap.fromTo(element, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", overwrite: true })
        }
    }
    const hide = (element) => {
        if (element.hidden) {
            return
        }
        if (reducedMotion) {
            element.hidden = true
            return
        }
        gsap.to(element, { opacity: 0, y: 24, duration: 0.3, ease: "power2.in", overwrite: true, onComplete: () => { element.hidden = true } })
    }

    const apply = () => {
        if (closed) {
            return
        }
        const next = visible.lucky || visible.footer ? "none" : visible.hero ? "card" : "chip"
        if (next === current) {
            return
        }
        current = next
        promo.classList.toggle("is-lit", next === "card" && entered)
        if (next === "card") {
            hide(chip)
            if (entered) {
                show(promo)
            } else {
                enter()
            }
        } else if (next === "chip") {
            hide(promo)
            show(chip)
        } else {
            hide(promo)
            hide(chip)
        }
    }

    const watch = (element, key) => {
        if (!element) {
            return
        }
        new IntersectionObserver(([entry]) => {
            visible[key] = entry.isIntersecting
            if (started) {
                apply()
            }
        }).observe(element)
    }

    let started = false
    watch(hero, "hero")
    watch(lucky, "lucky")
    watch(footer, "footer")

    setTimeout(() => {
        started = true
        apply()
    }, INTRO_DELAY * 1000)

    promo.querySelector("[data-promo-close]").addEventListener("click", () => {
        try {
            sessionStorage.setItem(HIDDEN_KEY, "1")
        } catch {
            // не сохранится — реклама вернётся после перезагрузки
        }
        respin?.kill()
        hide(promo)
        hide(chip)
        closed = true
    })
})()
