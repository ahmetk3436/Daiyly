# EmotionSenseML Evaluation Report

Repo: https://github.com/ahmetk3436/emotionsenseml
Evaluated: 2026-03-04
Branch: main, last push: 2026-03-03

---

## 1. What It Does

EmotionSenseML is a Python microservice with three separate emotion analysis capabilities:

- **Voice/Audio**: Two parallel approaches:
  - Custom PyTorch model (Conv1D + LSTM) trained on CREMA-D and SAVEE datasets using MFCC features
  - Hugging Face pretrained model `Hatman/audio-emotion-detection` (wav2vec2-based), which is the actively wired path in `main.py`
- **Text**: Hugging Face `michellejieli/emotion_text_classifier` (DistilRoBERTa fine-tuned for emotion classification)
- **Image**: Delegated to `image_analyzer.py` (not inspected in detail, but referenced in `main.py` via the `vision` router)

Output format for all modalities:

```json
{
  "emotions": [
    { "type": "happy", "score": 0.82 },
    { "type": "neutral", "score": 0.11 }
  ],
  "dominantEmotion": "happy",
  "timestamp": "2026-03-04T12:00:00Z",
  "status": "success"
}
```

Emotion labels (7 classes): `angry`, `disgust`, `fear`, `happy`, `neutral`, `sad`, `surprise`

---

## 2. Tech Stack

| Component | Technology |
|-----------|-----------|
| API framework | FastAPI + uvicorn |
| Audio processing | librosa, ffmpeg, soundfile |
| Audio model (primary) | Hugging Face `Hatman/audio-emotion-detection` (wav2vec2) |
| Audio model (secondary) | Custom PyTorch Conv1D+LSTM, trained locally |
| Text model | Hugging Face `michellejieli/emotion_text_classifier` (DistilRoBERTa) |
| ML runtime | PyTorch, transformers, torchaudio, SpeechBrain |
| Containerization | Docker (python:3.10-slim + ffmpeg) |
| Config | pydantic-settings, python-dotenv |

Root `requirements.txt` contains only `graphviz==0.20.3` — a leftover from development. The actual dependency list is in `api/requirements.txt` and is comprehensive and correct.

---

## 3. Current State

**Partially working, with significant gaps.**

### What works:
- FastAPI app structure is clean and well-organized (`api/app/` directory)
- The HuggingFace audio path (`POST /api/v1/analyze/voice`) is fully implemented and self-contained — it downloads the pretrained model on first run, requires no separate trained `.pt` file, and should work out of the box
- Text analysis endpoint (`POST /api/v1/analyze/text`) is implemented and functional
- Dockerfile is present and mostly correct

### What is broken or missing:
1. **Custom PyTorch `.pt` model file is not in the repo** — `audio.py` router and `analyzer.py` service both depend on `/app/app/models/speech_emotion_recognition_model.pt` which must be trained locally using `main-pytorch.py` then placed in the image. Without it, the `POST /audio/analyze` endpoint fails at startup with a logged warning and returns 500 for every request. The HuggingFace path is the functional fallback.
2. **`main-pytorch.py` has a code duplication bug** — the `if __name__ == "__main__"` block calls `train_model` and `evaluate_model` twice. It also references `plt` and `sns` (matplotlib/seaborn) without importing them, so the training script crashes at the confusion matrix step.
3. **SPRINT_STATUS.md** shows Sprint 1 tasks are all unchecked — the project self-reports as incomplete.
4. **CORS is wide open** (`allow_origins=["*"]`, `allow_credentials=True`) — a security problem if deployed publicly.
5. **No auth** — the `emotion-analyses.md` documentation describes JWT auth but none is implemented in the FastAPI app. Every endpoint is publicly accessible.
6. **`data_path.csv` (730KB) and `features.csv` (79MB) are committed to git** — training artifacts that should not be in a deployable repo.
7. **.DS_Store committed** — no consequence but sloppy.
8. **SpeechBrain router (`speechbrain_audio.py`)** exists as a file but is not wired into `main.py` — dead code.

---

## 4. Deployment Feasibility on Coolify

**Technically deployable with the HuggingFace-only path. Practically expensive.**

### Pros:
- Dockerfile is present and structurally correct
- FastAPI + uvicorn is the standard Python microservice pattern
- HuggingFace model download is automatic on first run — no separate artifact upload needed
- Health check endpoint at `GET /health` exists

### Blockers before deploying:

1. **Dockerfile points to `api/requirements.txt` and `api/app/`** — this is correct. The root `requirements.txt` with only `graphviz` must be ignored. The Dockerfile `COPY api/requirements.txt .` and `COPY api/app ./app` are right.

2. **Memory requirement is high**: At container startup, the service will download and load two HuggingFace models simultaneously (wav2vec2 for audio, DistilRoBERTa for text). Combined weight is approximately 500-700MB RAM baseline. The Coolify server (89.47.113.196) needs at least 2GB free RAM to run this alongside the Go backend.

