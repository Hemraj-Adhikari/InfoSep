// Load university data from external JSON file.
// Uses a synchronous request so the rest of this script (which relies on
// DB/KEYS being ready immediately) doesn't need to change.
let DB, KEYS;
{
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'data.json', false);
  xhr.send(null);
  DB = JSON.parse(xhr.responseText);
  KEYS = Object.keys(DB);
}

// Official domains — used to pull each university's real logo for the home page cards.
const UNI_DOMAIN = {
  YSJU: 'yorksj.ac.uk',
  WORCESTER: 'worc.ac.uk',
  UEL: 'uel.ac.uk',
  UWL: 'uwl.ac.uk',
  UCB: 'ucb.ac.uk',
  HERTS: 'herts.ac.uk',
  BEDFORDSHIRE: 'beds.ac.uk',
  LTU: 'leedstrinity.ac.uk',
  ARDEN: 'arden.ac.uk',
  UCA: 'uca.ac.uk',
  BNU: 'bnu.ac.uk',
  MDX: 'mdx.ac.uk',
  REGENT: 'regent.ac.uk',
  PLYMOUTH: 'plymouth.ac.uk',
  WOLVERHAMPTON: 'wlv.ac.uk',
  RAVENSBOURNE: 'ravensbourne.ac.uk',
  ROEHAMPTON: 'roehampton.ac.uk',
  HSU: 'hsu.ac.uk',
  WINCHESTER: 'winchester.ac.uk',
  PORTSMOUTH: 'port.ac.uk',
  UCLAN: 'uclan.ac.uk',
  SALFORD: 'salford.ac.uk',
  ESSEX: 'essex.ac.uk',
  CARDIFF: 'cardiffmet.ac.uk',
  BCU: 'bcu.ac.uk',
  BATHSPA: 'bathspa.ac.uk',
  BRIGHTON: 'brighton.ac.uk',
  CHESTER: 'chester.ac.uk',
  ASTON: 'aston.ac.uk',
  HULL: 'hull.ac.uk',
  NORTHUMBRIA: 'northumbria.ac.uk',
  SUNDERLAND: 'sunderland.ac.uk',
  LMU: 'londonmet.ac.uk',
  COVENTRY: 'coventry.ac.uk',
  LAW: 'law.ac.uk',
  ULSTER: 'ulster.ac.uk',
  UWS: 'uws.ac.uk',
  CCCU: 'canterbury.ac.uk',
  EDINBURGH: 'napier.ac.uk',
  UWSTD: 'uwtsd.ac.uk',
  LMUISC: 'londonmet.ac.uk',
  UOWISC: 'wlv.ac.uk',
  LHUISC: 'hope.ac.uk',
  UCIC: 'cumbria.ac.uk'
};
let mode = 'uni';
let query = '';
let courseQuery = '';
let activeKey = null;
let activeLevel = 'ALL';
let courseSearch = '';

// ===== PALETTE =====
const PALETTE = ['#C99A2E','#2B6B5F','#E8BC4A','#5B7FA8','#9B8DC2','#C87A6A','#7AB89A','#B05D3A'];
function colorFor(key){
  let h=0; for(const c of key) h=(h*31+c.charCodeAt(0))%997;
  return PALETTE[h%PALETTE.length];
}

// ===== CRITERIA ICONS & STYLES =====
const CRIT_META = {
  'ACADEMIC CRITERIA':          {icon:'🎓', cls:''},
  'ENGLISH LANGUAGE CRITERIA':  {icon:'💬', cls:'highlight-english'},
  'ENGLISH WAIVER CRITERIA':    {icon:'📋', cls:'highlight-waiver'},
  'FEE STRUCTURE':              {icon:'💳', cls:'highlight-fee'},
  'SCHOLARSHIP':                {icon:'🎁', cls:'highlight-scholar'},
  'GAP':                        {icon:'⏳', cls:''},
  'CAS DEPOSIT':                {icon:'💰', cls:''},
  'CAS DEPOSIT PAYMENT DEADLINE':{icon:'📅', cls:''},
  'ENROLLMENT FEE':             {icon:'🧾', cls:''},
  'ENROLMENT FEE':              {icon:'🧾', cls:''},
  'DEADLINES':                  {icon:'📅', cls:''},
  'DEADLINE':                   {icon:'📅', cls:''},
};
function critMeta(k){
  const ku = k.toUpperCase().trim();
  // Direct prefix match first
  for(const [mk, mv] of Object.entries(CRIT_META)){
    if(ku.startsWith(mk)) return mv;
  }
  // Fallback: catch any deadline-flavoured key
  if(ku.includes('DEADLINE')) return {icon:'📅', cls:''};
  return {icon:'', cls:''};
}

