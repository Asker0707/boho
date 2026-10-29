/**
 * Надёжное сохранение файла из редакторов (схема зала, меню).
 *
 * Chrome очищает выбранный файл ещё в окне «Сохранить», поэтому:
 *  - после записи файл перечитывается и сверяется;
 *  - при любой ошибке записи (в том числе без разрешения) отдаётся копия на скачивание.
 */
;(function () {
    "use strict"

    const download = (text, filename) => {
        const blob = new Blob([text], { type: "text/javascript" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }

    const writeAndVerify = async (handle, text) => {
        const writable = await handle.createWritable()
        await writable.write(text)
        await writable.close()
        const written = await (await handle.getFile()).text()
        if (written !== text) throw new Error("файл записался не полностью")
    }

    /**
     * Создаёт «сохранялку» для одного файла сайта. Запоминает выбранный файл между сохранениями.
     * Возвращает функцию save(text) → { ok, message, tone } или null, если пользователь отменил выбор.
     */
    const createSaver = ({ filename, sitePath, description }) => {
        let handle = null

        return async (text) => {
            if (!("showSaveFilePicker" in window)) {
                download(text, filename)
                return { ok: true, tone: "ok", message: `Файл ${filename} скачан. Замените им файл ${sitePath} в папке сайта.` }
            }

            if (!handle) {
                try {
                    handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{ description, accept: { "text/javascript": [".js"] } }]
                    })
                } catch (error) {
                    if (error?.name === "AbortError") return null // окно закрыли — файл не тронут
                    download(text, filename)
                    return { ok: false, tone: "warn", message: `Не удалось открыть окно сохранения — скачали копию ${filename}.` }
                }
            }

            try {
                await writeAndVerify(handle, text)
                return { ok: true, tone: "ok", message: `Сохранено и проверено: «${handle.name}». Обновите сайт, чтобы увидеть изменения.` }
            } catch (error) {
                handle = null
                download(text, filename)
                const reason = error?.name === "NotAllowedError" || error?.name === "AbortError" ? "нет разрешения на запись" : error?.message || "ошибка записи"
                return { ok: false, tone: "warn", message: `Файл не записан (${reason}). Скачали копию ${filename} — замените ею ${sitePath}.` }
            }
        }
    }

    window.BohoFile = { createSaver, download }
})()
