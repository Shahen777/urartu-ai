#!/usr/bin/env python3
"""Генератор иконок в манере настоящих иконок macOS (Big Sur / Sonoma).

Принцип, отличающий их от плоских Android-плиток:
  • светлый материальный корпус-плитка (near-white), а НЕ цветной фон;
  • внутри — изображение реального ПРЕДМЕТА с объёмом, тенью и деталями
    (конверт с клапаном, ценник с ниткой, металлическая корзина с рёбрами),
    а не белая пиктограмма;
  • форма — скуиркл (суперэллипс), поля 6 %, мягкая тень под плиткой;
  • глубина ≥ 3 слоёв: корпус-градиент + верхняя внутренняя тень +
    глянец-блик + тонкая кромка-бевел; у предмета — своя мягкая тень.
"""
import math
import pathlib

SIZE = 512
PAD = 30                      # поля: плитка не во всю область, под тень
N = 4.6                       # показатель суперэллипса (скуиркл Apple ≈ 4.5–5)
OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"


def squircle(cx, cy, rx, ry, n=N, steps=180):
    """Путь суперэллипса |x/rx|^n + |y/ry|^n = 1."""
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + rx * math.copysign(abs(ct) ** (2 / n), ct)
        y = cy + ry * math.copysign(abs(st) ** (2 / n), st)
        pts.append(f"{x:.2f},{y:.2f}")
    return "M" + "L".join(pts) + "Z"


BODY = squircle(SIZE / 2, SIZE / 2, SIZE / 2 - PAD, SIZE / 2 - PAD)
INNER = squircle(SIZE / 2, SIZE / 2, SIZE / 2 - PAD - 3, SIZE / 2 - PAD - 3)
CLIP = squircle(SIZE / 2, SIZE / 2, SIZE / 2 - PAD, SIZE / 2 - PAD, steps=180)


def tile(face_top, face_bot, dark=False):
    """Слои корпуса: face → верхняя внутр. тень → глянец → бевел-кромка."""
    sheen_top = ".22" if dark else ".55"
    sheen_mid = ".03" if dark else ".08"
    topshade = ".26" if dark else ".10"
    bevel_top = ".28" if dark else ".65"
    bevel_bot = ".40" if dark else ".22"
    return f'''    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{face_top}"/>
      <stop offset="1" stop-color="{face_bot}"/>
    </linearGradient>
    <linearGradient id="topshade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="{topshade}"/>
      <stop offset=".07" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="{sheen_top}"/>
      <stop offset=".40" stop-color="#fff" stop-opacity="{sheen_mid}"/>
      <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx=".32" cy=".20" r=".9">
      <stop offset="0" stop-color="#fff" stop-opacity="{'.10' if dark else '.60'}"/>
      <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="{bevel_top}"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".05"/>
      <stop offset="1" stop-color="#000" stop-opacity="{bevel_bot}"/>
    </linearGradient>'''


TILE_BODY = f'''    <path d="{BODY}" fill="url(#face)"/>
    <path d="{BODY}" fill="url(#glow)"/>
    <path d="{BODY}" fill="url(#topshade)"/>
    <path d="{BODY}" fill="url(#sheen)"/>
    <path d="{INNER}" fill="none" stroke="url(#bevel)" stroke-width="2.5"/>'''


def icon(name, face_top, face_bot, obj_defs, obj, dark=False, clip=False):
    inner = f'''  <g filter="url(#os)">
{obj}
  </g>'''
    if clip:
        inner = f'''  <clipPath id="body"><path d="{CLIP}"/></clipPath>
  <g clip-path="url(#body)">
    <g filter="url(#os)">
{obj}
    </g>
  </g>'''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-hidden="true">
  <defs>
{tile(face_top, face_bot, dark)}
    <filter id="cast" x="-25%" y="-20%" width="150%" height="155%">
      <feDropShadow dx="0" dy="16" stdDeviation="17" flood-color="#0b1220" flood-opacity=".34"/>
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0b1220" flood-opacity=".22"/>
    </filter>
    <filter id="os" x="-35%" y="-30%" width="170%" height="175%">
      <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#141a26" flood-opacity=".30"/>
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#141a26" flood-opacity=".20"/>
    </filter>
{obj_defs}  </defs>

  <g filter="url(#cast)">
{TILE_BODY}
  </g>

