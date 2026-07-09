/* ============================================================
   Urartu AI — словарь переводов РУ/EN + движок
   Владелец: Ядро. Чистый ES5, ноль внешних ресурсов.
   ============================================================ */
(function () {
  'use strict';

  var DICT = {
    ru: {
      /* meta */
      'meta.title': 'Локальные ИИ-сотрудники 24/7 для бизнеса — свой ИИ на вашем сервере | 152-ФЗ | Urartu AI',
      'meta.desc': 'Внедряем локальных ИИ-сотрудников 24/7: цифровые агенты на сервере компании — отвечают по регламентам, проверяют договоры, ведут поддержку клиентов. Данные не уходят в облако. Локальный ИИ, 152-ФЗ. Пилот за 2 недели. Москва и вся РФ.',

      /* меню / статус */
      'menu.assistant': 'Ассистент', 'menu.how': 'Как работает', 'menu.who': 'Кому',
      'menu.pricing': 'Тарифы', 'menu.faq': 'Вопросы', 'menu.about': 'О нас', 'menu.mail': 'Контакты',
      'menu.services': 'Услуги', 'menu.portfolio': 'Портфолио', 'menu.staff': 'Сотрудники',
      'status.local': 'ЛОКАЛЬНО · 152-ФЗ',
      'wifi.tip': 'интернет ассистенту не нужен',
      'ui.back': '‹ Назад',
      'cta.demo': 'Записаться на демо',

      /* пункт управления */
      'cc.theme': 'Тема', 'cc.lang': 'Язык',
      'cc.theme.dark': 'Тёмная', 'cc.theme.light': 'Светлая',
      'cc.wifi': 'Wi-Fi: не нужен ассистенту', 'cc.demo': 'Записаться на демо',

      /* README */
      'readme.tag': 'Локальное развёртывание · 152-ФЗ',
      'readme.h1': 'Локальные ИИ-сотрудники. Работают 24/7. Данные не покидают компанию.',
      'readme.lead': 'Устанавливаем и настраиваем ИИ-агентов — цифровых сотрудников на вашем сервере: отвечают по регламентам, проверяют договоры, ведут поддержку клиентов. Без облаков, без утечек, без выходных.',
      'readme.p': 'Пилот на вашем процессе — 2 недели · Москва и вся РФ. Это не описание продукта, а сам продукт: перед вами рабочий стол компании, на котором ассистент уже отвечает.',
      'readme.btnDemo': 'Показать демо →', 'readme.btnHow': 'Как это устроено',
      'readme.badge': 'Каждый ответ — со ссылкой на пункт документа. Можно проверить.',

      /* Ассистент */
      'assistant.title': 'Ассистент · Локально',
      'assistant.h1': 'ИИ-ассистент, который знает ваши документы наизусть',
      'assistant.plaque': 'Ассистент отвечает только по вашей базе знаний и всегда показывает источник — пункт и документ. Если ответа в документах нет, он так и говорит. Это фиксируется в договоре критериями приёмки.',
      'assistant.h2': 'Что он умеет',
      'assistant.m1.h': 'Ответы по регламентам за 10 секунд',
      'assistant.m1.p': '«Какой срок согласования договора на 300 тысяч?» Ассистент отвечает со ссылкой на пункт документа — вместо 10 минут поиска по папкам.',
      'assistant.m2.h': 'Проверка документов',
      'assistant.m2.p': 'Загрузите договор — ассистент проверит его по вашему чек-листу и покажет, что не так, с цитатами.',
      'assistant.m3.h': 'Суммаризация и черновики',
      'assistant.m3.p': 'Протоколы встреч, ответы на претензии, письма клиентам — черновик за минуту, по вашим шаблонам.',
      'assistant.m4.h': 'Всегда с источником',
      'assistant.m4.p': 'Каждый ответ — с указанием пункта и документа. Ответ легко проверить.',

      /* Как работает */
      'how.title': 'Как это работает',
      'how.h1': 'Открытая модель на вашем железе. Честная архитектура.',
      'how.b1': 'Ваши документы', 'how.b2': 'База знаний<br>(векторный индекс)',
      'how.b3': 'Открытая ИИ-модель<br>(Qwen / DeepSeek)', 'how.b4': 'Чат для сотрудников',
      'how.p1': 'Модель работает на сервере компании или отдельной машине в офисе. Интернет ей не нужен.',
      'how.p2': 'Используем открытые модели (Qwen, DeepSeek, GLM) — без лицензионных платежей и чужих API.',
      'how.p3': 'Доступы по ролям: каждый сотрудник видит ответы только по документам своего уровня.',
      'how.p4': 'Железо подбираем под задачу: от одной рабочей станции до сервера. Поставляем легально, с документами и гарантией — только под проект.',

      /* Кому */
      'who.title': 'Кому',
      'who.h1': 'Сделано для тех, кому нельзя в облако',
      'who.m1.h': 'Юристам и бухгалтерии',
      'who.m1.p': 'Договоры, регламенты, практика — ассистент по внутренней базе и проверка договоров.',
      'who.m1.q': '«Какая неустойка в нашем типовом договоре поставки?»',
      'who.m2.h': 'Клиникам',
      'who.m2.p': 'Протоколы, стандарты, ПДн пациентов не покидают клинику.',
      'who.m2.q': '«Что входит в осмотр перед вакцинацией по стандарту?»',
      'who.m3.h': 'Производству',
      'who.m3.p': 'Техдокументация и нормативка — ответы для инженеров и рабочих.',
      'who.m3.q': '«Какой момент затяжки для узла М12 по техкарте?»',
      'who.m4.h': 'Логистике и ВЭД',
      'who.m4.p': 'Обработка заявок, документов, переписки.',
      'who.m4.q': '«Какие документы нужны для растаможки груза из Китая?»',

      /* Тарифы */
      'pricing.title': 'Тарифы.txt', 'pricing.file': 'Тарифы.txt',
      'pricing.h1': 'Прозрачные условия',
      'pricing.pilot.h': 'Пилот', 'pricing.pilot.sub': 'На одном процессе, 2 недели',
      'pricing.pilot.price': '0 ₽ · бесплатно',
      'pricing.pilot.note': 'Бесплатный пилот для первых клиентов, без обязательств, 30 минут',
      'pricing.impl.stamp': 'Основной формат', 'pricing.impl.h': 'Внедрение',
      'pricing.impl.sub': 'Полный проект под ключ', 'pricing.impl.price': 'от 150 000 ₽',
      'pricing.impl.l1': 'Ассистент под процесс', 'pricing.impl.l2': 'База знаний',
      'pricing.impl.l3': 'Интерфейс', 'pricing.impl.l4': 'Доступы',
      'pricing.impl.l5': 'Обучение сотрудников', 'pricing.impl.l6': 'Документация',
      'pricing.impl.l7': 'Критерии приёмки',
      'pricing.sup.h': 'Поддержка', 'pricing.sup.sub': 'После внедрения',
      'pricing.sup.price': 'от 15 000 ₽/мес',
      'pricing.sup.l1': 'Обновления базы', 'pricing.sup.l2': 'Мониторинг',
      'pricing.sup.l3': 'Консультации', 'pricing.sup.l4': 'Отчёт ежемесячно',
      'pricing.budget': 'Ориентир полного бюджета: внедрение от 150 000 ₽ + железо 300–400 000 ₽ (разово, остаётся у вас).',
      'pricing.note': 'Железо — по закупочной цене с прозрачной наценкой, только под проект. Точная смета — после демо-встречи: зависит от объёма документов и числа пользователей.',

      /* FAQ */
      'faq.title': 'Вопросы', 'faq.h1': 'Вопросы, которые задают до демо',
      'faq.q1': 'Чем это отличается от ChatGPT?',
      'faq.a1': 'ChatGPT работает на серверах в США, и передавать туда данные клиентов юрлицу нельзя. Наш ассистент работает на вашем сервере, отвечает по вашим документам и показывает источник ответа. Интернет ему не нужен.',
      'faq.q2': 'Наши данные точно никуда не уходят?',
      'faq.a2': 'Да. Модель и база знаний физически находятся на вашем оборудовании. Наружу не уходит ничего — это проверяется на приёмке (можно отключить интернет и убедиться).',
      'faq.q3': 'Какое железо нужно?',
      'faq.a3': 'Для команды до 10–20 человек достаточно одной машины с современной видеокартой (порядка 300–400 тыс. ₽, если покупать новую). Часто подходит уже имеющийся сервер. Подбор — часть проекта.',
      'faq.q4': 'А если ассистент ошибётся?',
      'faq.a4': 'Ассистент отвечает только по вашей базе и всегда даёт ссылку на пункт документа — ответ легко проверить. Сдача проекта проходит по тестовому набору ваших вопросов с зафиксированной в договоре точностью.',
      'faq.q5': 'Сколько длится внедрение?',
      'faq.a5': 'Пилот — 2 недели, полное внедрение — 3–6 недель в зависимости от объёма документов и интеграций.',
      'faq.q6': 'Это законно? Какие модели вы используете?',
      'faq.a6': 'Полностью. Используем открытые модели (Qwen, DeepSeek, GLM), которые легально разворачиваются локально. Никакого параллельного импорта: железо — только официально доступное в РФ, с документами.',
      'faq.q7': 'Что входит в поддержку и обязательна ли она?',
      'faq.a7': 'Обновление базы знаний, мониторинг качества, консультации и ежемесячный отчёт. Первые месяцы поддержки входят в внедрение; дальше — по желанию.',

      /* Терминал */
      'term.title': 'Терминал — bash', 'term.head': '// доказательство: всё локально',

      /* Почта */
      'mail.title': 'Почта — Новое сообщение',
      'mail.h1': 'Посмотрите на своего будущего ассистента',
      'mail.p': '30 минут онлайн: покажем работающего ассистента, разберём ваш процесс и честно скажем, поможет ли вам локальный ИИ — и что для этого нужно.',
      'mail.phone': 'Телефон', 'mail.email': 'Почта',
      'mail.note': 'Отвечаем в течение рабочего дня',

      /* ИИ-сотрудники (штат) */
      'staff.title': 'Сотрудники',
      'staff.h1': 'Штат, который не спит',
      'staff.lead': 'Сотрудники, которые не спят, не болеют и не уносят данные. Живут на вашем сервере.',
      'staff.shift': 'график: 24/7',
      'staff.pay': 'зарплата',
      'staff.e1.role': 'Документовед', 'staff.e1.do': 'Отвечает по регламентам и базе знаний — со ссылкой на пункт документа.', 'staff.e1.pay': 'внедрение от 150 000 ₽',
      'staff.e2.role': 'Юрист-проверяющий', 'staff.e2.do': 'Проверяет договоры по вашему чек-листу — с цитатами и указанием рисков.', 'staff.e2.pay': 'внедрение от 150 000 ₽',
      'staff.e3.role': 'Оператор поддержки', 'staff.e3.do': 'Отвечает клиентам круглосуточно на базе ваших знаний — в чате и на сайте.', 'staff.e3.pay': 'от 120 000 ₽/мес',
      'staff.e4.role': 'Секретарь-голос', 'staff.e4.do': 'Принимает звонки, записывает обращения и назначает встречи — живым голосом.', 'staff.e4.pay': 'от 200 000 ₽',
      'staff.e5.role': 'Контент-менеджер', 'staff.e5.do': 'Пишет статьи, посты и рассылки в вашем стиле — по бренд-гайду и базе знаний.', 'staff.e5.pay': 'от 50 000 ₽/мес',
      'staff.cta': 'Собрать штат — на демо →',

      /* Услуги */
      'svc.title': 'Услуги',
      'svc.h1': 'Что мы делаем',
      'svc.lead': 'Основное направление — локальные ИИ-сотрудники на вашем сервере. Рядом — полный набор студийных услуг Urartu: сайты, боты, автоматизация, контент.',
      'svc.flag.eb': 'Флагман',
      'svc.flag.h': 'Локальные ИИ-сотрудники 24/7',
      'svc.flag.p': 'Внедряем и настраиваем ИИ-агентов — цифровых сотрудников на вашем сервере: отвечают по регламентам, проверяют договоры, ведут поддержку клиентов. Без облаков и утечек.',
      'svc.flag.price': 'Внедрение от 150 000 ₽ · поддержка от 15 000 ₽/мес',
      'svc.flag.more': 'Подробнее — в Тарифах →',
      'svc.dir': 'Направления',
      'svc.s1.h': 'Сайты под ключ', 'svc.s1.p': 'Лендинги, корпоративные, e-commerce', 'svc.s1.price': 'от 50 000 ₽',
      'svc.s2.h': 'AI-боты и агенты', 'svc.s2.p': 'Telegram, WhatsApp, RAG, голос', 'svc.s2.price': 'от 100 000 ₽',
      'svc.s3.h': 'Чат-боты поддержки 24/7', 'svc.s3.p': 'На базе знаний клиента', 'svc.s3.price': 'от 120 000 ₽/мес',
      'svc.s4.h': 'Голосовые ассистенты', 'svc.s4.p': 'Колл-центры, ресепшены', 'svc.s4.price': 'от 200 000 ₽',
      'svc.s5.h': 'Автоматизация бизнеса', 'svc.s5.p': '1С, Битрикс, AmoCRM, n8n', 'svc.s5.price': 'от 80 000 ₽',
      'svc.s6.h': 'AI-интеграции', 'svc.s6.p': 'LLM в ваши продукты, fine-tuning', 'svc.s6.price': 'от 150 000 ₽',
      'svc.s7.h': 'AI-видео', 'svc.s7.p': 'Реклама, аватары', 'svc.s7.price': 'от 20 000 ₽/ролик',
      'svc.s8.h': 'Контент-фабрика', 'svc.s8.p': 'Статьи, SEO, соцсети', 'svc.s8.price': 'от 50 000 ₽/мес',
      'svc.formats.eb': 'Форматы сотрудничества',
      'svc.fmt.starter.note': 'Базовое внедрение под один процесс', 'svc.fmt.starter.price': 'от 150 000 ₽',
      'svc.fmt.studio.note': 'Комплекс проектов и сопровождение', 'svc.fmt.studio.price': 'от 800 000 ₽',
      'svc.fmt.atelier.note': 'Выделенная команда, NDA, прямой канал с CTO', 'svc.fmt.atelier.price': 'от 5 000 000 ₽',

      /* Устройства */
      'dev.title': 'Устройства',
      'dev.h1': 'ИИ-железо: на чём живут сотрудники',
      'dev.lead': 'Модель и база знаний работают на вашем оборудовании. Ниже — станции под разный масштаб команды. Точную конфигурацию подбираем на демо.',
      'dev.d1.name': 'Станция «Старт»', 'dev.d1.spec': 'RTX 4060 Ti 16 ГБ · 64 ГБ ОЗУ', 'dev.d1.team': 'Команда до 10 человек', 'dev.d1.models': 'Тянет модели до 14B', 'dev.d1.price': 'от 180 000 ₽',
      'dev.d2.name': 'Станция «Про»', 'dev.d2.spec': 'RTX 4090 24 ГБ · 128 ГБ ОЗУ', 'dev.d2.team': 'До 30 сотрудников', 'dev.d2.models': 'Тянет модели до 32B', 'dev.d2.price': 'от 450 000 ₽',
      'dev.d3.name': 'Станция «Макс»', 'dev.d3.spec': 'RTX 5090 32 ГБ', 'dev.d3.team': 'До 50 сотрудников', 'dev.d3.models': 'Тянет модели до 70B (квант.)', 'dev.d3.price': 'от 650 000 ₽',
      'dev.d4.name': 'Mac Studio', 'dev.d4.spec': 'M4 Max · 64–128 ГБ', 'dev.d4.team': 'Бесшумный, в кабинет руководителя', 'dev.d4.models': 'Тянет модели до 70B', 'dev.d4.price': 'от 450 000 ₽',
      'dev.d5.name': 'Сервер Multi-GPU', 'dev.d5.spec': '2–8 × GPU · кластеры', 'dev.d5.team': '100+ пользователей', 'dev.d5.models': 'Несколько моделей параллельно', 'dev.d5.price': 'под заказ, от 1,5 млн ₽',
      'dev.disclaimer': 'Железо поставляем только под проект внедрения: легально, с документами, гарантией и настройкой под ключ. Цены ориентировочные и зависят от конфигурации и курса.',

      /* Портфолио */
      'port.title': 'Портфолио',
      'port.h1': 'Что мы уже сделали',
      'port.lead': 'Сайты, ИИ-сомелье, боты и системы регистрации — вживую. Откройте любой кейс в новой вкладке.',
      'port.sec.urartu': 'Кейсы Urartu',
      'port.sec.hotels': 'Отельные промо-сайты',
      'port.sec.events': 'События и билеты',
      'port.sec.bots': 'Telegram-боты',
      'case.megradzor.name': 'Megradzor Cheese Dairy', 'case.megradzor.res': 'Сайт сыроварни с AI-сомелье — 17 заявок от ресторанов за 2 недели',
      'case.machanents.name': 'Machanents Art Hotel', 'case.machanents.res': 'Арт-отель у Эчмиадзина — своё SEO и прямое бронирование',
      'case.annabella.name': 'AnnaBella Boutique Hotel', 'case.annabella.res': 'Бутик-отель в Ереване — журнальный дизайн люксовых travel-изданий',
      'case.olivia.name': 'Гостевой дом «Оливия», Севастополь', 'case.olivia.res': 'Рейтинг ★9.9 · прямое бронирование без комиссий агрегаторов',
      'case.alyans.name': 'Гостевой дом «Альянс», Севастополь', 'case.alyans.res': 'Рейтинг ★9.8 · премиальный промо-сайт с прямыми заявками',
      'case.florentina.name': 'Бутик-отель «Флорентина», Ялта', 'case.florentina.res': 'Тосканский флёр у набережной — авторская айдентика',
      'case.zhemchuzhina.name': '«Жемчужина Мыса», Геленджик', 'case.zhemchuzhina.res': 'Рейтинг ★9.6 · промо-сайт под прямое бронирование',
      'case.pushka.name': 'Мини-отель «Пушка», Ялта', 'case.pushka.res': 'Морской стиль, 2 минуты до набережной',
      'case.akva.name': 'Аква вилла, Краснодар', 'case.akva.res': 'Банно-гостиничный комплекс, рейтинг 5.0 · онлайн-заявка',
      'case.orderbot.name': 'Бот мониторинга заказов', 'case.orderbot.res': 'Отслеживает биржи и фильтрует подходящие заказы через ИИ',

      /* iOS-оболочка */
      'ios.search': 'Поиск',
      'ccx.full': 'На весь экран', 'ccx.fullHint': 'Скрыть панели браузера',
      'ccx.callHint': 'Аудио или видео из браузера',

      /* Звонок */
      'call.title': 'Звонок', 'call.short': 'Позвонить',
      'call.role': 'Urartu AI · внедрение локального ИИ',
      'call.audio': 'Аудиозвонок', 'call.video': 'Видеозвонок',
      'call.audioAria': 'Позвонить голосом', 'call.videoAria': 'Позвонить с видео',
      'call.hint': 'Звонок идёт прямо из браузера — устанавливать ничего не нужно. Если не отвечу сразу, нажмите «Позвать в Telegram»: увижу и подключусь.',
      'call.tg': 'Позвать в Telegram', 'call.phone': 'Позвонить по телефону',
      'call.connecting': 'Соединение…',
      'call.connected': 'Комната создана — подключаюсь',
      'call.copy': 'Скопировать ссылку', 'call.copied': 'Ссылка скопирована',
      'call.end': 'Завершить', 'call.guest': 'Гость сайта',

      /* О нас · Гарантии */
      'about.title': 'О нас · Гарантии',
      'about.h': 'О компании и гарантиях',
      'about.lead': 'Мы — ООО «Урарту», российская команда внедрения из Москвы. Работаем по договору, готовы к NDA и проверке до передачи любых данных. Ниже — реквизиты и обязательства, которые фиксируются в договоре.',
      'about.req.eb': 'Реквизиты',
      'about.req.company': 'ООО «Урарту», Москва',


      'about.req.resp': 'Ответственный: Казарян Шаген, директор',
      'about.req.docs': 'Полные реквизиты (ИНН, ОГРН, юридический адрес) — в договоре и по запросу.',
      'about.g.eb': 'Гарантии',
      'about.g1': 'Готовы подписать NDA до демонстрации и договор — до начала работ.',
      'about.g2': 'Точность ассистента — критерий приёмки, зафиксированный в договоре.',
      'about.g3': 'Работаем по 152-ФЗ: данные остаются в вашем контуре, наружу не уходит ничего.',
      'about.g4': 'Оборудование поставляем легально, с документами и гарантией.',
      'about.cases.eb': 'Мини-кейсы',
      'about.case1': 'Юрфирма, 12 юристов: поиск по практике и регламентам — с 10 минут до 15 секунд, всё на своём сервере.',
      'about.case2': 'Производство, отдел качества: ответы по техкартам и стандартам без выхода в интернет, пилот за 2 недели.',
      'about.note': 'Реквизиты, договор и рекомендации предоставляем по первому запросу.',

      /* ИИ-агенты */
      'agents.title': 'ИИ-агенты — 3D-офис', 'agents.short': 'ИИ-агенты',
      'agents.h1': 'Команда ИИ-агентов за работой',
      'agents.p': 'Так устроена многоагентная система: у каждого агента своя роль, они передают задачи друг другу и согласуют результат. Тот же принцип работает во внедрении: один агент ищет ответ в регламентах, второй проверяет договор по чек-листу, третий готовит черновик письма.',
      'agents.play': 'Запустить 3D-офис', 'agents.note': 'загрузится по клику',
      'agents.building': 'Строим офис', 'agents.hint': '~5 МБ · лучше по Wi-Fi',
      'agents.retry': 'Попробовать ещё раз',
      'agents.fs': 'На весь экран', 'agents.fsExit': 'Свернуть',
      'agents.credit': 'Симуляция: открытый проект The Delegation, лицензия MIT',

      /* Корзина */
      'trash.title': 'Корзина', 'trash.h1': 'Пусто — и хорошо',
      'trash.p': 'Сюда отправляются идеи выгрузить ваши документы в чужое облако.',

      /* Папки */
      'reg.title': 'Регламенты',
      'reg.f1': 'Регламент договорной работы.pdf', 'reg.f2': 'Положение о персональных данных.pdf',
      'reg.f3': 'Регламент согласования закупок.pdf', 'reg.f4': 'Инструкция по документообороту.pdf',
      'reg.note': 'На пилоте здесь будут ваши документы — ассистент отвечает только по ним.',
      'kb.title': 'База знаний',
      'kb.f1': 'Типовые договоры.pdf', 'kb.f2': 'Чек-листы проверки.pdf',
      'kb.f3': 'Шаблоны писем и претензий.pdf', 'kb.f4': 'Внутренние стандарты.pdf',
      'kb.note': 'На пилоте здесь будут ваши документы — векторный индекс строится локально.',
      'finder.name': 'Имя', 'finder.meta': 'Размер · Дата',

      /* Виджеты */
      'w.contour.eb': 'Контур', 'w.contour.cap': 'данных ушло наружу',
      'w.speed.eb': 'Скорость', 'w.speed.val': '10&nbsp;сек', 'w.speed.cap': 'ответ по регламентам вместо 10 минут',
      'w.speed.sub': 'работает 24/7 без выходных',
      'w.cal.mark': '● Демо', 'w.cal.cta': 'Записаться', 'w.cal.ctaSub': 'на 30 минут →',
      'w.fines.eb': 'Штрафы · 152-ФЗ', 'w.fines.val': 'до&nbsp;500&nbsp;млн&nbsp;₽',
      'w.fines.cap': 'оборотный штраф за повторную утечку персональных данных',
      'w.sticky': 'Пилот за&nbsp;2&nbsp;недели на&nbsp;ваших документах. <strong>Бесплатно для&nbsp;первых клиентов, без&nbsp;обязательств.</strong>',

      /* Springboard */
      'sb.assistant': 'Ассистент', 'sb.how': 'Как работает', 'sb.who': 'Кому',
      'sb.terminal': 'Терминал', 'sb.mail': 'Почта',

      /* Чат-виджет (диалог) */
      'chat.q1': 'Какой срок согласования договора на 300 тыс. ₽?',
      'chat.a1': '2 рабочих дня + 1 день (новый контрагент). Основание: Регламент, п. 2.1, 2.3',
      'chat.q2': 'Как отозвать согласие на обработку ПДн?',
      'chat.a2': 'Письменно на mos-city@bk.ru. Данные уничтожаются. Основание: Политика, п. 7; 152-ФЗ, ст. 9.',
      'chat.q3': 'Можно отправить договор клиента в ChatGPT?',
      'chat.a3': 'Нет. Серверы вне РФ — передача ПДн запрещена (152-ФЗ). Спросите локального ассистента.'
    },

    en: {
      /* meta */
      'meta.title': 'Local AI Employees, working 24/7 — On-Premise AI for Business | 152-FZ | Urartu AI',
      'meta.desc': 'We deploy local AI employees that work 24/7 — digital agents on your own server: answer from your policies, review contracts and run customer support. On-premise AI, never sends data to the cloud. 152-FZ compliant. Pilot in 2 weeks. Moscow and all of Russia.',

      /* menu / status */
      'menu.assistant': 'Assistant', 'menu.how': 'How it works', 'menu.who': "Who it's for",
      'menu.pricing': 'Pricing', 'menu.faq': 'FAQ', 'menu.about': 'About', 'menu.mail': 'Contact',
      'menu.services': 'Services', 'menu.portfolio': 'Portfolio', 'menu.staff': 'Employees',
      'status.local': 'LOCAL · 152-FZ',
      'wifi.tip': "the assistant doesn't need the internet",
      'ui.back': '‹ Back',
      'cta.demo': 'Book a demo',

      /* control center */
      'cc.theme': 'Theme', 'cc.lang': 'Language',
      'cc.theme.dark': 'Dark', 'cc.theme.light': 'Light',
      'cc.wifi': 'Wi-Fi: not needed by the assistant', 'cc.demo': 'Book a demo',

      /* README */
      'readme.tag': 'On-premise deployment · 152-FZ',
      'readme.h1': 'Local AI employees. Working 24/7. Data never leaves the company.',
      'readme.lead': 'We install and configure AI agents — digital employees on your own server: they answer from your policies, review contracts and run customer support. No clouds, no leaks, no days off.',
      'readme.p': 'A pilot on your process — 2 weeks · Moscow and all of Russia. This isn’t a product description, it’s the product itself: what you see is the company’s desktop, where the assistant is already answering.',
      'readme.btnDemo': 'Show me a demo →', 'readme.btnHow': 'How it works',
      'readme.badge': 'Every answer cites the exact document clause. Easy to verify.',

      /* Assistant */
      'assistant.title': 'Assistant · Local',
      'assistant.h1': 'An AI assistant that knows your documents by heart',
      'assistant.plaque': 'The assistant answers only from your knowledge base and always shows the source — the clause and the document. If the answer isn’t in the documents, it says so. This is fixed in the contract as acceptance criteria.',
      'assistant.h2': 'What it can do',
      'assistant.m1.h': 'Answers from your policies in 10 seconds',
      'assistant.m1.p': '“What’s the approval deadline for a contract worth 300k?” The assistant answers with a link to the document clause — instead of 10 minutes digging through folders.',
      'assistant.m2.h': 'Document review',
      'assistant.m2.p': 'Upload a contract — the assistant checks it against your checklist and shows what’s wrong, with quotes.',
      'assistant.m3.h': 'Summaries and drafts',
      'assistant.m3.p': 'Meeting minutes, replies to claims, client letters — a draft in a minute, following your templates.',
      'assistant.m4.h': 'Always with a source',
      'assistant.m4.p': 'Every answer cites the clause and the document. Easy to verify.',

      /* How it works */
      'how.title': 'How it works',
      'how.h1': 'An open model on your own hardware. Honest architecture.',
      'how.b1': 'Your documents', 'how.b2': 'Knowledge base<br>(vector index)',
      'how.b3': 'Open AI model<br>(Qwen / DeepSeek)', 'how.b4': 'Chat for your team',
      'how.p1': 'The model runs on the company’s server or a dedicated machine in the office. It doesn’t need the internet.',
      'how.p2': 'We use open models (Qwen, DeepSeek, GLM) — no licensing fees, no third-party APIs.',
      'how.p3': 'Role-based access: each employee only sees answers from documents at their clearance level.',
      'how.p4': 'We pick hardware to fit the task: from a single workstation to a server. Supplied legally, with paperwork and warranty — only for the project.',

      /* Who */
      'who.title': "Who it's for",
      'who.h1': 'Built for those who can’t go to the cloud',
      'who.m1.h': 'Legal & accounting',
      'who.m1.p': 'Contracts, policies, case history — an assistant over your internal base plus contract review.',
      'who.m1.q': '“What’s the penalty in our standard supply contract?”',
      'who.m2.h': 'Clinics',
      'who.m2.p': 'Protocols, standards, patient personal data never leave the clinic.',
      'who.m2.q': '“What’s included in the pre-vaccination check-up per the standard?”',
      'who.m3.h': 'Manufacturing',
      'who.m3.p': 'Technical documentation and standards — answers for engineers and workers.',
      'who.m3.q': '“What’s the tightening torque for the M12 joint per the process sheet?”',
      'who.m4.h': 'Logistics & foreign trade',
      'who.m4.p': 'Processing orders, documents and correspondence.',
      'who.m4.q': '“What documents are needed to clear cargo from China through customs?”',

      /* Pricing */
      'pricing.title': 'Pricing.txt', 'pricing.file': 'Pricing.txt',
      'pricing.h1': 'Transparent terms',
      'pricing.pilot.h': 'Pilot', 'pricing.pilot.sub': 'On one process, 2 weeks',
      'pricing.pilot.price': '₽0 · free',
      'pricing.pilot.note': 'A free pilot for our first clients, no commitment, 30 minutes',
      'pricing.impl.stamp': 'Main format', 'pricing.impl.h': 'Implementation',
      'pricing.impl.sub': 'Full turnkey project', 'pricing.impl.price': 'from 150 000 ₽ (≈ from $1,500)',
      'pricing.impl.l1': 'Assistant tailored to your process', 'pricing.impl.l2': 'Knowledge base',
      'pricing.impl.l3': 'Interface', 'pricing.impl.l4': 'Access control',
      'pricing.impl.l5': 'Staff training', 'pricing.impl.l6': 'Documentation',
      'pricing.impl.l7': 'Acceptance criteria',
      'pricing.sup.h': 'Support', 'pricing.sup.sub': 'After deployment',
      'pricing.sup.price': 'from 15 000 ₽/mo',
      'pricing.sup.l1': 'Knowledge base updates', 'pricing.sup.l2': 'Monitoring',
      'pricing.sup.l3': 'Consulting', 'pricing.sup.l4': 'Monthly report',
      'pricing.budget': 'Full-budget benchmark: implementation from 150 000 ₽ + hardware 300–400 000 ₽ (one-off, stays with you).',
      'pricing.note': 'Hardware — at cost with a transparent markup, only for the project. An exact quote comes after the demo call: it depends on the volume of documents and the number of users.',

      /* FAQ */
      'faq.title': 'FAQ', 'faq.h1': 'Questions people ask before the demo',
      'faq.q1': 'How is this different from ChatGPT?',
      'faq.a1': 'ChatGPT runs on servers in the USA, and a company isn’t allowed to send client data there. Our assistant runs on your server, answers from your documents and shows the source of every answer. It doesn’t need the internet.',
      'faq.q2': 'Is our data really staying put?',
      'faq.a2': 'Yes. The model and the knowledge base physically live on your hardware. Nothing goes out — it’s verified at acceptance (you can disconnect the internet and see for yourself).',
      'faq.q3': 'What hardware do we need?',
      'faq.a3': 'For a team of up to 10–20 people, a single machine with a modern GPU is enough (around 300–400k ₽ if bought new). Often an existing server will do. Selecting it is part of the project.',
      'faq.q4': 'What if the assistant makes a mistake?',
      'faq.a4': 'The assistant answers only from your base and always links to the document clause — the answer is easy to check. The project is accepted against a test set of your questions, with accuracy fixed in the contract.',
      'faq.q5': 'How long does deployment take?',
      'faq.a5': 'A pilot takes 2 weeks; a full deployment 3–6 weeks depending on the volume of documents and integrations.',
      'faq.q6': 'Is this legal? Which models do you use?',
      'faq.a6': 'Completely. We use open models (Qwen, DeepSeek, GLM) that can be legally deployed locally. No grey imports: hardware is only what’s officially available in Russia, with paperwork.',
      'faq.q7': 'What’s included in support, and is it mandatory?',
      'faq.a7': 'Knowledge base updates, quality monitoring, consulting and a monthly report. The first months of support are included in the deployment; after that it’s optional.',

      /* Terminal */
      'term.title': 'Terminal — bash', 'term.head': '// proof: everything is local',

      /* Mail */
      'mail.title': 'Mail — New message',
      'mail.h1': 'Meet your future assistant',
      'mail.p': '30 minutes online: we’ll show a working assistant, walk through your process and honestly tell you whether on-premise AI will help you — and what it takes.',
      'mail.phone': 'Phone', 'mail.email': 'Email',
      'mail.note': 'We reply within one business day',

      /* AI employees (staff) */
      'staff.title': 'Employees',
      'staff.h1': 'A team that never sleeps',
      'staff.lead': 'Employees that never sleep, never get sick and never walk off with your data. They live on your own server.',
      'staff.shift': 'shift: 24/7',
      'staff.pay': 'salary',
      'staff.e1.role': 'Document Clerk', 'staff.e1.do': 'Answers from your policies and knowledge base — citing the exact document clause.', 'staff.e1.pay': 'deployment from $1,500',
      'staff.e2.role': 'Contract Reviewer', 'staff.e2.do': 'Checks contracts against your checklist — with quotes and flagged risks.', 'staff.e2.pay': 'deployment from $1,500',
      'staff.e3.role': 'Support Operator', 'staff.e3.do': 'Answers customers around the clock from your knowledge base — in chat and on the site.', 'staff.e3.pay': 'from $1,200/mo',
      'staff.e4.role': 'Voice Secretary', 'staff.e4.do': 'Takes calls, logs requests and books meetings — in a natural voice.', 'staff.e4.pay': 'from $2,000',
      'staff.e5.role': 'Content Manager', 'staff.e5.do': 'Writes articles, posts and newsletters in your style — following your brand guide and knowledge base.', 'staff.e5.pay': 'from $500/mo',
      'staff.cta': 'Hire the team — book a demo →',

      /* Services */
      'svc.title': 'Services',
      'svc.h1': 'What we do',
      'svc.lead': 'Our core offering is on-premise AI employees on your own server. Alongside it — Urartu’s full studio stack: websites, bots, automation, content.',
      'svc.flag.eb': 'Flagship',
      'svc.flag.h': 'On-premise AI employees 24/7',
      'svc.flag.p': 'We deploy and tune AI agents — digital employees on your own server: they answer from your policies, review contracts and run customer support. No clouds, no leaks.',
      'svc.flag.price': 'Deployment from $1,500 · support from $150/mo',
      'svc.flag.more': 'More — in Pricing →',
      'svc.dir': 'Directions',
      'svc.s1.h': 'Turnkey websites', 'svc.s1.p': 'Landing pages, corporate, e-commerce', 'svc.s1.price': 'from $500',
      'svc.s2.h': 'AI bots & agents', 'svc.s2.p': 'Telegram, WhatsApp, RAG, voice', 'svc.s2.price': 'from $1,000',
      'svc.s3.h': 'Support chatbots 24/7', 'svc.s3.p': 'Built on the client’s knowledge base', 'svc.s3.price': 'from $1,200/mo',
      'svc.s4.h': 'Voice assistants', 'svc.s4.p': 'Call centers, reception desks', 'svc.s4.price': 'from $2,000',
      'svc.s5.h': 'Business automation', 'svc.s5.p': '1C, Bitrix, AmoCRM, n8n', 'svc.s5.price': 'from $800',
      'svc.s6.h': 'AI integrations', 'svc.s6.p': 'LLMs in your products, fine-tuning', 'svc.s6.price': 'from $1,500',
      'svc.s7.h': 'AI video', 'svc.s7.p': 'Ads, avatars', 'svc.s7.price': 'from $200/clip',
      'svc.s8.h': 'Content factory', 'svc.s8.p': 'Articles, SEO, social', 'svc.s8.price': 'from $500/mo',
      'svc.formats.eb': 'Ways to work together',
      'svc.fmt.starter.note': 'A base deployment for one process', 'svc.fmt.starter.price': 'from $1,500',
      'svc.fmt.studio.note': 'A bundle of projects with ongoing support', 'svc.fmt.studio.price': 'from $8,000',
      'svc.fmt.atelier.note': 'A dedicated team, NDA, a direct line to the CTO', 'svc.fmt.atelier.price': 'from $50,000',

      /* Devices */
      'dev.title': 'Devices',
      'dev.h1': 'AI hardware: where your employees live',
      'dev.lead': 'The model and the knowledge base run on your own hardware. Below are stations for different team sizes. We pick the exact spec at the demo.',
      'dev.d1.name': '“Start” station', 'dev.d1.spec': 'RTX 4060 Ti 16 GB · 64 GB RAM', 'dev.d1.team': 'A team of up to 10 people', 'dev.d1.models': 'Runs models up to 14B', 'dev.d1.price': 'from $1,800',
      'dev.d2.name': '“Pro” station', 'dev.d2.spec': 'RTX 4090 24 GB · 128 GB RAM', 'dev.d2.team': 'Up to 30 employees', 'dev.d2.models': 'Runs models up to 32B', 'dev.d2.price': 'from $4,500',
      'dev.d3.name': '“Max” station', 'dev.d3.spec': 'RTX 5090 32 GB', 'dev.d3.team': 'Up to 50 employees', 'dev.d3.models': 'Runs models up to 70B (quant.)', 'dev.d3.price': 'from $6,500',
      'dev.d4.name': 'Mac Studio', 'dev.d4.spec': 'M4 Max · 64–128 GB', 'dev.d4.team': 'Silent, for the director’s office', 'dev.d4.models': 'Runs models up to 70B', 'dev.d4.price': 'from $4,500',
      'dev.d5.name': 'Multi-GPU server', 'dev.d5.spec': '2–8 × GPU · clusters', 'dev.d5.team': '100+ users', 'dev.d5.models': 'Several models in parallel', 'dev.d5.price': 'made to order, from $15,000',
      'dev.disclaimer': 'Hardware is supplied only as part of a deployment project: legally, with paperwork, warranty and turnkey setup. Prices are indicative and depend on configuration and the exchange rate.',

      /* Portfolio */
      'port.title': 'Portfolio',
      'port.h1': 'What we’ve already shipped',
      'port.lead': 'Websites, an AI sommelier, bots and check-in systems — live. Open any case in a new tab.',
      'port.sec.urartu': 'Urartu cases',
      'port.sec.hotels': 'Hotel promo sites',
      'port.sec.events': 'Events & ticketing',
      'port.sec.bots': 'Telegram bots',
      'case.megradzor.name': 'Megradzor Cheese Dairy', 'case.megradzor.res': 'Dairy website with an AI sommelier — 17 restaurant leads in 2 weeks',
      'case.machanents.name': 'Machanents Art Hotel', 'case.machanents.res': 'Art hotel near Etchmiadzin — its own SEO and direct booking',
      'case.annabella.name': 'AnnaBella Boutique Hotel', 'case.annabella.res': 'Yerevan boutique hotel — editorial design of luxury travel magazines',
      'case.olivia.name': 'Olivia guest house, Sevastopol', 'case.olivia.res': 'Rating ★9.9 · direct booking with no aggregator fees',
      'case.alyans.name': 'Alyans guest house, Sevastopol', 'case.alyans.res': 'Rating ★9.8 · a premium promo site with direct enquiries',
      'case.florentina.name': 'Florentina boutique hotel, Yalta', 'case.florentina.res': 'Tuscan flair by the seafront — original brand identity',
      'case.zhemchuzhina.name': 'Zhemchuzhina Mysa, Gelendzhik', 'case.zhemchuzhina.res': 'Rating ★9.6 · a promo site built for direct booking',
      'case.pushka.name': 'Pushka mini-hotel, Yalta', 'case.pushka.res': 'Nautical style, 2 minutes to the seafront',
      'case.akva.name': 'Akva Villa, Krasnodar', 'case.akva.res': 'Bath-and-hotel complex, rating 5.0 · online booking',
      'case.orderbot.name': 'Order-monitoring bot', 'case.orderbot.res': 'Watches order boards and filters a good fit with AI',

      /* iOS shell */
      'ios.search': 'Search',
      'ccx.full': 'Full screen', 'ccx.fullHint': 'Hide browser chrome',
      'ccx.callHint': 'Audio or video from the browser',

      /* Call */
      'call.title': 'Call', 'call.short': 'Call',
      'call.role': 'Urartu AI · on-premise AI deployment',
      'call.audio': 'Audio call', 'call.video': 'Video call',
      'call.audioAria': 'Start an audio call', 'call.videoAria': 'Start a video call',
      'call.hint': 'The call runs in your browser — nothing to install. If I don’t pick up right away, tap “Ping me on Telegram” and I’ll join.',
      'call.tg': 'Ping me on Telegram', 'call.phone': 'Call by phone',
      'call.connecting': 'Connecting…',
      'call.connected': 'Room created — I’m joining',
      'call.copy': 'Copy link', 'call.copied': 'Link copied',
      'call.end': 'End call', 'call.guest': 'Website guest',

      /* About · Guarantees */
      'about.title': 'About · Guarantees',
      'about.h': 'About us & guarantees',
      'about.lead': 'We are Urartu LLC, a Moscow-based deployment team. We work under contract and are ready to sign an NDA and be audited before any data changes hands. Below are our details and the commitments we put in the contract.',
      'about.req.eb': 'Company details',
      'about.req.company': 'Urartu LLC (ООО «Урарту»)',


      'about.req.resp': 'Responsible: Shahen Kazaryan, director',
      'about.req.docs': 'Full company details (INN, OGRN, legal address) — in the contract and on request.',
      'about.g.eb': 'Guarantees',
      'about.g1': 'Ready to sign an NDA before the demo and a contract before any work starts.',
      'about.g2': 'The assistant’s accuracy is an acceptance criterion written into the contract.',
      'about.g3': 'We comply with 152-FZ: data stays inside your perimeter, nothing goes out.',
      'about.g4': 'Hardware is supplied legally, with paperwork and warranty.',
      'about.cases.eb': 'Mini cases',
      'about.case1': 'Law firm, 12 lawyers: search across case history and policies — from 10 minutes to 15 seconds, all on their own server.',
      'about.case2': 'Manufacturing, QA department: answers from process sheets and standards with no internet access, pilot in 2 weeks.',
      'about.note': 'Company details, contract and references provided on request.',

      /* AI agents */
      'agents.title': 'AI Agents — 3D office', 'agents.short': 'AI Agents',
      'agents.h1': 'A team of AI agents at work',
      'agents.p': 'This is how a multi-agent system works: every agent owns a role, they hand tasks to each other and agree on the result. The same principle drives a deployment — one agent finds the answer in your policies, another checks a contract against your checklist, a third drafts the reply.',
      'agents.play': 'Launch the 3D office', 'agents.note': 'loads on click',
      'agents.building': 'Building the office', 'agents.hint': '~5 MB · better on Wi-Fi',
      'agents.retry': 'Try again',
      'agents.fs': 'Fullscreen', 'agents.fsExit': 'Exit fullscreen',
      'agents.credit': 'Simulation: The Delegation, an open-source project, MIT license',

      /* Trash */
      'trash.title': 'Trash', 'trash.h1': 'Empty — and that’s good',
      'trash.p': 'This is where ideas about uploading your documents to someone else’s cloud end up.',

      /* Folders */
      'reg.title': 'Policies',
      'reg.f1': 'Contract workflow policy.pdf', 'reg.f2': 'Personal data regulation.pdf',
      'reg.f3': 'Procurement approval policy.pdf', 'reg.f4': 'Document management guide.pdf',
      'reg.note': 'During the pilot your own documents live here — the assistant answers only from them.',
      'kb.title': 'Knowledge base',
      'kb.f1': 'Standard contracts.pdf', 'kb.f2': 'Review checklists.pdf',
      'kb.f3': 'Letter & claim templates.pdf', 'kb.f4': 'Internal standards.pdf',
      'kb.note': 'During the pilot your own documents live here — the vector index is built locally.',
      'finder.name': 'Name', 'finder.meta': 'Size · Date',

      /* Widgets */
      'w.contour.eb': 'Perimeter', 'w.contour.cap': 'data sent outside',
      'w.speed.eb': 'Speed', 'w.speed.val': '10&nbsp;sec', 'w.speed.cap': 'an answer from policy instead of 10 minutes',
      'w.speed.sub': 'runs 24/7, no days off',
      'w.cal.mark': '● Demo', 'w.cal.cta': 'Book', 'w.cal.ctaSub': 'a 30-min call →',
      'w.fines.eb': 'Fines · 152-FZ', 'w.fines.val': 'up&nbsp;to&nbsp;₽500M',
      'w.fines.cap': 'revenue-based fine for a repeat personal-data leak',
      'w.sticky': 'Pilot in&nbsp;2&nbsp;weeks on&nbsp;your documents. <strong>Free for&nbsp;our&nbsp;first clients, no&nbsp;commitment.</strong>',

      /* Springboard */
      'sb.assistant': 'Assistant', 'sb.how': 'How it works', 'sb.who': "Who it's for",
      'sb.terminal': 'Terminal', 'sb.mail': 'Mail',

      /* Chat widget dialog */
      'chat.q1': 'What’s the approval deadline for a 300k ₽ contract?',
      'chat.a1': '2 business days + 1 day (new counterparty). Source: Policy, cl. 2.1, 2.3',
      'chat.q2': 'How do I withdraw consent to process personal data?',
      'chat.a2': 'In writing to mos-city@bk.ru. The data is destroyed. Source: Policy, cl. 7; 152-FZ, art. 9.',
      'chat.q3': 'Can I send a client’s contract to ChatGPT?',
      'chat.a3': 'No. Servers outside Russia — sending personal data is prohibited (152-FZ). Ask the local assistant.'
    }
  };

  function t(key, lang) {
    var l = lang || I18N.lang;
    var table = DICT[l] || DICT.ru;
    return (key in table) ? table[key] : (DICT.ru[key] != null ? DICT.ru[key] : key);
  }

  function setMeta(name, val, attr) {
    var sel = (attr || 'name') + '="' + name + '"';
    var el = document.querySelector('meta[' + sel + ']');
    if (el) el.setAttribute('content', val);
  }

  function apply(lang) {
    var l = (lang === 'en') ? 'en' : 'ru';
    I18N.lang = l;
    window.__lang = l;
    document.documentElement.lang = l;

    /* textContent элементы */
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-i18n');
      var val = t(k, l);
      /* значения с &nbsp;/<strong> ушли бы в &amp; — используем innerHTML,
         если строка содержит разметку/сущности */
      if (/[<&]/.test(val)) nodes[i].innerHTML = val; else nodes[i].textContent = val;
    }
    /* innerHTML элементы */
    var htmls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmls.length; j++) {
      htmls[j].innerHTML = t(htmls[j].getAttribute('data-i18n-html'), l);
    }
    /* тултипы (data-tip) */
    var tips = document.querySelectorAll('[data-tip-i18n]');
    for (var m = 0; m < tips.length; m++) {
      tips[m].setAttribute('data-tip', t(tips[m].getAttribute('data-tip-i18n'), l));
    }
    /* имена дока (data-name) */
    var names = document.querySelectorAll('[data-name-i18n]');
    for (var n = 0; n < names.length; n++) {
      names[n].setAttribute('data-name', t(names[n].getAttribute('data-name-i18n'), l));
    }

    /* meta / title */
    document.title = t('meta.title', l);
    setMeta('description', t('meta.desc', l));
    setMeta('og:title', t('meta.title', l), 'property');
    setMeta('og:description', t('meta.desc', l), 'property');
    setMeta('og:locale', l === 'en' ? 'en_US' : 'ru_RU', 'property');

    /* переключатель языка */
    var lbl = document.getElementById('langLabel');
    if (lbl) lbl.textContent = (l === 'en') ? 'EN' : 'РУ';
    var ccLangVal = document.getElementById('ccLangVal');
    if (ccLangVal) ccLangVal.textContent = (l === 'en') ? 'English' : 'Русский';

    /* уведомить остальной код (чат/терминал/часы) */
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: l } }));
  }

  function setLang(lang, persist) {
    apply(lang);
    if (persist !== false) { try { localStorage.setItem('lang', I18N.lang); } catch (e) {} }
  }

  var I18N = {
    lang: (window.__lang === 'en') ? 'en' : 'ru',
    dict: DICT,
    t: t,
    apply: apply,
    setLang: setLang,
    toggle: function () { setLang(this.lang === 'en' ? 'ru' : 'en'); }
  };
  window.I18N = I18N;

  /* первичное применение при загрузке (лениво — DOM уже готов, скрипт defer) */
  apply(I18N.lang);
})();
