"use strict"

/**
 * Слот-машина «Испытай удачу» (секция #lucky на главной).
 * Призы и шансы — window.BOHO_SLOT (slot-data.js). Исход выбирается заранее
 * по весам, барабаны лишь доигрывают его.
 * Движение — только transform/opacity: полосы символов едут через translateY,
 * «размытие» — заранее нарисованная смазанная копия полосы, которая
 * проявляется на скорости. Огни — три слоя, у которых меняется opacity.
 * Для проверки: ?slot=test — без лимита; ?slot=jackpot|win|near|lose — нужный исход.
 */
;(() => {
    const data = window.BOHO_SLOT
    const machine = document.querySelector("[data-slot]")
    if (!data || !machine) {
        return
    }

    const SVG_NS = "http://www.w3.org/2000/svg"
    const STORAGE_KEY = "boho-slot"
    const SPEED = 22 // ячеек в секунду на полном ходу
    const STOP_DISTANCE = 4 // за сколько ячеек до цели барабан начинает тормозить
    const TEASE_DISTANCE = 13 // третий барабан при интриге тормозит дольше
    const OVERSHOOT = 1.4 // «перелёт» при остановке, параметр back.out
    const TEASE_OVERSHOOT = 1.2

    const hasGsap = typeof window.gsap !== "undefined"
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !hasGsap
    const testMode = new URLSearchParams(location.search).get("slot")
    const lock = typeof lockScroll === "function" ? lockScroll : () => {}
    const toast = typeof showToast === "function" ? showToast : () => {}

    const els = {
        cabinet: machine.querySelector(".slot__cabinet"),
        panel: machine.querySelector(".slot__panel"),
        lights: machine.querySelector(".slot__lights"),
        ticker: machine.querySelector(".slot__ticker"),
        tickerTrack: machine.querySelector(".slot__ticker-track"),
        reels: machine.querySelector(".slot__reels"),
        wins: machine.querySelector(".slot__wins"),
        flash: machine.querySelector(".slot__flash"),
        fx: machine.querySelector(".slot__fx"),
        spin: machine.querySelector("[data-slot-spin]"),
        sound: machine.querySelector("[data-slot-sound]"),
        lever: machine.querySelector("[data-slot-lever]"),
        leverArm: machine.querySelector(".slot__lever-arm"),
        leverKnob: machine.querySelector(".slot__lever-knob"),
        lamps: machine.querySelector(".slot__lamps"),
        tries: machine.querySelector("[data-slot-tries]"),
        status: machine.querySelector("[data-slot-status]"),
        paytable: document.querySelector("[data-slot-paytable]"),
        rules: document.querySelector("[data-slot-rules]"),
        mine: document.querySelector("[data-slot-mine]"),
        mineOpen: document.querySelector("[data-slot-mine-open]"),
        dialog: document.getElementById("lucky-prize")
    }

    /* ---------- Утилиты ---------- */

    const mod = (value, size) => ((value % size) + size) % size
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
    const random = (min, max) => min + Math.random() * (max - min)
    const pick = (list) => list[Math.floor(Math.random() * list.length)]
    const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
    const escapeHtml = (text) =>
        String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])

    const toDayKey = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const formatDay = (key) => key.split("-").reverse().join(".")
    const plural = (count, one, few, many) => {
        const tens = count % 100
        const units = count % 10
        if (tens > 10 && tens < 20) {
            return many
        }
        return units === 1 ? one : units >= 2 && units <= 4 ? few : many
    }
    const timeToMidnight = () => {
        const now = new Date()
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const minutes = Math.max(1, Math.ceil((midnight - now) / 60000))
        const hours = Math.floor(minutes / 60)
        return hours ? `${hours} ч ${minutes % 60} мин` : `${minutes} мин`
    }

    /* ---------- Лимит вращений и призы (localStorage) ---------- */

    const readState = () => {
        let saved = null
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
        } catch {
            saved = null
        }
        const today = toDayKey(new Date())
        const prizes = Array.isArray(saved?.prizes) ? saved.prizes.filter((prize) => prize.until >= today) : []
        if (saved?.day === today) {
            return { day: today, spins: Number(saved.spins) || 0, won: Boolean(saved.won), prizes }
        }
        return { day: today, spins: 0, won: false, prizes }
    }

    let state = readState()

    const writeState = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } catch {
            // приватный режим: лимит действует до перезагрузки страницы
        }
    }

    const refreshDay = () => {
        if (state.day !== toDayKey(new Date())) {
            state = readState()
        }
    }

    // Вход и бонус за Telegram — lucky-account.js (без него автомат работает как раньше)
    const account = window.BohoLucky
    const needsLogin = () => Boolean(account) && !account.isRegistered()
    const bonusLeft = () => account?.bonusLeft() || 0
    const dailyLeft = () => Math.max(0, data.spinsPerDay - state.spins)

    const spinsLeft = () => {
        if (testMode) {
            return data.spinsPerDay
        }
        if (data.stopAfterWin && state.won) {
            return 0
        }
        return dailyLeft() + bonusLeft()
    }

    const savePrize = (prize) => {
        const now = new Date()
        const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (data.validDays || 7))
        const stamp = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`
        const record = {
            symbol: prize.symbol,
            title: prize.title,
            text: prize.text,
            jackpot: Boolean(prize.jackpot),
            code: `${prize.code}-${stamp}`,
            until: toDayKey(until)
        }
        state.prizes = [record, ...state.prizes.filter((item) => item.code !== record.code)].slice(0, 5)
        if (!testMode) {
            state.won = true
        }
        writeState()
        return record
    }

    /* ---------- Барабаны ---------- */

    // Детерминированная перетасовка: у каждого барабана свой порядок символов
    const seededRandom = (seed) => () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    const buildStrip = (seed) => {
        const next = seededRandom(seed)
        const pool = data.symbols.flatMap((symbol) => Array(Math.max(1, symbol.count || 1)).fill(symbol.id))
        for (let attempt = 0; attempt < 300; attempt++) {
            const list = [...pool]
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1))
                ;[list[i], list[j]] = [list[j], list[i]]
            }
            // одинаковые символы не стоят рядом — иначе «почти» и выигрыш читаются плохо
            if (list.every((id, i) => id !== list[(i + 1) % list.length])) {
                return list
            }
        }
        return pool
    }

    // Смазанные копии символов для движения: тот же рисунок, повторённый с прозрачностью
    const buildBlurSymbols = () => {
        const defs = document.querySelector(".slot-sprite defs")
        data.symbols.forEach(({ id }) => {
            const symbol = document.createElementNS(SVG_NS, "symbol")
            symbol.id = `ss-${id}-blur`
            symbol.setAttribute("viewBox", "0 0 100 100")
            symbol.setAttribute("overflow", "visible")
            ;[[-16, 0.16], [-6, 0.38], [6, 0.38], [16, 0.16]].forEach(([shift, opacity]) => {
                const use = document.createElementNS(SVG_NS, "use")
                use.setAttribute("href", `#ss-${id}`)
                use.setAttribute("y", shift)
                use.setAttribute("opacity", opacity)
                symbol.append(use)
            })
            defs.append(symbol)
        })
    }

    const cellMarkup = (id, suffix = "") =>
        `<div class="reel__cell"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#ss-${id}${suffix}"/></svg></div>`

    // Полоса: [последний, ...все, первый, второй] — так прокрутка по кругу бесшовная
    const stripMarkup = (list, suffix) =>
        [list[list.length - 1], ...list, list[0], list[1]].map((id) => cellMarkup(id, suffix)).join("")

    const reels = [0, 1, 2].map((index) => {
        const list = buildStrip(index * 7919 + 17)
        const el = document.createElement("div")
        el.className = "reel"
        el.innerHTML =
            `<div class="reel__strip">${stripMarkup(list, "")}</div>` +
            `<div class="reel__strip reel__strip--blur">${stripMarkup(list, "-blur")}</div>`
        els.reels.append(el)
        return {
            el,
            list,
            size: list.length,
            strips: [...el.querySelectorAll(".reel__strip")],
            pos: 0,
            lastPos: 0,
            vel: 0,
            blur: 0,
            mode: "idle",
            lastIndex: 0
        }
    })

    // Размеры читаются только при ресайзе — во время анимации раскладку не трогаем
    let cell = 0
    const metrics = { tickerWidth: 300, tickerFont: 11, armLength: 100, reelsX: 0, reelsY: 0 }
    const measure = () => {
        cell = reels[0].strips[0].firstElementChild.getBoundingClientRect().height
        const box = machine.getBoundingClientRect()
        const reelsBox = els.reels.getBoundingClientRect()
        metrics.reelsX = reelsBox.left - box.left + reelsBox.width / 2
        metrics.reelsY = reelsBox.top - box.top + reelsBox.height / 2
        metrics.tickerWidth = els.ticker.clientWidth
        metrics.tickerFont = parseFloat(getComputedStyle(els.tickerTrack).fontSize) || 11
        metrics.armLength = els.leverArm.offsetHeight
    }

    // pos растёт — символы едут вниз; в центре окна стоит символ list[mod(-pos)]
    const render = (reel) => {
        const offset = mod(-reel.pos, reel.size)
        const transform = `translate3d(0, ${(-offset * cell).toFixed(2)}px, 0)`
        reel.strips[0].style.transform = transform
        reel.strips[1].style.transform = transform
    }

    const setBlur = (reel, value) => {
        reel.blur = value
        reel.strips[0].style.opacity = String(1 - value)
        reel.strips[1].style.opacity = String(value)
    }

    const update = (time, deltaMs) => {
        const dt = Math.min(deltaMs, 50) / 1000 || 0.016
        reels.forEach((reel) => {
            if (reel.mode === "free") {
                reel.pos += reel.vel * dt
            }
            const speed = Math.abs(reel.pos - reel.lastPos) / dt
            reel.lastPos = reel.pos
            const blur = Math.round(clamp((speed - 7) / 9, 0, 1) * 20) / 20
            if (blur !== reel.blur) {
                setBlur(reel, blur)
            }
            render(reel)
            const index = Math.round(reel.pos)
            if (index !== reel.lastIndex) {
                reel.lastIndex = index
                sound.tick()
            }
        })
    }

    const startReel = (reel, delay) => {
        reel.mode = "tween"
        reel.vel = 0
        gsap.timeline({ delay })
            // короткий рывок назад перед разгоном, как у механического барабана
            .to(reel, { pos: reel.pos - 0.28, duration: 0.2, ease: "power2.out" })
            .add(() => {
                reel.mode = "free"
            })
            .to(reel, { vel: SPEED, duration: 0.5, ease: "power2.in" })
    }

    const stopReel = (reel, targetIndex, distance, overshoot) =>
        new Promise((resolve) => {
            gsap.killTweensOf(reel)
            const velocity = Math.max(reel.vel, 6)
            // На полном ходу символы смазаны, поэтому полосу можно незаметно
            // «перемотать» так, чтобы торможение всегда шло ровно distance ячеек
            const rough = Math.round(reel.pos + distance)
            let delta = mod(-targetIndex - rough, reel.size)
            if (delta > reel.size / 2) {
                delta -= reel.size
            }
            const target = rough + delta
            const shift = target - distance - reel.pos
            reel.pos += shift
            reel.lastPos += shift
            reel.mode = "tween"
            // у back.out начальная скорость = путь × (s + 3) / длительность — подбираем без рывка
            gsap.to(reel, {
                pos: target,
                duration: (distance * (overshoot + 3)) / velocity,
                ease: `back.out(${overshoot})`,
                onComplete: () => {
                    reel.mode = "idle"
                    reel.vel = 0
                    sound.stop()
                    resolve()
                }
            })
        })

    const placeReel = (reel, targetIndex) => {
        reel.pos = mod(-targetIndex, reel.size)
        reel.lastPos = reel.pos
        reel.lastIndex = Math.round(reel.pos)
        setBlur(reel, 0)
        render(reel)
    }

    /* ---------- Исход вращения ---------- */

    const symbolIds = data.symbols.map((symbol) => symbol.id)

    const pickOutcome = () => {
        const prizes = data.prizes
        if (testMode === "jackpot") {
            return { type: "win", prize: prizes.find((prize) => prize.jackpot) || prizes[0] }
        }
        if (testMode === "win") {
            return { type: "win", prize: pick(prizes.filter((prize) => !prize.jackpot)) }
        }
        if (testMode === "near" || testMode === "lose") {
            return { type: testMode }
        }
        // у подписчиков Telegram-канала веса призов выше
        const boost = account?.weightMultiplier() || 1
        const options = [
            ...prizes.map((prize) => ({ type: "win", prize, weight: prize.weight * boost })),
            { type: "near", weight: data.nearMissWeight },
            { type: "lose", weight: data.loseWeight }
        ]
        const total = options.reduce((sum, option) => sum + Math.max(0, Number(option.weight) || 0), 0)
        let roll = Math.random() * total
        for (const option of options) {
            roll -= Math.max(0, Number(option.weight) || 0)
            if (roll < 0) {
                return option
            }
        }
        return { type: "lose" }
    }

    const indexWhere = (reel, test) => {
        const options = reel.list.map((id, index) => index).filter((index) => test(reel.list[index], index))
        return options.length ? pick(options) : Math.floor(Math.random() * reel.size)
    }

    // Для каждого барабана — индекс символа, который встанет на линию
    const planStops = (outcome) => {
        let indexes
        if (outcome.type === "win") {
            indexes = reels.map((reel) => indexWhere(reel, (id) => id === outcome.prize.symbol))
        } else if (outcome.type === "near") {
            const symbol = Math.random() < 0.45 ? "boho" : pick(symbolIds)
            const third = reels[2]
            indexes = [
                indexWhere(reels[0], (id) => id === symbol),
                indexWhere(reels[1], (id) => id === symbol),
                // нужный символ стоит прямо над линией: на «перелёте» он почти доезжает до неё
                indexWhere(third, (id, index) => third.list[mod(index - 1, third.size)] === symbol)
            ]
        } else {
            const first = pick(symbolIds)
            const second = pick(symbolIds.filter((id) => id !== first))
            indexes = [
                indexWhere(reels[0], (id) => id === first),
                indexWhere(reels[1], (id) => id === second),
                Math.floor(Math.random() * reels[2].size)
            ]
        }
        return indexes.map((index, reelIndex) => ({ index, symbol: reels[reelIndex].list[index] }))
    }

    /* ---------- Звук (по умолчанию выключен, синтез без файлов) ---------- */

    const sound = {
        on: false,
        ctx: null,
        lastTick: 0,
        ensure() {
            const Context = window.AudioContext || window.webkitAudioContext
            if (!this.ctx && Context) {
                this.ctx = new Context()
            }
            if (this.ctx?.state === "suspended") {
                this.ctx.resume()
            }
            return this.ctx
        },
        tone(frequency, start, duration, { type = "triangle", gain = 0.05, to } = {}) {
            if (!this.on || !this.ensure()) {
                return
            }
            const ctx = this.ctx
            const time = ctx.currentTime + start
            const oscillator = ctx.createOscillator()
            const amp = ctx.createGain()
            oscillator.type = type
            oscillator.frequency.setValueAtTime(frequency, time)
            if (to) {
                oscillator.frequency.exponentialRampToValueAtTime(to, time + duration)
            }
            amp.gain.setValueAtTime(0.0001, time)
            amp.gain.exponentialRampToValueAtTime(gain, time + 0.01)
            amp.gain.exponentialRampToValueAtTime(0.0001, time + duration)
            oscillator.connect(amp).connect(ctx.destination)
            oscillator.start(time)
            oscillator.stop(time + duration + 0.02)
        },
        tick() {
            const now = performance.now()
            if (!this.on || now - this.lastTick < 70) {
                return
            }
            this.lastTick = now
            this.tone(1700, 0, 0.03, { type: "square", gain: 0.01 })
        },
        lever() {
            this.tone(200, 0, 0.2, { type: "sawtooth", gain: 0.025, to: 90 })
        },
        stop() {
            this.tone(150, 0, 0.12, { type: "square", gain: 0.04, to: 60 })
            this.tone(950, 0, 0.05, { gain: 0.02 })
        },
        win() {
            ;[523, 659, 784, 1047].forEach((frequency, i) => this.tone(frequency, i * 0.09, 0.28, { gain: 0.05 }))
        },
        jackpot() {
            ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((frequency, i) =>
                this.tone(frequency, i * 0.11, 0.32, { type: "square", gain: 0.03 })
            )
        },
        near() {
            this.tone(440, 0, 0.2, { gain: 0.04 })
            this.tone(415, 0.18, 0.4, { gain: 0.04 })
        }
    }

    els.sound.addEventListener("click", () => {
        sound.on = !sound.on
        els.sound.setAttribute("aria-pressed", String(sound.on))
        els.sound.setAttribute("aria-label", sound.on ? "Звук включён" : "Звук выключен")
        if (sound.on) {
            sound.ensure()
            sound.tone(880, 0, 0.12, { gain: 0.04 })
        }
    })

    /* ---------- Огни по периметру ---------- */

    let lightsSize = ""
    const buildLights = () => {
        const width = els.cabinet.offsetWidth
        const height = els.cabinet.offsetHeight
        if (!width || !height || lightsSize === `${width}x${height}`) {
            return
        }
        lightsSize = `${width}x${height}`
        const inset = els.panel.offsetLeft / 2
        const corner = 32
        const bottom = Math.max(4, corner - inset)
        const path = document.createElementNS(SVG_NS, "path")
        path.setAttribute(
            "d",
            `M${inset} ${height - corner}V${width / 2}` +
                `A${width / 2 - inset} ${width / 2 - inset} 0 0 1 ${width - inset} ${width / 2}` +
                `V${height - corner}A${bottom} ${bottom} 0 0 1 ${width - corner} ${height - inset}` +
                `H${corner}A${bottom} ${bottom} 0 0 1 ${inset} ${height - corner}Z`
        )
        const sprite = document.querySelector(".slot-sprite")
        sprite.append(path)
        const length = path.getTotalLength()
        // число огней кратно трём — бегущая волна замыкается без шва
        const count = Math.max(24, Math.round(length / (width < 400 ? 20 : 25) / 3) * 3)
        const groups = ["", "", ""]
        let base = ""
        for (let i = 0; i < count; i++) {
            const point = path.getPointAtLength((i * length) / count)
            const bulb = `<i class="slot__bulb" style="left:${point.x.toFixed(1)}px;top:${point.y.toFixed(1)}px"></i>`
            base += bulb
            groups[i % 3] += bulb
        }
        path.remove()
        els.lights.innerHTML =
            `<div class="slot__bulbs">${base}</div>` +
            ["a", "b", "c"].map((name, i) => `<div class="slot__bulbs slot__bulbs--lit slot__bulbs--${name}">${groups[i]}</div>`).join("")
    }

    /* ---------- Табло ---------- */

    const MODES = ["is-spinning", "is-tease", "is-win", "is-jackpot", "is-near"]
    const setMode = (mode) => {
        machine.classList.remove(...MODES)
        if (mode) {
            machine.classList.add(mode)
        }
    }

    const jackpotPrize = data.prizes.find((prize) => prize.jackpot)
    const idleMessage = [
        "Испытай удачу",
        jackpotPrize ? `Джекпот Boho — ${jackpotPrize.title.toLowerCase()}` : "",
        "Три одинаковых символа — приз",
        `${data.spinsPerDay} ${plural(data.spinsPerDay, "попытка", "попытки", "попыток")} в день бесплатно`,
        account ? `Подписка на Telegram — ещё +${account.bonusSpins} и выше шанс` : ""
    ]
        .filter(Boolean)
        .join("  ✦  ")

    const setTicker = (text, { fixed = false, short = text } = {}) => {
        const isStatic = fixed || reducedMotion
        els.ticker.classList.toggle("is-static", isStatic)
        const track = els.tickerTrack
        if (isStatic) {
            track.innerHTML = `<span>${escapeHtml(short)}</span>`
            return
        }
        // Ширину строки оцениваем по числу знаков (заглавные + разрядка ≈ 0.9em),
        // чтобы не заставлять браузер пересчитывать раскладку посреди анимации.
        // Текст должен быть шире табло, иначе в бегущей строке появится пустота.
        const unit = `${text}  ✦  `
        const unitWidth = unit.length * metrics.tickerFont * 0.9
        const piece = unit.repeat(Math.ceil(metrics.tickerWidth / unitWidth) + 1)
        track.innerHTML = `<span>${escapeHtml(piece)}</span><span>${escapeHtml(piece)}</span>`
        track.style.setProperty("--ticker-dur", `${((piece.length * metrics.tickerFont * 0.9) / 48).toFixed(1)}s`)
    }

    const announce = (text) => {
        els.status.textContent = text
    }

    /* ---------- Выигрышная линия, вспышка, конфетти ---------- */

    const showWins = (plan, indexes, isWin) => {
        els.wins.innerHTML = plan
            .map(({ symbol }) => `<div class="slot__win"><svg viewBox="0 0 100 100"><use href="#ss-${symbol}"/></svg></div>`)
            .join("")
        const cells = indexes.map((index) => els.wins.children[index])
        if (reducedMotion) {
            cells.forEach((item) => {
                item.style.opacity = isWin ? "1" : "0.6"
            })
            return
        }
        gsap.fromTo(
            cells,
            { opacity: 0, scale: 0.9 },
            { opacity: isWin ? 1 : 0.65, scale: isWin ? 1.16 : 1.03, duration: 0.45, ease: "back.out(2.5)", stagger: 0.08 }
        )
        if (isWin) {
            gsap.to(cells, { scale: 1.02, duration: 0.32, ease: "sine.inOut", yoyo: true, repeat: 7, delay: 0.7 })
        }
    }

    const hideWins = () => {
        if (hasGsap) {
            gsap.killTweensOf(els.wins.children)
        }
        els.wins.innerHTML = ""
    }

    const flash = (isJackpot) => {
        gsap.fromTo(
            els.flash,
            { opacity: 0.001 },
            { opacity: isJackpot ? 0.9 : 0.6, duration: 0.12, ease: "power1.out", yoyo: true, repeat: isJackpot ? 5 : 1 }
        )
    }

    const shake = () => {
        gsap.to([els.cabinet, els.lever], {
            keyframes: {
                x: [0, -8, 8, -7, 7, -5, 5, -3, 3, 0],
                rotation: [0, -0.6, 0.6, -0.5, 0.5, -0.3, 0.3, -0.15, 0.15, 0]
            },
            duration: 0.75,
            ease: "none"
        })
    }

    // Конфетти и монеты — Web Animations: transform/opacity по ключевым кадрам
    // считаются заранее и проигрываются композитором, без работы в каждом кадре
    const particles = []
    const CONFETTI = ["#d6a15a", "#e8b872", "#f2e9da", "#2f5a46", "#b8693a"]
    const easeOut = (t) => 1 - (1 - t) * (1 - t)
    const easeIn = (t) => t * t
    const buildParticles = () => {
        for (let i = 0; i < 72; i++) {
            const item = document.createElement("i")
            item.className = `fx ${i % 2 === 0 ? "fx--coin" : "fx--paper"}`
            item.style.setProperty("--fx-color", CONFETTI[i % CONFETTI.length])
            els.fx.append(item)
            particles.push(item)
        }
    }
    const burst = async (isJackpot) => {
        const items = isJackpot ? particles : particles.filter((item, i) => i % 4 !== 2).slice(0, 36)
        // запускаем двумя порциями в соседних кадрах — на слабых телефонах так ровнее
        const half = Math.ceil(items.length / 2)
        launch(items.slice(0, half), isJackpot)
        await nextFrame()
        launch(items.slice(half), isJackpot)
    }
    const launch = (items, isJackpot) => {
        const originX = metrics.reelsX
        const originY = metrics.reelsY
        items.forEach((item) => {
            const isCoin = item.classList.contains("fx--coin")
            const angle = random(-165, -15) * (Math.PI / 180)
            const reachX = Math.cos(angle) * random(60, isJackpot ? 340 : 240)
            const rise = random(70, isJackpot ? 260 : 190)
            const fall = random(280, 520)
            const duration = random(1300, 2100)
            const size = random(0.7, 1.15)
            const startX = originX + random(-20, 20)
            const startY = originY + random(-10, 10)
            const turn = random(0, 360)
            const spinBy = random(-540, 540)
            const flips = isCoin ? Math.round(random(4, 7)) : 0
            const frames = []
            const steps = isCoin ? 28 : 14
            for (let k = 0; k <= steps; k++) {
                const t = k / steps
                const x = startX + reachX * easeOut(t)
                // взлёт (первые 32% времени) и падение с ускорением
                const y = t < 0.32 ? startY - rise * easeOut(t / 0.32) : startY - rise + fall * easeIn((t - 0.32) / 0.68)
                const flip = isCoin ? 0.15 + 0.85 * Math.abs(Math.cos(t * flips * Math.PI)) : 1
                frames.push({
                    offset: t,
                    transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(turn + spinBy * t).toFixed(1)}deg) scale(${(size * flip).toFixed(3)}, ${size.toFixed(3)})`,
                    opacity: t > 0.82 ? Math.max(0, (1 - t) / 0.18) : 1
                })
            }
            item.animate(frames, { duration, easing: "linear" })
        })
    }

    /* ---------- Рычаг ---------- */

    const lever = { value: 0 }
    const setLever = () => {
        const length = metrics.armLength
        const value = lever.value
        // рычаг «проворачивается» к зрителю: палка укорачивается и уходит ниже оси
        els.leverArm.style.transform = `scaleY(${(1 - 1.5 * value).toFixed(3)})`
        els.leverKnob.style.transform =
            `translate(-50%, -50%) translateY(${(length * 1.5 * value).toFixed(1)}px) scale(${(1 + 0.18 * Math.sin(Math.PI * clamp(value, 0, 1))).toFixed(3)})`
    }

    const releaseLever = () => {
        if (reducedMotion) {
            lever.value = 0
            setLever()
            return
        }
        gsap.to(lever, { value: 0, duration: 0.9, ease: "elastic.out(1, 0.35)", onUpdate: setLever })
    }

    const pullLever = () => {
        sound.lever()
        if (reducedMotion) {
            return
        }
        gsap.killTweensOf(lever)
        gsap.to(lever, { value: 1, duration: 0.2, ease: "power2.in", onUpdate: setLever, onComplete: releaseLever })
    }

    let drag = null
    let suppressClick = false
    els.lever.addEventListener("pointerdown", (event) => {
        if (busy || reducedMotion) {
            return
        }
        drag = { startY: event.clientY, moved: false }
        els.lever.setPointerCapture(event.pointerId)
        gsap.killTweensOf(lever)
    })
    els.lever.addEventListener("pointermove", (event) => {
        if (!drag) {
            return
        }
        const value = clamp((event.clientY - drag.startY) / (metrics.armLength * 1.5), 0, 1)
        if (value > 0.05) {
            drag.moved = true
        }
        lever.value = value
        setLever()
    })
    const endDrag = () => {
        if (!drag) {
            return
        }
        const { moved } = drag
        drag = null
        if (!moved) {
            releaseLever()
            return
        }
        suppressClick = true
        const pulled = lever.value > 0.55
        releaseLever()
        if (pulled) {
            sound.lever()
            spin()
        }
    }
    els.lever.addEventListener("pointerup", endDrag)
    els.lever.addEventListener("pointercancel", endDrag)
    els.lever.addEventListener("click", () => {
        if (suppressClick) {
            suppressClick = false
            return
        }
        if (canSpin()) {
            if (!needsLogin()) {
                pullLever()
            }
            spin()
        } else if (!busy) {
            setTicker("Попытки на сегодня закончились", { fixed: true, short: "Приходите завтра" })
        }
    })

    /* ---------- Кнопки, попытки ---------- */

    let busy = false
    let countdown = null
    const canSpin = () => !busy && spinsLeft() > 0

    const updateControls = () => {
        refreshDay()
        const left = spinsLeft()
        const daily = testMode || (data.stopAfterWin && state.won) ? Math.min(left, data.spinsPerDay) : dailyLeft()
        const bonus = left - daily
        // дневные лампы + бонусные (за подписку) отдельным цветом
        els.lamps.innerHTML =
            Array.from({ length: data.spinsPerDay }, (item, i) => `<i class="slot__lamp${i < daily ? " is-on" : ""}"></i>`).join("") +
            Array.from({ length: bonus }, () => '<i class="slot__lamp slot__lamp--bonus is-on"></i>').join("")
        els.spin.disabled = busy || left === 0
        els.spin.textContent = busy ? "Крутим…" : left ? "Крутить" : "Завтра"
        els.lever.setAttribute("aria-disabled", String(busy || left === 0))
        machine.classList.toggle("is-busy", busy)

        if (needsLogin()) {
            els.tries.textContent = "Вход по номеру телефона"
        } else if (left) {
            els.tries.textContent = `Попытки: ${daily} из ${data.spinsPerDay}${bonus ? ` · бонус +${bonus}` : ""}`
        } else {
            const reason = data.stopAfterWin && state.won ? "Приз на сегодня получен." : "Попытки закончились."
            els.tries.textContent = `${reason} Новые через ${timeToMidnight()}`
        }

        clearInterval(countdown)
        if (!left && !busy) {
            countdown = setInterval(updateControls, 60000)
        }
        updateMine()
    }

    const updateMine = () => {
        const prize = state.prizes[0]
        els.mine.hidden = !prize
        if (prize) {
            els.mineOpen.innerHTML = `${escapeHtml(prize.code)}<span>показать</span>`
        }
    }

    const spinFull = async (plan) => {
        gsap.ticker.add(update)
        reels.forEach((reel, i) => startReel(reel, i * 0.09))
        await wait(1.05)

        const isTease = plan[0].symbol === plan[1].symbol
        const stops = [stopReel(reels[0], plan[0].index, STOP_DISTANCE, OVERSHOOT)]
        await wait(0.38)
        const second = stopReel(reels[1], plan[1].index, STOP_DISTANCE, OVERSHOOT)
        stops.push(second)

        if (isTease) {
            // Интрига: два символа совпали — третий барабан тормозит дольше
            await second
            setMode("is-tease")
            setTicker("Ну же…", { fixed: true })
            showWins(plan, [0, 1], false)
            reels[2].el.classList.add("is-tease")
            stops.push(stopReel(reels[2], plan[2].index, TEASE_DISTANCE, TEASE_OVERSHOOT))
        } else {
            await wait(0.38)
            stops.push(stopReel(reels[2], plan[2].index, STOP_DISTANCE, OVERSHOOT))
        }

        await Promise.all(stops)
        reels[2].el.classList.remove("is-tease")
        update(0, 16)
        gsap.ticker.remove(update)
    }

    const spinReduced = async (plan) => {
        for (let i = 0; i < reels.length; i++) {
            await wait(0.25)
            placeReel(reels[i], plan[i].index)
            sound.stop()
        }
    }

    let idleTimer = null
    const backToIdle = (delay) => {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
            if (busy || els.dialog?.open) {
                return
            }
            setMode("")
            hideWins()
            setTicker(idleMessage, { short: "Испытай удачу" })
        }, delay * 1000)
    }

    const showResult = async (outcome, plan) => {
        if (outcome.type === "win") {
            const { prize } = outcome
            const isJackpot = Boolean(prize.jackpot)
            const record = savePrize(prize)
            // Тяжёлое раскладываем по соседним кадрам, чтобы ни один не затянулся
            setMode(isJackpot ? "is-jackpot" : "is-win")
            showWins(plan, [0, 1, 2], true)
            announce(`${isJackpot ? "Джекпот! " : "Выигрыш! "}${prize.title}. Промокод ${record.code}.`)
            if (isJackpot) {
                sound.jackpot()
            } else {
                sound.win()
            }
            await nextFrame()
            setTicker(isJackpot ? `Джекпот!  ✦  ${prize.title}` : `Выигрыш: ${prize.title}`, {
                short: isJackpot ? "Джекпот!" : "Выигрыш!"
            })
            if (!reducedMotion) {
                await nextFrame()
                flash(isJackpot)
                burst(isJackpot)
                if (isJackpot) {
                    shake()
                }
            }
            fillPrize(record)
            await wait(reducedMotion ? 0.6 : isJackpot ? 2.4 : 1.5)
            openPrize(record)
            return
        }

        if (outcome.type === "near") {
            setMode("is-near")
            showWins(plan, [0, 1], false)
            setTicker("Почти!  ✦  Совсем чуть-чуть", { short: "Почти!" })
            announce("Почти! Два символа совпали.")
            sound.near()
        } else {
            setMode("")
            setTicker("Не в этот раз  ✦  Удача любит смелых", { short: "Не в этот раз" })
            announce("Не в этот раз.")
        }
        backToIdle(4)
    }

    const spin = async () => {
        refreshDay()
        if (!canSpin()) {
            return
        }
        // Сначала вход по телефону; после него кнопка «Крутить барабаны» сразу запускает вращение
        if (needsLogin()) {
            account.openAuth({
                onDone: () => {
                    if (!reducedMotion) {
                        pullLever()
                    }
                    spin()
                }
            })
            return
        }
        busy = true
        clearTimeout(idleTimer)
        if (!testMode) {
            // сначала тратятся дневные попытки, потом бонусные
            if (dailyLeft() > 0) {
                state.spins += 1
                writeState()
            } else {
                account?.consumeBonus()
            }
        }
        updateControls()

        const outcome = pickOutcome()
        const plan = planStops(outcome)
        hideWins()
        setMode("is-spinning")
        setTicker("Крутим…", { fixed: true })
        announce("Барабаны крутятся")

        if (reducedMotion) {
            await spinReduced(plan)
        } else {
            await spinFull(plan)
        }

        busy = false
        updateControls()
        await showResult(outcome, plan)
        updateControls()
    }

    els.spin.addEventListener("click", () => {
        if (!reducedMotion && !needsLogin()) {
            pullLever()
        }
        spin()
    })

    /* ---------- Окно приза ---------- */

    let shownPrize = null
    // Текст окна заполняем заранее, пока оно закрыто, — открытие обходится дешевле
    const fillPrize = (prize) => {
        const dialog = els.dialog
        if (!dialog || shownPrize === prize) {
            return
        }
        shownPrize = prize
        dialog.querySelector("[data-prize-symbol]").setAttribute("href", `#ss-${prize.symbol}`)
        dialog.querySelector("[data-prize-eyebrow]").textContent = prize.jackpot ? "Джекпот!" : "Ваш приз"
        dialog.querySelector("[data-prize-title]").textContent = prize.title
        dialog.querySelector("[data-prize-text]").textContent = prize.text
        dialog.querySelector("[data-prize-code]").textContent = prize.code
        dialog.querySelector("[data-prize-copy]").textContent = "Скопировать"
        dialog.querySelector("[data-prize-note]").textContent =
            `Действует до ${formatDay(prize.until)} включительно. Назовите промокод при бронировании или покажите официанту.`
    }

    const openPrize = (prize) => {
        const dialog = els.dialog
        if (!dialog || typeof dialog.showModal !== "function") {
            return
        }
        fillPrize(prize)
        if (!dialog.open) {
            dialog.showModal()
            // прокрутку замораживаем кадром позже: так открытие окна и пауза
            // ScrollSmoother не складываются в один долгий кадр
            requestAnimationFrame(() => {
                if (dialog.open) {
                    lock(true)
                }
            })
        }
    }

    const initDialog = () => {
        const dialog = els.dialog
        if (!dialog) {
            return
        }
        dialog.querySelectorAll("[data-prize-close]").forEach((button) => button.addEventListener("click", () => dialog.close()))
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                dialog.close()
            }
        })
        dialog.addEventListener("close", () => {
            // окно брони могло открыться сразу после приза — тогда прокрутку не отпускаем
            if (!document.getElementById("booking")?.open) {
                lock(false)
            }
            backToIdle(1.5)
        })

        const copyButton = dialog.querySelector("[data-prize-copy]")
        copyButton.addEventListener("click", async () => {
            const code = shownPrize?.code || ""
            try {
                await navigator.clipboard.writeText(code)
                copyButton.textContent = "Скопировано"
                toast("Промокод скопирован")
            } catch {
                const range = document.createRange()
                range.selectNodeContents(dialog.querySelector("[data-prize-code]"))
                getSelection().removeAllRanges()
                getSelection().addRange(range)
                toast("Выделили промокод — скопируйте его")
            }
        })

        // «Забронировать стол»: окно брони откроет общий обработчик [data-booking],
        // а промокод заранее попадает в комментарий заявки
        dialog.querySelector("[data-prize-book]").addEventListener("click", () => {
            const comment = document.querySelector("#booking [name='comment']")
            const code = shownPrize?.code
            if (comment && code && !comment.value.includes(code)) {
                comment.value = `${comment.value ? `${comment.value}\n` : ""}Промокод «Испытай удачу»: ${code}`
            }
            dialog.close()
        })

        els.mineOpen.addEventListener("click", () => {
            if (state.prizes[0]) {
                openPrize(state.prizes[0])
            }
        })
    }

    /* ---------- Таблица выигрышей ---------- */

    const renderPaytable = () => {
        const boost = account?.weightMultiplier() || 1
        const total = [...data.prizes.map((prize) => prize.weight * boost), data.nearMissWeight, data.loseWeight].reduce(
            (sum, weight) => sum + Math.max(0, Number(weight) || 0),
            0
        )
        const groups = []
        data.prizes.forEach((prize) => {
            const group = groups.find((item) => item.title === prize.title)
            if (group) {
                group.items.push(prize)
            } else {
                groups.push({ title: prize.title, jackpot: prize.jackpot, items: [prize] })
            }
        })
        const triple = (id) => `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#ss-${id}"/></svg>`.repeat(3)
        els.paytable.innerHTML = groups
            .map((group) => {
                const weight = group.items.reduce((sum, prize) => sum + (Number(prize.weight) || 0), 0) * boost
                const chance = total ? ((weight / total) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "0"
                const labels = group.items
                    .map((prize) => data.symbols.find((symbol) => symbol.id === prize.symbol)?.label || prize.symbol)
                    .join(" или ")
                return (
                    `<li class="paytable__row${group.jackpot ? " paytable__row--jackpot" : ""}">` +
                    `<span class="paytable__symbols" role="img" aria-label="Три символа: ${escapeHtml(labels)}">` +
                    group.items.map((prize) => triple(prize.symbol)).join('<span class="paytable__or" aria-hidden="true">или</span>') +
                    "</span>" +
                    `<span class="paytable__prize">${escapeHtml(group.title)}</span>` +
                    `<span class="paytable__chance">шанс ${chance}%</span>` +
                    "</li>"
                )
            })
            .join("")
        els.rules.textContent = data.rules || ""
    }

    /* ---------- Старт ---------- */

    buildBlurSymbols()
    renderPaytable()
    initDialog()

    buildParticles()
    measure()
    planStops({ type: "lose" }).forEach(({ index }, i) => placeReel(reels[i], index))
    setTicker(idleMessage, { short: "Испытай удачу" })
    updateControls()
    setLever()
    account?.onChange(() => {
        renderPaytable()
        if (!busy) {
            updateControls()
        }
    })

    // Размеры: ячейка барабана и огни по контуру корпуса
    const resizeObserver = new ResizeObserver(() => {
        const tickerWidth = metrics.tickerWidth
        measure()
        reels.forEach(render)
        setLever()
        if (Math.abs(tickerWidth - metrics.tickerWidth) > 1 && !busy && !machine.classList.contains("is-win")) {
            setTicker(idleMessage, { short: "Испытай удачу" })
        }
        buildLights()
    })
    resizeObserver.observe(els.cabinet)

    // Огни и бегущая строка работают, только пока автомат на экране
    const visibility = new IntersectionObserver(
        ([entry]) => machine.classList.toggle("is-visible", entry.isIntersecting),
        { rootMargin: "100px 0px" }
    )
    visibility.observe(machine)

    document.fonts?.ready.then(() => {
        if (!busy && !machine.classList.contains("is-win")) {
            setTicker(idleMessage, { short: "Испытай удачу" })
        }
    })
})()