{inner}
</svg>
'''
    (OUT / name).write_text(svg, encoding="utf-8")
    return name


# ── светлый корпус по умолчанию ────────────────────────────────────────────
LT, LB = "#FEFEFF", "#E7E9F0"      # top / bottom корпуса


# ═══════════════════════════════════════════════════════════════════════════
#  ПРЕДМЕТЫ ВНУТРИ  (каждый — с объёмом, деталями и собственной тенью)
# ═══════════════════════════════════════════════════════════════════════════

# 1. Ассистент — облачко чата на светлом (синий пузырь + серый позади + точки)
ASSISTANT_DEFS = '''    <linearGradient id="bub" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#54ABFF"/>
      <stop offset="1" stop-color="#1E74E6"/>
    </linearGradient>
    <linearGradient id="bub2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#E7ECF4"/>
    </linearGradient>
    <linearGradient id="bubgl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
'''
ASSISTANT = '''    <path d="M232 148h118a40 40 0 0 1 40 40v58a40 40 0 0 1-40 40h-16v34l-40-34h-62a40 40 0 0 1-40-40v-58a40 40 0 0 1 40-40z"
          fill="url(#bub2)" stroke="#D3D9E4" stroke-width="2"/>
    <path d="M158 196h150a44 44 0 0 1 44 44v66a44 44 0 0 1-44 44h-70l-52 44 4-44h-32a44 44 0 0 1-44-44v-66a44 44 0 0 1 44-44z"
          fill="url(#bub)"/>
    <path d="M158 196h150a44 44 0 0 1 44 44v10H114v-10a44 44 0 0 1 44-44z" fill="url(#bubgl)"/>
    <g fill="#fff">
      <circle cx="188" cy="278" r="16"/>
      <circle cx="236" cy="278" r="16"/>
      <circle cx="284" cy="278" r="16"/>
    </g>'''

# 2. Как работает — белая карточка-схема с блок-схемой (процесс) индиго
HOW_DEFS = '''    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EEF1F7"/>
    </linearGradient>
    <linearGradient id="node1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7C86FF"/>
      <stop offset="1" stop-color="#4A50E0"/>
    </linearGradient>
    <linearGradient id="node2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AA0F6"/>
      <stop offset="1" stop-color="#5B62DE"/>
    </linearGradient>
'''
HOW = '''    <path d="M150 118h180l40 40v212a24 24 0 0 1-24 24H150a24 24 0 0 1-24-24V142a24 24 0 0 1 24-24z"
          fill="url(#card)" stroke="#DEE2EC" stroke-width="2"/>
    <path d="M330 118l40 40h-28a12 12 0 0 1-12-12z" fill="#D7DCE8"/>
    <g fill="none" stroke="#7B82E8" stroke-width="12" stroke-linecap="round">
      <path d="M256 210v30"/>
      <path d="M188 300v-24a12 12 0 0 1 12-12h112a12 12 0 0 1 12 12v24"/>
    </g>
    <rect x="212" y="164" width="88" height="46" rx="14" fill="url(#node1)"/>
    <rect x="150" y="300" width="82" height="44" rx="14" fill="url(#node2)"/>
    <rect x="282" y="300" width="82" height="44" rx="14" fill="url(#node2)"/>'''

# 3. Кому — карточка-бейдж с силуэтом человека
WHO_DEFS = '''    <linearGradient id="badge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EEF1F6"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3ED8CE"/>
      <stop offset="1" stop-color="#15A69C"/>
    </linearGradient>
    <linearGradient id="ava" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2FC6BC"/>
      <stop offset="1" stop-color="#0E877F"/>
    </linearGradient>
    <clipPath id="bclip"><rect x="140" y="130" width="232" height="256" rx="26"/></clipPath>
'''
WHO = '''    <rect x="238" y="104" width="36" height="26" rx="9" fill="#C6CCD6"/>
    <rect x="248" y="110" width="16" height="9" rx="4.5" fill="#9AA1AD"/>
    <rect x="140" y="130" width="232" height="256" rx="26" fill="url(#badge)" stroke="#DCE0E9" stroke-width="2"/>
    <g clip-path="url(#bclip)">
      <rect x="140" y="130" width="232" height="96" fill="url(#band)"/>
    </g>
    <circle cx="256" cy="226" r="52" fill="#fff"/>
    <circle cx="256" cy="226" r="44" fill="url(#ava)"/>
    <g fill="#fff">
      <circle cx="256" cy="212" r="17"/>
      <path d="M224 262a32 26 0 0 1 64 0z"/>
    </g>
    <g fill="#CDD3DD">
      <rect x="176" y="306" width="160" height="15" rx="7.5"/>
      <rect x="200" y="336" width="112" height="14" rx="7"/>
    </g>'''

# 4. Тарифы — ценник с отверстием и ниткой
PRICING_DEFS = '''    <linearGradient id="tag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#54D889"/>
      <stop offset="1" stop-color="#159B52"/>
    </linearGradient>
    <linearGradient id="taggl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".42"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
