"""RepoMind FastAPI backend with persistent local report caching.

Existing API routes and response fields are preserved. Successful reports are
cached on disk so repeated expo demonstrations do not repeatedly call GitHub
or Groq. Send {"refresh": true} to any report endpoint to force a fresh run.
"""

import asyncio
import base64
import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Awaitable, Callable

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Resolve .env relative to this file. This also avoids dotenv auto-discovery
# issues when running short Python scripts from the terminal.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

app = FastAPI(title="RepoMind API", docs_url="/swagger")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

GH = "https://api.github.com"
MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
URL_RE = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")
CACHE_DIR = BASE_DIR / ".repomind_cache"
CACHE_TTL_SECONDS = max(60, int(os.getenv("REPOMIND_CACHE_TTL_SECONDS", "86400")))
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class RepoReq(BaseModel):
    url: str
    refresh: bool = Field(default=False, description="Set true to bypass the saved report and run a fresh analysis")


def parse(url: str) -> tuple[str, str]:
    match = URL_RE.match(url.strip())
    if not match:
        raise HTTPException(400, "Enter a URL like https://github.com/owner/repo")
    return match.group(1), match.group(2)


def _cache_file(feature: str, url: str) -> Path:
    owner, repo = parse(url)
    stable_url = f"{owner.lower()}/{repo.lower()}"
    digest = hashlib.sha256(f"{feature}:{stable_url}".encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.json"


_cache_locks: dict[str, asyncio.Lock] = {}


async def cached_report(
    feature: str,
    url: str,
    builder: Callable[[], Awaitable[dict[str, Any]]],
    refresh: bool = False,
) -> dict[str, Any]:
    """Return a saved report if fresh; otherwise build and persist one."""
    cache_file = _cache_file(feature, url)
    lock_key = str(cache_file)
    lock = _cache_locks.setdefault(lock_key, asyncio.Lock())

    async with lock:
        if not refresh and cache_file.exists():
            try:
                saved = json.loads(cache_file.read_text(encoding="utf-8"))
                age = max(0, int(time.time() - saved["saved_at"]))
                if age <= CACHE_TTL_SECONDS:
                    data = saved["data"]
                    return {
                        **data,
                        "_cache": {"hit": True, "age_seconds": age, "ttl_seconds": CACHE_TTL_SECONDS},
                    }
            except (OSError, ValueError, KeyError, TypeError):
                # A damaged cache entry is ignored and rebuilt below.
                pass

        result = await builder()
        envelope = {"saved_at": time.time(), "data": result}
        temporary = cache_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(envelope, ensure_ascii=False), encoding="utf-8")
        temporary.replace(cache_file)
        return {
            **result,
            "_cache": {"hit": False, "age_seconds": 0, "ttl_seconds": CACHE_TTL_SECONDS},
        }


async def gh(client: httpx.AsyncClient, path: str) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoMind-WT-Expo",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = await client.get(GH + path, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not reach GitHub. Check your internet connection.") from exc

    if response.status_code == 404:
        raise HTTPException(404, "Repository not found or private. Check the public GitHub URL.")
    if response.status_code in (403, 429):
        reset = response.headers.get("X-RateLimit-Reset")
        message = "GitHub rate limit reached. Your cached reports remain available."
        if reset and reset.isdigit():
            message += f" Rate limit reset timestamp: {reset}."
        raise HTTPException(429, message)
    if response.status_code >= 400:
        raise HTTPException(502, f"GitHub returned HTTP {response.status_code}.")
    return response.json()


async def ask(system: str, data: str) -> dict[str, str]:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(500, "GROQ_API_KEY is not configured in backend/.env.")

    rate_limited = False
    last_error = None
    async with httpx.AsyncClient(timeout=75) as client:
        for model in MODELS:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": data[:24000]},
                        ],
                    },
                )
                if response.status_code == 200:
                    content = response.json()["choices"][0]["message"]["content"]
                    return {"model": model, "text": content}
                if response.status_code == 429:
                    rate_limited = True
                    last_error = response.headers.get("retry-after", "")
                    continue
                if response.status_code in (401, 403):
                    raise HTTPException(502, "Groq rejected the API key or model access. Check your Groq configuration.")
                last_error = f"HTTP {response.status_code}"
            except httpx.HTTPError as exc:
                last_error = str(exc)
                continue

    if rate_limited:
        suffix = f" Retry after {last_error} seconds." if last_error else ""
        raise HTTPException(429, "Groq rate limit reached for both configured models. Use a saved Expo Demo report or retry later." + suffix)
    raise HTTPException(502, f"Groq AI is temporarily unavailable. {last_error or 'Please retry later.'}")


