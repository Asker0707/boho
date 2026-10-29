/*
 * Меню Бохо.
 * Этот файл создаёт редактор меню (menu-editor.html) — править вручную не обязательно.
 * После изменений в редакторе сохраните файл сюда же: assets/js/menu-data.js
 *
 * ТЕСТОВЫЕ ДАННЫЕ: блюда, цены и часть фото — примеры. Внешние фото взяты
 * из открытых баз TheMealDB и TheCocktailDB только для проверки вёрстки.
 */
window.BOHO_MENU = {
    "version": 1,
    "currency": "₽",
    "note": "Тестовое меню: блюда, цены и фото — примеры для проверки вёрстки.",
    "sections": [
        {
            "id": "kitchen",
            "name": "Кухня",
            "intro": "Европейская и авторская кухня: от горячих супов до блюд на гриле и домашних десертов.",
            "categories": [
                {
                    "id": "starters",
                    "name": "Закуски",
                    "items": [
                        { "id": "hummus", "name": "Хумус с тёплой питой", "desc": "Нутовый хумус, оливковое масло, паприка, кедровые орехи", "price": 490, "unit": "220 г", "photo": "https://www.themealdb.com/images/media/meals/gpon5u1763801180.jpg", "tags": ["veg"] },
                        { "id": "wings", "name": "Крылья BBQ", "desc": "Хрустящие куриные крылья, соус барбекю и сельдерей", "price": 650, "unit": "350 г", "photo": "https://www.themealdb.com/images/media/meals/feh9k21784665694.jpg", "tags": ["hit", "spicy"] },
                        { "id": "cheese-plate", "name": "Сырная тарелка", "desc": "Четыре вида сыра, мёд, орехи, виноград и крекеры", "price": 1290, "unit": "320 г", "photo": "", "tags": ["signature"] }
                    ]
                },
                {
                    "id": "salads",
                    "name": "Салаты",
                    "items": [
                        { "id": "shopska", "name": "Шопский салат", "desc": "Томаты, огурцы, перец, красный лук, брынза", "price": 520, "unit": "260 г", "photo": "https://www.themealdb.com/images/media/meals/bqx8mc1782684286.jpg", "tags": ["veg"] },
                        { "id": "salmon-avocado", "name": "Лосось и авокадо", "desc": "Слабосолёный лосось, авокадо, микс салатов, цитрусовая заправка", "price": 790, "unit": "230 г", "photo": "https://www.themealdb.com/images/media/meals/1549542994.jpg", "tags": [] },
                        { "id": "pomegranate-salad", "name": "Салат с гранатом", "desc": "Кускус, зелень, гранат, мята, оливковое масло", "price": 560, "unit": "240 г", "photo": "https://www.themealdb.com/images/media/meals/fqpqml1764359125.jpg", "tags": ["veg", "new"] }
                    ]
                },
                {
                    "id": "soups",
                    "name": "Супы",
                    "items": [
                        { "id": "borscht", "name": "Борщ со сметаной", "desc": "Наваристый борщ на говяжьем бульоне, сметана, бородинский хлеб", "price": 490, "unit": "350 г", "photo": "https://www.themealdb.com/images/media/meals/zadvgb1699012544.jpg", "tags": ["hit"] },
                        { "id": "tom-yum", "name": "Том-ям с креветками", "desc": "Кокосовое молоко, креветки, шампиньоны, лемонграсс, рис", "price": 790, "unit": "400 г", "photo": "https://www.themealdb.com/images/media/meals/l50vz41763422681.jpg", "tags": ["spicy"] },
                        { "id": "pumpkin-soup", "name": "Тыквенный крем-суп", "desc": "Тыква, сливки, тыквенные семечки, гренки", "price": 450, "unit": "300 г", "photo": "https://www.themealdb.com/images/media/meals/1brbso1763585098.jpg", "tags": ["veg"] },
                        { "id": "ukha", "name": "Уха по-домашнему", "desc": "Судак и лосось, картофель, зелень", "price": 590, "unit": "350 г", "photo": "https://www.themealdb.com/images/media/meals/7n8su21699013057.jpg", "tags": [] }
                    ]
                },
                {
                    "id": "mains",
                    "name": "Горячее",
                    "items": [
                        { "id": "carbonara", "name": "Паста карбонара", "desc": "Спагетти, гуанчале, желток, пармезан, чёрный перец", "price": 690, "unit": "300 г", "photo": "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg", "tags": ["hit"] },
                        { "id": "lasagne", "name": "Лазанья болоньезе", "desc": "Говяжий рагу, соус бешамель, моцарелла", "price": 720, "unit": "320 г", "photo": "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg", "tags": [] },
                        { "id": "teriyaki-salmon", "name": "Лосось терияки", "desc": "Стейк лосося в соусе терияки, рис жасмин, кунжут", "price": 1190, "unit": "280 г", "photo": "https://www.themealdb.com/images/media/meals/xxyupu1468262513.jpg", "tags": [] },
                        { "id": "risotto", "name": "Ризотто с лососем и креветками", "desc": "Арборио, сливочный соус, пармезан", "price": 990, "unit": "300 г", "photo": "https://www.themealdb.com/images/media/meals/xxrxux1503070723.jpg", "tags": [] },
                        { "id": "steak", "name": "Стейк с перечным соусом", "desc": "Говяжья вырезка, соус из зелёного перца, овощи гриль", "price": 1890, "unit": "250 г", "photo": "https://www.themealdb.com/images/media/meals/vussxq1511882648.jpg", "tags": ["signature"] },
                        { "id": "burger", "name": "Бургер «Бохо»", "desc": "Говяжья котлета, чеддер, бекон, маринованный лук, картофель фри", "price": 790, "unit": "420 г", "photo": "https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg", "tags": ["hit", "signature"] },
                        { "id": "sticky-chicken", "name": "Курица в медовой глазури", "desc": "Куриные голени, мёд, соевый соус, чеснок, кунжут", "price": 680, "unit": "300 г", "photo": "https://www.themealdb.com/images/media/meals/cj56fs1762340001.jpg", "tags": [] },
                        { "id": "pierogi", "name": "Вареники с картофелем", "desc": "Домашние вареники, жареный лук, сметана", "price": 450, "unit": "250 г", "photo": "https://www.themealdb.com/images/media/meals/45xxr21593348847.jpg", "tags": ["veg"] }
                    ]
                },
                {
                    "id": "pizza",
                    "name": "Пицца",
                    "items": [
                        { "id": "margherita", "name": "Маргарита", "desc": "Томатный соус, моцарелла, базилик", "price": 590, "unit": "30 см", "photo": "https://www.themealdb.com/images/media/meals/x0lk931587671540.jpg", "tags": ["veg"] },
                        { "id": "pepperoni", "name": "Пепперони", "desc": "Томатный соус, моцарелла, пикантная колбаса пепперони", "price": 690, "unit": "30 см", "photo": "", "tags": ["spicy"] }
                    ]
                },
                {
                    "id": "desserts",
                    "name": "Десерты",
                    "items": [
                        { "id": "cheesecake", "name": "Нью-Йорк чизкейк", "desc": "Сливочный сыр, песочная основа, ягодный соус", "price": 420, "unit": "140 г", "photo": "https://www.themealdb.com/images/media/meals/swttys1511385853.jpg", "tags": ["hit"] },
                        { "id": "tarte-tatin", "name": "Тарт Татен", "desc": "Карамелизированные яблоки, слоёное тесто, шарик ванильного мороженого", "price": 450, "unit": "180 г", "photo": "https://www.themealdb.com/images/media/meals/ryspuw1511786688.jpg", "tags": [] },
                        { "id": "strawberry-tart", "name": "Клубничный тарт", "desc": "Заварной крем, свежая клубника, миндальное тесто", "price": 480, "unit": "150 г", "photo": "https://www.themealdb.com/images/media/meals/9kmyly1784660555.jpg", "tags": ["new"] },
                        { "id": "blini", "name": "Блины с вареньем", "desc": "Тонкие блины, домашнее варенье, сметана", "price": 350, "unit": "200 г", "photo": "https://www.themealdb.com/images/media/meals/0206h11699013358.jpg", "tags": ["veg"] },
                        { "id": "raspberry", "name": "Малина со сливками", "desc": "Свежая малина, взбитые сливки, мята", "price": 390, "unit": "160 г", "photo": "assets/img/malina.webp", "tags": ["signature"] }
                    ]
                }
            ]
        },
        {
            "id": "bar",
            "name": "Бар",
            "intro": "Авторские коктейли, классика, шоты и напитки без алкоголя.",
            "adult": true,
            "categories": [
                {
                    "id": "signature-cocktails",
                    "name": "Авторские коктейли",
                    "items": [
                        { "id": "boho-spritz", "name": "Бохо спритц", "desc": "Игристое, апельсиновый биттер, маракуйя, содовая", "price": 690, "unit": "300 мл", "photo": "assets/img/kokteyli.webp", "tags": ["signature", "hit"] },
                        { "id": "lagoon", "name": "Лагуна", "desc": "Водка, голубой кюрасао, лайм, спрайт", "price": 650, "unit": "300 мл", "photo": "assets/img/kokteyli-bar.webp", "tags": ["signature"] },
                        { "id": "polaroid", "name": "Полароид", "desc": "Три мини-коктейля на выбор бармена и снимок на память", "price": 1290, "unit": "3 × 100 мл", "photo": "assets/img/bar-polaroid.webp", "tags": ["signature", "new"] },
                        { "id": "sangria", "name": "Сангрия", "desc": "Красное вино, фрукты, корица, апельсиновый ликёр", "price": 590, "unit": "300 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/xrvxpp1441249280.jpg", "tags": [] }
                    ]
                },
                {
                    "id": "classic-cocktails",
                    "name": "Классика",
                    "items": [
                        { "id": "mojito", "name": "Мохито", "desc": "Белый ром, лайм, мята, тростниковый сахар, содовая", "price": 590, "unit": "300 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg", "tags": ["hit"] },
                        { "id": "aperol", "name": "Апероль спритц", "desc": "Апероль, просекко, содовая, апельсин", "price": 650, "unit": "300 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/iloasq1587661955.jpg", "tags": [] },
                        { "id": "negroni", "name": "Негрони", "desc": "Джин, кампари, красный вермут", "price": 690, "unit": "100 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/qgdu971561574065.jpg", "tags": [] },
                        { "id": "pina-colada", "name": "Пина колада", "desc": "Ром, кокосовые сливки, ананасовый сок", "price": 620, "unit": "300 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/upgsue1668419912.jpg", "tags": [] },
                        { "id": "espresso-martini", "name": "Эспрессо мартини", "desc": "Водка, кофейный ликёр, свежий эспрессо", "price": 650, "unit": "120 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/n0sx531504372951.jpg", "tags": [] },
                        { "id": "whiskey-sour", "name": "Виски сауэр", "desc": "Бурбон, лимон, сахарный сироп, белок", "price": 650, "unit": "150 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/hbkfsh1589574990.jpg", "tags": [] },
                        { "id": "margarita-cocktail", "name": "Маргарита", "desc": "Текила, апельсиновый ликёр, лайм, соль", "price": 620, "unit": "120 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg", "tags": [] }
                    ]
                },
                {
                    "id": "shots",
                    "name": "Шоты",
                    "items": [
                        { "id": "b52", "name": "Б-52", "desc": "Кофейный, сливочный и апельсиновый ликёры", "price": 390, "unit": "50 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/5a3vg61504372070.jpg", "tags": [] },
                        { "id": "shot-set", "name": "Сет «Радуга»", "desc": "Шесть слоистых шотов для компании", "price": 1890, "unit": "6 × 40 мл", "photo": "assets/img/shoty.webp", "tags": ["hit"] },
                        { "id": "tequila-sunrise-shot", "name": "Текила санрайз", "desc": "Текила, апельсиновый сок, гренадин", "price": 450, "unit": "200 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/quqyqp1480879103.jpg", "tags": [] }
                    ]
                },
                {
                    "id": "wine",
                    "name": "Вино и игристое",
                    "items": [
                        { "id": "mimosa", "name": "Мимоза", "desc": "Просекко и свежевыжатый апельсиновый сок", "price": 550, "unit": "150 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/juhcuu1504370685.jpg", "tags": [] },
                        { "id": "prosecco", "name": "Просекко", "desc": "Италия, сухое игристое — бокал", "price": 590, "unit": "150 мл", "photo": "", "tags": [] },
                        { "id": "red-wine", "name": "Красное вино дня", "desc": "Спросите у официанта — бокал", "price": 520, "unit": "150 мл", "photo": "", "tags": [] },
                        { "id": "mulled-wine", "name": "Глинтвейн", "desc": "Красное вино, апельсин, корица, гвоздика", "price": 490, "unit": "250 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/iuwi6h1504735724.jpg", "tags": ["new"] }
                    ]
                },
                {
                    "id": "soft",
                    "name": "Без алкоголя",
                    "items": [
                        { "id": "strawberry-lemonade", "name": "Клубничный лимонад", "desc": "Клубника, базилик, лимон, содовая", "price": 390, "unit": "400 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/spvvxp1468924425.jpg", "tags": ["veg"] },
                        { "id": "iced-coffee", "name": "Айс латте", "desc": "Эспрессо, молоко, лёд, сироп на выбор", "price": 320, "unit": "350 мл", "photo": "https://www.thecocktaildb.com/images/media/drink/ytprxy1454513855.jpg", "tags": [] },
                        { "id": "sea-buckthorn-tea", "name": "Облепиховый чай", "desc": "Облепиха, апельсин, мёд, имбирь — чайник", "price": 490, "unit": "800 мл", "photo": "", "tags": ["hit"] }
                    ]
                }
            ]
        },
        {
            "id": "hookah",
            "name": "Кальян",
            "intro": "Подберём вкус и крепость под настроение. Только для гостей старше 18 лет.",
            "adult": true,
            "categories": [
                {
                    "id": "hookah-main",
                    "name": "Кальяны",
                    "items": [
                        { "id": "hookah-classic", "name": "Классический", "desc": "Табак на выбор, глиняная чаша", "price": 1800, "unit": "≈ 60 мин", "photo": "", "tags": [] },
                        { "id": "hookah-fruit", "name": "На фрукте", "desc": "Чаша из граната, грейпфрута или ананаса", "price": 2600, "unit": "≈ 60 мин", "photo": "assets/img/kalyan.webp", "tags": ["signature", "hit"] },
                        { "id": "hookah-premium", "name": "Премиум", "desc": "Табаки премиум-линеек, авторские миксы кальянного мастера", "price": 2400, "unit": "≈ 70 мин", "photo": "", "tags": ["new"] }
                    ]
                },
                {
                    "id": "hookah-extra",
                    "name": "Дополнительно",
                    "items": [
                        { "id": "bowl-change", "name": "Замена чаши", "desc": "Новая забивка того же или другого вкуса", "price": 1000, "unit": "", "photo": "", "tags": [] },
                        { "id": "milk-flask", "name": "Молоко в колбу", "desc": "Мягкая, «сливочная» тяга", "price": 300, "unit": "", "photo": "", "tags": [] },
                        { "id": "ice-hose", "name": "Ледяной мундштук", "desc": "Охлаждает дым", "price": 250, "unit": "", "photo": "", "tags": [] }
                    ]
                }
            ]
        }
    ]
}