'''
# ценник наклонён; острый угол слева, отверстие-люверс и нитка вверх
PRICING = '''    <g transform="rotate(-17 256 262)">
      <path d="M118 262l82-84h150a30 30 0 0 1 30 30v108a30 30 0 0 1-30 30H200z"
            fill="url(#tag)"/>
      <path d="M118 262l82-84h150a30 30 0 0 1 30 30v16H150z" fill="url(#taggl)"/>
      <circle cx="214" cy="262" r="24" fill="#0E7B40"/>
      <circle cx="214" cy="262" r="14" fill="#E7E9F0"/>
      <path d="M198 218l40 88" fill="none" stroke="#C7CCD6" stroke-width="8" stroke-linecap="round"/>
      <text x="300" y="292" text-anchor="middle" font-family="-apple-system,'SF Pro Display',Arial,sans-serif"
            font-size="120" font-weight="800" fill="#fff">₽</text>
    </g>'''

# 5. Вопросы — белая карточка с загнутым уголком и янтарным «?»
FAQ_DEFS = '''    <linearGradient id="fcard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EEF1F6"/>
    </linearGradient>
    <linearGradient id="qm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC44D"/>
      <stop offset="1" stop-color="#F08A12"/>
    </linearGradient>
'''
FAQ = '''    <path d="M156 110h160l40 40v228a24 24 0 0 1-24 24H156a24 24 0 0 1-24-24V134a24 24 0 0 1 24-24z"
          fill="url(#fcard)" stroke="#DEE2EC" stroke-width="2"/>
    <path d="M316 110l40 40h-28a12 12 0 0 1-12-12z" fill="#D7DCE6"/>
    <path d="M256 158c-52 0-90 31-96 80h52c4-22 20-34 44-34 24 0 40 13 40 33 0 16-9 25-29 38-27 18-38 34-38 63v10h52v-8c0-18 7-27 29-41 27-18 40-38 40-66 0-45-39-77-96-77z"
          fill="url(#qm)"/>
    <circle cx="256" cy="392" r="28" fill="url(#qm)"/>'''

# 6. ИИ-агенты — три связанных узла-сферы разных цветов (делегирование)
AGENTS_DEFS = '''    <radialGradient id="nA" cx=".35" cy=".3" r=".85">
      <stop offset="0" stop-color="#7DBEFF"/>
      <stop offset="1" stop-color="#1E6FE0"/>
    </radialGradient>
    <radialGradient id="nB" cx=".35" cy=".3" r=".85">
      <stop offset="0" stop-color="#57E0BE"/>
      <stop offset="1" stop-color="#0FA07A"/>
    </radialGradient>
    <radialGradient id="nC" cx=".35" cy=".3" r=".85">
      <stop offset="0" stop-color="#B79BFF"/>
      <stop offset="1" stop-color="#6A3AE0"/>
    </radialGradient>
'''
AGENTS = '''    <g stroke="#C4C9D4" stroke-width="13" stroke-linecap="round">
      <line x1="256" y1="186" x2="176" y2="326"/>
      <line x1="256" y1="186" x2="336" y2="326"/>
      <line x1="182" y1="336" x2="330" y2="336"/>
    </g>
    <circle cx="176" cy="336" r="40" fill="url(#nB)"/>
    <circle cx="176" cy="324" r="12" fill="#fff" opacity=".35"/>
    <circle cx="336" cy="336" r="40" fill="url(#nC)"/>
    <circle cx="336" cy="324" r="12" fill="#fff" opacity=".35"/>
    <circle cx="256" cy="182" r="50" fill="url(#nA)"/>
    <circle cx="256" cy="166" r="16" fill="#fff" opacity=".4"/>'''

# 7. Терминал — тёмное окно с заголовком, кнопками-огоньками и промптом >_
TERM_DEFS = '''    <linearGradient id="tbar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A4F58"/>
      <stop offset="1" stop-color="#3A3E46"/>
    </linearGradient>
