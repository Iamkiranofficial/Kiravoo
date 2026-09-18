# KIRAVO Kaggle GPU Worker

This folder contains the free-GPU worker used by KIRAVO during development.

## Why this exists
Vercel serverless functions are not the place to run a multi-GB video diffusion model. KIRAVO therefore keeps the web/API layer on Vercel and moves inference to a Kaggle notebook with a T4 GPU.

The worker uses the LTX-Video 2B pipeline with FP8 layerwise casting and group offloading. Hugging Face's current Diffusers documentation describes this memory-optimized configuration and lists roughly 10 GB VRAM for the model. citeturn0search0

## Files
- `kiravo_kaggle_worker.py` — HTTP worker: /health, /generate, /status/:id, /video/:id.
- `KIRAVO_Kaggle_Worker.ipynb` — minimal notebook cells to download/start the worker and create a temporary HTTPS tunnel.

## Current development flow
1. Enable Kaggle T4 x2.
2. Import/open the notebook.
3. Run the notebook cells.
4. Copy the printed `KIRAVO_WORKER_URL` into Vercel as `KIRAVO_WORKER_URL`.
5. KIRAVO sends generation jobs to the worker and polls the result.

Kaggle's API supports authenticated notebook creation/update/execution, but that requires Kaggle authorization; this repository deliberately does not contain a Kaggle token. citeturn0search2
