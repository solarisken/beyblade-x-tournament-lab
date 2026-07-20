#!/usr/bin/env python3
"""Chromium mobile regression for X Deck Lab.

The execution environment used for release certification blocks browser navigation to
all URL schemes. This harness therefore injects the unchanged production HTML, CSS,
and JavaScript into Chromium's document context. A deterministic in-memory
localStorage shim is inserted before the production scripts so persistence and
migration behavior can still be exercised. Service-worker lifecycle behavior is
covered separately by test.mjs.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent
RESULT_PATH = ROOT / "browser-audit-result.json"
SCREENSHOT_PATH = ROOT / "mobile-v3.0-coach-final.png"
HOME_SCREENSHOT_PATH = ROOT / "mobile-v3.0-coach-home.png"
VIEWPORT = {"width": 390, "height": 844}
DEVICE_SCALE_FACTOR = 3


def production_document(initial_storage: dict[str, str] | None = None) -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    initial = json.dumps(initial_storage or {}, ensure_ascii=False).replace("</", "<\\/")
    bootstrap = f"""
<script>
(() => {{
  const data = Object.assign(Object.create(null), {initial});
  const storage = {{
    getItem(key) {{ return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; }},
    setItem(key, value) {{ data[key] = String(value); }},
    removeItem(key) {{ delete data[key]; }},
    clear() {{ Object.keys(data).forEach((key) => delete data[key]); }},
    key(index) {{ return Object.keys(data)[index] ?? null; }},
    get length() {{ return Object.keys(data).length; }}
  }};
  Object.defineProperty(window, 'localStorage', {{ value: storage, configurable: true }});
  window.__auditStorage = data;
  window.__auditDownloads = [];
  window.__auditLastBlob = null;
  window.confirm = () => true;
  URL.createObjectURL = (blob) => {{ window.__auditLastBlob = blob; return 'blob:audit'; }};
  URL.revokeObjectURL = () => {{}};
  HTMLAnchorElement.prototype.click = function () {{
    window.__auditDownloads.push({{ filename: this.download, href: this.href }});
  }};
}})();
</script>
"""
    html = html.replace("<head>", "<head>" + bootstrap, 1)
    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}\n</style>")
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">', "")
    html = html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', "")
    for filename in ("data.js", "core.js", "app.js"):
        source = (ROOT / filename).read_text(encoding="utf-8")
        html = html.replace(f'<script src="{filename}"></script>', f"<script>\n{source}\n</script>")
    return html


class Audit:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []
        self.normal_console_errors: list[str] = []
        self.page_errors: list[str] = []
        self.expected_validation_logs: list[str] = []
        self.phase = "normal"

    def record(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append({"name": name, "passed": bool(passed), "detail": detail})
        print(f"[{len(self.checks):02d}] {'PASS' if passed else 'FAIL'} {name}", flush=True)
        if not passed:
            raise AssertionError(f"{name}: {detail}")

    def console(self, message) -> None:
        if message.type != "error":
            return
        target = self.expected_validation_logs if self.phase == "negative" else self.normal_console_errors
        target.append(message.text)

    def page_error(self, error) -> None:
        self.page_errors.append(str(error))


def wait_ready(page: Page) -> None:
    page.wait_for_function("document.documentElement.dataset.appReady === 'true'")


def storage_snapshot(page: Page) -> dict[str, str]:
    return page.evaluate("Object.assign({}, window.__auditStorage)")


def state_snapshot(page: Page) -> dict[str, Any]:
    raw = page.evaluate("window.__auditStorage['x-deck-lab-state-v2'] || null")
    if not raw:
        raise AssertionError("No v2 state exists in audit storage.")
    return json.loads(raw)


def nav(page: Page, view: str) -> None:
    page.locator(f'[data-nav="{view}"]').click()
    page.locator(f'#view-{view}').wait_for(state="visible")


def add_product(page: Page, product_id: str) -> None:
    search = page.locator("#productSearch")
    search.fill(product_id)
    page.locator(f'[data-add-product="{product_id}"]').click()


def temporary_json(payload: Any) -> str:
    handle = tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False)
    try:
        json.dump(payload, handle, ensure_ascii=False)
        return handle.name
    finally:
        handle.close()


def run() -> dict[str, Any]:
    audit = Audit()
    started = time.perf_counter()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=DEVICE_SCALE_FACTOR,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.on("console", audit.console)
        page.on("pageerror", audit.page_error)
        page.set_content(production_document(), wait_until="load")
        wait_ready(page)

        audit.record("Application initializes", page.locator("html").get_attribute("data-app-ready") == "true")
        audit.record("No initial page errors", not audit.page_errors, "; ".join(audit.page_errors))
        audit.record(
            "No horizontal overflow",
            page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
            page.evaluate("`${document.documentElement.scrollWidth}px content / ${window.innerWidth}px viewport`"),
        )
        unlabeled = page.evaluate("""() => Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea, button')).filter((el) => { const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) return false; const labels = el.labels ? el.labels.length : 0; const accessibleName = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim(); return !labels && !accessibleName; }).map((el) => el.id || el.name || el.tagName)""")
        audit.record("Initial visible controls have accessible names", len(unlabeled) == 0, ", ".join(unlabeled))
        duplicate_ids = page.evaluate("""() => { const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id); return ids.filter((id, index) => ids.indexOf(id) !== index); }""")
        audit.record("Document IDs are unique", len(duplicate_ids) == 0, ", ".join(sorted(set(duplicate_ids))))
        audit.record("Four-step home guide is visible", page.locator("#quickGuide").is_visible() and page.locator("#guideSteps .guide-step").count() == 4)
        page.locator("#guideButton").click()
        page.locator("#guideDialog").wait_for(state="visible")
        guide_text = page.locator("#guideDialog").inner_text()
        audit.record("Full player guide has four clear steps", page.locator("#guideDialog .guide-list li").count() == 4 and "Parts" in guide_text and "Decks" in guide_text and "Coach" in guide_text)
        audit.record("Kid guide explains ordinary Self-KO", "Just answer Yes or No" in guide_text and "ask an adult" in guide_text.lower(), guide_text[:500])
        page.locator('#guideDialog [data-close-dialog]').click()
        page.locator("#guideDialog").wait_for(state="hidden")

        page.set_viewport_size({"width": 320, "height": 700})
        audit.record("Small-phone layout has no horizontal overflow", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), page.evaluate("`${document.documentElement.scrollWidth}px / ${window.innerWidth}px`"))
        page.set_viewport_size(VIEWPORT)

        view_accessibility_issues = []
        for view in ("dashboard", "inventory", "deck", "test", "results", "more"):
            nav(page, view)
            audit.record(f"{view.title()} view navigates", page.locator(f"#view-{view}").is_visible())
            issues = page.evaluate("""() => Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea, button')).filter((el) => { const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) return false; const labels = el.labels ? el.labels.length : 0; const accessibleName = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim(); return !labels && !accessibleName; }).map((el) => el.id || el.name || el.tagName)""")
            view_accessibility_issues.extend([f"{view}:{item}" for item in issues])
        audit.record("Visible controls across primary views have accessible names", len(view_accessibility_issues) == 0, ", ".join(view_accessibility_issues))
        audit.record("Management navigation does not stall", page.locator("#settingsForm").is_visible())

        nav_rects = page.locator(".bottom-nav [data-nav]").evaluate_all(
            "els => els.map(el => { const r = el.getBoundingClientRect(); return ({w:r.width,h:r.height,left:r.left,right:r.right,bottom:r.bottom}); })"
        )
        touch_ok = all(rect["h"] >= 44 and rect["w"] >= 44 for rect in nav_rects)
        contained = all(rect["left"] >= 0 and rect["right"] <= VIEWPORT["width"] + 0.5 for rect in nav_rects)
        audit.record("Primary navigation meets 44 px touch target", touch_ok, json.dumps(nav_rects))
        audit.record("Primary navigation stays inside viewport", contained, json.dumps(nav_rects))

        nav(page, "inventory")
        product_search = page.locator("#productSearch")
        product_search.fill("BX-23")
        audit.record("Product search retains focus", page.evaluate("document.activeElement.id") == "productSearch")
        page.locator('[data-add-product="BX-23"]').click()
        audit.record("Known-products panel remains open", page.locator("#knownProductsDetails").get_attribute("open") is not None)
        for product_id in ("UX-03", "UX-08", "UX-11", "BX-49"):
            add_product(page, product_id)
        state = state_snapshot(page)
        audit.record("Product entry updates inventory", len(state["inventory"]) >= 13, f"{len(state['inventory'])} unique parts")

        inventory_search = page.locator("#inventorySearch")
        inventory_search.fill("PhoenixWing")
        audit.record("Inventory search retains focus", page.evaluate("document.activeElement.id") == "inventorySearch")
        audit.record("Inventory filtering renders owned part", "PhoenixWing" in page.locator("#inventoryList").inner_text())
        inventory_search.fill("")

        page.locator("#openPartDialog").click()
        page.locator("#partCategory").select_option("ratchet")
        page.locator("#partSelect").select_option("ratchet-1-60")
        page.locator('#partForm input[name="quantity"]').fill("2")
        page.locator("#partCondition").select_option("worn")
        page.locator('#partForm input[name="notes"]').fill("Audit spare")
        page.locator("#partForm").evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Loose-part dialog saves quantity and condition", state["inventory"]["ratchet-1-60"]["qty"] == 2 and state["inventory"]["ratchet-1-60"]["condition"] == "worn")

        nav(page, "deck")
        page.locator("#smartBuildButton").click()
        page.locator("[data-apply-suggestion]").first.wait_for(state="visible", timeout=15000)
        audit.record("Owned-parts optimizer returns ranked decks", page.locator("[data-apply-suggestion]").count() >= 1)
        page.locator("[data-apply-suggestion]").first.click()
        subtitles = page.locator(".bey-card .bey-title small").all_inner_texts()
        audit.record("Optimizer applies three complete Beys", len(subtitles) == 3 and all("Incomplete" not in item for item in subtitles), " | ".join(subtitles))
        metric_counts = page.locator(".bey-card .bey-metric").evaluate_all("els => { const cards = [...document.querySelectorAll('.bey-card')]; return cards.map(card => card.querySelectorAll('.bey-metric').length); }")
        audit.record("Each completed Bey uses a four-cell mobile score grid", metric_counts == [4, 4, 4], json.dumps(metric_counts))
        metric_layout = page.locator(".bey-card").first.evaluate("""card => {
          const grid = card.querySelector('.bey-metric-grid');
          const cardRect = card.getBoundingClientRect();
          const cells = [...card.querySelectorAll('.bey-metric')].map(el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width }; });
          return {
            columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
            contained: cells.every(r => r.left >= cardRect.left - 0.5 && r.right <= cardRect.right + 0.5),
            legacyInlineSpans: card.querySelectorAll('.bey-engineering > span').length,
            labeledCells: [...card.querySelectorAll('.bey-metric')].every(el => el.querySelector('small') && el.querySelector('strong') && el.querySelector('em'))
          };
        }""")
        audit.record("Mobile engineering scores are separated and contained", metric_layout["columns"] == 2 and metric_layout["contained"] and metric_layout["legacyInlineSpans"] == 0 and metric_layout["labeledCells"], json.dumps(metric_layout))
        validation_text = page.locator("#deckValidation").inner_text()
        audit.record("Applied deck passes rules and inventory gates", "Construction passes" in validation_text and "Shortage" not in validation_text and "Rules" not in validation_text, validation_text[:500])

        page.locator("#renameDeckButton").click()
        page.locator("#deckNameInput").fill("Certified Tournament Deck")
        page.locator("#nameForm").evaluate("form => form.requestSubmit()")
        page.locator("#cloneDeckButton").click()
        page.locator("#deckNameInput").fill("Certified Tournament Deck Copy")
        page.locator("#nameForm").evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Deck library clones complete decks", len(state["decks"]) == 2 and state["decks"][1]["beys"] == state["decks"][0]["beys"])
        page.locator("#deleteDeckButton").click()
        state = state_snapshot(page)
        audit.record("Deck library deletes selected version safely", len(state["decks"]) == 1 and state["decks"][0]["name"] == "Certified Tournament Deck")

        nav(page, "test")
        audit.record("Adaptive test plan renders exact owned opponents", page.locator("#testPlanList .test-task").count() >= 1 and "you own all needed parts" in page.locator("#view-test").inner_text().lower())
        audit.record("Adaptive plan prioritizes simple self-KO checks", "SELF-KO CHECK" in page.locator("#testPlanList").inner_text() and "self-KO question" in page.locator("#testPlanList").inner_text())
        audit.record("Battle form offers an owned opponent build", page.locator("#battleOpponent option").count() >= 1 and page.locator("#battleOpponent").input_value() != "")
        pair_policy = page.evaluate("""() => {
          const state = JSON.parse(window.__auditStorage['x-deck-lab-state-v2']);
          const deck = state.decks.find((entry) => entry.id === state.activeDeckId);
          const ownIndex = Number(document.querySelector('#battleOwnBey').value || 0);
          const own = deck.beys[ownIndex];
          const signature = document.querySelector('#battleOpponent').value;
          const partMap = Object.fromEntries([...window.XDATA.parts, ...(state.customParts || [])].map((part) => [part.id, part]));
          const candidates = window.XCore.generateOwnedOpponentCandidates({ inventory: state.inventory, ownBey: own, partMap, includeAnnounced: deck.includeAnnounced, avoidAttackMirrors: state.settings.avoidAttackMirrors !== false, maxCandidates: state.settings.opponentPoolSize || 90 });
          const opponent = candidates.find((entry) => entry.signature === signature);
          return {
            found: Boolean(opponent),
            capacity: opponent ? window.XCore.inventoryCapacityForBattle(own, opponent.bey, state.inventory, partMap).valid : false,
            attackMirror: opponent ? window.XCore.bitRoleForBey(own, partMap) === 'attack' && opponent.engineering.bitRole === 'attack' : true
          };
        }""")
        audit.record("Selected opponent is simultaneously constructible from owned quantities", pair_policy["found"] and pair_policy["capacity"], json.dumps(pair_policy))
        audit.record("Attack-bit mirror exclusion is enforced", not pair_policy["attackMirror"], json.dumps(pair_policy))
        audit.record("Opponent engineering preview renders", "Owned capacity verified" in (page.locator("#opponentEngineering").text_content() or ""))
        page.locator('#battleForm select[name="result"]').select_option("win")
        page.locator('#battleForm select[name="finish"]').select_option("xtreme")
        page.locator('#battleForm input[name="selfKo"][value="no"]').check()
        page.locator("#battleForm").evaluate("form => form.requestSubmit()")
        history_text = page.locator("#battleHistory").inner_text()
        state = state_snapshot(page)
        audit.record("Battle logging persists exact opponent, finish, and simple No answer", len(state["battles"]) == 1 and state["battles"][0]["finish"] == "xtreme" and state["battles"][0]["selfKo"] is False and state["battles"][0]["selfKoKnown"] is True and bool(state["battles"][0].get("opponentBey")) and bool(state["battles"][0].get("opponentSignature")))
        audit.record("Xtreme Finish receives three points", "3 points" in history_text, history_text[:400])

        page.locator('#battleForm select[name="result"]').select_option("win")
        page.locator('#battleForm select[name="finish"]').select_option("spin")
        page.locator('#battleForm input[name="selfKo"][value="yes"]').check()
        page.locator("#battleForm").evaluate("form => form.requestSubmit()")
        audit.record("Impossible Self-KO Yes answer is blocked", len(state_snapshot(page)["battles"]) == 1 and "only when your Bey lost" in page.locator("#toast").inner_text())

        page.locator('#battleForm select[name="result"]').select_option("loss")
        page.locator('#battleForm select[name="finish"]').select_option("over")
        page.locator('#battleForm input[name="selfKo"][value="yes"]').check()
        page.locator("#battleForm").evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Ordinary Self-KO Yes is retained as valid decided evidence", len(state["battles"]) == 2 and state["battles"][1]["selfKo"] is True and state["battles"][1]["selfKoKnown"] is True and state["battles"][1]["contaminated"] is False)
        audit.record("Battle history shows only the simple Self-KO label", "SELF-KO" in page.locator("#battleHistory").inner_text() and "rail overshoot" not in page.locator("#battleHistory").inner_text().lower())

        page.locator('#battleForm select[name="result"]').select_option("loss")
        page.locator('#battleForm select[name="finish"]').select_option("spin")
        page.locator('#battleForm input[name="selfKo"][value="no"]').check()
        page.locator("#optionalTestDetails").evaluate("details => details.open = true")
        page.locator('#battleForm input[name="contaminated"]').check()
        page.locator("#battleForm").evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Contaminated battle is retained but marked for exclusion", len(state["battles"]) == 3 and state["battles"][2]["contaminated"] is True)

        nav(page, "results")
        audit.record("Coach tab is clearly named", "Coach" in page.locator('[data-nav="results"]').inner_text())
        audit.record("Player mode is visible by default", page.locator("#modeButton").inner_text() == "Player mode")
        audit.record("Coach roadmap is visible on Home", page.locator("#coachRoadmap").count() == 1)
        audit.record("Coach reports decided evidence", "2 decided battles" in page.locator("#analysisHero").inner_text())
        audit.record("Coach shows one next mission", "mission" in page.locator("#coachMission").inner_text().lower() and page.locator("#coachMission button").count() == 1)
        audit.record("Coach mission exposes information value", "info" in page.locator("#coachMission").inner_text().lower())
        audit.record("Coach patterns render", page.locator("#coachPatterns .coach-point").count() >= 1)
        page.locator("#modeButton").click()
        audit.record("Advanced mode opens technical details", page.locator("#coachAdvancedDetails").evaluate("el => el.open") is True and page.locator("#modeButton").inner_text() == "Advanced mode")
        page.locator("#modeButton").click()
        audit.record("Player mode restores collapsed technical details", page.locator("#coachAdvancedDetails").evaluate("el => el.open") is False and page.locator("#modeButton").inner_text() == "Player mode")
        audit.record("Coach shows progress, strengths, weaknesses, and simple behavior", page.locator("#coachProgress progress").count() == 3 and bool(page.locator("#coachStrengths").inner_text().strip()) and bool(page.locator("#coachWeaknesses").inner_text().strip()) and page.locator("#coachPhysics .coach-physics-row").count() == 5)
        audit.record("Technical analysis is collapsed by default", page.locator(".coach-advanced").evaluate("el => !el.open"))
        page.locator(".coach-advanced").evaluate("el => el.open = true")
        audit.record("Coverage matrix renders in advanced analysis", page.locator("#coverageMatrix table").count() == 1)
        audit.record("Engineering deck analysis renders in advanced analysis", "Deck engineering score" in page.locator("#engineeringAnalysis").inner_text() and page.locator("#engineeringAnalysis .engineering-card").count() == 3)
        selfko_text = page.locator("#selfKoAnalysis").inner_text()
        audit.record("Simple Self-KO analysis renders Yes-or-No totals", "Total self-KOs" in selfko_text and "Yes or No" in selfko_text and "No special cause is needed" in selfko_text, selfko_text[:600])
        audit.record("Detailed Self-KO causes are not shown", "Wilson 95%" not in selfko_text and "rail overshoot" not in selfko_text.lower() and "Over / Xtreme" not in selfko_text, selfko_text[:600])
        audit.record("Order analysis renders without failure", bool(page.locator("#orderAnalysis").inner_text().strip()))
        page.locator("#runForecastButton").click()
        page.wait_for_function("document.querySelector('#runForecastButton').disabled === false && document.querySelector('#runForecastButton').textContent === 'Run forecast'", timeout=30000)
        forecast_text = page.locator("#forecastResults").inner_text()
        audit.record("Forecast action completes", bool(forecast_text.strip()) and "Run the forecast" not in forecast_text, forecast_text[:500])

        # Initial navigation already certifies a physical mobile tap. Use a DOM click here
        # to avoid Playwright actionability stalls after the asynchronous simulation.
        page.evaluate("document.querySelector('[data-nav=\"more\"]').click()")
        page.locator("#view-more").wait_for(state="visible", timeout=10000)
        page.locator("#addMetaButton").click()
        meta = page.locator("#metaForm")
        meta.locator('input[name="name"]').fill("Audit field")
        meta.locator('input[name="weight"]').fill("1.25")
        meta.locator('select[name="position1"]').select_option("stamina")
        meta.locator('select[name="position2"]').select_option("attack")
        meta.locator('select[name="position3"]').select_option("balance")
        meta.evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Meta-profile management saves weighted lineup", any(item["name"] == "Audit field" and item["weight"] == 1.25 for item in state["metaProfiles"]))

        page.locator("#addProfileButton").click()
        profile = page.locator("#profileForm")
        profile.locator('input[name="name"]').fill("Audit 5-point")
        profile.locator('input[name="targetPoints"]').fill("5")
        profile.locator('select[name="lockChipPolicy"]').select_option("tt-v12")
        profile.locator('textarea[name="bannedParts"]').fill("bit-metal-needle")
        profile.locator('textarea[name="notes"]').fill("Audit-local organizer clause")
        profile.evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Custom tournament profile persists", len(state["customProfiles"]) == 1 and state["customProfiles"][0]["targetPoints"] == 5)

        settings = page.locator("#settingsForm")
        settings.locator('input[name="minimumBattles"]').fill("42")
        settings.locator('input[name="targetPerCell"]').fill("6")
        settings.locator('input[name="targetPerOpponent"]').fill("4")
        settings.locator('input[name="opponentPoolSize"]').fill("80")
        settings.locator('input[name="candidatePool"]').fill("52")
        settings.locator('input[name="minimumSelfKoTestsPerBey"]').fill("6")
        settings.locator('input[name="maxObservedSelfKoRate"]').fill("0.12")
        settings.locator('input[name="showGuide"]').uncheck()
        settings.evaluate("form => form.requestSubmit()")
        state = state_snapshot(page)
        audit.record("Readiness and engineering-search policy persists", state["settings"]["minimumBattles"] == 42 and state["settings"]["targetPerCell"] == 6 and state["settings"]["targetPerOpponent"] == 4 and state["settings"]["opponentPoolSize"] == 80 and state["settings"]["candidatePool"] == 52 and state["settings"]["minimumSelfKoTestsPerBey"] == 6 and state["settings"]["maxObservedSelfKoRate"] == 0.12)
        nav(page, "dashboard")
        audit.record("Guide cards can be hidden", not page.locator("#quickGuide").is_visible())
        nav(page, "more")
        settings = page.locator("#settingsForm")
        settings.locator('input[name="showGuide"]').check()
        settings.evaluate("form => form.requestSubmit()")
        nav(page, "dashboard")
        audit.record("Guide cards can be restored", page.locator("#quickGuide").is_visible() and page.locator("#guideSteps .guide-step").count() == 4)
        nav(page, "more")

        page.locator("#runAuditButton").click()
        diagnostics = page.locator("#diagnostics").inner_text()
        audit.record("Diagnostics report integrity pass", "Integrity checks pass" in diagnostics and '"catalogPass": true' in diagnostics)

        page.locator("#exportBackupButton").click()
        backup_text = page.evaluate("window.__auditLastBlob.text()")
        backup = json.loads(backup_text)
        checksum = page.evaluate("payload => window.XCore.fnv1a(JSON.stringify(payload.state))", backup)
        audit.record("Backup export includes valid checksum", backup["checksum"] == checksum)
        audit.record("Backup export uses current schema", backup["schemaVersion"] == 7 and backup["appVersion"] == "3.0.0")

        normal_error_count = len(audit.normal_console_errors)
        audit.record("Normal workflow has no console errors", normal_error_count == 0, "; ".join(audit.normal_console_errors))
        audit.record("Normal workflow has no uncaught errors", len(audit.page_errors) == 0, "; ".join(audit.page_errors))

        audit.phase = "negative"
        tampered = json.loads(json.dumps(backup))
        tampered["state"]["decks"][0]["name"] = "Tampered Deck"
        tampered_path = temporary_json(tampered)
        page.locator("#importBackupInput").set_input_files(tampered_path)
        page.wait_for_function("document.querySelector('#backupStatus').textContent.includes('checksum mismatch')")
        audit.record("Tampered backup is rejected", "checksum mismatch" in page.locator("#backupStatus").inner_text().lower())
        os.unlink(tampered_path)

        valid_restore = json.loads(json.dumps(backup))
        valid_restore["state"]["decks"][0]["name"] = "Restored Certified Deck"
        valid_restore["checksum"] = page.evaluate("payload => window.XCore.fnv1a(JSON.stringify(payload.state))", valid_restore)
        restore_path = temporary_json(valid_restore)
        page.locator("#importBackupInput").set_input_files(restore_path)
        page.wait_for_function("document.querySelector('#backupStatus').textContent.includes('checksum verified')")
        state = state_snapshot(page)
        audit.record("Valid backup imports and normalizes", state["decks"][0]["name"] == "Restored Certified Deck")
        os.unlink(restore_path)

        duplicate_patch = {
            "schemaVersion": 1,
            "parts": [{"id": "audit-blade", "name": "Audit Blade", "category": "blade", "role": "balance"}],
            "products": [
                {"id": "AUDIT-001", "name": "Audit Product A", "parts": ["audit-blade"]},
                {"id": "AUDIT-001", "name": "Audit Product B", "parts": ["audit-blade"]},
            ],
        }
        duplicate_path = temporary_json(duplicate_patch)
        before_custom_products = len(state_snapshot(page)["customProducts"])
        page.locator("#importCatalogInput").set_input_files(duplicate_path)
        page.wait_for_timeout(100)
        after_custom_products = len(state_snapshot(page)["customProducts"])
        audit.record("Duplicate product IDs in one catalog patch are rejected", before_custom_products == after_custom_products)
        os.unlink(duplicate_path)

        valid_patch = {
            "schemaVersion": 1,
            "parts": [{"id": "audit-blade-valid", "name": "Audit Blade Valid", "category": "blade", "role": "balance"}],
            "products": [{"id": "AUDIT-VALID", "name": "Audit Product Valid", "parts": ["audit-blade-valid"]}],
        }
        valid_patch_path = temporary_json(valid_patch)
        page.locator("#importCatalogInput").set_input_files(valid_patch_path)
        page.wait_for_function("JSON.parse(window.__auditStorage['x-deck-lab-state-v2']).customProducts.some(p => p.id === 'AUDIT-VALID')")
        state = state_snapshot(page)
        audit.record("Valid catalog patch imports", any(item["id"] == "audit-blade-valid" for item in state["customParts"]) and any(item["id"] == "AUDIT-VALID" for item in state["customProducts"]))
        os.unlink(valid_patch_path)

        undersized = page.evaluate("""() => Array.from(document.querySelectorAll('button, label.button')).filter((el) => { const rect = el.getBoundingClientRect(); return rect.width && rect.height && (rect.width < 44 || rect.height < 44); }).map((el) => ({ id: el.id || '', text: (el.textContent || '').trim().slice(0, 40), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }))""")
        audit.record("Visible button targets meet 44 px minimum", len(undersized) == 0, json.dumps(undersized))
        audit.record("Final workflow has no horizontal overflow", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))

        nav(page, "dashboard")
        page.evaluate("""() => { window.scrollTo(0, 0); const toast = document.querySelector('#toast'); if (toast) { toast.classList.remove('show'); toast.style.display = 'none'; } }""")
        page.screenshot(path=str(HOME_SCREENSHOT_PATH), full_page=False)
        audit.record("Guided home-screen screenshot captured", HOME_SCREENSHOT_PATH.exists() and HOME_SCREENSHOT_PATH.stat().st_size > 0)

        nav(page, "results")
        page.evaluate("""() => {
          document.activeElement?.blur();
          const skip = document.querySelector('.skip-link'); if (skip) skip.style.display = 'none';
          const toast = document.querySelector('#toast'); if (toast) { toast.classList.remove('show'); toast.style.display = 'none'; }
          const header = document.querySelector('.app-header'); if (header) header.style.position = 'static';
          const nav = document.querySelector('.bottom-nav'); if (nav) { nav.style.position = 'static'; nav.style.marginTop = '12px'; }
        }""")
        page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
        audit.record("Final guided analysis screenshot captured", SCREENSHOT_PATH.exists() and SCREENSHOT_PATH.stat().st_size > 0)

        persisted = storage_snapshot(page)
        second = context.new_page()
        second.on("pageerror", audit.page_error)
        second.set_content(production_document(persisted), wait_until="load")
        wait_ready(second)
        restored_state = state_snapshot(second)
        audit.record("Fresh application instance restores deck library", restored_state["decks"][0]["name"] == "Restored Certified Deck")
        audit.record("Fresh application instance restores inventory", len(restored_state["inventory"]) >= 14)
        audit.record("Fresh application instance restores battles", len(restored_state["battles"]) == 3)
        second.close()

        browser.close()

    passed = sum(1 for check in audit.checks if check["passed"])
    failed = len(audit.checks) - passed
    result = {
        "application": "X Deck Lab",
        "version": "3.0.0",
        "timestampUtc": datetime.now(timezone.utc).isoformat(),
        "viewport": {**VIEWPORT, "deviceScaleFactor": DEVICE_SCALE_FACTOR, "mobile": True, "touch": True},
        "method": "Unchanged production files injected into Chromium document context; deterministic localStorage shim; service worker tested separately in test.mjs.",
        "durationSeconds": round(time.perf_counter() - started, 3),
        "summary": {"checks": len(audit.checks), "passed": passed, "failed": failed},
        "normalConsoleErrors": audit.normal_console_errors,
        "uncaughtPageErrors": audit.page_errors,
        "expectedValidationLogs": audit.expected_validation_logs,
        "checks": audit.checks,
    }
    RESULT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    result = run()
    print(json.dumps(result["summary"], indent=2))
    raise SystemExit(0 if result["summary"]["failed"] == 0 else 1)
