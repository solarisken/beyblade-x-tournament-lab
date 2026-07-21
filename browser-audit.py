from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re

ROOT = Path(__file__).resolve().parent
checks = []
errors = []

def check(name, condition, detail=''):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
    if not condition:
        raise AssertionError(f'{name}: {detail}')

def shell_html():
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html = re.sub(r'<link rel="manifest"[^>]*>', '', html)
    html = re.sub(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>', '', html)
    html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>{(ROOT / "styles.css").read_text()}</style>')
    html = re.sub(r'<script src="data\.js"></script>\s*<script src="core\.js"></script>\s*<script src="app\.js"></script>', '', html)
    return html

storage_polyfill = """
(() => {
  const store = new Map();
  const storage = {
    getItem: k => store.has(String(k)) ? store.get(String(k)) : null,
    setItem: (k,v) => store.set(String(k), String(v)),
    removeItem: k => store.delete(String(k)),
    clear: () => store.clear(),
    key: i => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; }
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
})();
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, service_workers='block')
    page = context.new_page()
    page.on('console', lambda msg: errors.append(f'console {msg.type}: {msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.set_content(shell_html(), wait_until='load')
    page.add_script_tag(content=storage_polyfill)
    page.evaluate("localStorage.setItem('xCommandCenterStateV1', JSON.stringify({settings:{avoidAttackMirrors:true}}))")
    for name in ['data.js','core.js','app.js']:
        page.add_script_tag(content=(ROOT / name).read_text())
    page.wait_for_timeout(300)

    check('App scripts initialize', bool(page.locator('#readinessHero').inner_text().strip()), '; '.join(errors))
    check('App title renders', page.locator('h1').inner_text() == 'X Command Center')
    check('Five primary navigation items', page.locator('.nav-item').count() == 5)
    check('No mobile horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    check('Command view active', page.locator('#view-command').is_visible())
    check('Readiness hero visible', page.locator('#readinessHero').is_visible())
    check('Retired attack-mirror setting is absent', page.locator('#settingAvoidMirrors').count() == 0)
    check('Attack-movement mirror missions are eligible', page.evaluate("""() => {
      const C = window.XCC_CORE;
      const own = C.normalizeBey({architecture:'standard',blade:'blade-dran-sword',ratchet:'ratchet-3-60',bit:'bit-flat'});
      const opponent = C.normalizeBey({architecture:'standard',blade:'blade-shark-edge',ratchet:'ratchet-1-60',bit:'bit-low-flat'});
      const looseParts = {};
      [...C.getBeyPartIds(own), ...C.getBeyPartIds(opponent)].forEach(id => { looseParts[id] = (looseParts[id] || 0) + 1; });
      const testState = {ownedProducts:{},looseParts,decks:[{id:'m',name:'m',beys:[own]}],activeDeckId:'m',battles:[],settings:{targetPerCell:4,avoidAttackMirrors:true}};
      const missions = C.generateTestMissions(testState, 4);
      return missions.length > 0 && missions.some(m => C.usesAttackMovementBit(m.own) && C.usesAttackMovementBit(m.opponent));
    }"""))
    check('Mobile coverage cards render', page.locator('.coverage-mobile .coverage-card').count() == 3)
    check('Mobile coverage table is hidden', not page.locator('.coverage-table-wrap').is_visible())
    check('Primary mobile navigation touch targets are at least 44px', page.evaluate("[...document.querySelectorAll('.nav-item')].every(el => el.getBoundingClientRect().height >= 44)"))

    page.locator('[data-nav="collection"]').last.click()
    check('Collection view opens', page.locator('#view-collection').is_visible())
    for product_id in ['UX-01','UX-03','UX-06']:
        page.locator(f'[data-product-id="{product_id}"][data-product-change="1"]').click()
    check('Owned product quantities update', page.locator('[data-product-id="UX-01"][data-product-change="-1"]').is_enabled())
    check('Legacy exclusion setting is removed on save', page.evaluate("!('avoidAttackMirrors' in JSON.parse(localStorage.getItem('xCommandCenterStateV1')).settings)"))

    page.locator('[data-nav="deck"]').last.click()
    check('Deck lab opens', page.locator('#view-deck').is_visible())
    page.locator('#optimizeButton').click()
    check('Optimizer dialog opens', page.locator('#optimizerDialog').is_visible())
    check('Optimizer returns a legal deck', page.locator('[data-apply-optimizer]').count() > 0)
    page.locator('[data-apply-optimizer="0"]').click()
    check('Applied deck has three complete previews', page.locator('.bey-preview strong').count() == 3 and all('Incomplete' not in page.locator('.bey-preview strong').nth(i).inner_text() for i in range(3)))
    check('Deck validation passes', page.locator('#deckValidationBadge').inner_text() == 'Legal')

    page.locator('[data-nav="test"]').last.click()
    check('Test lab opens', page.locator('#view-test').is_visible())
    check('Owned-opponent missions generated', page.locator('[data-mission-key]').count() > 1)
    first_key = page.locator('[data-mission-key]').first.get_attribute('data-mission-key')
    page.locator('[data-mission-key]').first.click()
    check('Mission can be selected', page.locator('#saveBattleButton').is_enabled())
    page.locator('input[name="winner"][value="own"]').check()
    page.locator('input[name="finish"][value="spin"]').check()
    page.locator('#saveBattleButton').click()
    page.wait_for_timeout(250)
    check('Battle saved to local state', page.evaluate("JSON.parse(localStorage.getItem('xCommandCenterStateV1')).battles.length") == 1)
    new_first_key = page.locator('[data-mission-key]').first.get_attribute('data-mission-key')
    check('Completed pairing is not immediately repeated', new_first_key != first_key, f'{first_key} -> {new_first_key}')

    page.locator('[data-nav="records"]').last.click()
    check('Records view opens', page.locator('#view-records').is_visible())
    check('Saved battle appears in records', page.locator('.record-card').count() == 1)

    page.locator('#settingsButton').click()
    check('Settings dialog opens', page.locator('#settingsDialog').is_visible())
    check('Mobile form controls use 16px text to avoid focus zoom', page.evaluate("parseFloat(getComputedStyle(document.querySelector('#settingTargetPerCell')).fontSize) >= 16"))
    page.locator('[data-close-dialog="settingsDialog"]').click()

    page.locator('[data-nav="command"]').last.click()
    page.wait_for_timeout(2800)
    page.screenshot(path=str(ROOT / 'mobile-command-center.png'), full_page=True)

    page.set_viewport_size({'width': 320, 'height': 720})
    page.wait_for_timeout(100)
    check('No 320px horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    page.screenshot(path=str(ROOT / 'small-phone-command-center.png'), full_page=True)

    page.set_viewport_size({'width': 1280, 'height': 900})
    page.wait_for_timeout(100)
    check('No desktop horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    page.screenshot(path=str(ROOT / 'desktop-command-center.png'), full_page=True)

    check('No uncaught browser errors', len(errors) == 0, '; '.join(errors))
    browser.close()

result = {
    'checks': checks,
    'passed': sum(1 for c in checks if c['passed']),
    'failed': sum(1 for c in checks if not c['passed']),
    'browserErrors': errors
}
(ROOT / 'browser-audit-result.json').write_text(json.dumps(result, indent=2))
print(json.dumps({'passed': result['passed'], 'failed': result['failed'], 'errors': errors}, indent=2))
