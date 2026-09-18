# KIRAVO Kaggle GPU worker
#
# Purpose: run the LTX-Video 2B pipeline on Kaggle's free T4 GPU instead of
# trying to run video inference inside Vercel's serverless runtime.
#
# This file is intentionally self-contained. The notebook can execute it with:
#   %run /kaggle/working/kiravo_kaggle_worker.py
#
# It exposes a small HTTP API through a Cloudflare quick tunnel when run in a
# Kaggle notebook. KIRAVO sends POST /generate and polls GET /status/<job_id>.
# The tunnel URL is printed at startup; set that URL as KIRAVO_WORKER_URL in Vercel.

import gc
import json
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

# Install only what the worker needs. Avoid upgrading Kaggle's whole environment.
subprocess.run([
    sys.executable, "-m", "pip", "install", "-q",
    "diffusers==0.40.0", "transformers", "accelerate", "imageio[ffmpeg]", "flask"
], check=False)

import torch
from flask import Flask, jsonify, request, send_file
from diffusers import LTXPipeline, AutoModel
from diffusers.hooks import apply_group_offloading
from diffusers.utils import export_to_video

APP = Flask(__name__)
OUT = Path("/kaggle/working/kiravo_jobs")
OUT.mkdir(parents=True, exist_ok=True)
JOBS = {}
LOCK = threading.Lock()
PIPE = None


def load_pipeline():
    global PIPE
    if PIPE is not None:
        return PIPE

    gc.collect()
    torch.cuda.empty_cache()

    transformer = AutoModel.from_pretrained(
        "Lightricks/LTX-Video",
        subfolder="transformer",
        dtype=torch.bfloat16,
    )
    transformer.enable_layerwise_casting(
        storage_dtype=torch.float8_e4m3fn,
        compute_dtype=torch.bfloat16,
    )

    pipe = LTXPipeline.from_pretrained(
        "Lightricks/LTX-Video",
        transformer=transformer,
        dtype=torch.bfloat16,
    )

    # This is the complete memory-saving pattern documented by Hugging Face:
    # transformer + text encoder + VAE are offloaded as needed.
    cuda = torch.device("cuda")
    cpu = torch.device("cpu")
    pipe.transformer.enable_group_offload(
        onload_device=cuda,
        offload_device=cpu,
        offload_type="leaf_level",
        use_stream=True,
    )
    apply_group_offloading(
        pipe.text_encoder,
        onload_device=cuda,
        offload_type="block_level",
        num_blocks_per_group=2,
    )
    apply_group_offloading(
        pipe.vae,
        onload_device=cuda,
        offload_type="leaf_level",
    )

    PIPE = pipe
    return PIPE


def worker(job_id, payload):
    with LOCK:
        JOBS[job_id] = {"status": "loading", "url": None, "error": None}
    try:
        pipe = load_pipeline()
        prompt = str(payload.get("prompt", "")).strip()
        negative = str(payload.get("negative_prompt", "worst quality, blurry, jittery, distorted"))
        width = int(payload.get("width", 512))
        height = int(payload.get("height", 320))
        frames = int(payload.get("num_frames", 41))
        steps = int(payload.get("num_inference_steps", 8))
        seed = int(payload.get("seed", 42))

        # Conservative T4 defaults. Dimensions are rounded down to 32-pixel multiples.
        width = max(320, (width // 32) * 32)
        height = max(320, (height // 32) * 32)
        frames = max(17, frames)

        with LOCK:
            JOBS[job_id]["status"] = "processing"

        generator = torch.Generator(device="cuda").manual_seed(seed)
        result = pipe(
            prompt=prompt,
            negative_prompt=negative,
            width=width,
            height=height,
            num_frames=frames,
            num_inference_steps=steps,
            guidance_scale=1.0,
            decode_timestep=0.05,
            decode_noise_scale=0.025,
            generator=generator,
        )
        frames_out = result.frames[0]
        output = OUT / f"{job_id}.mp4"
        export_to_video(frames_out, str(output), fps=24)

        with LOCK:
            JOBS[job_id] = {
                "status": "complete",
                "url": f"/video/{job_id}",
                "error": None,
                "path": str(output),
            }
    except Exception as exc:
        with LOCK:
            JOBS[job_id] = {"status": "error", "url": None, "error": str(exc)}
    finally:
        gc.collect()
        torch.cuda.empty_cache()


@APP.get("/health")
def health():
    return jsonify({
        "ok": True,
        "engine": "LTX-Video 2B",
        "cuda": bool(torch.cuda.is_available()),
        "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
    })


@APP.post("/generate")
def generate():
    payload = request.get_json(silent=True) or {}
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400
    job_id = uuid.uuid4().hex
    with LOCK:
        JOBS[job_id] = {"status": "queued", "url": None, "error": None}
    threading.Thread(target=worker, args=(job_id, payload), daemon=True).start()
    return jsonify({"id": job_id, "status": "queued", "creditsCharged": 0})


@APP.get("/status/<job_id>")
def status(job_id):
    with LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify({"status": "error", "error": "Unknown job"}), 404
    result = dict(job)
    if result.get("status") == "complete":
        result["url"] = f"/video/{job_id}"
    return jsonify(result)


@APP.get("/video/<job_id>")
def video(job_id):
    path = OUT / f"{job_id}.mp4"
    if not path.exists():
        return jsonify({"error": "Video not found"}), 404
    return send_file(path, mimetype="video/mp4", as_attachment=False)


if __name__ == "__main__":
    # Keep the server alive in the Kaggle cell. In the notebook, run this file
    # and then start a Cloudflare quick tunnel to port 7860.
    APP.run(host="0.0.0.0", port=7860, threaded=True)