// ===== STATS =====
function totalCourses(){ return KEYS.reduce((s,k)=>s+DB[k].courses.filter(c=>c.name).length,0); }
// ===== LEVEL BADGE =====
function lvlBadge(lvl){
  if(!lvl) return '';
  const lu = (lvl||'').toUpperCase().replace(/[\s\-\/]/g,'');
  let cls = 'lvl-'+lu.toLowerCase();
  if(lu.includes('UG')) cls='lvl-UG';
  else if(lu.includes('PG') || lu === 'MBA' || lu.startsWith('MSC') || lu.startsWith('MA') || lu.startsWith('LLM') || lu.startsWith('MRES')) cls='lvl-PG';
  else if(lu.includes('TOPUP') || lu.includes('TOP-UP') || lu.includes('LEVEL6')) cls='lvl-top';
  else if(lu.includes('NURS')) cls='lvl-nursing';
  else if(lu.includes('IY1') || lu.includes('IFY') || lu.includes('PATH')) cls='lvl-path';
  return `<span class="lvl-badge ${cls}">${esc(lvl)}</span>`;
}

// ===== ESC =====
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== MODE =====
function setMode(m){
  mode = m;
  document.getElementById('tabUni').classList.toggle('active', m==='uni');
  document.getElementById('tabCourse').classList.toggle('active', m==='course');
  document.getElementById('homeSearch').placeholder = m==='uni' ? 'Search universities…' : 'Search courses — e.g. nursing, MBA, computer science…';
  // Show Level filter only in course search; hide Sort By in course search
  const levelEl = document.getElementById('filterLevel');
  const sortEl  = document.getElementById('sortBy');
  if(levelEl) levelEl.style.display = m==='course' ? '' : 'none';
  if(sortEl)  sortEl.style.display  = m==='uni'    ? '' : 'none';
  renderHome();
}