async def context(url: str, with_commits: bool = False):
    owner, name = parse(url)
    async with httpx.AsyncClient(timeout=25) as client:
        meta = await gh(client, f"/repos/{owner}/{name}")
        tree = await gh(client, f"/repos/{owner}/{name}/git/trees/{meta['default_branch']}?recursive=1")
        paths = [item["path"] for item in tree.get("tree", []) if item.get("type") == "blob"]

        try:
            readme_data = await gh(client, f"/repos/{owner}/{name}/readme")
            readme = base64.b64decode(readme_data.get("content", "")).decode("utf-8", "ignore")
        except HTTPException as exc:
            if exc.status_code == 404:
                readme = ""
            else:
                raise

        commits = []
        if with_commits:
            recent = await gh(client, f"/repos/{owner}/{name}/commits?per_page=5")
            for commit in recent:
                detail = await gh(client, f"/repos/{owner}/{name}/commits/{commit['sha']}")
                commits.append({
                    "sha": commit["sha"][:7],
                    "message": commit["commit"]["message"].split("\n")[0],
                    "files": [
                        {"file": file["filename"], "+": file.get("additions", 0), "-": file.get("deletions", 0)}
                        for file in detail.get("files", [])[:30]
                    ],
                })

    directories: dict[str, int] = {}
    for path in paths:
        directory = path.split("/")[0] if "/" in path else "(root)"
        directories[directory] = directories.get(directory, 0) + 1

    stats = {
        "name": meta["full_name"],
        "description": meta.get("description"),
        "language": meta.get("language"),
        "stars": meta.get("stargazers_count", 0),
        "files": len(paths),
        "directories": dict(sorted(directories.items(), key=lambda item: -item[1])[:12]),
    }
    return stats, paths, readme, commits


def blob(stats: dict, paths: list[str], readme: str, commits: list) -> str:
    return f"META:{stats}\nFILES(first 300):{paths[:300]}\nREADME:{readme[:6000]}\nCOMMITS:{commits}"


@app.get("/health")
def health():
    return {"ok": True, "cache_enabled": True, "cache_ttl_seconds": CACHE_TTL_SECONDS}


@app.get("/cache/status")
def cache_status():
    files = list(CACHE_DIR.glob("*.json"))
    return {"enabled": True, "entries": len(files), "ttl_seconds": CACHE_TTL_SECONDS}


@app.post("/analyze")
async def analyze(request: RepoReq):
    async def build():
        stats, paths, readme, _ = await context(request.url)
        ai = await ask(
            "You are a senior software engineer. Summarise this repository in clear Markdown: purpose, architecture, main directories, important files, strengths and notable observations. Use only the supplied repository data. Do not invent facts.",
            blob(stats, paths, readme, []),
        )
        return {"stats": stats, "analysis": ai}
    return await cached_report("analyze", request.url, build, request.refresh)


@app.post("/docs")
async def docs(request: RepoReq):
    async def build():
        stats, paths, readme, _ = await context(request.url)
        doc_files = [path for path in paths if path.lower().endswith((".md", ".rst")) or path.lower().startswith("docs/")]
        ai = await ask(
            "Assess this repository's documentation in Markdown: README strengths, missing sections, quality observations and concrete improvements. Use only the supplied data. State when evidence is limited.",
            blob(stats, paths, readme, []),
        )
        return {"readme_chars": len(readme), "doc_files": doc_files[:30], "analysis": ai}
    return await cached_report("docs", request.url, build, request.refresh)


@app.post("/impact")
async def impact(request: RepoReq):
    async def build():
        stats, paths, readme, commits = await context(request.url, True)
        ai = await ask(
            "Explain the impact and scope of the supplied recent commits in Markdown: affected areas, potential risk and what to test. Use only the supplied evidence; do not claim certainty where evidence is limited.",
            blob(stats, paths, readme, commits),
        )
        return {"commits": commits, "analysis": ai}
    return await cached_report("impact", request.url, build, request.refresh)


@app.post("/firstpr")
async def firstpr(request: RepoReq):
    async def build():
        stats, paths, readme, _ = await context(request.url)
        ai = await ask(
            "Suggest 3-5 beginner-friendly first contributions in Markdown. Include relevant file paths from the supplied file list and explain why each is suitable. Use only supplied evidence.",
            blob(stats, paths, readme, []),
        )
        return {"analysis": ai}
    return await cached_report("firstpr", request.url, build, request.refresh)


@app.post("/drift")
async def drift(request: RepoReq):
    async def build():
        stats, paths, readme, commits = await context(request.url, True)
        ai = await ask(
            "Identify possible code drift in Markdown: structural changes in recent commits and places where the README may no longer match the code. Use only supplied evidence and explicitly say when evidence is limited.",
            blob(stats, paths, readme, commits),
        )
        return {"commits": commits, "analysis": ai}
    return await cached_report("drift", request.url, build, request.refresh)
