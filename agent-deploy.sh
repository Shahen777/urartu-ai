#!/usr/bin/env bash
# ============================================================
# Urartu Voice Agent — деплой на Ubuntu-сервер одной командой.
# Ставит: агента (kie.ai LLM + edge-tts), автозапуск (systemd),
# бесплатный HTTPS через Caddy + sslip.io (без правки DNS).
# Запуск НА СЕРВЕРЕ под root:
#   KIE_API_KEY=ваш_ключ bash deploy.sh
# (или просто `bash deploy.sh` — спросит ключ)
# ============================================================
set -e
APP=/opt/urartu-agent
IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
HOST="${IP//./-}.sslip.io"

if [ -z "$KIE_API_KEY" ]; then read -rsp "Вставьте KIE_API_KEY: " KIE_API_KEY; echo; fi
[ -z "$KIE_API_KEY" ] && { echo "Нет ключа — выход"; exit 1; }

echo "→ Ставлю пакеты…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip curl debian-keyring debian-archive-keyring apt-transport-https >/dev/null

# Caddy (авто-HTTPS)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

mkdir -p "$APP"

echo "→ Пишу приложение…"
cat > $APP/server.py <<'PYEOF'
"""
Urartu Voice Agent — умный голосовой ИИ-ассистент.
Мозг: kie.ai (Gemini 3.1 Pro, OpenAI chat-формат) — свободный разговор + продажи.
Голос: edge-tts (нейроголоса Microsoft) — тот, что одобрил заказчик (Svetlana).
Отдаёт JSON { text, audio(data-URI mp3) } — сайт проигрывает вживую.

Запуск:  uvicorn server:app --host 0.0.0.0 --port 8787
Ключ KIE_API_KEY — в .env (на СЕРВЕРЕ, в браузер не попадает).
"""
import os, base64, asyncio
from pathlib import Path

import httpx
import edge_tts
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- .env ---
def _load_env():
    p = Path(__file__).with_name(".env")
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
_load_env()

KIE_KEY = os.environ.get("KIE_API_KEY", "")
KIE_URL = "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions"
KIE_MODEL = "gemini-3.1-pro"

# --- факты о продукте: чтобы ассистент продавал точно, а не выдумывал ---
PRODUCT = (
    "Компания Urartu внедряет ЛОКАЛЬНЫХ ИИ-сотрудников на сервере клиента: они отвечают по "
    "регламентам и базе знаний, проверяют договоры, ведут поддержку клиентов и принимают звонки. "
    "Главное преимущество: модель работает на сервере клиента, данные НЕ уходят в облако — это "
    "соответствие 152-ФЗ. Ориентиры цен: внедрение ИИ-сотрудника от 200 000 ₽, поддержка от "
    "15 000 ₽/мес, станция с GPU от 180 000 ₽. Пилот на процессе клиента — 2 недели. "
    "Открытые модели (Qwen/GLM/DeepSeek) для типовых задач дают уровень GPT-4o/Claude Sonnet, но "
    "локально и без абонплаты. Контакты: mos-city@bk.ru, +7 926 333-78-47, Telegram @Shahen_kazaryan."
)

# --- роли: системный промпт + голос ---
ROLES = {
    "secretary": {
        "voice": "ru-RU-SvetlanaNeural",
        "sys": ("Ты — Анна, живой ИИ-секретарь компании Urartu. Ты умный голосовой ассистент "
                "(как ChatGPT/Grok): свободно и естественно разговариваешь на любую тему, отвечаешь "
                "по делу и с теплом. При этом ты представляешь Urartu и мягко, ненавязчиво ведёшь "
                "человека к записи на бесплатное демо (30 минут онлайн). Не дави. Отвечай КОРОТКО — "
                "1–3 предложения, разговорным языком, будто говоришь голосом по телефону (без списков "
                "и markdown, без эмодзи-спама). Если спрашивают цену/сроки/152-ФЗ — отвечай точно по фактам."),
    },
    "documoved": {
        "voice": "ru-RU-DmitryNeural",
        "sys": ("Ты — Документовед, ИИ-сотрудник Urartu. Помогаешь с регламентами, документами и "
                "базой знаний, отвечаешь со ссылкой на пункт. Говоришь коротко и по-деловому, голосом. "
                "Мягко предлагаешь записаться на демо, если уместно."),
    },
    "lawyer": {
        "voice": "ru-RU-DmitryNeural",
        "sys": ("Ты — Юрист-проверяющий, ИИ-сотрудник Urartu. Проверяешь договоры по чек-листу, "
                "называешь риски конкретно. Говоришь коротко, по-деловому, голосом. Не даёшь "
                "юридически обязывающих заключений — это демо."),
    },
    "support": {
        "voice": "ru-RU-DmitryNeural",
        "sys": ("Ты — Оператор поддержки, ИИ-сотрудник Urartu. Быстро и дружелюбно помогаешь. "
                "Говоришь коротко, голосом. Если нужен человек — предлагаешь связать с Шагеном."),
    },
    "content": {
        "voice": "ru-RU-SvetlanaNeural",
        "sys": ("Ты — Контент-менеджер, ИИ-сотрудник Urartu. Помогаешь с текстами и идеями. "
                "Отвечаешь живо и коротко, голосом."),
    },
}
DEFAULT_ROLE = "secretary"

