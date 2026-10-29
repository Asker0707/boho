"use strict"

/**
 * Галерея интерьера (секция #interior): фото появляются при прокрутке,
 * по клику открываются на весь экран — стрелки, клавиши ←/→, свайп.
 * Анимации — только transform/opacity.
 */
;(() => {
    const grid = document.querySelector("[data-gallery]")
    const dialog = document.getElementById("gallery")
    if (!grid || !dialog || typeof dialog.showModal !== "function") {
        return
    }

    const hasGsap = typeof window.gsap !== "undefined"
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !hasGsap
    const lock = typeof lockScroll === "function" ? lockScroll : () => {}

    const photos = [...grid.querySelectorAll("img")].map((img) => ({ src: img.dataset.full || img.src, alt: img.alt }))
    const image = dialog.querySelector("[data-gallery-img]")
    const caption = dialog.querySelector("[data-gallery-caption]")
    const count = dialog.querySelector("[data-gallery-count]")
    let index = 0

    const wrap = (value) => (value + photos.length) % photos.length

    const preload = (value) => {
        const next = new Image()
        next.src = photos[wrap(value)].src
    }

    const setPhoto = (photo) => {
        image.src = photo.src
        image.alt = photo.alt
    }

    // direction: −1 — назад, 1 — вперёд, 0 — без перелистывания (открытие)
    const show = (value, direction = 0) => {
        index = wrap(value)
        const photo = photos[index]
        caption.textContent = photo.alt
        count.textContent = `${index + 1} / ${photos.length}`
        preload(index + 1)
        preload(index - 1)

        if (reducedMotion || !direction) {
            setPhoto(photo)
            return
        }
        gsap.to(image, {
            opacity: 0,
            x: -40 * direction,
            duration: 0.18,
            ease: "power2.in",
            overwrite: true,
            onComplete: () => {
                setPhoto(photo)
                const reveal = () =>
                    gsap.fromTo(image, { opacity: 0, x: 40 * direction }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" })
                image.decode().then(reveal, reveal)
            }
        })
    }

    const open = (value) => {
        show(value)
        dialog.showModal()
        requestAnimationFrame(() => {
            if (dialog.open) {
                lock(true)
            }
        })
        if (!reducedMotion) {
            gsap.fromTo(image, { opacity: 0, scale: 0.94, x: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" })
        }
    }

    grid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-gallery-index]")
        if (button) {
            open(Number(button.dataset.galleryIndex))
        }
    })

    dialog.querySelector("[data-gallery-prev]").addEventListener("click", () => show(index - 1, -1))
    dialog.querySelector("[data-gallery-next]").addEventListener("click", () => show(index + 1, 1))
    dialog.querySelector("[data-gallery-close]").addEventListener("click", () => dialog.close())
    dialog.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            show(index - 1, -1)
        } else if (event.key === "ArrowRight") {
            show(index + 1, 1)
        }
    })
    // Клик по тёмному фону (не по фото и не по кнопкам) закрывает просмотр
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog || event.target.classList.contains("gallery__stage")) {
            dialog.close()
        }
    })
    dialog.addEventListener("close", () => {
        if (!document.getElementById("booking")?.open) {
            lock(false)
        }
    })

    // Свайп по фото на телефоне
    let swipeStart = null
    image.addEventListener("pointerdown", (event) => {
        swipeStart = event.clientX
    })
    image.addEventListener("pointerup", (event) => {
        if (swipeStart === null) {
            return
        }
        const distance = event.clientX - swipeStart
        swipeStart = null
        if (Math.abs(distance) > 50) {
            show(index + (distance < 0 ? 1 : -1), distance < 0 ? 1 : -1)
        }
    })

    // Появление фото при прокрутке: поднимаются и проявляются волной
    if (!reducedMotion && typeof window.ScrollTrigger !== "undefined") {
        const items = grid.querySelectorAll(".interior__item")
        gsap.set(items, { opacity: 0, y: 40 })
        ScrollTrigger.batch(items, {
            start: "top 92%",
            once: true,
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", overwrite: true })
        })
    }
})()
