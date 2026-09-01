import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import modal

APP_NAME = "scholarmcp-video-worker"
RENDER_ROOT = Path("/renders")
WORK_ROOT = Path("/tmp/scholarmcp-video")
SAMPLE_RATE = 24000

app = modal.App(APP_NAME)
renders = modal.Volume.from_name("scholarmcp-video-renders", create_if_missing=True)

worker_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.11")
    .apt_install(
        "git",
        "wget",
        "ffmpeg",
        "espeak-ng",
        "fonts-noto-core",
        "libnss3",
        "libdbus-1-3",
        "libatk1.0-0",
        "libgbm1",
        "libasound2",
        "libxrandr2",
        "libxkbcommon0",
        "libxfixes3",
        "libxcomposite1",
        "libxdamage1",
        "libatk-bridge2.0-0",
        "libcups2",
        "libpango-1.0-0",
        "libcairo2",
    )
    .run_commands(
        "python -m pip install --no-cache-dir numpy soundfile huggingface_hub misaki camel-tools",
        "python -m pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu",
        'python -m pip install --no-cache-dir "kokoro @ git+https://github.com/Oddadmix/kokoro.git@main"',
        "camel_data -i disambig-mle-calima-msa-r13",
        "mkdir -p /opt/nabra/model",
        "wget -q https://gist.githubusercontent.com/Oddadmix/dc699f7942a9516ce29d4842c7aed756/raw/827b541c892a862f9ef3b44006a6e27b100d1bdd/arabic_g2p.py -O /opt/nabra/arabic_g2p.py",
        "python -c \"from huggingface_hub import snapshot_download; snapshot_download('oddadmix/Nabra-82M-v0.1', local_dir='/opt/nabra/model')\"",
    )
    .add_local_dir("cloud/video-worker/render", "/video", copy=True)
    .run_commands(
        "cd /video && npm install --omit=dev",
        "cd /video && npx remotion browser ensure",
    )
)

_tts_cache = None


def _load_tts():
    global _tts_cache
    if _tts_cache is not None:
        return _tts_cache

    sys.path.insert(0, "/opt/nabra")
    import torch
    from arabic_g2p import ArabicG2P, EXTRA_SYMBOLS, clean_phonemes, normalize_text
    from kokoro import KModel, KPipeline
    from kokoro import pipeline as kpipeline_mod

    model_dir = Path("/opt/nabra/model")
    config = str(model_dir / "config.json")
    model_path = str(model_dir / "kokoro_arabic.pth")
    voice_path = str(model_dir / "af_msa.pt")

    model = KModel(
        repo_id="oddadmix/Nabra-82M-v0.1",
        config=config,
        model=model_path,
        disable_complex=True,
    ).eval()
    model.vocab.update(EXTRA_SYMBOLS)
    kpipeline_mod.LANG_CODES.setdefault("ar", "ar")
    pipeline = KPipeline(
        lang_code="ar",
        repo_id="oddadmix/Nabra-82M-v0.1",
        model=model,
    )
    original_g2p = pipeline.g2p
    pipeline.g2p = lambda text: (
        clean_phonemes(original_g2p(text)[0]),
        original_g2p(text)[1],
    )
    voice = torch.load(voice_path, map_location="cpu", weights_only=True)
    g2p = ArabicG2P(diacritize=True)
    _tts_cache = (pipeline, voice, g2p, normalize_text)
    return _tts_cache


def _synthesize_scenes(scenes, output_path: Path):
    import numpy as np
    import soundfile as sf

    pipeline, voice, g2p, normalize_text = _load_tts()
    timeline = []
    pieces = []
    cursor = 0
    pause = np.zeros(int(SAMPLE_RATE * 0.22), dtype=np.float32)

    for index, scene in enumerate(scenes):
        raw = str(scene.get("narration") or scene.get("text") or "").strip()
        if not raw:
            continue
        normalized, _ = normalize_text(raw)
        diacritized = g2p.diacritize(normalized)
        audio_parts = [
            audio.detach().cpu().numpy()
            for _, _, audio in pipeline(diacritized, voice=voice, speed=1.0)
        ]
        if not audio_parts:
            raise RuntimeError(f"TTS produced no audio for scene {index + 1}")
        audio = np.concatenate(audio_parts).astype(np.float32)
        start = cursor / SAMPLE_RATE
        pieces.append(audio)
        cursor += len(audio)
        end = cursor / SAMPLE_RATE
        pieces.append(pause)
        cursor += len(pause)
        timeline.append(
            {
                "title": str(scene.get("title") or f"الفكرة {index + 1}"),
                "narration": raw,
                "onScreen": str(scene.get("onScreen") or raw),
                "sourceRef": str(scene.get("sourceRef") or ""),
                "startSec": round(start, 3),
                "endSec": round(max(end + 0.18, start + 0.5), 3),
            }
        )

    if not pieces:
        raise ValueError("At least one narrated scene is required")
    wav = np.concatenate(pieces).astype(np.float32)
    sf.write(str(output_path), wav, SAMPLE_RATE)
    return timeline, len(wav) / SAMPLE_RATE


