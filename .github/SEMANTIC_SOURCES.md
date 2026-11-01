# Semantic sources: defaults and calibration (#86, ADR 0003)

## Settings (Settings > API > Semantic similarity)
| Setting | Default | Meaning |
| --- | --- | --- |
| Use embeddings | off | Site Focus and Topical Authority run on TF-IDF and report `tfidf-only`. |
| Source | `ollama` | `hybrid` blends the offline local hash with Ollama. |
| Ollama address | empty | Empty means `http://127.0.0.1:11434`. LAN addresses are allowed. |
| Model | `nomic-embed-text` | SEOmi never installs or pulls a model. |
| Timeout per batch | 30 000 ms | Slow provider falls back, never blocks the report. |
| Most pages per run | 500 | Remaining pages stay TF-IDF only. |

Page text sent to the embedder is the title, first H1 and meta description (at most 600 characters). It goes only
to the address you configured. Vectors are cached in memory per project and model for the session, never on disk.

## Fallbacks
Ollama missing, offline, wrong model, timeout, cancel or an unusable vector all return to TF-IDF. The report keeps
its `similaritySource` (`tfidf-only`), and the Settings test button names the reason.

## Similarity thresholds (D02)
Thresholds are per model kind and never reused across kinds (`DEFAULT_SIMILARITY_THRESHOLDS`):
`local-hash` 0.12, `neural` 0.6, `hybrid` 0.35. A kind without a value returns null and the lexical path is used.
- `local-hash` is verified in CI on a pinned fixture (`tests/similarityCalibration.test.ts`).
- `neural` and `hybrid` are defaults for `nomic-embed-text`-class models and need a real Ollama to confirm.

## Manual protocol for a real Ollama (T01)
1. `ollama serve` and `ollama pull nomic-embed-text`. Enable embeddings in Settings and press the test button: expect
   "Works" with the model and dimensions.
2. Stop Ollama and press the test button again: expect "Ollama is not reachable" and a TF-IDF report.
3. Set a model name that is not installed: expect "model not installed".
4. Run the fixture pairs from `tests/similarityCalibration.test.ts` through your model. Keep the threshold only when
   every related pair is at or above it and every unrelated pair below. Otherwise set a model-specific value.
