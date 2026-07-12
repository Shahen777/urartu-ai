#!/usr/bin/env python3
"""Генератор изображений для «Устройства»/«Услуги» через kie.ai Nano Banana 2.

Самодостаточный скрипт (не зависит от чужих проектов) — ключ берётся из
~/Projects/content-factory/.env (KIE_API_KEY), больше ничего не импортирует.
Сохраняет PNG в images/devices/ и images/services/, затем sips конвертирует
в webp (тот же паттерн, что icons/*.webp).

Запуск: python3 tools/gen_images.py
"""
import json
import os
import time
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = Path.home() / "Projects" / "content-factory" / ".env"


def load_key():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("KIE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("KIE_API_KEY not found in " + str(ENV_PATH))


API_KEY = load_key()
BASE = "https://api.kie.ai"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

STYLE = (
    "Dark premium tech product photograph, near-black background (#0a0c14) with a subtle "
    "warm red-orange accent glow (#F3350C) from one side, soft studio lighting, shallow depth "
    "of field, photorealistic, high detail, clean minimal composition, no text, no logos, "
    "no watermarks, no people, centered subject, editorial product-shot quality, square 1:1 crop. "
)

DEVICES = [
    ("start", STYLE + "A compact mini-tower PC case with a single RTX 4060 Ti class GPU visible through a tempered glass side panel, subtle red RGB accent lighting inside, sitting on a dark desk."),
    ("pro", STYLE + "A mid-tower PC workstation case with a high-end RTX 4070/4080 class GPU visible through a tempered glass side panel, subtle red accent lighting, clean cable management, on a dark desk."),
    ("max", STYLE + "A large premium tower workstation PC with a flagship RTX 4090/5090 class GPU visible through a glass panel, triple-fan cooler, subtle red accent lighting, powerful and substantial presence."),
    ("mac", STYLE + "A silver Mac Studio compact cube computer on a dark desk, minimalist Apple industrial design, subtle reflections, quiet and elegant presence, no other objects."),
    ("server", STYLE + "A rack-mounted multi-GPU server chassis, front panel with ventilation mesh and status LEDs, mounted in a dark open server rack, subtle red accent lighting, datacenter aesthetic."),
]

SERVICES = [
    ("websites", STYLE + "An abstract composition of a laptop screen showing a clean modern website mockup with geometric UI blocks, floating above a dark surface."),
    ("bots", STYLE + "An abstract glowing chat bubble interface floating above a dark surface, with small geometric nodes connected by thin glowing lines suggesting an AI agent network."),
    ("support", STYLE + "A glowing headset icon rendered as a physical 3D object floating above a dark surface, with soft chat-bubble glows around it, suggesting 24/7 customer support."),
    ("voice", STYLE + "An abstract sound waveform rendered as glowing 3D bars radiating from a small speaker-like object, floating above a dark surface, suggesting a voice assistant."),
    ("automation", STYLE + "Abstract interlocking gear shapes rendered as smooth glowing 3D objects, floating above a dark surface, suggesting business process automation."),
    ("integrations", STYLE + "Abstract geometric puzzle-piece shapes connecting together, rendered as smooth glowing 3D objects, floating above a dark surface, suggesting system integration."),
    ("video", STYLE + "A stylized 3D film-frame / clapperboard shape rendered as a smooth glowing object, floating above a dark surface, suggesting AI video generation."),
    ("content", STYLE + "Abstract floating stacked document/card shapes rendered as smooth glowing 3D objects with subtle text-line details, floating above a dark surface, suggesting a content factory."),
    ("analytics", STYLE + "Abstract floating 3D bar-chart and line-graph shapes rendered as smooth glowing objects, floating above a dark surface, suggesting AI analytics and dashboards."),
]


def create_task(prompt):
    payload = {
        "model": "nano-banana-2",
        "input": {"prompt": prompt, "aspect_ratio": "1:1", "resolution": "1K", "output_format": "png"},
    }
    r = requests.post(f"{BASE}/api/v1/jobs/createTask", headers=HEADERS, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"kie API error: {data.get('msg')} (code {data.get('code')})")
    return data["data"]["taskId"]


def wait_task(task_id, max_wait=180, poll=6):
    start = time.time()
    while time.time() - start < max_wait:
        r = requests.get(f"{BASE}/api/v1/jobs/recordInfo", headers=HEADERS, params={"taskId": task_id}, timeout=15)
        r.raise_for_status()
        data = r.json().get("data", {})
        state = data.get("state", "")
        if state == "success":
            return data
        if state == "fail":
            raise RuntimeError(f"task failed: {data.get('failMsg')}")
        time.sleep(poll)
    raise TimeoutError(f"task {task_id} timed out")


def result_url(task_data):
    rj = task_data.get("resultJson", "")
    if rj:
        parsed = json.loads(rj) if isinstance(rj, str) else rj
        urls = parsed.get("resultUrls", [])
        if urls:
            return urls[0]
    raise RuntimeError("no result url in task data")


def create_task_ref(prompt, image_input):
    payload = {
        "model": "nano-banana-2",
        "input": {
            "prompt": prompt, "aspect_ratio": "1:1", "resolution": "1K",
            "output_format": "png", "image_input": image_input,
        },
    }
    r = requests.post(f"{BASE}/api/v1/jobs/createTask", headers=HEADERS, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"kie API error: {data.get('msg')} (code {data.get('code')})")
    return data["data"]["taskId"]


def gen_one(name, prompt, out_dir, image_input=None):
    print(f"== {name}: submitting...")
    tid = create_task_ref(prompt, image_input) if image_input else create_task(prompt)
    print(f"   task_id={tid}, waiting...")
    data = wait_task(tid)
    url = result_url(data)
    print(f"   downloading {url}")
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    out_path = out_dir / f"{name}.png"
    out_path.write_bytes(r.content)
    print(f"   saved {out_path} ({len(r.content)//1024}KB)")
    return out_path


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    dev_dir = ROOT / "images" / "devices"
    svc_dir = ROOT / "images" / "services"
    dev_dir.mkdir(parents=True, exist_ok=True)
    svc_dir.mkdir(parents=True, exist_ok=True)

    if which in ("all", "devices"):
        for name, prompt in DEVICES:
            gen_one(name, prompt, dev_dir)
    if which in ("all", "services"):
        for name, prompt in SERVICES:
            gen_one(name, prompt, svc_dir)


if __name__ == "__main__":
    main()