@app.function()
@modal.fastapi_endpoint(method="GET", label="health")
def health():
    return {
        "ok": True,
        "service": APP_NAME,
        "execution": "cloud-only",
        "student_device_models": False,
        "renderer": "Remotion+FFmpeg",
        "tts": "Nabra-82M",
    }


@app.function(
    image=worker_image,
    cpu=4,
    memory=4096,
    timeout=1200,
    volumes={"/renders": renders},
)
def render_video(payload: dict):
    started = time.perf_counter()
    job_id = str(payload.get("jobId") or uuid.uuid4().hex)
    title = str(payload.get("title") or "فيديو دراسي — ScholarMCP")
    scenes = list(payload.get("scenes") or [])
    if not 1 <= len(scenes) <= 30:
        raise ValueError("scenes must contain between 1 and 30 items")

    job_dir = WORK_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    narration = job_dir / "narration.wav"
    props_path = job_dir / "props.json"
    silent_video = job_dir / "silent.mp4"
    final_video = RENDER_ROOT / f"{job_id}.mp4"
    metadata_path = RENDER_ROOT / f"{job_id}.json"

    tts_started = time.perf_counter()
    timed_scenes, total_duration = _synthesize_scenes(scenes, narration)
    tts_seconds = time.perf_counter() - tts_started

    props = {
        "title": title,
        "scenes": timed_scenes,
        "totalDurationSec": total_duration,
    }
    props_path.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

    render_started = time.perf_counter()
    subprocess.run(
        ["node", "/video/render.mjs", str(props_path), str(silent_video)],
        check=True,
        cwd="/video",
    )
    remotion_seconds = time.perf_counter() - render_started

    mux_started = time.perf_counter()
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(silent_video),
            "-i",
            str(narration),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-shortest",
            str(final_video),
        ],
        check=True,
    )
    mux_seconds = time.perf_counter() - mux_started

    result = {
        "ok": True,
        "jobId": job_id,
        "title": title,
        "durationSec": round(total_duration, 3),
        "scenes": len(timed_scenes),
        "bytes": final_video.stat().st_size,
        "timing": {
            "ttsSec": round(tts_seconds, 3),
            "remotionSec": round(remotion_seconds, 3),
            "muxSec": round(mux_seconds, 3),
            "totalSec": round(time.perf_counter() - started, 3),
        },
        "volumePath": final_video.name,
    }
    metadata_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    renders.commit()
    return result


@app.local_entrypoint()
def benchmark():
    payload = {
        "title": "اختبار ScholarMCP السحابي",
        "scenes": [
            {
                "title": "من المصدر إلى الفهم",
                "narration": "يحوّل شُولَر إم سي بي المادّةَ الدِّراسيّةَ إلى شَرْحٍ واضِحٍ ومُنَظَّمٍ.",
                "onScreen": "المصدر ← الفهم ← المراجعة",
                "sourceRef": "اختبار داخلي — ص 1",
            },
            {
                "title": "بدون تحميل محركات",
                "narration": "تَتِمُّ المُعالَجَةُ على السَّحابَةِ، ولا يَحتاجُ الطّالِبُ إلى تَنْزيلِ نَموذَجِ ذَكاءٍ اصطِناعِيٍّ على جِهازِهِ.",
                "onScreen": "المعالجة سحابية بالكامل",
                "sourceRef": "اختبار داخلي — ص 2",
            },
        ],
    }
    result = render_video.remote(payload)
    print("SCHOLARMCP_BENCHMARK=" + json.dumps(result, ensure_ascii=False))