3. **Slow cold start**: First boot downloads the HuggingFace models from the internet. On a cold deploy this will take 2-5 minutes. Subsequent starts are fast if the models are cached in a Docker volume.

4. **No `MODEL_PATH` needed** for the HuggingFace path — but the config still tries to resolve it. The `audio.py` router logs a warning and continues if the `.pt` file is missing, so it does not crash the server.

5. **ffmpeg must be in the image** — it is, the Dockerfile installs it correctly.

6. **Port**: Container exposes 8000. Coolify would assign a subdomain + reverse proxy. No conflict with the Go backend on 8099.

### Steps to deploy:
1. Fix Dockerfile: the `CMD` references `app.main:app` which maps to `api/app/main.py` inside the container — correct as-is.
2. Set `MODEL_PATH` env var in Coolify to a nonexistent path so startup warning is predictable.
3. Add a Docker volume for HuggingFace model cache (`~/.cache/huggingface`) to survive redeploys.
4. Lock CORS to `https://api.vexellabspro.com` before deploying.

---

## 5. Integration with Daiyly

### Recommended endpoint to call:

**Audio (voice journal analysis):**
```
POST https://<emotionsenseml-host>/api/v1/analyze/voice
Content-Type: multipart/form-data
Body: file=<audio_file.m4a>
```

**Text (journal entry analysis):**
```
POST https://<emotionsenseml-host>/api/v1/analyze/text
Content-Type: application/json
Body: { "content": "Today I felt anxious about the presentation..." }

Note: the current router accepts `content` as a plain query param, not JSON body.
Verify the actual endpoint signature before wiring — it may be `?content=...`.
```

### Response shape to consume in Daiyly:
```json
{
  "emotions": [
    { "type": "sad", "score": 0.71 },
    { "type": "fear", "score": 0.18 },
    { "type": "neutral", "score": 0.07 }
  ],
  "dominantEmotion": "sad",
  "timestamp": "...",
  "status": "success"
}
```

Map `dominantEmotion` to a mood tag on the journal entry. Store `emotions` array for the insights screen (premium feature).

### Integration path in unified-backend:
The cleanest integration is to add a `daiyly` handler in `unified-backend` that:
1. Receives the journal entry text or audio upload from the app
2. Proxies to EmotionSenseML internally (server-to-server, no CORS issues)
3. Stores the result in Postgres alongside the journal entry
4. Returns the enriched entry to the app

This keeps the ML service internal and behind auth, rather than exposing it directly to mobile clients.

---

## 6. Value Assessment: Deploy vs. OpenAI Whisper + Sentiment

| Factor | EmotionSenseML | OpenAI Whisper + GPT sentiment |
|--------|---------------|-------------------------------|
| Cost | Near-zero (self-hosted) | ~$0.006/min Whisper + ~$0.002/1K tokens GPT-4o-mini |
| Latency | ~2-3s (audio), ~500ms (text) | ~3-5s (Whisper) + ~1s (GPT) |
| Accuracy | Unknown (no benchmark reported) | GPT-4o-mini emotion extraction is strong |
| Setup effort | Medium (Docker deploy, volume for model cache) | Low (API key in unified-backend) |
| Dependencies | Server RAM, model downloads | OpenAI uptime |
| Emotion granularity | 7 classes (fixed) | Flexible, can return richer nuance |
| Multilingual text | Partial (langdetect + English model) | Strong (GPT handles all languages) |
| Voice analysis | Yes (wav2vec2) | Whisper transcribes → text sentiment only |

### Verdict:

**Deploy EmotionSenseML only if voice-based emotion detection (paralinguistic — tone, pitch, not content) is a core Daiyly feature.** The wav2vec2 model detects emotion from acoustic properties of the voice, which OpenAI Whisper cannot do (Whisper only transcribes content).

For **text-only** emotion tagging of journal entries, skip this service entirely. Add a single GPT-4o-mini call in the unified-backend (`POST /daiyly/entries` → analyze text → store emotion tag). It is simpler, more accurate, multilingual, and costs fractions of a cent per entry.

For **voice journaling** (user speaks instead of types), EmotionSenseML adds genuine value because it captures how the user sounds emotionally, not just what they said. That is a differentiated feature no text-based analysis can replicate.

---

## 7. What Needs to Be Fixed Before Deploying

1. Remove `features.csv` (79MB) and `data_path.csv` from git history — they bloat the Docker build context.
2. Fix CORS: replace `allow_origins=["*"]` with an explicit allowlist.
3. Add a `HF_HOME` env var pointing to a Docker volume path so model weights persist across redeploys.
4. Verify `text` endpoint signature — current code uses `async def analyze_text(content: str)` which FastAPI will treat as a query parameter, not a JSON body. Add `request: TextAnalysisRequest` or use `Body(...)` if JSON is intended.
5. Add a startup event that pre-warms both HuggingFace models to avoid cold-start failures on first real request.
6. The `main-pytorch.py` training script is irrelevant for deployment — document clearly that it is offline training only and not part of the service.
