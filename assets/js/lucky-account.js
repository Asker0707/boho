"use strict"

/**
 * Аккаунт «Испытай удачу» (window.BohoLucky): вход по номеру телефона
 * с кодом из SMS и бонус за подписку на Telegram-канал.
 * Настройки — BOHO_SLOT.auth и BOHO_SLOT.telegram (slot-data.js).
 * Пока адреса сервера пустые, работает демо-режим: код показывается в окне.
 * Подписка проверяется «на доверии». Данные — в localStorage (boho-lucky-user).
 */
;(() => {
    const data = window.BOHO_SLOT
    const dialog = document.getElementById("lucky-auth")
    if (!data || !dialog) {
        return
    }

    const STORAGE_KEY = "boho-lucky-user"
    const MAX_ATTEMPTS = 5
    const auth = { codeLength: 4, resendSeconds: 60, sendCodeUrl: "", verifyCodeUrl: "", privacyUrl: "", ...data.auth }
    const telegram = { channelUrl: "", channelName: "Telegram-канал", bonusSpins: 3, prizeWeightMultiplier: 1, ...data.telegram }
    const isDemo = !auth.sendCodeUrl || !auth.verifyCodeUrl
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof window.gsap === "undefined"
    const lock = typeof lockScroll === "function" ? lockScroll : () => {}
    const toast = typeof showToast === "function" ? showToast : () => {}

    const escapeHtml = (text) =>
        String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])
    const plural = (count, one, few, many) => {
        const tens = count % 100
        const units = count % 10
        if (tens > 10 && tens < 20) {
            return many
        }
        return units === 1 ? one : units >= 2 && units <= 4 ? few : many
    }

    /* ---------- Хранилище ---------- */

    const readUser = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
            return saved?.phone ? saved : null
        } catch {
            return null
        }
    }

    let user = readUser()

    const writeUser = () => {
        try {
            if (user) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
            } else {
                localStorage.removeItem(STORAGE_KEY)
            }
        } catch {
            // приватный режим: вход действует до перезагрузки страницы
        }
    }

    const listeners = new Set()
    const notify = () => {
        renderAccount()
        listeners.forEach((listener) => listener(user))
    }

    /* ---------- Телефон ---------- */

    // Из любого ввода — 10 цифр после +7 (ведущие 7/8 отбрасываем)
    const phoneDigits = (value) => {
        let digits = String(value).replace(/\D/g, "")
        if (digits[0] === "7" || digits[0] === "8") {
            digits = digits.slice(1)
        }
        return digits.slice(0, 10)
    }

    const formatPhone = (digits) => {
        if (!digits) {
            return ""
        }
        let out = `+7 (${digits.slice(0, 3)}`
        if (digits.length > 3) {
            out += `) ${digits.slice(3, 6)}`
        }
        if (digits.length > 6) {
            out += `-${digits.slice(6, 8)}`
        }
        if (digits.length > 8) {
            out += `-${digits.slice(8, 10)}`
        }
        return out
    }

    const maskPhone = (phone) => {
        const digits = phoneDigits(phone)
        return `+7 (${digits.slice(0, 3)}) •••-••-${digits.slice(8, 10)}`
    }

    /* ---------- Сервер SMS (или демо) ---------- */

    let demoCode = ""

    const post = async (url, body) => {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        let json = {}
        try {
            json = await response.json()
        } catch {
            json = {}
        }
        if (!response.ok || json.ok === false) {
            throw new Error(json.message || "Не получилось. Попробуйте ещё раз чуть позже.")
        }
        return json
    }

    const sendCode = async (phone) => {
        if (isDemo) {
            demoCode = Array.from({ length: auth.codeLength }, () => Math.floor(Math.random() * 10)).join("")
            return { demoCode }
        }
        await post(auth.sendCodeUrl, { phone })
        return {}
    }

    const verifyCode = async (phone, code, name) => {
        if (isDemo) {
            if (code !== demoCode) {
                throw new Error("Неверный код. Проверьте и введите ещё раз.")
            }
            return { token: "demo" }
        }
        return post(auth.verifyCodeUrl, { phone, code, name })
    }

    /* ---------- Шансы для подсказок ---------- */

    const chances = () => {
        const prizeWeight = data.prizes.reduce((sum, prize) => sum + (Number(prize.weight) || 0), 0)
        const other = (Number(data.nearMissWeight) || 0) + (Number(data.loseWeight) || 0)
        const boosted = prizeWeight * telegram.prizeWeightMultiplier
        return {
            base: Math.round((prizeWeight / (prizeWeight + other)) * 100),
            boosted: Math.round((boosted / (boosted + other)) * 100)
        }
    }

    /* ---------- Окно входа ---------- */

    const steps = Object.fromEntries([...dialog.querySelectorAll("[data-step]")].map((step) => [step.dataset.step, step]))
    const phoneForm = steps.phone
    const codeForm = steps.code
    const codeInput = codeForm.elements.code
    const resendButton = codeForm.querySelector("[data-auth-resend]")
    let pending = null
    let attempts = 0
    let resendTimer = null
    let afterLogin = null

    codeInput.maxLength = auth.codeLength

    const setError = (step, text) => {
        step.querySelector("[data-auth-error]").textContent = text
    }

    const showStep = (name) => {
        Object.entries(steps).forEach(([key, step]) => {
            step.hidden = key !== name
        })
        const step = steps[name]
        step.querySelectorAll("[data-auth-error]").forEach((item) => {
            item.textContent = ""
        })
        if (!reducedMotion) {
            gsap.fromTo(step, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" })
        }
        const field = step.querySelector("input:not([type='checkbox'])")
        if (field) {
            requestAnimationFrame(() => field.focus({ preventScroll: true }))
        }
    }

    const fillWelcome = () => {
        if (!user) {
            return
        }
        dialog.querySelector("[data-auth-hello]").textContent = `Удачи, ${user.name}!`
        const daily = `${data.spinsPerDay} ${plural(data.spinsPerDay, "бесплатная попытка", "бесплатные попытки", "бесплатных попыток")} в день`
        const bonus = user.bonusLeft ? ` и ещё ${user.bonusLeft} ${plural(user.bonusLeft, "бонусная", "бонусные", "бонусных")}` : ""
        dialog.querySelector("[data-auth-spins]").textContent = `У вас ${daily}${bonus}.`
    }

    const openAuth = ({ onDone } = {}) => {
        afterLogin = onDone || null
        if (user) {
            fillWelcome()
            showStep("welcome")
        } else {
            showStep(pending ? "code" : "phone")
        }
        if (!dialog.open) {
            dialog.showModal()
            requestAnimationFrame(() => {
                if (dialog.open) {
                    lock(true)
                }
            })
        }
    }

    const startResend = () => {
        let left = auth.resendSeconds
        const tick = () => {
            resendButton.disabled = left > 0
            resendButton.textContent = left > 0 ? `Отправить код ещё раз через ${left} с` : "Отправить код ещё раз"
            left -= 1
        }
        clearInterval(resendTimer)
        tick()
        resendTimer = setInterval(() => {
            tick()
            if (left < 0) {
                clearInterval(resendTimer)
            }
        }, 1000)
    }

    const requestCode = async (button) => {
        const label = button.textContent
        button.disabled = true
        button.textContent = "Отправляем…"
        try {
            const result = await sendCode(pending.phone)
            attempts = 0
            codeInput.value = ""
            codeForm.querySelector("[data-auth-phone]").textContent = formatPhone(phoneDigits(pending.phone))
            const demo = codeForm.querySelector("[data-auth-demo]")
            demo.hidden = !result.demoCode
            demo.textContent = result.demoCode ? `Демо-режим: SMS пока не отправляются. Ваш код — ${result.demoCode}` : ""
            codeForm.querySelector("button[type='submit']").disabled = false
            startResend()
            return true
        } catch (error) {
            setError(button.closest("[data-step]"), error.message)
            return false
        } finally {
            button.disabled = false
            button.textContent = label
        }
    }

    const phoneInput = phoneForm.elements.phone
    phoneInput.addEventListener("input", () => {
        phoneInput.value = formatPhone(phoneDigits(phoneInput.value))
    })

    phoneForm.addEventListener("submit", async (event) => {
        event.preventDefault()
        const name = phoneForm.elements.name.value.trim()
        const digits = phoneDigits(phoneInput.value)
        if (name.length < 2) {
            setError(phoneForm, "Как к вам обращаться? Введите имя.")
            phoneForm.elements.name.focus()
            return
        }
        if (digits.length !== 10) {
            setError(phoneForm, "Введите номер полностью: +7 и 10 цифр.")
            phoneInput.focus()
            return
        }
        if (!phoneForm.elements.consent.checked) {
            setError(phoneForm, "Нужно согласие на обработку данных.")
            phoneForm.elements.consent.focus()
            return
        }
        setError(phoneForm, "")
        pending = { name, phone: `+7${digits}` }
        if (await requestCode(phoneForm.querySelector("button[type='submit']"))) {
            showStep("code")
        }
    })

    codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, auth.codeLength)
        if (codeInput.value.length === auth.codeLength) {
            codeForm.requestSubmit()
        }
    })

    codeForm.addEventListener("submit", async (event) => {
        event.preventDefault()
        const code = codeInput.value
        const submit = codeForm.querySelector("button[type='submit']")
        if (code.length !== auth.codeLength) {
            setError(codeForm, `Введите ${auth.codeLength} цифры из SMS.`)
            return
        }
        submit.disabled = true
        try {
            const result = await verifyCode(pending.phone, code, pending.name)
            user = {
                name: pending.name,
                phone: pending.phone,
                token: result.token || "",
                verifiedAt: Date.now(),
                subscribed: false,
                bonusLeft: 0
            }
            pending = null
            clearInterval(resendTimer)
            writeUser()
            notify()
            fillWelcome()
            showStep("welcome")
        } catch (error) {
            attempts += 1
            codeInput.select()
            if (attempts >= MAX_ATTEMPTS) {
                setError(codeForm, "Слишком много попыток. Запросите новый код.")
                return
            }
            setError(codeForm, error.message)
            submit.disabled = false
        }
    })

    codeForm.querySelector("[data-auth-back]").addEventListener("click", () => {
        pending = null
        clearInterval(resendTimer)
        showStep("phone")
    })
    resendButton.addEventListener("click", () => requestCode(resendButton))

    dialog.querySelector("[data-auth-play]").addEventListener("click", () => {
        const callback = afterLogin
        afterLogin = null
        dialog.close()
        callback?.()
    })
    dialog.querySelector("[data-auth-close]").addEventListener("click", () => dialog.close())
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            dialog.close()
        }
    })
    dialog.addEventListener("close", () => {
        if (!document.getElementById("booking")?.open) {
            lock(false)
        }
    })

    const privacy = dialog.querySelector("[data-auth-privacy]")
    if (auth.privacyUrl) {
        privacy.href = auth.privacyUrl
        privacy.target = "_blank"
        privacy.rel = "noopener"
    } else {
        privacy.dataset.todo = "Политика обработки данных"
    }

    /* ---------- Telegram: подписка и бонус ---------- */

    let subscribeOpened = false

    const telegramIcon =
        '<svg class="lucky-tg__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.94 4.3 18.7 19.6c-.24 1.07-.88 1.34-1.78.83l-4.93-3.63-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.14-8.26c.4-.35-.09-.55-.62-.2L6.2 13.2l-4.86-1.52c-1.06-.33-1.08-1.06.22-1.57L20.6 2.77c.88-.33 1.65.2 1.34 1.53Z"/></svg>'

    const telegramMarkup = () => {
        const { base, boosted } = chances()
        if (user?.subscribed) {
            const bonus = user.bonusLeft
                ? ` Бонусных попыток осталось: ${user.bonusLeft}.`
                : " Бонусные попытки уже использованы."
            return (
                `<p class="lucky-tg__title">${telegramIcon}Вы подписаны — удача на вашей стороне</p>` +
                `<p class="lucky-tg__text">Шанс выигрыша повышен до ≈${boosted}%.${bonus}</p>`
            )
        }
        const subscribeAttrs = telegram.channelUrl
            ? `href="${escapeHtml(telegram.channelUrl)}" target="_blank" rel="noopener"`
            : 'href="#" data-todo="Telegram-канал"'
        return (
            `<p class="lucky-tg__title">${telegramIcon}Больше шансов с Telegram</p>` +
            `<p class="lucky-tg__text">Подпишитесь на ${escapeHtml(telegram.channelName)}: шанс выигрыша вырастет с ≈${base}% до ≈${boosted}%, и сразу +${telegram.bonusSpins} ${plural(telegram.bonusSpins, "попытка", "попытки", "попыток")}.</p>` +
            '<ol class="lucky-tg__steps">' +
            `<li class="${user ? "is-done" : ""}">${user ? "Вы вошли по номеру" : "Войдите по номеру телефона"}</li>` +
            "<li>Подпишитесь на канал</li>" +
            "<li>Нажмите «Я подписался» — бонус начислится сразу</li>" +
            "</ol>" +
            '<div class="lucky-tg__actions">' +
            `<a class="btn btn--accent" ${subscribeAttrs} data-tg-subscribe>Подписаться</a>` +
            `<button class="btn btn--ghost" type="button" data-tg-claim${subscribeOpened ? "" : " disabled"}>Я подписался</button>` +
            "</div>"
        )
    }

    const claimBonus = () => {
        if (!user || user.subscribed) {
            return
        }
        user.subscribed = true
        user.subscribedAt = Date.now()
        user.bonusLeft = (Number(user.bonusLeft) || 0) + telegram.bonusSpins
        writeUser()
        notify()
        fillWelcome()
        toast(`+${telegram.bonusSpins} ${plural(telegram.bonusSpins, "попытка", "попытки", "попыток")} и повышенный шанс — удачи!`)
    }

    const userBox = document.querySelector("[data-lucky-user]")
    const renderAccount = () => {
        document.querySelectorAll("[data-tg-card]").forEach((card) => {
            card.innerHTML = telegramMarkup()
            card.classList.toggle("is-subscribed", Boolean(user?.subscribed))
        })
        if (userBox) {
            userBox.hidden = !user
            userBox.innerHTML = user
                ? `<p>Вы вошли: <strong>${escapeHtml(user.name)}</strong> · ${maskPhone(user.phone)}</p><button class="lucky-auth__link" type="button" data-lucky-logout>Выйти</button>`
                : ""
        }
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-tg-subscribe]")) {
            subscribeOpened = true
            // ссылку не перерисовываем — иначе браузер не перейдёт по ней
            document.querySelectorAll("[data-tg-claim]").forEach((button) => {
                button.disabled = false
            })
            return
        }
        if (event.target.closest("[data-tg-claim]")) {
            if (user) {
                claimBonus()
            } else {
                openAuth({ onDone: claimBonus })
            }
            return
        }
        if (event.target.closest("[data-lucky-logout]")) {
            user = null
            writeUser()
            notify()
            return
        }
        // Бронь подхватывает имя и телефон из входа, если поля пустые
        if (event.target.closest("[data-booking]") && user) {
            const form = document.querySelector("#booking form")
            if (form && !form.elements.name.value) {
                form.elements.name.value = user.name
            }
            if (form && !form.elements.phone.value) {
                form.elements.phone.value = formatPhone(phoneDigits(user.phone))
            }
        }
    }, true)

    renderAccount()

    window.BohoLucky = {
        get user() {
            return user
        },
        isRegistered: () => Boolean(user),
        isSubscribed: () => Boolean(user?.subscribed),
        bonusLeft: () => Number(user?.bonusLeft) || 0,
        consumeBonus: () => {
            if (!user || !(user.bonusLeft > 0)) {
                return false
            }
            user.bonusLeft -= 1
            writeUser()
            notify()
            return true
        },
        weightMultiplier: () => (user?.subscribed ? telegram.prizeWeightMultiplier : 1),
        bonusSpins: telegram.bonusSpins,
        openAuth,
        onChange: (listener) => listeners.add(listener)
    }
})()