// ===== EMPTY STATE BUILDER =====
// Returns HTML for a premium empty state.
// icon: inline SVG path (stroke-based, 20×20 viewBox)
// heading: short bold line
// sub: one-sentence helper text
// action: optional { label, onclick } for a clear-filters button
function emptyState({ icon, heading, sub, action } = {}){
  const defaultIcon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>`;
  const actionHtml = action
    ? `<button class="empty-state-action" onclick="${action.onclick}">${esc(action.label)}</button>`
    : '';
  return `<div class="empty-state">
    <div class="empty-state-mark">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        ${icon || defaultIcon}
      </svg>
    </div>
    <div class="empty-state-heading">${heading || 'Nothing found'}</div>
    <div class="empty-state-sub">${sub || 'Try adjusting your search.'}</div>
    ${actionHtml}
  </div>`;
}

// ===== DEBOUNCE UTILITY =====
// Returns a debounced version of fn that fires 300ms after the last call.
function debounce(fn, delay){
  let timer;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ===== HOME RENDER =====
function onSearch(){
  if(mode==='uni') query = document.getElementById('homeSearch').value;
  else courseQuery = document.getElementById('homeSearch').value;
  renderHome();
}

// Debounced version wired to the search input via oninput (replaces direct call)
const onSearchDebounced = debounce(onSearch, 300);

function onFilterChange(){ renderHome(); }
function onSortChange(){ renderHome(); }

function renderHome(){
  const v = document.getElementById('home-view');
  if(mode==='course'){ v.innerHTML = renderCourseSearch(); bindCourseResults(); return; }
  
  let list = KEYS.filter(k=>{
    const q = query.toLowerCase();
    return !q || DB[k].title.toLowerCase().includes(q) || k.toLowerCase().includes(q);
  });

  // Filter by level
  const levelFilter = document.getElementById('filterLevel') ? document.getElementById('filterLevel').value : '';
  if(levelFilter){
    list = list.filter(k => DB[k].categories.some(c => c.toUpperCase().includes(levelFilter)));
  }

  // Sort
  const sortVal = document.getElementById('sortBy') ? document.getElementById('sortBy').value : '';
  if(sortVal === 'az'){
    list = [...list].sort((a,b) => DB[a].title.localeCompare(DB[b].title));
  } else if(sortVal === 'courses'){
    list = [...list].sort((a,b) => DB[b].courses.filter(c=>c.name).length - DB[a].courses.filter(c=>c.name).length);
  }

  if(!list.length){ v.innerHTML = emptyState({
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 9.172L6.343 6.343M14.828 9.172l2.829-2.829M9.172 14.828L6.343 17.657M14.828 14.828l2.829 2.829M12 21a9 9 0 100-18 9 9 0 000 18z"/>`,
    heading: 'No universities found',
    sub: `No results${query ? ` for <strong>"${esc(query)}"</strong>` : ''}${levelFilter ? ` in <strong>${levelFilter.charAt(0)+levelFilter.slice(1).toLowerCase()}</strong>` : ''}. Try adjusting your search or filters.`,
    action: { label: '✕ Clear all filters', onclick: "document.getElementById('homeSearch').value='';document.getElementById('filterLevel').value='';document.getElementById('sortBy').value='';query='';renderHome();" }
  }); return; }
  
  v.innerHTML = `<div class="uni-grid">${list.map(k=>{
    const u=DB[k], nc=u.courses.filter(c=>c.name).length;
    const feeArr = u.criteria['FEE STRUCTURE'];

    // Build UG and PG fee labels separately
    const cats = u.categories.map(c => c.toUpperCase());
    const hasUG = cats.some(c => c.includes('UNDERGRADUATE') || c.includes('DIRECT UNDERGRADUATE') || c.includes('INTERNATIONAL YEAR') || c.includes('INTERNATIONAL FOUNDATION'));
    const hasPG = cats.some(c => c.includes('POSTGRADUATE') || c.includes('EXTENDED MASTERS') || c.includes('ENHANCED EXTENDED MASTERS'));

    function extractFee(raw){
      if(!raw) return '';
      const m = raw.match(/£[\d,]+(?:\/[-]?)?/);
      return m ? m[0].replace(/\/-$/, '').replace(/\/$/, '') : '';
    }

    // Find UG fee: first non-PG-looking entry in feeArr
    let ugFee = '', pgFee = '';
    if(feeArr && feeArr.length){
      // Try to match UG (first entry that doesn't start with MBA/MSc/MA/LLM/PG)
      const ugEntry = feeArr.find(f => f && !/^(MBA|MSc|MA |LLM|PG|Postgraduate)/i.test(f.trim()));
      const pgEntry = feeArr.find(f => f && /^(MBA|MSc|MA |LLM|PG|Postgraduate)/i.test(f.trim()));

      // Fallback: use index position based on categories
      if(!ugEntry && !pgEntry){
        // All entries are generic — map by position to categories
        ugFee = hasUG ? extractFee(feeArr[0]) : '';
        pgFee = hasPG ? extractFee(feeArr[feeArr.length > 1 ? feeArr.length-1 : 0]) : '';
      } else {
        ugFee = hasUG ? extractFee(ugEntry || feeArr[0]) : '';
        pgFee = hasPG ? extractFee(pgEntry || (feeArr.length > 1 ? feeArr[feeArr.length-1] : feeArr[0])) : '';
      }

      // If both fees are identical and there's only one category level, don't duplicate
      if(ugFee && pgFee && ugFee === pgFee && feeArr.length === 1){
        pgFee = '';
      }
    }

    const feeHtml = [
      ugFee ? `<span class="cs-fee cs-fee-ug" title="Undergraduate fee">UG: ${esc(ugFee + '/yr')}</span>` : '',
      pgFee ? `<span class="cs-fee cs-fee-pg" title="Postgraduate fee">PG: ${esc(pgFee + '/yr')}</span>` : ''
    ].filter(Boolean).join('');

    // Check for upcoming deadline in categories (e.g. "Application Deadline: ...")
    const deadlineCat = u.categories.find(c => c.toLowerCase().includes('deadline'));
    const hasDeadline = !!deadlineCat;

    // Title-case helper — CSS handles it but keep data clean
    const titleCased = u.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    // Pills — up to 3 category tags
    const pills = u.categories.slice(0,3).filter(c => !c.toLowerCase().includes('deadline'));

    const deadlineHtml = hasDeadline ? `
      <div class="cs-deadline">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Priority Deadline Approaching
      </div>` : '';

    return `<div class="uni-card" data-key="${k}">
      <div class="card-accent" style="background:${colorFor(k)}"></div>
      <div class="card-body">
        <div class="card-title-wrap">
          <div class="card-logo-row">
            <img class="card-logo" src="https://www.google.com/s2/favicons?domain=${UNI_DOMAIN[k] || ''}&sz=128" alt="${esc(titleCased)} logo" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('no-logo')">
            <div class="card-title">${esc(titleCased)}</div>
          </div>
          <div class="card-title-line"></div>
        </div>
        <div class="card-cats">${pills.map(c=>{
          const cl = c.toLowerCase();
          const lvl = cl.includes('undergraduate') ? 'undergraduate' : cl.includes('postgraduate') ? 'postgraduate' : 'other';
          return `<span class="cat-pill" data-lvl="${lvl}">${esc(c.charAt(0)+c.slice(1).toLowerCase())}</span>`;
        }).join('')}</div>
        <div style="flex-grow:1;"></div>
        <div class="card-stats">
          <div class="card-stats-row">
            <div class="cs-courses">
              <span class="cs-courses-num">${nc}</span>
              <span class="cs-courses-label">courses<br>available</span>
            </div>
            <span class="cs-intake">Sep 2026</span>
          </div>
          ${feeHtml ? `<div class="card-stats-row card-fees-row">${feeHtml}</div>` : ''}
          ${deadlineHtml}
        </div>
      </div>
      <div class="card-actions">
        <button class="card-btn card-btn-primary" data-action="criteria" data-key="${k}">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Entry Criteria
        </button>
        <button class="card-btn card-btn-secondary" data-action="courses" data-key="${k}">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          Courses
        </button>
      </div>
    </div>`;
  }).join('')}</div>`;
  
  document.querySelectorAll('.uni-card').forEach(el => {
    // Card body click → open to criteria tab (default)
    el.addEventListener('click', e => {
      // If the click was on or inside a .card-btn, let the button handler deal with it
      if (e.target.closest('.card-btn')) return;
      openUni(el.dataset.key);
    });
  });

  // Action buttons — Entry Criteria or Courses tab
  document.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // don't bubble to card
      const key    = btn.dataset.key;
      const action = btn.dataset.action; // 'criteria' | 'courses'
      openUni(key);
      // After openUni sets up the detail page, switch to the right tab
      if (action === 'courses') showDetailTab('courses');
    });
  });
}

