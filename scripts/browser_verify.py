import json, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'X-Tournament-Director-Evidence-First.html').read_text()
out={}
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1280,'height':900})
  page=ctx.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(HTML,wait_until='domcontentloaded'); page.wait_for_timeout(100)
  out['empty']={'entries':page.locator('#inventoryCount').inner_text(),'analysis_null':page.evaluate('window.XTournamentCoach.state.analysis===null'),'validation_hidden':page.locator('#coachResults').evaluate('(e)=>e.classList.contains("hidden")')}
  codes=['BX-49','UX-14','CX-16','UX-19','UX-08','CX-09','CX-10','BX-23','UX-11']
  for code in codes:
    page.locator('#quickAdd').fill(code); page.locator('#quickAddButton').click()
  page.wait_for_function('window.XTournamentCoach.state.analysis && window.XTournamentCoach.state.analysis.decks.length',timeout=60000)
  page.locator('.nav-button[data-nav="coach"]').click(); page.wait_for_timeout(250)
  initial_status=page.locator('#validationBadge').inner_text(); initial_conf=page.locator('#leaderConfidence').inner_text()
  out['analysis']={'entries':page.evaluate('window.XTournamentCoach.state.entries.length'),'legal':page.evaluate('window.XTournamentCoach.legalDeck(window.XTournamentCoach.state.analysis.decks[0].combos)'),'status':initial_status,'confidence':initial_conf,'validation_checks':page.locator('#validationChecklist .validation-check').count(),'test_action':page.locator('#validationNextTitle').inner_text()}
  page.locator('#openValidationTest').click(); page.wait_for_timeout(100)
  out['test_open']={'lab_active':page.locator('#view-lab').evaluate('(e)=>e.classList.contains("active")'),'start_enabled':page.locator('#startTest').is_enabled(),'side':page.evaluate('window.XTournamentCoach.state.currentTest?.side'),'flip_potential':page.evaluate('window.XTournamentCoach.state.currentTest?.flipPotential'),'decision_impact':page.evaluate('window.XTournamentCoach.state.currentTest?.decisionImpact')}
  page.locator('#startTest').click()
  page.locator('[data-result="win:spin"]').click(); page.locator('[data-result="loss:over"]').click(); page.locator('[data-result="win:xtreme"]').click()
  page.wait_for_function('window.XTournamentCoach.state.evidence.length===1 && window.XTournamentCoach.state.analysis && window.XTournamentCoach.state.analysis.decks.length',timeout=60000)
  page.locator('.nav-button[data-nav="coach"]').click(); page.wait_for_timeout(200)
  out['after_test']={'evidence_batches':page.evaluate('window.XTournamentCoach.state.evidence.length'),'direct_total':page.evaluate('window.XTournamentCoach.validationStatus(window.XTournamentCoach.state.analysis.decks[0]).totalDirect'),'status':page.locator('#validationBadge').inner_text(),'confidence':page.locator('#leaderConfidence').inner_text()}
  out['rules']=page.evaluate('''() => { const api=window.XTournamentCoach,cs=api.state.analysis.shortlist; const bullet=cs.filter(c=>c.name.startsWith('BulletGriffon')); const separate=bullet.some(c=>c.parts.some(p=>p.category==='ratchet')); const nine=cs.filter(c=>c.parts.some(p=>p.category==='ratchet'&&p.name==='9-60')); const third=cs.find(c=>!c.parts.some(p=>p.category==='ratchet'&&p.name==='9-60')); return {bullet_separate_ratchet:separate,duplicate_9_60_accepted:Boolean(nine[0]&&nine[1]&&third&&api.legalDeck([nine[0],nine[1],third]))}; }''')
  page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(150); out['mobile']={'overflow':page.evaluate('document.body.scrollWidth-window.innerWidth')}; page.screenshot(path=str(ROOT/'data/mobile.png'),full_page=True)
  out['errors']=errors; ctx.close(); browser.close()
(ROOT/'data/browser-verification.json').write_text(json.dumps(out,indent=2)); print(json.dumps(out,indent=2))