app = FastAPI(title="Urartu Voice Agent")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class VoiceReq(BaseModel):
    agent: str = "secretary"
    message: str = ""
    history: list = []      # [{role:'user'|'assistant', content:str}, ...]
    voice: bool = True      # нужен ли аудио-ответ
    lang: str = "ru"


async def kie_chat(system: str, history: list, message: str, lang: str) -> str:
    msgs = [{"role": "system", "content": system}]
    for h in (history or [])[-8:]:
        r = "assistant" if h.get("role") == "assistant" else "user"
        c = str(h.get("content", ""))[:1500]
        if c:
            msgs.append({"role": r, "content": c})
    msgs.append({"role": "user", "content": message[:2000]})
    payload = {"model": KIE_MODEL, "messages": msgs, "temperature": 0.7}
    async with httpx.AsyncClient(timeout=45) as cl:
        r = await cl.post(KIE_URL, headers={
            "Authorization": f"Bearer {KIE_KEY}", "Content-Type": "application/json",
        }, json=payload)
        r.raise_for_status()
        data = r.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return "Извините, я на секунду задумалась. Повторите, пожалуйста?"


async def tts(text: str, voice: str) -> str:
    """edge-tts → data-URI mp3."""
    buf = bytearray()
    comm = edge_tts.Communicate(text, voice, rate="-4%")
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    b64 = base64.b64encode(bytes(buf)).decode("ascii")
    return "data:audio/mpeg;base64," + b64


@app.get("/api/health")
async def health():
    return {"ok": True, "has_key": bool(KIE_KEY), "voices": list({r["voice"] for r in ROLES.values()})}


@app.post("/api/voice")
async def voice(req: VoiceReq):
    role = ROLES.get(req.agent) or ROLES[DEFAULT_ROLE]
    if not (req.message or "").strip():
        return {"text": "", "audio": None}
    text = await kie_chat(role["sys"], req.history, req.message, req.lang)
    audio = None
    if req.voice:
        try:
            audio = await tts(text, role["voice"])
        except Exception as e:
            audio = None
    return {"text": text, "audio": audio, "agent": req.agent}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8787)))
PYEOF

cat > $APP/requirements.txt <<'REQ'
fastapi
uvicorn[standard]
httpx
edge-tts
REQ

printf 'KIE_API_KEY=%s\nPORT=8787\n' "$KIE_API_KEY" > $APP/.env
chmod 600 $APP/.env

echo "→ Виртуальное окружение…"
python3 -m venv $APP/.venv
$APP/.venv/bin/pip -q install --upgrade pip >/dev/null
$APP/.venv/bin/pip -q install -r $APP/requirements.txt >/dev/null

echo "→ systemd-сервис…"
cat > /etc/systemd/system/urartu-agent.service <<UNIT
[Unit]
Description=Urartu Voice Agent
After=network.target
[Service]
WorkingDirectory=$APP
ExecStart=$APP/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8787
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now urartu-agent

echo "→ Caddy (HTTPS для $HOST)…"
grep -q "$HOST" /etc/caddy/Caddyfile 2>/dev/null || cat >> /etc/caddy/Caddyfile <<CADDY

$HOST {
    reverse_proxy 127.0.0.1:8787
}
CADDY
systemctl reload caddy || systemctl restart caddy

sleep 4
echo ""
echo "============================================================"
echo "✅ Готово. Адрес агента (HTTPS):"
echo "   https://$HOST"
echo "Проверка:  curl https://$HOST/api/health"
echo "На сайте укажите этот адрес (?agent=https://$HOST или localStorage urartu_agent_api)"
echo "============================================================"
