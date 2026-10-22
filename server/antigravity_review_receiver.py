#!/usr/bin/env python3
"""
Hermes Antigravity Background Review Receiver (V2.0 - High-Fidelity Engine)
Port: 9125
Receives post-turn transcript events from Antigravity IDE (hooks.json Stop event).

Upgraded to 100% parity with Hermes native background_review.py:
1. Hermes Signal Boundary (_LESSON_LAYER_BLOCK & _DO_NOT_CAPTURE_BLOCK)
   - First-Class Signal: User frustration, corrections, standing preferences.
   - Strict ban on unresolved failures, transient errors, environment state.
2. Smart Structural Patcher (Read-Before-Write)
   - Preserves YAML frontmatter intact.
   - Deduplicates rules before insertion.
   - Contextual insertion under '## ⚠️ Pitfalls & Edge Cases' or SOP sections.
3. Dual-Target Routing (Skills vs Mnemosyne Memory)
   - Procedural workflows -> skills/<target>/SKILL.md (GitLab rules-agents-agus)
   - Architectural facts / behavioral rules -> Mnemosyne Canonical Memory (:8080)
"""

import os
import sys
import re
import json
import html
import time
import uuid
import queue
import logging
import threading
from pathlib import Path
import urllib.request
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# Logging setup
LOG_DIR = "/home/agus/.hermes/logs"
CACHE_DIR = "/home/agus/.hermes/cache/antigravity_reviews"
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

