# TechPulse AI: Engine Research & Logic Guide

This document serves as a research foundation for the `techpulse-ai` repository, documenting the current logic and the areas of study required for the production transition.

---

## 1. Existing Service Architecture

The AI engine is composed of 5 core services working in a **Consumer-Provider** model via Redis.

| Service | Logic Source | Key Research Area |
| :--- | :--- | :--- |
| **Collector** | `collector/main.py` | Optimizing RSS polling frequency to stay within Azure Timer Trigger limits. |
| **Enricher** | `enricher/embedder.py` | Measuring accuracy trade-off when moving from 768-dim to 384-dim embeddings. |
| **Summarizer** | `summarizer/main.py` | Prompt engineering for Groq/Llama-3 to ensure consistent JSON article analysis. |
| **Ranker** | `ranker/main.py` | Fine-tuning the scoring algorithm (Source Quality vs. Topic Match). |
| **Delivery** | `delivery/main.py` | Researching Slack/Discord webhook reliability in a serverless environment. |

---

## 2. Intelligence Research: The Embedding Dilemma

Currently, the engine uses **SentenceTransformers** locally. 

### Research Goal: "Memory vs. Meaning"
- **Current Model**: `all-mpnet-base-v2` (High accuracy, 420MB, 768-dim).
- **Proposed Model**: `all-MiniLM-L6-v2` (Medium accuracy, 80MB, 384-dim).
- **Task**: We need to study if the 384-dim vector is sufficient to cluster articles about "Generative AI" vs "LLMs" accurately.

---

## 3. Infrastructure Research: Redis Streams

The system uses **Upstash Redis** as a message broker.
- **Current State**: Uses `XREADGROUP` for robust task management.
- **Research Goal**: Ensure the Azure Function (which is short-lived) can correctly `ACK` (acknowledge) messages before the function times out.

---

## 4. Open Source Sovereignty Path

To move to a 100% Open Source (Sovereign) AI stack:
1. **Model**: Research **Ollama** integration.
2. **Database**: Research self-hosting **pgvector** on a Linux server.
3. **Orchestration**: Study the move from **Azure Functions** to a simple **Python Cron container**.

---

**Next Research Step**: I recommend running a profiling script on the `Enricher` service to measure the exact RAM peak during an embedding cycle. This will provide the data needed to finalize the Azure hosting decision.
