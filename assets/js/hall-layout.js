/*
 * Схема зала Бохо.
 * Этот файл создаёт редактор схемы (editor.html) — править вручную не обязательно.
 * После изменений в редакторе сохраните файл сюда же: assets/js/hall-layout.js
 */
window.BOHO_HALL = {
    "version": 1,
    "width": 1200,
    "height": 800,
    "items": [
        { "id": "z-restaurant", "type": "zone", "zoneId": "restaurant", "name": "Ресторан", "color": "#5f8a6f", "x": 335, "y": 290, "w": 610, "h": 520, "r": 0, "locked": true },
        { "id": "z-hookah", "type": "zone", "zoneId": "hookah", "name": "Кальянный лаунж", "color": "#c4894a", "x": 915, "y": 230, "w": 510, "h": 400, "r": 0, "locked": true },
        { "id": "z-karaoke", "type": "zone", "zoneId": "karaoke", "name": "Караоке", "color": "#9a73b0", "x": 915, "y": 610, "w": 510, "h": 320, "r": 0, "locked": true },

        { "id": "o-window-1", "type": "window", "x": 210, "y": 14, "w": 170, "h": 8, "r": 0 },
        { "id": "o-window-2", "type": "window", "x": 460, "y": 14, "w": 170, "h": 8, "r": 0 },
        { "id": "o-window-3", "type": "window", "x": 1186, "y": 300, "w": 170, "h": 8, "r": 90 },
        { "id": "o-fireplace", "type": "fireplace", "x": 30, "y": 280, "w": 24, "h": 150, "r": 0 },
        { "id": "o-wall-1", "type": "wall", "x": 650, "y": 160, "w": 240, "h": 10, "r": 90 },
        { "id": "o-wall-2", "type": "wall", "x": 830, "y": 440, "w": 340, "h": 10, "r": 0 },
        { "id": "o-column", "type": "column", "x": 650, "y": 560, "w": 26, "h": 26, "r": 0 },
        { "id": "o-bar", "type": "bar", "x": 230, "y": 655, "w": 300, "h": 50, "r": 0 },
        { "id": "o-kitchen", "type": "kitchen", "x": 230, "y": 745, "w": 300, "h": 60, "r": 0 },
        { "id": "o-wc", "type": "wc", "x": 450, "y": 735, "w": 80, "h": 80, "r": 0 },
        { "id": "o-wardrobe", "type": "wardrobe", "x": 575, "y": 650, "w": 120, "h": 50, "r": 0 },
        { "id": "o-entrance", "type": "entrance", "x": 580, "y": 786, "w": 90, "h": 12, "r": 0 },
        { "id": "o-stage", "type": "stage", "x": 1070, "y": 615, "w": 170, "h": 250, "r": 0 },
        { "id": "o-plant-1", "type": "plant", "x": 600, "y": 60, "w": 44, "h": 44, "r": 0 },
        { "id": "o-plant-2", "type": "plant", "x": 60, "y": 520, "w": 44, "h": 44, "r": 0 },
        { "id": "o-plant-3", "type": "plant", "x": 690, "y": 400, "w": 40, "h": 40, "r": 0 },

        { "id": "t1", "type": "table-round", "num": "1", "seats": 2, "minSeats": 1, "features": "у окна", "x": 160, "y": 100, "w": 62, "h": 62, "r": 0 },
        { "id": "t2", "type": "table-round", "num": "2", "seats": 2, "minSeats": 1, "features": "у окна", "x": 285, "y": 100, "w": 62, "h": 62, "r": 0 },
        { "id": "t3", "type": "table-round", "num": "3", "seats": 2, "minSeats": 1, "features": "у окна", "x": 410, "y": 100, "w": 62, "h": 62, "r": 0 },
        { "id": "t4", "type": "table-rect", "num": "4", "seats": 4, "minSeats": 2, "features": "у камина", "x": 130, "y": 225, "w": 80, "h": 76, "r": 0 },
        { "id": "t5", "type": "table-rect", "num": "5", "seats": 4, "minSeats": 2, "features": "у камина", "x": 130, "y": 365, "w": 80, "h": 76, "r": 0 },
        { "id": "t6", "type": "table-rect", "num": "6", "seats": 4, "minSeats": 2, "features": "", "x": 300, "y": 225, "w": 80, "h": 76, "r": 0 },
        { "id": "t7", "type": "table-rect", "num": "7", "seats": 6, "minSeats": 3, "features": "", "x": 310, "y": 375, "w": 140, "h": 70, "r": 0 },
        { "id": "t8", "type": "table-round", "num": "8", "seats": 4, "minSeats": 2, "features": "", "x": 515, "y": 155, "w": 84, "h": 84, "r": 0 },
        { "id": "t9", "type": "table-round", "num": "9", "seats": 6, "minSeats": 3, "features": "центр зала", "x": 505, "y": 330, "w": 108, "h": 108, "r": 0 },
        { "id": "t10", "type": "table-rect", "num": "10", "seats": 8, "minSeats": 5, "features": "для компании", "x": 420, "y": 500, "w": 210, "h": 70, "r": 0 },

        { "id": "l1", "type": "sofa", "num": "11", "seats": 4, "minSeats": 2, "features": "мягкий диван", "x": 750, "y": 115, "w": 150, "h": 110, "r": 0 },
        { "id": "l2", "type": "sofa", "num": "12", "seats": 4, "minSeats": 2, "features": "мягкий диван", "x": 920, "y": 115, "w": 150, "h": 110, "r": 0 },
        { "id": "l3", "type": "sofa", "num": "13", "seats": 5, "minSeats": 2, "features": "у окна", "x": 1085, "y": 130, "w": 140, "h": 130, "r": 0 },
        { "id": "l4", "type": "sofa", "num": "14", "seats": 4, "minSeats": 2, "features": "уединённый", "x": 780, "y": 330, "w": 150, "h": 110, "r": 180 },
        { "id": "l5", "type": "sofa", "num": "15", "seats": 6, "minSeats": 3, "features": "у окна, для компании", "x": 1010, "y": 330, "w": 210, "h": 120, "r": 180 },

        { "id": "k1", "type": "table-round", "num": "16", "seats": 4, "minSeats": 2, "features": "у сцены", "x": 740, "y": 530, "w": 80, "h": 80, "r": 0 },
        { "id": "k2", "type": "table-round", "num": "17", "seats": 4, "minSeats": 2, "features": "у сцены", "x": 890, "y": 530, "w": 80, "h": 80, "r": 0 },
        { "id": "k3", "type": "sofa", "num": "18", "seats": 6, "minSeats": 3, "features": "для компании", "x": 765, "y": 695, "w": 170, "h": 100, "r": 180 },
        { "id": "k4", "type": "table-rect", "num": "19", "seats": 4, "minSeats": 2, "features": "", "x": 915, "y": 700, "w": 90, "h": 70, "r": 0 }
    ]
}
