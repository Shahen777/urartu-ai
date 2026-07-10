# vendor/ — локальные библиотеки (никаких CDN в рантайме)

Все файлы лежат локально и грузятся ЛЕНИВО — только после явных кнопок
(«Живой голос», «Аватар») или первого открытия окна («Пульс компании»).
При старте страницы отсюда не загружается ничего.

| Папка | Что | Версия | Лицензия | Источник |
|---|---|---|---|---|
| `echarts.min.js` | Apache ECharts — графики дашборда «Пульс компании» (~1,1 МБ, лениво при первом открытии окна) | 6.0.0 | Apache-2.0 | npm echarts |
| `countup.umd.js` | CountUp.js — анимация KPI-цифр дашборда (~6 КБ, грузится вместе с ним) | 2.9.0 | MIT | npm countup.js |
| `vits/vits-engine.mjs` | адаптация @diffusionstudio/vits-web (локальные пути, CacheStorage, кеш сессии) | из v1.0.3 | MIT | npm @diffusionstudio/vits-web |
| `vits/vits-worker.mjs` | наш module-worker для синтеза | — | MIT | своё |
| `vits/piper_phonemize.{mjs,wasm,data}` | фонемизатор espeak-ng (wasm 0.6 МБ + данные 18 МБ) | 1.0.0 | MIT | npm @diffusionstudio/piper-wasm (+ESM-глю из vits-web) |
| `ort/ort.wasm.bundle.min.mjs` + `ort-wasm-simd-threaded.{wasm,mjs}` | onnxruntime-web (wasm-бэкенд, 13,5 МБ) | 1.27.0 | MIT | npm onnxruntime-web |
| `three/three.module.min.js` + `three.core.min.js` | three.js для 3D-лица (~0,75 МБ) | 0.185.1 | MIT | npm three |
| `purify.min.js` | DOMPurify — санитайзер HTML перед innerHTML (ЛОТ J, ~28 КБ, эагерно) | 3.4.11 | Apache-2.0 / MPL-2.0 | npm dompurify |
| `markdown-it.min.js` | markdown-it — ответы живой модели markdown → DOMPurify → DOM (~125 КБ, лениво при первом ответе WebLLM) | 14.3.0 | MIT | npm markdown-it |
| `driver.iife.js` + `driver.css` | driver.js — «Экскурсия по системе», 8 шагов (~24 КБ, лениво по кнопке) | 1.6.0 | MIT | npm driver.js |
| `jspdf.umd.min.js` | jsPDF — «Скачать смету (PDF)» (~420 КБ, лениво по кнопке) | 4.2.1 | MIT | npm jspdf |
| `pdf-font.js` | Roboto Regular, подмножество Latin+Cyrillic (base64 ~28 КБ) — встроенные шрифты jsPDF без кириллицы; лениво с jsPDF | subset | Apache-2.0 | Google Fonts + pyftsubset |
| `qrcode.min.js` | qrcode-generator — QR на Telegram в PDF-смете (~56 КБ, лениво с jsPDF) | 2.0.4 | MIT | npm qrcode-generator |

ЛОТ J грузит тяжёлое строго по кнопке: markdown-it — при первом ответе живой модели; driver.js — при запуске экскурсии; jsPDF+Roboto+QR — при клике «Скачать смету (PDF)». При старте страницы из этого списка эагерно только `purify.min.js` (броня для innerHTML).

Голосовая модель `ru_RU-irina-medium` (60,3 МБ) в репозиторий НЕ кладётся:
качается по кнопке с huggingface (rhasspy/piper-voices) и кешируется
в CacheStorage `vits-voice-v1` — второй раз работает офлайн.

3D-лицо — собственная процедурная голова на three.js (js/face3d.mjs).
Ready Player Me GLB не используется: лицензия RPM разрешает аватары только
внутри приложений, интегрированных с их платформой по Developer Agreement.