LOG_FILE = os.path.join(LOG_DIR, "antigravity_review.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("antigravity-reviewer")

# Internal Work Queue
review_queue = queue.Queue()

# Load Config
def load_hermes_config():
    config_path = "/home/agus/.hermes/config.yaml"
    try:
        import yaml
        with open(config_path) as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.warning(f"Failed to load yaml config: {e}")
        return {}

CONFIG = load_hermes_config()
MODEL_CFG = CONFIG.get("model", {})
LLM_BASE_URL = MODEL_CFG.get("base_url", "http://172.168.1.202:20130/v1")
LLM_API_KEY = MODEL_CFG.get("api_key", "")
LLM_MODEL = MODEL_CFG.get("default", "agus-stack")

GITLAB_TOKEN = CONFIG.get("mcp_servers", {}).get("gitlab", {}).get("env", {}).get("GITLAB_PERSONAL_ACCESS_TOKEN", "")
GITLAB_URL = "http://172.168.1.33"
GITLAB_PROJECT_ID = 84
GITLAB_BRANCH = "main"
MNEMOSYNE_URL = "http://127.0.0.1:8080/sse"

RECENT_EVENTS_FILE = Path("/home/agus/.hermes/cache/recent_evolution_events.json")

def record_evolution_event(event_dict):
    try:
        events = []
        if RECENT_EVENTS_FILE.exists():
            try:
                events = json.loads(RECENT_EVENTS_FILE.read_text(encoding="utf-8"))
            except Exception:
                events = []
        events.insert(0, event_dict)
        events = events[:100]
        RECENT_EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        RECENT_EVENTS_FILE.write_text(json.dumps(events, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        logger.error(f"Failed to record evolution event: {e}")

# Telegram Bot Helpers
def get_telegram_config():
    bot_token = os.environ.get("EVALUATOR_BOT_TOKEN")
    chat_id = os.environ.get("EVALUATOR_CHAT_ID")
    if not bot_token or not chat_id:
        try:
            with open("/home/agus/.hermes/.env") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("EVALUATOR_BOT_TOKEN="):
                        bot_token = bot_token or line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif line.startswith("EVALUATOR_CHAT_ID="):
                        chat_id = chat_id or line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    # Fallback to Hermes default bot if evaluator not configured
    if not bot_token:
        bot_token = os.environ.get("ALERT_BOT_TOKEN")
        try:
            with open("/home/agus/.hermes/.env") as f:
                for line in f:
                    if line.startswith("TELEGRAM_BOT_TOKEN="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            bot_token = val
                            break
        except Exception:
            pass
    if not chat_id:
        chat_id = "1254166905"
    return bot_token, chat_id


def send_telegram_notification(message: str):
    token, chat_id = get_telegram_config()
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("[TELEGRAM] Notification delivered successfully.")
    except urllib.error.HTTPError as e:
        if e.code == 400:
            try:
                payload.pop("parse_mode", None)
                req_fallback = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req_fallback, timeout=10):
                    logger.info("[TELEGRAM] Delivered with plain-text fallback.")
            except Exception as e_fb:
                logger.error(f"[TELEGRAM] Plain-text fallback failed: {e_fb}")
        else:
            logger.error(f"[TELEGRAM] Failed to send notification: {e}")
    except Exception as e:
        logger.error(f"[TELEGRAM] Failed to send notification: {e}")


# =====================================================================
# HERMES EVALUATION PROMPTS & SIGNAL RULES
# =====================================================================
_DO_NOT_CAPTURE_BLOCK = """
WHAT NOT TO PERSIST AS A SKILL:
  • Environment-dependent failures: missing binaries, fresh-install errors, path mismatches, 'command not found', unconfigured credentials, uninstalled packages.
  • Negative claims about tools or features ('browser tools do not work', 'X tool is broken', 'cannot use Y').
  • Session-specific transient errors that resolved before the turn ended. If retrying worked, the lesson is the retry pattern, not the original failure.
  • One-off task narratives ('summarize file X', 'audit ticket #123').
  • UNRESOLVED FAILURES: if the turn ended WITHOUT actually finding a working method (the agent tried things, none worked, and gave up or asked user to check manually), do NOT write those attempts as best practice. Output has_lesson: false.
"""

_LESSON_LAYER_BLOCK = """
WHAT A SKILL / PITFALL IS (PARENT-CHILD PROGRESSIVE DISCLOSURE ARCHITECTURE):
  • Procedure first: concrete commands, tool calls, and decision points.
  • A pitfall is an imperative generalizable rule + one clause of WHY (mechanism). Example: 'Always check INFORMATION_SCHEMA.STATISTICS before ALTER TABLE to avoid table rebuild MDL-X lock.' NOT a narrative of what happened this session.
  • No PR/issue numbers, dates, ticket IDs, or quoted session text.
  • LEAN ROOT ENTRYPOINT: SKILL.md is strictly a high-level manifest (< 80-100 lines). Never dump large multi-paragraph runbooks or dozens of duplicate pitfalls into SKILL.md.
  • CHILD REFERENCES FOR DEEP RUNBOOKS: Deep domain details, specialized query traps, or complex workflows belong in child reference files: 'skills/<skill-name>/references/<subtopic-slug>.md'.
    Example:
      Root: skills/simgos2-db-audit/SKILL.md
      Child 1: skills/simgos2-db-audit/references/charset_and_patch_discipline.md
      Child 2: skills/simgos2-db-audit/references/inpatient_occupancy_queries.md
  • SYNTHESIZE & CONSOLIDATE: The same lesson learned twice is ONE rule. Strengthen existing rules rather than creating duplicate copies with slight wording variations.
"""

_SIGNAL_CRITERIA_BLOCK = """
SIGNALS TO LOOK FOR:
  1. USER CORRECTIONS & FRUSTRATION (FIRST-CLASS SIGNAL): User said 'stop doing X', 'don't assume Y', 'format salah', 'jangan kaku', 'gunakan metode Z'. These MUST be captured immediately either into the governing SKILL.md or Mnemosyne behavior rule.
  2. WORKAROUND / NEW OPERATIONAL FIX: A tricky bug was solved with a proven technical workaround (e.g. database query, Laminas service, ExtJS component, API bridging).
  3. ARCHITECTURAL / INVARIANT FACT: A core server truth, port mapping, or project constraint was established. Route this to Mnemosyne canonical memory.
"""


def call_llm_evaluator(transcript_tail: str) -> dict:
    """Invokes Hermes LLM with full Hermes-standard signal boundary and routing."""
    if not transcript_tail or len(transcript_tail.strip()) < 30:
        return {"has_lesson": False, "reason": "Transcript tail too short"}

    # Take the TAIL (most recent 7000 characters) where the latest actions/decisions occurred
    tail_snippet = transcript_tail[-7000:] if len(transcript_tail) > 7000 else transcript_tail

    prompt = f"""You are the autonomous self-improvement review evaluator for SIMGOSv2 / RSUD dr. H. Jusuf SK.
Review the following transcript tail from an Antigravity IDE coding turn.

{_SIGNAL_CRITERIA_BLOCK}
{_LESSON_LAYER_BLOCK}
{_DO_NOT_CAPTURE_BLOCK}

TRANSCRIPT TAIL:
```
{tail_snippet}
```

Respond STRICTLY with a valid JSON object matching one of these structures:

If NO actionable technical lesson / trivial chat / unresolved failure:
{{"has_lesson": false, "reason": "explanation why skipped"}}

If YES, you may output 1 or more actions routed to skills or memory:
{{
  "has_lesson": true,
  "actions": [
    {{
      "type": "skill",
      "target_file": "skills/<skill-name>/references/<topic_slug>.md OR skills/<new-skill-name>/SKILL.md",
      "description": "Required when creating a new skill root (skills/<new-skill-name>/SKILL.md): 'Use this skill when dealing with...'",
      "title": "Imperative Rule Title",
      "rule": "Imperative rule stating exact action",
      "why": "Mechanism clause explaining why this prevents failure",
      "section": "pitfalls"
    }},
    {{
      "type": "memory",
      "category": "architecture_policy",
      "name": "snake_case_fact_name",
      "body": "Clear authoritative statement of the fact/rule."
    }}
  ]
}}

SKILL ROUTING POLICY (MANDATORY RULES FOR target_file):
1. DEEP OPERATIONAL PLAYBOOKS BELONG IN CHILD REFERENCES:
   If the rule expands on an existing skill, ALWAYS reuse and patch an existing child reference file if the topic matches!
   
   CURRENT ACTIVE SKILLS & EXISTING REFERENCES (PATCH/REUSE THESE FIRST):
   - simgos2-frontend-extjs:
     * skills/simgos2-frontend-extjs/references/plugin_overrides.md (ExtJS overrides, zero-dirty-core, fe/overrides vs classic/overrides, addFields, proxy isolation)
     * skills/simgos2-frontend-extjs/references/widget_and_plugin_overrides.md (dockedItems, ViewModel binding, modal windows)
     * skills/simgos2-frontend-extjs/references/standalone_runners_and_apache_alias.md (/apps/ URL, test runners, buildx)
   - simgos2-clean-code-validator:
     * skills/simgos2-clean-code-validator/references/laminas_backend_conventions.md (Laminas backend conventions, controller actions)
     * skills/simgos2-clean-code-validator/references/laminas_service_factories.md (Service composition, Factory patterns)
   - simgos2-db-audit:
     * skills/simgos2-db-audit/references/charset_and_patch_discipline.md (DB charset, patch numbering)
     * skills/simgos2-db-audit/references/dbservice_param_sanitization.md (DBService SQL injection & sanitization)
     * skills/simgos2-db-audit/references/inpatient_occupancy_queries.md (Complex inpatient queries)
   - simgos2-core-blueprint:
     * skills/simgos2-core-blueprint/references/core_isolation_and_overrides.md
     * skills/simgos2-core-blueprint/references/backend_entity_overrides.md
     * skills/simgos2-core-blueprint/references/plugin_backend_overrides.md
   - simgos2-audit-trail:
     * skills/simgos2-audit-trail/references/audit_widget_integration.md
   - git-upstream-sync:
     * skills/git-upstream-sync/references/commit_discipline.md
     * skills/git-upstream-sync/references/commit_workflow.md
     * skills/git-upstream-sync/references/core_isolation.md
   - gitlab-issue-tracker:
     * skills/gitlab-issue-tracker/references/issue_attachments.md
   - mnemosyne-memory-sync:
     * skills/mnemosyne-memory-sync/SKILL.md
   - satusehat-sp-sync:
     * skills/satusehat-sp-sync/SKILL.md
   - simgos2-mutu-inm:
     * skills/simgos2-mutu-inm/SKILL.md

   CRITICAL ANTI-DUPLICATION DIRECTIVE:
   DO NOT invent new reference file names if an existing reference file covers the subject domain!
   ALWAYS target one of the existing reference files listed above whenever the rule relates to its domain.
   Only generate a new 'skills/<skill>/references/<topic_slug>.md' if the technical topic is completely novel and unrepresented above.

2. DISTINCT FUNCTIONAL DOMAINS BELONG IN NEW DEDICATED SKILLS:
   If the rule introduces a completely new domain, set target_file to:
   'skills/<new-domain-kebab-case>/SKILL.md' and provide a descriptive 'description' field.

3. ROOT SKILL.md IS ONLY FOR CORE INVARIANTS:
   Only route to root 'skills/<skill>/SKILL.md' if it is a top-level procedural command or high-level non-negotiable invariant.
"""

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You are a precise procedural knowledge extraction engine. Output strictly raw JSON, no markdown formatting."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
        "stream": False
    }

    req = urllib.request.Request(
        f"{LLM_BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw_text = resp.read().decode("utf-8").strip()
            if raw_text.startswith("data:"):
                chunks = []
                for line in raw_text.splitlines():
                    line = line.strip()
                    if line.startswith("data:"):
                        chunk_str = line[5:].strip()
                        if chunk_str and chunk_str != "[DONE]":
                            try:
                                chunk_json = json.loads(chunk_str)
                                delta = chunk_json.get("choices", [{}])[0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    chunks.append(delta["content"])
                            except Exception:
                                pass
                content = "".join(chunks).strip()
            else:
                data = json.loads(raw_text)
                content = data["choices"][0]["message"]["content"].strip()

            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            return json.loads(content)
    except Exception as e:
        logger.error(f"LLM evaluator error: {e}")
        return {"has_lesson": False, "error": str(e)}


# =====================================================================
# SMART STRUCTURAL PATCHER (READ-BEFORE-WRITE)
# =====================================================================
SEMANTIC_STOPWORDS = {
    "the", "a", "an", "in", "on", "of", "for", "to", "and", "with", "from", "by", "is", "at", "as",
    "into", "or", "not", "do", "does", "use", "using", "when", "always", "never", "should", "must",
    "di", "ke", "dari", "pada", "untuk", "dan", "dengan", "oleh", "yang", "ini", "itu", "agar", "bisa", "dapat"
}

SEMANTIC_SYNONYMS = {
    "omit": "exclude", "avoid": "exclude", "remove": "exclude", "strip": "exclude",
    "permissions": "access", "permission": "access", "rights": "access", "grants": "access",
    "roles": "access", "role": "access", "privilege": "access", "privileges": "access",
    "patches": "patch", "migrations": "patch", "migration": "patch", "scripts": "patch", "script": "patch",
    "directories": "directory", "folders": "directory", "folder": "directory",
    "numeric": "numeric", "numbers": "numeric",
    "columns": "column", "add": "column",
    "idempotent": "idempotency", "idempotency": "idempotency",
    "runners": "runner", "example": "runner", "examples": "runner"
}


def tokenize_semantic(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z0-9_]+", text.lower())
    tokens = set()
    for w in words:
        if len(w) > 2 and w not in SEMANTIC_STOPWORDS:
            tokens.add(SEMANTIC_SYNONYMS.get(w, w))
    return tokens


def validate_skill_syntax(content: str, file_path: str) -> tuple[bool, str, str]:
    """
    Validates and auto-repairs Markdown/YAML syntax before committing to GitLab:
    1. Normalizes all line breaks to standard Unix LF.
    2. If SKILL.md: verifies YAML frontmatter has name and description.
    3. Verifies code block backtick balance (auto-closes if unbalanced).
    4. Auto-repairs malformed heading syntax (e.g. '###Heading' -> '### Heading').
    5. Ensures clean trailing newline.
    Returns: (is_valid, sanitized_content, error_or_warning_msg)
    """
    if not content or not content.strip():
        return False, "", "Content is empty"

    sanitized = content.replace("\r\n", "\n").replace("\r", "\n")
    is_skill_root = file_path.endswith("SKILL.md")

    # 1. Frontmatter check for root SKILL.md
    if is_skill_root:
        if not sanitized.startswith("---"):
            return False, sanitized, "SKILL.md missing opening YAML frontmatter '---'"
        parts = sanitized.split("---", 2)
        if len(parts) < 3:
            return False, sanitized, "SKILL.md frontmatter is unclosed (missing closing '---')"
        fm_text = parts[1]
        try:
            import yaml
            parsed_fm = yaml.safe_load(fm_text)
            if not isinstance(parsed_fm, dict):
                return False, sanitized, "SKILL.md frontmatter must be a YAML mapping/dict"
            if "name" not in parsed_fm:
                return False, sanitized, "SKILL.md frontmatter missing required field: 'name'"
            if "description" not in parsed_fm:
                return False, sanitized, "SKILL.md frontmatter missing required field: 'description'"
        except Exception as e:
            return False, sanitized, f"Invalid YAML frontmatter: {e}"

    # 2. Check for unbalanced code blocks (triple backticks)
    code_block_count = len(re.findall(r"^```", sanitized, flags=re.MULTILINE))
    if code_block_count % 2 != 0:
        logger.warning(f"[VALIDATOR] Unbalanced code blocks detected ({code_block_count} backticks). Auto-closing.")
        sanitized = sanitized.rstrip() + "\n```\n"

    # 3. Clean up broken headers (e.g. '###Something' without space)
    sanitized = re.sub(r'^(#{1,6})([^\s#])', r'\1 \2', sanitized, flags=re.MULTILINE)

    # 4. Ensure single trailing newline
    sanitized = sanitized.rstrip() + "\n"

    return True, sanitized, "OK"


def apply_structural_patch(existing_md: str, title: str, rule: str, why: str, is_new: bool = False) -> str:
    """
    Applies a clean structural markdown patch:
    - Preserves YAML frontmatter intact.
    - Checks for rule deduplication via exact match and semantic token similarity.
    - Inserts neatly under '## ⚠️ Pitfalls & Edge Cases' or SOP section.
    """
    # 1. Anti-duplication check: only check existing files (never block brand new files)
    if not is_new:
        clean_title = title.strip().lower()
        clean_rule = rule.strip().lower()
        heading_needle = f"### {clean_title}"
        if heading_needle in existing_md.lower() or (len(clean_rule) > 15 and clean_rule in existing_md.lower()):
            logger.info(f"[PATCH] Rule or heading '{title}' already exists in file (exact match). Skipping duplication.")
            return None

        # Semantic Token Similarity Check against all existing ### sections
        cand_tokens = tokenize_semantic(title + " " + rule)
        if cand_tokens:
            existing_sections = re.findall(r"###\s+([^\n]+)(.*?)(?=\n###|\n##|$)", existing_md, re.DOTALL)
            for ex_title, ex_body in existing_sections:
                ex_tokens = tokenize_semantic(ex_title + " " + ex_body)
                if not ex_tokens:
                    continue
                overlap = len(cand_tokens & ex_tokens)
                containment = overlap / len(cand_tokens)
                jaccard = overlap / len(cand_tokens | ex_tokens)
                if containment >= 0.55 or jaccard >= 0.40:
                    logger.info(
                        f"[PATCH:DEDUP] Semantic duplicate of existing section '{ex_title.strip()}' "
                        f"(containment: {containment:.2f}, jaccard: {jaccard:.2f}). Skipping duplication."
                    )
                    return None

    entry_text = f"\n### {title}\n- **Kaidah Baku**: {rule}\n- **Penyebab (Why)**: {why}\n- *Tercatat otonom*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S WITA')}\n"

    # 2. Check if '## ⚠️ Pitfalls & Edge Cases' exists
    pitfalls_header_variations = [
        "## ⚠️ Core Pitfalls (High-Level Invariants)",
        "## ⚠️ Core Pitfalls",
        "## ⚠️ Pitfalls & Edge Cases",
        "## Pitfalls & Edge Cases",
        "## Pitfalls",
        "## ⚠️ Pitfall & Edge Cases"
    ]

    target_header = None
    for h in pitfalls_header_variations:
        if h in existing_md:
            target_header = h
            break

    if target_header:
        parts = existing_md.split(target_header, 1)
        # Insert right below the header
        return parts[0] + target_header + "\n" + entry_text + parts[1]

    # 3. If no Pitfalls section exists, find the end of SOP or append before any references
    if "## 🎯 Prosedur Operasional Baku (SOP)" in existing_md:
        return existing_md + "\n\n---\n\n## ⚠️ Pitfalls & Edge Cases\n" + entry_text

    # Default: append section cleanly
    return existing_md.rstrip() + "\n\n---\n\n## ⚠️ Pitfalls & Edge Cases\n" + entry_text


def ensure_parent_skill_exists(parent_file: str, skill_name: str):
    """Ensures parent SKILL.md exists when a child reference is created under a skill dir."""
    try:
        encoded = urllib.parse.quote(parent_file, safe="")
        url = f"{GITLAB_URL}/api/v4/projects/{GITLAB_PROJECT_ID}/repository/files/{encoded}?ref={GITLAB_BRANCH}"
        req_get = urllib.request.Request(url, headers={"PRIVATE-TOKEN": GITLAB_TOKEN})
        try:
            with urllib.request.urlopen(req_get, timeout=10):
                return
        except urllib.error.HTTPError as e:
            if e.code != 404:
                return

        clean_name = skill_name.replace("-", " ").title()
        parent_content = (
            f"---\n"
            f"name: {skill_name}\n"
            f"description: >-\n"
            f"  Use this skill when developing, refactoring, or reviewing components in the {skill_name} domain.\n"
            f"---\n\n"
            f"# SIMGOSv2 {clean_name} Skill\n\n"
            f"Skill ini mendokumentasikan tata cara operasional baku dan kaidah arsitektur pada domain {clean_name}.\n\n"
            f"---\n\n"
            f"## 🎯 Prosedur Operasional Baku (SOP)\n"
            f"- Ikuti standar arsitektur SIMGOSv2 dan aturan clean code.\n\n"
            f"---\n\n"
            f"## ⚠️ Core Pitfalls (High-Level Invariants)\n\n"
            f"---\n\n"
            f"## 📚 Linked Child References (Progressive Disclosure)\n"
            f"Muat file referensi ini saat mengerjakan sub-topik mendalam:\n"
        )
        req_post = urllib.request.Request(
            url,
            data=json.dumps({
                "branch": GITLAB_BRANCH,
                "commit_message": f"feat(agents): auto-initialize parent skill '{skill_name}' for child references",
                "content": parent_content
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "PRIVATE-TOKEN": GITLAB_TOKEN},
            method="POST"
        )
        with urllib.request.urlopen(req_post, timeout=15):
            logger.info(f"[GITLAB] Successfully auto-initialized parent skill {parent_file}")
            auto_register_skill_inventory(skill_name, f"Guidelines for {clean_name}")
    except Exception as e:
        logger.warning(f"[GITLAB] Could not ensure parent skill {parent_file}: {e}")


def ensure_parent_skill_links_reference(parent_file: str, ref_rel_path: str, title: str, summary: str):
    """Ensures that parent SKILL.md indexes the child reference in ## 📚 Linked Child References."""
    try:
        import base64
        skill_name = os.path.basename(os.path.dirname(parent_file))
        ensure_parent_skill_exists(parent_file, skill_name)

        encoded = urllib.parse.quote(parent_file, safe="")
        url = f"{GITLAB_URL}/api/v4/projects/{GITLAB_PROJECT_ID}/repository/files/{encoded}?ref={GITLAB_BRANCH}"
        req_get = urllib.request.Request(url, headers={"PRIVATE-TOKEN": GITLAB_TOKEN})
        with urllib.request.urlopen(req_get, timeout=15) as resp:
            meta = json.loads(resp.read().decode("utf-8"))
            parent_content = base64.b64decode(meta["content"]).decode("utf-8")

        if ref_rel_path in parent_content:
            return  # already linked

        link_entry = f"- `{ref_rel_path}`: {title} - {summary[:100]}\n"
        header = "## 📚 Linked Child References (Progressive Disclosure)"
        if header in parent_content:
            parts = parent_content.split(header, 1)
            updated_parent = parts[0] + header + "\n" + link_entry + parts[1]
        else:
            updated_parent = parent_content.rstrip() + f"\n\n---\n\n{header}\nMuat file referensi ini hanya saat dibutuhkan:\n" + link_entry

        req_put = urllib.request.Request(
            url,
            data=json.dumps({
                "branch": GITLAB_BRANCH,
                "commit_message": f"docs(skill): link child reference '{ref_rel_path}' in parent {parent_file}",
                "content": updated_parent
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "PRIVATE-TOKEN": GITLAB_TOKEN},
            method="PUT"
        )
        with urllib.request.urlopen(req_put, timeout=15) as resp_put:
            logger.info(f"[GITLAB] Successfully linked child reference {ref_rel_path} in parent {parent_file}")
    except Exception as e:
        logger.warning(f"[GITLAB] Could not link child reference to parent {parent_file}: {e}")


def auto_register_skill_inventory(skill_name: str, desc: str):
    """Automatically registers newly created skill into Mnemosyne and canonical_seeds.json."""
    try:
        import base64
        seeds_path = "memory/canonical_seeds.json"
        encoded = urllib.parse.quote(seeds_path, safe="")
        url = f"{GITLAB_URL}/api/v4/projects/{GITLAB_PROJECT_ID}/repository/files/{encoded}?ref={GITLAB_BRANCH}"
        req_get = urllib.request.Request(url, headers={"PRIVATE-TOKEN": GITLAB_TOKEN})
        with urllib.request.urlopen(req_get, timeout=15) as resp:
            meta = json.loads(resp.read().decode("utf-8"))
            seeds = json.loads(base64.b64decode(meta["content"]).decode("utf-8"))

        cur_inv = seeds.get("canonical_slots", {}).get("skills_inventory", {}).get("body", "")
        if skill_name in cur_inv:
            return  # already registered

        nums = [int(n) for n in re.findall(r"(\d+)\.\s+", cur_inv)]
        next_num = (max(nums) + 1) if nums else 1
        clean_desc = desc.replace("\n", " ").strip()[:80]
        new_entry = f" {next_num}. {skill_name}: skills/{skill_name}/SKILL.md ({clean_desc})."
        updated_inv = cur_inv.rstrip() + new_entry

        seeds["canonical_slots"]["skills_inventory"]["body"] = updated_inv

        req_put = urllib.request.Request(
            url,
            data=json.dumps({
                "branch": GITLAB_BRANCH,
                "commit_message": f"feat(memory): auto-register new skill '{skill_name}' into skills_inventory",
                "content": json.dumps(seeds, indent=2)
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "PRIVATE-TOKEN": GITLAB_TOKEN},
            method="PUT"
        )
        with urllib.request.urlopen(req_put, timeout=15) as resp_put:
            logger.info(f"[GITLAB] Auto-registered {skill_name} in canonical_seeds.json")

        save_canonical_memory("skills", "skills_inventory", updated_inv)
        logger.info(f"[MNEMOSYNE] Auto-registered {skill_name} in Mnemosyne canonical memory")

        # Also update <available_skills> in AGENTS.md if present
        try:
            agents_path = "AGENTS.md"
            encoded_agents = urllib.parse.quote(agents_path, safe="")
            url_agents = f"{GITLAB_URL}/api/v4/projects/{GITLAB_PROJECT_ID}/repository/files/{encoded_agents}?ref={GITLAB_BRANCH}"
            req_ag = urllib.request.Request(url_agents, headers={"PRIVATE-TOKEN": GITLAB_TOKEN})
            with urllib.request.urlopen(req_ag, timeout=15) as r_ag:
                meta_ag = json.loads(r_ag.read().decode("utf-8"))
                ag_content = base64.b64decode(meta_ag["content"]).decode("utf-8")

            if f"- {skill_name}:" not in ag_content and "</available_skills>" in ag_content:
                skill_line = f"  - {skill_name}: {clean_desc}.\n</available_skills>"
                ag_patched = ag_content.replace("</available_skills>", skill_line, 1)
                req_ag_put = urllib.request.Request(
                    url_agents,
                    data=json.dumps({
                        "branch": GITLAB_BRANCH,
                        "commit_message": f"feat(agents): register '{skill_name}' into available_skills catalog",
                        "content": ag_patched
                    }).encode("utf-8"),
                    headers={"Content-Type": "application/json", "PRIVATE-TOKEN": GITLAB_TOKEN},
                    method="PUT"
                )
                with urllib.request.urlopen(req_ag_put, timeout=15):
                    logger.info(f"[GITLAB] Registered {skill_name} into AGENTS.md <available_skills>")
        except Exception as e_ag:
            logger.warning(f"Could not update <available_skills> in AGENTS.md: {e_ag}")
    except Exception as e:
        logger.warning(f"Failed to auto-register skill {skill_name} in inventory: {e}")


KNOWN_CANONICAL_REFERENCES = {
    "simgos2-frontend-extjs": [
        "plugin_overrides.md",
        "standalone_runners_and_apache_alias.md",
        "widget_and_plugin_overrides.md"
    ],
    "simgos2-clean-code-validator": [
        "laminas_backend_conventions.md",
        "laminas_service_factories.md"
    ],
    "simgos2-db-audit": [
        "charset_and_patch_discipline.md",
        "dbservice_param_sanitization.md",
        "inpatient_occupancy_queries.md"
    ],
    "simgos2-core-blueprint": [
        "core_isolation_and_overrides.md",
        "backend_entity_overrides.md",
        "plugin_backend_overrides.md"
    ],
    "simgos2-audit-trail": [
        "audit_widget_integration.md"
    ],
    "git-upstream-sync": [
        "commit_discipline.md",
        "commit_workflow.md",
        "core_isolation.md",
        "workflow_discipline.md"
    ],
    "gitlab-issue-tracker": [
        "issue_attachments.md"
    ]
}


def resolve_canonical_reference(target_file: str, title: str) -> str:
    """Normalizes slightly varied reference filenames into existing canonical references to prevent overlapping."""
    parts = target_file.split("/")
    if "references" not in parts or not target_file.endswith(".md"):
        return target_file

    ref_idx = parts.index("references")
    if ref_idx < 1:
        return target_file
    skill_name = parts[ref_idx - 1]
    proposed_file = parts[-1]

    known = KNOWN_CANONICAL_REFERENCES.get(skill_name, [])
    if proposed_file in known:
        return target_file

    prop_stem = proposed_file.lower().replace(".md", "")

    best_match = None
    best_score = 0.0
    for k in known:
        k_stem = k.lower().replace(".md", "")
        score = 0.0
        if prop_stem.startswith(k_stem.rstrip("s")) or k_stem.startswith(prop_stem.rstrip("s")):
            score += 10.0
        elif "override" in prop_stem and "override" in k_stem:
            if k == "plugin_overrides.md":
                score += 6.0
            else:
                score += 3.0

        prop_words = set(re.findall(r"[a-z0-9]+", prop_stem))
        k_words = set(re.findall(r"[a-z0-9]+", k_stem))
        title_words = set(re.findall(r"[a-z0-9]+", title.lower()))

        score += len(prop_words & k_words) * 2.0
        score += len(title_words & k_words) * 0.5
        score -= len(k_stem) * 0.05

        if score > best_score:
            best_score = score
            best_match = k

    if best_match and best_score >= 3.0:
        parts[-1] = best_match
        resolved = "/".join(parts)
        logger.info(f"[ROUTER:DEDUP] Normalized target_file '{target_file}' -> existing '{resolved}' (score: {best_score:.1f})")
        return resolved

    return target_file


def commit_skill_patch_to_gitlab(target_file: str, title: str, rule: str, why: str, description: str = "") -> tuple[bool, bool]:
    """Reads target file from GitLab, applies structural patch (or creates new skill/reference), and commits back.
    Returns (success, is_new_created).
    """
    if not GITLAB_TOKEN:
        logger.warning("No GitLab token configured, skipping direct commit.")
        return False, False

    if target_file.startswith(""):
        target_file = target_file[len(""):]
    target_file = target_file.lstrip("/")

    target_file = resolve_canonical_reference(target_file, title)
    encoded_path = urllib.parse.quote(target_file, safe="")
    file_url = f"{GITLAB_URL}/api/v4/projects/{GITLAB_PROJECT_ID}/repository/files/{encoded_path}?ref={GITLAB_BRANCH}"
    
    is_reference = "/references/" in target_file
    is_new = False
    req_get = urllib.request.Request(file_url, headers={"PRIVATE-TOKEN": GITLAB_TOKEN})
    try:
        import base64
        with urllib.request.urlopen(req_get, timeout=15) as resp:
            file_meta = json.loads(resp.read().decode("utf-8"))
            current_content = base64.b64decode(file_meta["content"]).decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            is_new = True
            if is_reference:
                current_content = (
                    f"# {title}\n\n"
                    f"Dokumen referensi teknis terkait {title}.\n\n"
                    f"---\n\n"
                    f"## ⚠️ Pitfalls & Edge Cases\n"
                )
            else:
                skill_name = os.path.basename(os.path.dirname(target_file)) or "custom-skill"
                clean_desc = description.strip() if description else f"Use this skill when dealing with {title.lower()}."
                current_content = (
                    f"---\n"
                    f"name: {skill_name}\n"
                    f"description: >-\n"
                    f"  {clean_desc}\n"
                    f"---\n\n"
                    f"# {title}\n\n"
                    f"Skill ini mendokumentasikan tata cara operasional baku dan kaidah penanganan pitfall terkait {title}.\n\n"
                    f"---\n\n"
                    f"## 🎯 Prosedur Operasional Baku (SOP)\n"
                    f"- Ikuti standar arsitektur SIMGOSv2 dan aturan clean code.\n\n"
                    f"---\n\n"
                    f"## ⚠️ Core Pitfalls (High-Level Invariants)\n"
                )
        else:
            logger.error(f"GitLab fetch error: {e}")
            return False, False
    except Exception as e:
        logger.error(f"GitLab connection error: {e}")
        return False, False

    # Deterministic Ceiling Guard: if root SKILL.md has >= 50 lines, auto-reroute to child reference
    if not is_reference and not is_new:
        lines_count = len(current_content.splitlines())
        if lines_count >= 50:
            skill_dir = os.path.dirname(target_file)
            slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:40] or "reference"
            ref_target = f"{skill_dir}/references/{slug}.md"
            logger.info(f"[ROUTER] Root {target_file} has {lines_count} lines (ceiling >= 50). Auto-offloading to child reference: {ref_target}")
            return commit_skill_patch_to_gitlab(ref_target, title, rule, why, description)

    # 2. Structural patch
    patched_content = apply_structural_patch(current_content, title, rule, why, is_new=is_new)
    if patched_content is None:
        logger.info(f"[GITLAB] No modification needed for {target_file} (rule already present).")
        return False, False

    # 2b. Structural and syntax validation
    is_valid, validated_content, val_msg = validate_skill_syntax(patched_content, target_file)
    if not is_valid:
        logger.error(f"[VALIDATOR] Rejecting commit for {target_file}: {val_msg}")
        return False, False
    patched_content = validated_content

    # 3. Commit update (POST for new file, PUT for existing file)
    commit_action = "create child reference" if (is_new and is_reference) else ("create new skill" if is_new else "structural patch")
    commit_payload = {
        "branch": GITLAB_BRANCH,
        "commit_message": f"docs(agents): {commit_action} '{title}' in {target_file}",
        "content": patched_content
    }

    req_commit = urllib.request.Request(
        file_url,
        data=json.dumps(commit_payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "PRIVATE-TOKEN": GITLAB_TOKEN
        },
        method="POST" if is_new else "PUT"
    )

    try:
        with urllib.request.urlopen(req_commit, timeout=20) as resp:
            logger.info(f"[GITLAB] Successfully committed ({commit_action}) {target_file} on branch {GITLAB_BRANCH}")
            
            # If target was a child reference, link it in parent SKILL.md
            if is_reference:
                skill_dir = target_file.split("/references/")[0]
                parent_file = f"{skill_dir}/SKILL.md"
                ref_rel = "references/" + target_file.split("/references/")[1]
                ensure_parent_skill_links_reference(parent_file, ref_rel, title, rule)
            elif is_new:
                # If a new root skill was created, auto-register in skills_inventory
                skill_name = os.path.basename(os.path.dirname(target_file))
                auto_register_skill_inventory(skill_name, description or title)

            return True, is_new
    except Exception as e:
        logger.error(f"GitLab commit error: {e}")
        return False, False


# =====================================================================
# MNEMOSYNE CANONICAL MEMORY BRIDGE
# =====================================================================
def save_canonical_memory(category: str, name: str, body: str) -> tuple[bool, bool]:
    """Stores a canonical fact/rule into Mnemosyne MCP server with duplicate check.
    Returns (success, is_updated_or_new).
    """
    # 1. Deduplication check via mnemosyne_recall_canonical
    try:
        recall_payload = {
            "jsonrpc": "2.0",
            "id": int(time.time()),
            "method": "tools/call",
            "params": {
                "name": "mnemosyne_recall_canonical",
                "arguments": {
                    "category": category,
                    "name": name
                }
            }
        }
        req_recall = urllib.request.Request(
            MNEMOSYNE_URL,
            data=json.dumps(recall_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_recall, timeout=5) as resp:
            recall_res = json.loads(resp.read().decode("utf-8"))
            content_text = recall_res.get("result", {}).get("content", [{}])[0].get("text", "")
            if content_text:
                slot_data = json.loads(content_text)
                if slot_data.get("found"):
                    existing_body = slot_data.get("result", {}).get("body", "").strip()
                    if existing_body.lower() == body.strip().lower():
                        logger.info(f"[MNEMOSYNE] Canonical memory '{category}:{name}' already has identical body. Skipping duplicate.")
                        return False, False
    except Exception as e:
        logger.debug(f"[MNEMOSYNE] Recall check warning: {e}")

    # 2. Save new or updated canonical slot
    payload = {
        "jsonrpc": "2.0",
        "id": int(time.time()),
        "method": "tools/call",
        "params": {
            "name": "mnemosyne_remember_canonical",
            "arguments": {
                "category": category,
                "name": name,
                "body": body
            }
        }
    }
    req = urllib.request.Request(
        MNEMOSYNE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            if "error" in res:
                logger.error(f"[MNEMOSYNE] Error saving canonical memory: {res['error']}")
                return False, False
            logger.info(f"[MNEMOSYNE] Successfully saved canonical memory '{category}:{name}'")
            return True, True
    except Exception as e:
        logger.error(f"[MNEMOSYNE] Connection error saving canonical memory: {e}")
        return False, False


# =====================================================================
# BACKGROUND WORKER & HTTP HANDLER
# =====================================================================
def background_worker():
    """Consumes tasks from review_queue in background thread."""
    logger.info("Background review worker thread started (V2.0 High-Fidelity Engine).")
    while True:
        try:
            task = review_queue.get()
            if task is None:
                break

            task_id = task.get("id")
            conv_id = task.get("conversationId")
            transcript_tail = task.get("transcriptTail", "") or task.get("transcript_tail", "")

            # Robust fallback if JSON payload had unescaped quotes or was captured as raw
            if not transcript_tail and "raw" in task:
                import re
                raw = task["raw"]
                m_conv = re.search(r'"conversationId"\s*:\s*"([^"]+)"', raw)
                if m_conv and not conv_id:
                    conv_id = m_conv.group(1)
                m_tail = re.search(r'"transcriptTail"\s*:\s*"(.*)"\s*\}\s*$', raw, re.DOTALL)
                if m_tail:
                    try:
                        transcript_tail = m_tail.group(1).encode("utf-8").decode("unicode_escape", errors="replace")
                    except Exception:
                        transcript_tail = m_tail.group(1)

            logger.info(f"[QUEUE] Processing review task {task_id} (conv: {conv_id}, tail_len: {len(transcript_tail)})")

            # Deduplication: Lewati jika konten transkrip ini sama persis dengan yang sudah pernah dievaluasi
            import hashlib
            tail_hash = hashlib.sha256(transcript_tail.strip().encode("utf-8")).hexdigest()
            seen_hashes_file = os.path.join(CACHE_DIR, "seen_hashes.txt")
            seen_hashes = set()
            if os.path.exists(seen_hashes_file):
                try:
                    with open(seen_hashes_file, "r") as f:
                        seen_hashes = set(line.strip() for line in f if line.strip())
                except Exception:
                    pass

            if tail_hash in seen_hashes:
                logger.info(f"[DEDUP] Skipping duplicate transcript tail {tail_hash[:12]} for task {task_id}")
                review_queue.task_done()
                continue

            try:
                with open(seen_hashes_file, "a") as f:
                    f.write(tail_hash + "\n")
            except Exception:
                pass

            # Save incoming request snapshot
            snapshot_path = os.path.join(CACHE_DIR, f"{task_id}.json")
            with open(snapshot_path, "w") as f:
                json.dump(task, f, indent=2)

            # Evaluate with LLM
            start_t = time.time()
            result = call_llm_evaluator(transcript_tail)
            duration = time.time() - start_t

            logger.info(f"[EVAL] Task {task_id} evaluated in {duration:.2f}s: has_lesson={result.get('has_lesson')}")

            if result.get("has_lesson"):
                actions = result.get("actions", [])
                # Backward compatibility if LLM returned old schema
                if not actions and result.get("target_file"):
                    actions = [{
                        "type": "skill",
                        "target_file": result.get("target_file"),
                        "title": result.get("title", "Learned Procedure"),
                        "rule": result.get("content", ""),
                        "why": "Auto-extracted procedural rule",
                        "section": "pitfalls"
                    }]

                for act in actions:
                    act_type = act.get("type", "skill")
                    author_name = task.get("git_target", {}).get("author_name") or task.get("profile_id") or task.get("client") or "Hermes Agent"
                    ws_id = task.get("workspace_id") or "default"

                    if act_type == "skill":
                        target_file = act.get("target_file", "skills/simgos2-db-audit/SKILL.md")
                        title = act.get("title", "Learned Procedure")
                        rule = act.get("rule", "")
                        why = act.get("why", "")
                        description = act.get("description", "")
                        
                        logger.info(f"[LESSON:SKILL] Processing '{title}' into {target_file}")
                        ok, is_new = commit_skill_patch_to_gitlab(target_file, title, rule, why, description)
                        if ok:
                            action_label = "New skill created" if is_new else "Skill structurally patched"
                            emoji = "✨" if is_new else "💾"
                            send_telegram_notification(
                                f"{emoji} <b>Self-improvement review</b>: {action_label} <code>{html.escape(target_file)}</code>.\n"
                                f"• <b>Workspace</b>: <code>{html.escape(ws_id)}</code>\n"
                                f"• <b>Author</b>: <b>{html.escape(author_name)}</b>\n"
                                f"• <b>Aturan</b>: {html.escape(title)}\n"
                                f"• <b>Kaidah</b>: {html.escape(rule)}"
                            )
                            record_evolution_event({
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": datetime.now().isoformat(),
                                "workspace_id": ws_id,
                                "author": author_name,
                                "type": "skill",
                                "action_label": action_label,
                                "target": target_file,
                                "title": title,
                                "content": rule,
                                "details": why or description
                            })

                    elif act_type == "memory":
                        category = act.get("category", "architecture_policy")
                        name = act.get("name", f"fact_{task_id}")
                        body = act.get("body", "")

                        logger.info(f"[LESSON:MEMORY] Saving canonical fact '{category}:{name}'")
                        ok, is_updated = save_canonical_memory(category, name, body)
                        if ok:
                            send_telegram_notification(
                                f"🧠 <b>Self-improvement review</b>: Canonical memory saved to Mnemosyne.\n"
                                f"• <b>Workspace</b>: <code>{html.escape(ws_id)}</code>\n"
                                f"• <b>Author</b>: <b>{html.escape(author_name)}</b>\n"
                                f"• <b>Slot</b>: <code>{html.escape(category)}:{html.escape(name)}</code>\n"
                                f"• <b>Konten</b>: {html.escape(body)}"
                            )
                            record_evolution_event({
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": datetime.now().isoformat(),
                                "workspace_id": ws_id,
                                "author": author_name,
                                "type": "memory",
                                "action_label": "Canonical memory saved",
                                "target": f"{category}:{name}",
                                "title": f"Slot {category}:{name}",
                                "content": body,
                                "details": f"Saved to Mnemosyne canonical memory by {author_name}"
                            })

            review_queue.task_done()
        except Exception as e:
            logger.error(f"Error in background review worker: {e}", exc_info=True)


class ReviewHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "status": "ok",
                "service": "hermes-antigravity-review-receiver-v2",
                "queue_size": review_queue.qsize(),
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        elif self.path == "/api/v1/evolution-events":
            try:
                events = []
                if RECENT_EVENTS_FILE.exists():
                    events = json.loads(RECENT_EVENTS_FILE.read_text(encoding="utf-8"))
                body_bytes = json.dumps(events).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body_bytes)
            except Exception as e:
                err_bytes = json.dumps({"error": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(err_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(err_bytes)
        elif self.path == "/api/v1/provision/telegram-target":
            try:
                b_tok, c_id = get_telegram_config()
                resp_payload = {
                    "bot_token": b_tok or "",
                    "chat_id": c_id or "-5594254057",
                    "topic_id": "",
                    "enabled": True
                }
                body_bytes = json.dumps(resp_payload).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body_bytes)
            except Exception as e:
                err_bytes = json.dumps({"error": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(err_bytes)))
                self.end_headers()
                self.wfile.write(err_bytes)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        logger.info(f"[HTTP-IN] POST path={self.path} length={self.headers.get('Content-Length')} from {self.client_address[0]}")
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path == "/api/v1/direct-memory-event":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8", errors="replace")
            try:
                data = json.loads(body) if body else {}
                cat = data.get("category", "canonical")
                name = data.get("name", "slot")
                val = data.get("body", "")
                author = data.get("profile_id", "Agus Azis")
                ws = data.get("workspace_id", "ai-agents")

                logger.info(f"[DIRECT-MUTATION] Memory event received for {cat}:{name} by {author}")
                
                # Kirim ke Telegram
                send_telegram_notification(
                    f"🧠 <b>Self-improvement review</b>: Canonical memory saved to Mnemosyne.\n"
                    f"• <b>Workspace</b>: <code>{html.escape(ws)}</code>\n"
                    f"• <b>Author</b>: <b>{html.escape(author)}</b>\n"
                    f"• <b>Slot</b>: <code>{html.escape(cat)}:{html.escape(name)}</code>\n"
                    f"• <b>Konten</b>: {html.escape(val)}"
                )

                # Rekam ke recent evolution feed
                record_evolution_event({
                    "id": str(uuid.uuid4())[:8],
                    "timestamp": datetime.now().isoformat(),
                    "workspace_id": ws,
                    "author": author,
                    "type": "memory",
                    "action_label": "Canonical memory saved",
                    "target": f"{cat}:{name}",
                    "title": f"Slot {cat}:{name}",
                    "content": val,
                    "details": f"Saved directly from IDE tool call by {author}"
                })

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
                return
            except Exception as e:
                logger.error(f"Error handling direct memory event: {e}")
                self.send_response(500)
                self.end_headers()
                return

        if clean_path in ["/review", "/hermes/skill-review", ""]:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8", errors="replace")
            
            try:
                data = json.loads(body) if body else {}
            except Exception:
                data = {"raw": body}
                import re
                m_conv = re.search(r'"conversationId"\s*:\s*"([^"]+)"', body)
                if m_conv:
                    data["conversationId"] = m_conv.group(1)
                m_tail = re.search(r'"transcriptTail"\s*:\s*"(.*)"\s*\}\s*$', body, re.DOTALL)
                if m_tail:
                    try:
                        data["transcriptTail"] = m_tail.group(1).encode("utf-8").decode("unicode_escape", errors="replace")
                    except Exception:
                        data["transcriptTail"] = m_tail.group(1)

            task_id = str(uuid.uuid4())[:8]
            data["id"] = task_id
            data["received_at"] = datetime.now().isoformat()

            review_queue.put(data)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = {
                "status": "queued",
                "task_id": task_id,
                "engine_version": "2.0-high-fidelity",
                "message": "Review admitted into background worker queue"
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
            logger.info(f"[HTTP] Enqueued task {task_id} from {self.client_address[0]}")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def run_server(port=9125):
    worker_thread = threading.Thread(target=background_worker, daemon=True)
    worker_thread.start()

    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, ReviewHandler)
    logger.info(f"Hermes Antigravity Review Receiver V2.0 listening on 0.0.0.0:{port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server(9125)