'''
TERMINAL = '''    <path d="M96 160h320v40H96z" fill="url(#tbar)"/>
    <line x1="96" y1="200" x2="416" y2="200" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <circle cx="132" cy="180" r="11" fill="#FF5F57"/>
    <circle cx="168" cy="180" r="11" fill="#FEBC2E"/>
    <circle cx="204" cy="180" r="11" fill="#28C840"/>
    <path d="M132 240l44 38-44 38" fill="none" stroke="#5CE07A" stroke-width="18"
          stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="196" y="300" width="30" height="20" rx="4" fill="#5CE07A"/>
    <rect x="132" y="346" width="196" height="17" rx="8.5" fill="#5A616C"/>
    <rect x="132" y="380" width="130" height="17" rx="8.5" fill="#454b55"/>'''

# 8. Почта — конверт с открытым клапаном, письмом-строками и внутренней тенью
MAIL_DEFS = '''    <linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EFF2F7"/>
    </linearGradient>
    <linearGradient id="pocket" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F4F6FA"/>
      <stop offset="1" stop-color="#DFE4EC"/>
    </linearGradient>
    <linearGradient id="vshade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".16"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
'''
MAIL = '''    <rect x="160" y="150" width="192" height="158" rx="12" fill="url(#sheet)" stroke="#DCE1EA" stroke-width="2"/>
    <g fill="#B7C6E0">
      <rect x="182" y="182" width="148" height="14" rx="7" fill="#4C9BF0"/>
      <rect x="182" y="214" width="148" height="12" rx="6"/>
      <rect x="182" y="242" width="148" height="12" rx="6"/>
      <rect x="182" y="270" width="96" height="12" rx="6"/>
    </g>
    <path d="M132 236l124 78 124-78v96a24 24 0 0 1-24 24H156a24 24 0 0 1-24-24z" fill="url(#pocket)"/>
    <path d="M132 236l124 78 124-78-124 46z" fill="url(#vshade)"/>
    <path d="M132 236l124 78 124-78" fill="none" stroke="#CBD2DC" stroke-width="3"/>'''

# 9. Корзина — металлическая корзина с вертикальными рёбрами
TRASH_DEFS = '''    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E4E7EC"/>
      <stop offset=".28" stop-color="#B9BEC9"/>
      <stop offset=".5" stop-color="#D6DAE1"/>
      <stop offset=".72" stop-color="#AEB4BF"/>
      <stop offset="1" stop-color="#D9DDE4"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#EDEFF3"/>
      <stop offset=".5" stop-color="#C2C7D0"/>
      <stop offset="1" stop-color="#EDEFF3"/>
    </linearGradient>
    <clipPath id="basket"><path d="M162 206h188l-24 176a20 20 0 0 1-20 18H206a20 20 0 0 1-20-18z"/></clipPath>
'''
TRASH = '''    <path d="M162 206h188l-24 176a20 20 0 0 1-20 18H206a20 20 0 0 1-20-18z" fill="url(#metal)"/>
    <g clip-path="url(#basket)" stroke="#9299A6" stroke-width="8" opacity=".75">
      <line x1="196" y1="210" x2="204" y2="396"/>
      <line x1="228" y1="210" x2="232" y2="396"/>
      <line x1="256" y1="210" x2="256" y2="396"/>
      <line x1="284" y1="210" x2="280" y2="396"/>
      <line x1="316" y1="210" x2="308" y2="396"/>
    </g>
    <g clip-path="url(#basket)">
      <rect x="150" y="200" width="26" height="210" fill="#fff" opacity=".28"/>
    </g>
    <ellipse cx="256" cy="206" rx="94" ry="26" fill="url(#rim)"/>
    <ellipse cx="256" cy="207" rx="79" ry="18" fill="#9BA1AD"/>
    <ellipse cx="256" cy="204" rx="79" ry="17" fill="#828A98"/>'''


ICONS = [
    ("assistant.svg", LT, LB, ASSISTANT_DEFS, ASSISTANT, False, False),
    ("how.svg",       LT, LB, HOW_DEFS,       HOW,       False, False),
    ("who.svg",       LT, LB, WHO_DEFS,       WHO,       False, False),
    ("pricing.svg",   LT, LB, PRICING_DEFS,   PRICING,   False, True),
    ("faq.svg",       LT, LB, FAQ_DEFS,       FAQ,       False, False),
    ("agents.svg",    LT, LB, AGENTS_DEFS,    AGENTS,    False, False),
    ("terminal.svg",  "#4C515A", "#22262C", TERM_DEFS, TERMINAL, True, True),
    ("mail.svg",      LT, LB, MAIL_DEFS,      MAIL,      False, False),
    ("trash.svg",     LT, LB, TRASH_DEFS,     TRASH,     False, False),
]

for name, ft, fb, d, o, dark, clip in ICONS:
    icon(name, ft, fb, d, o, dark=dark, clip=clip)
    print("wrote", name)
