# TechPulse Pro: Research & Pre-Flight Log

This document tracks the research areas and current state validation required before proceeding with the Zero-Cost Azure migration.

## 🔍 Areas of Research

### 1. Memory Profiling (SentenceTransformers)
- **Objective**: Determine if `all-mpnet-base-v2` can be swapped for `all-MiniLM-L6-v2` without losing thematic accuracy.
- **Hypothesis**: The lightweight model (384-dim) will fit in Azure's 1.5GB RAM limit, while the larger model (768-dim) will cause OOM (Out of Memory) crashes.
- **Test Required**: Run both models on a sample of 100 articles and compare similarity scores.

### 2. Vector Indexing (pgvector)
- **Objective**: Decide on the indexing strategy for the `articles` table.
- **Research**: Compare `IVFFlat` (faster build, slightly lower accuracy) vs. `HNSW` (best performance, more memory usage).
- **Decision**: Since we are on a budget, `IVFFlat` is likely the starting point.

### 3. Queue Management (Upstash vs. Redis OSS)
- **Objective**: Verify that Upstash Redis Streams support the `XREADGROUP` command required by the existing `redis_client.py`.
- **Status**: Upstash supports the majority of Redis 6.2+ commands.

---

## 💾 Current State Validation (Checkpoint)

| Repo | Last Stable State | Pending Changes |
| :--- | :--- | :--- |
| **techpulse-web** | Functional dashboard with live Edge Functions. | CORS hardening & Schema updates. |
| **techpulse-ai** | Functional collector loop using local MPNET model. | Model swap to MiniLM & Supabase Vector integration. |

## 🛠️ Research To-Do List
- [ ] Create a benchmark script to measure RAM usage of `SentenceTransformer`.
- [ ] Research Azure Static Web Apps "Preview Environments" for zero-cost staging.
- [ ] Verify Supabase `anon` key permissions for `match_articles` RPC call.