function renderCourseSearch(){
  if(!courseQuery.trim()) return emptyState({
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
      d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>`,
    heading: 'Search all courses',
    sub: `Type a subject, degree, or keyword to search across all ${KEYS.length} universities.`
  });
  const q = courseQuery.toLowerCase();

  // Read the level filter — values are 'UNDERGRADUATE' | 'POSTGRADUATE' | ''
  const levelFilter = (document.getElementById('filterLevel')?.value || '').toUpperCase();

  // Helper: does a course's level string match the selected filter?
  function levelMatches(c){
    if(!levelFilter) return true; // no filter active → show all
    const lu = (c.level||'').toUpperCase().replace(/[\s\-\/]/g,'');
    if(levelFilter === 'UNDERGRADUATE'){
      // UG: explicit UG tag, or level contains "UG", or Top-Up / Level-6 / Foundation-year
      return lu.includes('UG') || lu.includes('UNDERGRADUATE') ||
             lu.includes('TOPUP') || lu.includes('TOP-UP') || lu.includes('LEVEL6') ||
             lu.includes('IY1') || lu.includes('IFY') || lu.includes('PATH');
    }
    if(levelFilter === 'POSTGRADUATE'){
      // PG: explicit PG tag, or MBA / MSc / MA / LLM / MRes / MPhil / MArch / MEng
      return lu.includes('PG') || lu.includes('POSTGRADUATE') ||
             lu === 'MBA' || lu.startsWith('MSC') || lu.startsWith('MA') ||
             lu.startsWith('LLM') || lu.startsWith('MRES') || lu.startsWith('MPHIL') ||
             lu.startsWith('MARCH') || lu.startsWith('MENG') || lu.startsWith('POSTGRAD');
    }
    return true;
  }

  let results=[];
  KEYS.forEach(k=>{
    DB[k].courses
      .filter(c => c.name && c.name.toLowerCase().includes(q) && levelMatches(c))
      .forEach(c=>results.push({...c,uni:DB[k].title,key:k}));
  });

  const levelLabel = levelFilter === 'UNDERGRADUATE' ? ' (Undergraduate only)'
                   : levelFilter === 'POSTGRADUATE'  ? ' (Postgraduate only)'
                   : '';

  if(!results.length) return emptyState({
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
      d="M9.172 9.172L6.343 6.343M14.828 9.172l2.829-2.829M9.172 14.828L6.343 17.657M14.828 14.828l2.829 2.829M12 21a9 9 0 100-18 9 9 0 000 18z"/>`,
    heading: 'No matching courses',
    sub: `Nothing found for "${esc(courseQuery)}"${esc(levelLabel)}. Try a different keyword or change the level filter.`,
    action: levelFilter ? { label: 'Clear level filter', onclick: "document.getElementById('filterLevel').value='';onFilterChange();" } : null
  });
  return `<div class="course-count" style="font-family:Manrope,sans-serif;font-size:12px;color:var(--muted);margin-bottom:10px;">${results.length} matching courses${esc(levelLabel)} — click any to view university</div>` +
    results.slice(0,300).map(r=>`
    <div class="course-result" data-key="${r.key}" title="View ${esc(r.uni)}">
      <div><div class="cr-name">${esc(r.name)}</div><div class="cr-uni">${esc(r.uni)}</div></div>
      <div class="cr-uni">${esc(r.intake||'Sep 2026')}</div>
      <div style="display:flex;align-items:center;gap:6px;">${lvlBadge(r.level)}<span class="course-result-arrow">→</span></div>
    </div>`).join('') +
    (results.length>300?`<div class="empty-msg">Showing first 300 — refine your search.</div>`:'');
}

function bindCourseResults(){
  document.querySelectorAll('.course-result').forEach(el=>el.addEventListener('click',()=>openUni(el.dataset.key)));
}

// ===== PAGE & TAB FADE HELPERS =====

// Fade OUT `outEl`, then call `swap()`, then fade IN `inEl`.
// Works by removing/adding a single class — no inline opacity juggling elsewhere.
function fadePage(outEl, inEl, swap){
  if(!outEl && !inEl){ swap(); return; }

  const doIn = () => {
    inEl.style.display = 'block';
    // Let the browser paint the display:block before adding the class
    requestAnimationFrame(() => {
      requestAnimationFrame(() => inEl.classList.add('page-fade-in'));
    });
  };

  if(outEl && outEl.classList.contains('page-fade-in')){
    outEl.classList.remove('page-fade-in');
    const onOut = () => {
      outEl.removeEventListener('transitionend', onOut);
      outEl.style.display = 'none';
      swap();
      doIn();
    };
    outEl.addEventListener('transitionend', onOut);
  } else {
    if(outEl) outEl.style.display = 'none';
    swap();
    doIn();
  }
}

