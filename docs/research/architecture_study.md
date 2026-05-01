# TechPulse Pro: Architecture and Intelligence Study Guide

This document provides a "Full Picture" analysis of the TechPulse Pro platform, designed for research and architectural study.

---

## 1. The Intelligence Pipeline (Data Flow)

The system is built as a **Decoupled Event-Driven Pipeline**. Each stage is independent, connected by **Redis**.

### Stage A: Discovery & Deduplication
- **Tool**: Python (Collector Service) + Redis.
- **Process**: The collector polls RSS feeds. It generates an MD5 hash of every URL.
- **Logic**: It checks Redis (`EXISTS seen:url_hash`). If it exists, the article is ignored. This prevents "News Fatigue" and saves processing costs.
- **Queueing**: New URLs are pushed to a **Redis Stream** (`XADD`).

### Stage B: Enrichment & Embedding
- **Tool**: Python (Enricher/Summarizer) + SentenceTransformers.
- **The Intelligence**: The summarizer pulls from the Redis stream. 
- **Embeddings**: It uses `all-MiniLM-L6-v2` to turn text into a **384-dimensional vector** (a list of 384 numbers). 
    - *Research Note*: These numbers represent "Semantic Meaning." Two articles about "React Hooks" will have vectors that are mathematically close to each other.
- **Storage**: The text, metadata, and vector are saved to **Supabase**.

---

## 2. RAG: Retrieval Augmented Generation

This is the "Brain" of your platform. It allows the AI to answer questions based *only* on your collected data.

### The Mechanism:
1. **The Question**: A user asks "What's new in Rust today?"
2. **Vectorization**: The system turns that question into a 384-dim vector using the *same* model.
3. **Similarity Search**: It runs a SQL query in Supabase: 
   ```sql
   SELECT content FROM articles 
   ORDER BY embedding <=> question_vector 
   LIMIT 5;
   ```
   *Note: `<=>` is the Cosine Distance operator in pgvector.*
4. **Augmentation**: It takes those 5 articles and "stuffs" them into an LLM prompt:
   *"Using only these 5 articles, answer the user's question: [Question]"*

---

## 3. The Zero-Cost Cloud Map (Azure + Supabase)

To run this for $0, we exploit the "Always Free" tiers of modern cloud providers.

### A. Frontend (Static)
- **Azure Static Web Apps**: Free forever. It only serves HTML/JS/CSS. It doesn't need a running server, so it costs nothing.

### B. Backend Logic (Reactive)
- **Supabase Edge Functions**: These only run when a user clicks a button. Since they are "Serverless," you aren't charged for idle time.

### C. AI Agents (Proactive)
- **Azure Functions (Python)**: These run on a **Timer Trigger**. They wake up every hour, process the news, and go back to sleep.
- **Optimization**: We use a "Lightweight Model" (~80MB) so it fits in the free 1.5GB RAM slot.

---

## 4. The Open Source Philosophy (Current vs. Future)

TechPulse Pro is built on an **"Open Core"** philosophy. While we use managed cloud services today for $0 cost, every component can be replaced with its purely Open Source equivalent.

| Component | Managed (Current $0) | Sovereign (The OSS Future) |
| :--- | :--- | :--- |
| **Database** | Supabase Cloud (Postgres) | **Self-Hosted Supabase / Postgres** |
| **Vector Engine** | Supabase (pgvector) | **pgvector** or **Qdrant (OSS)** |
| **AI Inference** | Groq / OpenAI API | **Ollama** or **vLLM** (Local Models) |
| **Embeddings** | SentenceTransformers (Local) | **SentenceTransformers** (Unchanged) |
| **Queue** | Upstash Redis | **Redis (Docker)** |
| **Hosting** | Azure Static Web Apps | **Nginx / Docker Compose** |

---

## 5. The "Sovereign" Roadmap: Full Self-Hosting

If you choose to leave the cloud and own 100% of your infrastructure, here is the architectural blueprint:

### A. The Containerized Core
You would use **Docker Compose** to manage the entire stack on a single Linux machine.
- **`docker-compose.yml`**: Defines containers for Postgres, Redis, your React App, and your Python Agents.
- **Benefit**: One command (`docker-compose up -d`) starts the entire world.

### B. Local AI Inference (Ollama)
Instead of calling Groq, you would run **Ollama** on your Linux server.
- **Model**: `Llama-3-8B` or `Mistral`.
- **Privacy**: No intelligence ever leaves your hardware.
- **Cost**: 100% Free (Forever), limited only by your hardware power.

### C. Nginx Reverse Proxy
Instead of Azure Static Web Apps, you would use **Nginx** as a Gateway.
- Handles SSL (via Let's Encrypt).
- Routes traffic to your React container.
- Protects your Edge Functions.

---

## 6. Local vs. Production vs. Sovereign Comparison

| Feature | Local Dev | Managed Cloud (Current) | Sovereign (Self-Hosted) |
| :--- | :--- | :--- | :--- |
| **Cost** | $0 | $0 (Free Tiers) | ~$10-$20 (VPS Cost) |
| **Complexity** | Low | Low | Medium (Linux Admin req.) |
| **Privacy** | High | Medium (Cloud APIs) | **Ultimate** |
| **Scalability** | Laptop Only | Global Edge | Vertical (More RAM) |

---

## 7. Scaling & Future Research

**Question: What happens if we get 1,000,000 articles?**
- **Database**: Postgres might slow down. We would add an **HNSW Index** to pgvector to speed up search.
- **Queue**: Redis might fill up. We would move from "In-memory" Redis to a managed "Disk-backed" cluster.
- **Intelligence**: We might move from a local model to **Azure OpenAI Service** for higher accuracy.

---

**Study Recommendation**: To truly understand the "Full Picture," look at how [redis_client.py](file:///home/vishnu/worklab/techpulse-ai/src/shared/redis_client.py) uses **Streams**. This is the most complex part of the system and handles the "hand-off" between your discovery and your intelligence.