// Fade between two tab panels (both stay in DOM; only one visible at a time)
function fadeTab(hideEl, showEl, afterSwap){
  if(hideEl && hideEl.classList.contains('tab-panel-visible')){
    hideEl.classList.remove('tab-panel-visible');
    const onHide = () => {
      hideEl.removeEventListener('transitionend', onHide);
      hideEl.style.display = 'none';
      showEl.style.display = 'block';
      afterSwap && afterSwap();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => showEl.classList.add('tab-panel-visible'));
      });
    };
    hideEl.addEventListener('transitionend', onHide);
  } else {
    if(hideEl) hideEl.style.display = 'none';
    showEl.style.display = 'block';
    afterSwap && afterSwap();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => showEl.classList.add('tab-panel-visible'));
    });
  }
}

// ===== OPEN UNI =====
function openUni(key){
  activeKey = key;
  activeLevel = 'ALL';
  courseSearch = '';

  const homePage   = document.getElementById('home-page');
  const detailPage = document.getElementById('detail-page');
  const toolbar    = document.getElementById('page-hero-section');

  fadePage(homePage, detailPage, () => {
    toolbar.style.display = 'none';
    document.getElementById('btnHome').classList.add('visible');

    const u = DB[key];
    document.getElementById('bc-current').textContent  = u.title;
    document.getElementById('detail-title').textContent = u.title;
    document.getElementById('detail-cats').innerHTML    = u.categories.map(c=>`<span class="uni-cat">${esc(c)}</span>`).join('');

    const idx = KEYS.indexOf(key);
    document.getElementById('btnPrevUni').disabled = idx === 0;
    document.getElementById('btnNextUni').disabled = idx === KEYS.length - 1;

    renderDetailCriteria(u);
    // Reset tab panels: criteria visible, courses hidden
    const critEl    = document.getElementById('detail-criteria');
    const coursesEl = document.getElementById('detail-courses');
    critEl.style.display    = 'block';
    coursesEl.style.display = 'none';
    critEl.classList.add('tab-panel-visible');
    coursesEl.classList.remove('tab-panel-visible');
    document.getElementById('dtab-criteria').classList.add('active');
    document.getElementById('dtab-courses').classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function navUni(dir){
  const idx = KEYS.indexOf(activeKey);
  const nk = KEYS[idx+dir];
  if(nk) openUni(nk);
}

function showHome(){
  const homePage   = document.getElementById('home-page');
  const detailPage = document.getElementById('detail-page');
  const toolbar    = document.getElementById('page-hero-section');

  fadePage(detailPage, homePage, () => {
    toolbar.style.display = '';
    document.getElementById('btnHome').classList.remove('visible');
    activeKey = null;
  });
}

// ===== DETAIL TABS =====
function showDetailTab(tab){
  const u         = DB[activeKey];
  const critEl    = document.getElementById('detail-criteria');
  const coursesEl = document.getElementById('detail-courses');

  document.getElementById('dtab-criteria').classList.toggle('active', tab === 'criteria');
  document.getElementById('dtab-courses').classList.toggle('active',  tab === 'courses');

  if(tab === 'criteria'){
    fadeTab(coursesEl, critEl);
  } else {
    // FIX: render courses AFTER the panel is made visible so layout/grid computes correctly
    fadeTab(critEl, coursesEl, () => {
      renderDetailCourses(u);
      // Re-enforce ct-row grid in case display toggling caused a layout reset
      coursesEl.querySelectorAll('.ct-row, .ct-head').forEach(el => {
        el.style.display = 'grid';
      });
    });
  }
}

// ===== CRITERIA RENDER =====
// Maps criterion key → { icon, sublabel } for richer header identity
function formatCritVal(v){
  if(!v) return '';
  const lines = v.split(/\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length <= 1){
    return `<div class="crit-val-plain">${esc(v)}</div>`;
  }
  return lines.map(l=>`<div class="crit-val-line">${esc(l)}</div>`).join('');
}

function renderDetailCriteria(u){
  const cats = u.categories;
  
  let html = `<div class="criteria-section">
    <div class="criteria-title">Entry Requirements</div>
    <div class="criteria-grid">`;
  
  for(const [k, vals] of Object.entries(u.criteria)){
    const m    = critMeta(k);
    const nonEmptyVals = vals.map((v,i)=>({v,i})).filter(({v})=>v && v.trim());
    if(nonEmptyVals.length === 0) continue;

    // Normalise display label
    const LABEL_NORM = {
      'cas deposit':                   'CAS DEPOSIT',
      'cas deposit payment deadline':  'CAS DEPOSIT PAYMENT DEADLINE',
      'enrollment fee':                'ENROLLMENT FEE',
      'enrolment fee':                 'ENROLLMENT FEE',
      'deadline':                      'DEADLINE',
      'deadlines':                     'DEADLINES',
      'deadline for booking cis':      'DEADLINE — BOOKING CIs',
      'deadline to provide all documents to meet offer conditions': 'DEADLINE — OFFER CONDITIONS',
    };
    const displayLabel = LABEL_NORM[k.toLowerCase().trim()] || k.toUpperCase();

    // Sublabel per card type
    const sublabelMap = {
      'ACADEMIC':         'GPA · Grades · Qualifications',
      'ENGLISH LANGUAGE': 'IELTS · TOEFL · PTE',
      'ENGLISH WAIVER':   'Exemption conditions',
      'FEE STRUCTURE':    'Tuition · Deposit · Fees',
      'SCHOLARSHIP':      'Awards · Discounts',
      'GAP':              'Acceptable gap period',
      'CAS':              'CAS Deposit details',
      'ENROLLMENT':       'Enrolment fees',
      'DEADLINE':         'Key dates',
    };
    let sublabel = '';
    const ku = k.toUpperCase();
    for(const [sk, sv] of Object.entries(sublabelMap)){
      if(ku.startsWith(sk)){ sublabel = sv; break; }
    }

    // ALWAYS use side-by-side column layout (UCB style).
    // If more than 2 non-empty vals, group them: first col = first entry,
    // second col = remaining entries merged, using cats[0]/cats[1] as headers.
    // This ensures every card looks identical regardless of how many categories the uni has.
    let colsHtml = '';
    if(nonEmptyVals.length === 1){
      // Single value — one full-width col, no header pill
      colsHtml = `<div class="crit-col crit-col-full">${formatCritVal(nonEmptyVals[0].v)}</div>`;
    } else {
      // 2+ values — show as side-by-side columns, max 2 cols
      // If 3-5 cols exist, pair them: [0] left, [1..n] right (each separated by a thin rule)
      const leftEntry  = nonEmptyVals[0];
      const rightEntries = nonEmptyVals.slice(1);

      const leftHead  = cats[leftEntry.i]  || cats[0] || '';
      const rightHead = cats[rightEntries[0].i] || cats[1] || '';

      const rightContent = rightEntries.map(({v, i}) => {
        const extraHead = rightEntries.length > 1 ? (cats[i] || '') : '';
        return `${extraHead ? `<div class="crit-col-head crit-col-head-inner">${esc(extraHead)}</div>` : ''}${formatCritVal(v)}`;
      }).join('<div class="crit-col-divider"></div>');

      colsHtml = `
        <div class="crit-col">
          ${leftHead  ? `<div class="crit-col-head">${esc(leftHead)}</div>`  : ''}
          ${formatCritVal(leftEntry.v)}
        </div>
        <div class="crit-col">
          ${rightHead && rightEntries.length === 1 ? `<div class="crit-col-head">${esc(rightHead)}</div>` : ''}
          ${rightContent}
        </div>`;
    }
    
    html += `<div class="crit-card ${m.cls}">
      <div class="crit-header" onclick="toggleCritCard(this)">
        <div class="crit-header-text">
          <span class="crit-label">${esc(displayLabel)}</span>
          ${sublabel ? `<span class="crit-sublabel">${sublabel}</span>` : ''}
        </div>
        <div class="crit-chevron">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div class="crit-body">
        <div class="crit-cols">${colsHtml}</div>
      </div>
    </div>`;
  }
  
  html += `</div>
    <div class="criteria-note">
      <span class="criteria-note-icon">ℹ️</span>
      <span style="flex:1 1 220px;"><strong>Note:</strong> Entry requirements are subject to change. Please contact our admissions team for the latest information.</span>
      <a class="criteria-contact-btn" href="https://www.realdreamsedu.com/" target="_blank" rel="noopener" style="margin-left:auto;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Contact Admissions
      </a>
    </div>
  </div>`;

  document.getElementById('detail-criteria').innerHTML = html;
  initCritAccordions();
}

function initCritAccordions(){
  const isMobile = window.matchMedia('(max-width: 680px)').matches;
  document.querySelectorAll('.crit-card').forEach(card => {
    const body = card.querySelector('.crit-body');
    if(!body) return;
    if(isMobile){
      // Collapsed: measure nothing, set to 0
      body.style.maxHeight = '0px';
      card.classList.remove('is-open');
    } else {
      // Desktop: always expanded, no max-height clamp
      body.style.maxHeight = 'none';
      card.classList.add('is-open');
    }
  });
}

function toggleCritCard(headerEl){
  // Only interactive on mobile
  if(!window.matchMedia('(max-width: 680px)').matches) return;

  const card = headerEl.closest('.crit-card');
  if(!card) return;
  const body = card.querySelector('.crit-body');
  if(!body) return;

  const isOpen = card.classList.contains('is-open');

  if(isOpen){
    // Collapse: fix current height first, then animate to 0
    body.style.maxHeight = body.scrollHeight + 'px';
    // Force reflow so transition fires
    body.offsetHeight; // eslint-disable-line no-unused-expressions
    body.style.maxHeight = '0px';
    card.classList.remove('is-open');
  } else {
    // Expand: animate from 0 to scrollHeight, then release to 'none'
    body.style.maxHeight = body.scrollHeight + 'px';
    card.classList.add('is-open');
    // Once transition ends, set to 'none' so content reflow works freely
    body.addEventListener('transitionend', function onEnd(e){
      if(e.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', onEnd);
      if(card.classList.contains('is-open')){
        body.style.maxHeight = 'none';
      }
    });
  }
}

// ===== COURSES RENDER =====
function renderDetailCourses(u){
  const courses = u.courses.filter(c=>c.name);
  const levels = ['ALL', ...[...new Set(courses.map(c=>c.level))]];
  const container = document.getElementById('detail-courses');

  // Only build the toolbar once (or when levels change) — don't rebuild on every search keystroke
  if(!container.querySelector('.courses-toolbar')){
    container.innerHTML = `<div class="courses-sticky-header">
      <div class="courses-toolbar">
        ${levels.map(l=>`<button class="lvl-chip ${activeLevel===l?'active':''}" onclick="setLevel('${l.replace(/'/g,"\'")}')">
          ${esc(l)}</button>`).join('')}
        <input class="courses-search" type="text" placeholder="Filter courses…"
          oninput="onCourseSearch(this.value)">
      </div>
      <div class="ct-head"><span>Course</span><span>Level</span><span>Intake</span><span>Campus / Notes</span></div>
    </div><div id="courses-table-wrap"></div>`;
  } else {
    // Update active chip styles without touching the input
    container.querySelectorAll('.lvl-chip').forEach(btn=>{
      btn.classList.toggle('active', btn.textContent.trim()===activeLevel);
    });
  }

  // Restore input value without moving focus
  const inp = container.querySelector('.courses-search');
  if(inp && inp !== document.activeElement) inp.value = courseSearch;

  const filtered = u.courses.filter(c=>{
    if(!c.name && !c.section) return false;
    if(c.section) return true;
    const lvlOk = activeLevel==='ALL' || c.level===activeLevel;
    const qOk = !courseSearch || c.name.toLowerCase().includes(courseSearch.toLowerCase());
    return lvlOk && qOk;
  });

  let rows = '';
  for(const c of filtered){
    if(c.section){
      rows += `<div class="ct-section">${esc(c.section)}</div>`;
    } else {
      rows += `<div class="ct-row" onclick="showDetailTab('criteria');window.scrollTo({top:0,behavior:'smooth'});" title="View entry criteria for this university">
        <span>${esc(c.name)}</span>
        <span>${lvlBadge(c.level)}</span>
        <span class="ct-intake">${esc(c.intake||'Sep 2026')}</span>
        <span class="ct-extra ct-extra-action"><span class="ct-extra-text">${esc(c.campus||c.extra||'')}</span><span class="ct-view-criteria">Entry Criteria →</span></span>
      </div>`;
    }
  }

  const shown = filtered.filter(c=>c.name).length;
  const noMatchHtml = emptyState({
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
      d="M3 7h14M3 12h9m-9 5h5m8-5l2 2 4-4"/>`,
    heading: 'No courses match',
    sub: 'Try clearing the search field or selecting a different level.',
    action: { label: 'Reset filters', onclick: "courseSearch='';activeLevel='ALL';renderDetailCourses(DB[activeKey]);" }
  });
  document.getElementById('courses-table-wrap').innerHTML = `
    <div class="course-table">
      ${rows || noMatchHtml}
    </div>
    <div class="course-count">${shown} of ${courses.length} courses shown</div>`;
}

function setLevel(l){
  activeLevel=l; renderDetailCourses(DB[activeKey]);
}
function onCourseSearch(v){
  courseSearch=v; renderDetailCourses(DB[activeKey]);
}

// ===== SHARE FUNCTIONS =====
function getShareData(){
  const u = DB[activeKey];
  if(!u) return null;
  // Build a shareable URL with university key as hash
  const url  = window.location.href.split('#')[0] + '#uni=' + encodeURIComponent(activeKey);
  const name = u.name;
  return { url, name };
}

function shareWhatsApp(){
  const d = getShareData(); if(!d) return;
  const text = `Check out ${d.name} on Route 2 Uni — Sep 2026 Intake!\n${d.url}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

function shareEmail(){
  const d = getShareData(); if(!d) return;
  const subject = encodeURIComponent(`${d.name} — Route 2 Uni Sep 2026`);
  const body    = encodeURIComponent(
    `Hi,\n\nI wanted to share this university with you:\n\n${d.name}\n${d.url}\n\nYou can view the full entry criteria and available courses on the Route 2 Uni Partner Portal.\n\nBest regards`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function showToast(msg){
  const t = document.getElementById('shareToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 2800);
}

// ===== EXPORT TO PDF =====
function exportToPDF(){
  const u = DB[activeKey];
  if(!u) return;

  const critEl    = document.getElementById('detail-criteria');
  const coursesEl = document.getElementById('detail-courses');

  // Temporarily show criteria, hide courses
  const criteriaWasHidden = (critEl.style.display === 'none');
  const coursesWasVisible = (coursesEl.style.display !== 'none');

  if(criteriaWasHidden){
    critEl.style.display = 'block';
    critEl.style.opacity = '1';
  }
  if(coursesWasVisible){
    coursesEl.style.display = 'none';
  }

  // Force all crit-body panels fully open + visible
  document.querySelectorAll('.crit-body').forEach(b => {
    b.dataset._prevMaxHeight = b.style.maxHeight;
    b.dataset._prevOverflow  = b.style.overflow;
    b.dataset._prevOpacity   = b.style.opacity;
    b.style.maxHeight  = 'none';
    b.style.height     = 'auto';
    b.style.overflow   = 'visible';
    b.style.opacity    = '1';
    b.style.visibility = 'visible';
    b.style.display    = 'block';
  });

  // Force crit-card animations done
  document.querySelectorAll('.crit-card').forEach(c => {
    c.style.opacity   = '1';
    c.style.transform = 'none';
  });

  // Set document title = university name for PDF filename
  const prevTitle = document.title;
  document.title  = `${u.title} — Route 2 Uni`;

  window.print();

  // Restore after print dialog closes
  document.title = prevTitle;

  document.querySelectorAll('.crit-body').forEach(b => {
    b.style.maxHeight  = b.dataset._prevMaxHeight || '';
    b.style.height     = '';
    b.style.overflow   = b.dataset._prevOverflow  || '';
    b.style.opacity    = b.dataset._prevOpacity   || '';
    b.style.visibility = '';
    b.style.display    = '';
    delete b.dataset._prevMaxHeight;
    delete b.dataset._prevOverflow;
    delete b.dataset._prevOpacity;
  });

  document.querySelectorAll('.crit-card').forEach(c => {
    c.style.opacity   = '';
    c.style.transform = '';
  });

  if(criteriaWasHidden){
    critEl.style.display = 'none';
    critEl.style.opacity = '';
  }
  if(coursesWasVisible){
    coursesEl.style.display = '';
  }
}

// ===== THEME (DARK / LIGHT MODE) =====
// Apply saved theme from localStorage on page load (eliminates flicker via inline script in <head>)
(function initTheme(){
  const saved = localStorage.getItem('r2u-theme');
  if(saved === 'dark'){
    document.body.classList.add('dark-theme');
  }
  // Clean up the pending sentinel added in <head>
  document.documentElement.classList.remove('dark-theme-pending');
})();

function toggleTheme(){
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('r2u-theme', isDark ? 'dark' : 'light');
}

// ===== BACK TO TOP =====
function scrollToTop(){
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

(function initBackToTop(){
  const btn = document.getElementById('backToTop');
  if(!btn) return;
  const THRESHOLD = 300; // show after scrolling 300px
  // Initial state
  btn.classList.toggle('visible', window.scrollY > THRESHOLD);
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > THRESHOLD);
  }, { passive: true });
})();

// ===== DEEP-LINK HANDLING (#uni=key) =====
// Reads the "uni" key out of the URL hash (e.g. set by getShareData()/copyLink())
// and opens that university's detail view directly, instead of always
// falling back to the home page. Without this, a shared link like
// "#uni=worcester" loaded the page with an empty/blank detail view
// (no criteria cards), since nothing ever read the hash on load.
function getUniKeyFromHash(){
  const hash = window.location.hash || '';
  const match = hash.match(/uni=([^&]+)/);
  if(!match) return null;
  const key = decodeURIComponent(match[1]);
  return DB[key] ? key : null;
}

function openUniFromHash(){
  const key = getUniKeyFromHash();
  if(!key) return false;

  // Show the detail page directly (no fade-from-home transition needed,
  // since the home page was never the active view in this case).
  document.getElementById('home-page').style.display = 'none';
  document.getElementById('detail-page').style.display = 'block';
  document.getElementById('detail-page').classList.add('page-fade-in');

  openUni(key);
  return true;
}

// Keep the view in sync if the hash changes without a full reload
// (e.g. user clicks a different shared link, or uses browser back/forward).
window.addEventListener('hashchange', () => {
  if(!openUniFromHash()){
    showHome();
  }
});

// ===== INIT =====
if(!openUniFromHash()){
  renderHome();
}

// Re-initialise criteria accordions if the viewport crosses the mobile breakpoint
// (e.g. user rotates phone or resizes a browser window)
let _lastMobile = window.matchMedia('(max-width: 680px)').matches;
window.addEventListener('resize', () => {
  const isMobile = window.matchMedia('(max-width: 680px)').matches;
  if(isMobile !== _lastMobile){
    _lastMobile = isMobile;
    // Only re-init if the criteria tab is currently visible
    if(document.getElementById('detail-criteria').style.display !== 'none'){
      initCritAccordions();
    }
  }
});
