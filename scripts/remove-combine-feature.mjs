import fs from 'fs';

const pagePath = 'app/page.tsx';
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Remove #btn-sub-combined-catalog-m from male subtoolbar
const maleSubCombinedTarget = `     <button
      type="button"
      id="btn-sub-combined-catalog-m"
      onClick={() => setMode('dimorphic')}
      style={{
       background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(14, 165, 233, 0.3))',
       color: '#ffffff',
       border: '1px solid rgba(255, 255, 255, 0.3)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       display: 'flex',
       alignItems: 'center',
       gap: '4px',
       marginLeft: '8px'
      }}
     >
      🚻 Combined Dimorphic 3D (107)
     </button>`;

if (content.includes(maleSubCombinedTarget)) {
  content = content.replace(maleSubCombinedTarget, '');
  console.log('[✓] Removed btn-sub-combined-catalog-m');
} else {
  console.log('[!] maleSubCombinedTarget not found, check formatting');
}

// 2. Remove #btn-sub-combined-catalog-f from female subtoolbar
const femaleSubCombinedTarget = `     <button
      type="button"
      id="btn-sub-combined-catalog-f"
      onClick={() => setMode('dimorphic')}
      style={{
       background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(14, 165, 233, 0.3))',
       color: '#ffffff',
       border: '1px solid rgba(255, 255, 255, 0.3)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       display: 'flex',
       alignItems: 'center',
       gap: '4px',
       marginLeft: '8px'
      }}
     >
      🚻 Combined Dimorphic 3D (107)
     </button>`;

if (content.includes(femaleSubCombinedTarget)) {
  content = content.replace(femaleSubCombinedTarget, '');
  console.log('[✓] Removed btn-sub-combined-catalog-f');
} else {
  console.log('[!] femaleSubCombinedTarget not found, check formatting');
}

// 3. Remove mode === 'dimorphic' subtoolbar
const dimorphicSubtoolbarTarget = `   {mode === 'dimorphic' && (
    <div style={{
     position: 'absolute',
     top: '47px',
     left: 0,
     right: 0,
     height: '36px',
     background: 'rgba(15, 23, 42, 0.85)',
     backdropFilter: 'blur(12px)',
     borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     gap: '8px',
     zIndex: 99
    }}>
     <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, marginRight: '4px' }}>
      🚻 Dimorphic 3D Filter:
     </span>
     <button
      type="button"
      id="btn-dimorphic-filter-all"
      onClick={() => setDimorphicFilter('all')}
      style={{
       background: dimorphicFilter === 'all' ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.35), rgba(56, 189, 248, 0.35))' : 'rgba(255,255,255,0.06)',
       color: dimorphicFilter === 'all' ? '#fff' : '#cbd5e1',
       border: dimorphicFilter === 'all' ? '1px solid rgba(255, 255, 255, 0.5)' : '1px solid rgba(255,255,255,0.1)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       boxShadow: dimorphicFilter === 'all' ? '0 0 10px rgba(236, 72, 153, 0.3)' : 'none'
      }}
     >
      🚻 All 107 (Both Sexes in 3D)
     </button>
     <button
      type="button"
      id="btn-dimorphic-filter-female"
      onClick={() => setDimorphicFilter('female')}
      style={{
       background: dimorphicFilter === 'female' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(255,255,255,0.06)',
       color: dimorphicFilter === 'female' ? '#f472b6' : '#cbd5e1',
       border: dimorphicFilter === 'female' ? '1px solid #f472b6' : '1px solid rgba(255,255,255,0.1)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       boxShadow: dimorphicFilter === 'female' ? '0 0 10px rgba(236, 72, 153, 0.3)' : 'none'
      }}
     >
      🌸 77 Female Only
     </button>
     <button
      type="button"
      id="btn-dimorphic-filter-male"
      onClick={() => setDimorphicFilter('male')}
      style={{
       background: dimorphicFilter === 'male' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)',
       color: dimorphicFilter === 'male' ? '#38bdf8' : '#cbd5e1',
       border: dimorphicFilter === 'male' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       boxShadow: dimorphicFilter === 'male' ? '0 0 10px rgba(56, 189, 248, 0.3)' : 'none'
      }}
     >
      ⚡ 30 Male Only
     </button>

     <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />

     <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, marginRight: '4px' }}>
      3D Spatial Layout:
     </span>
     <button
      type="button"
      id="btn-dimorphic-layout-side"
      onClick={() => setDimorphicArrangement('side-by-side')}
      style={{
       background: dimorphicArrangement === 'side-by-side' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255,255,255,0.06)',
       color: dimorphicArrangement === 'side-by-side' ? '#c084fc' : '#cbd5e1',
       border: dimorphicArrangement === 'side-by-side' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer'
      }}
      title="Female organs positioned on Left (-22cm), Male organs on Right (+22cm) for side-by-side comparative inspection"
     >
      ↔️ Side-by-Side Dual View
     </button>
     <button
      type="button"
      id="btn-dimorphic-layout-super"
      onClick={() => setDimorphicArrangement('superimposed')}
      style={{
       background: dimorphicArrangement === 'superimposed' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255,255,255,0.06)',
       color: dimorphicArrangement === 'superimposed' ? '#34d399' : '#cbd5e1',
       border: dimorphicArrangement === 'superimposed' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer'
      }}
      title="Exact anatomical [X, Y, Z] spatial coordinates (Superimposed Parity)"
     >
      🎯 Exact Superimposed
     </button>

     <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />

     <button
      type="button"
      id="btn-dimorphic-open-catalog"
      onClick={() => { setSexCatalogTab('combined'); setFemaleCatalogOpen(true); setPanel(null); }}
      style={{
       background: 'rgba(255,255,255,0.12)',
       color: '#ffffff',
       border: '1px solid rgba(255,255,255,0.3)',
       borderRadius: '4px',
       padding: '2px 10px',
       fontSize: '11px',
       fontWeight: 700,
       cursor: 'pointer',
       display: 'flex',
       alignItems: 'center',
       gap: '4px'
      }}
     >
      📋 107 Catalog
     </button>
    </div>
   )}`;

if (content.includes(dimorphicSubtoolbarTarget)) {
  content = content.replace(dimorphicSubtoolbarTarget, '');
  console.log('[✓] Removed dimorphicSubtoolbar');
} else {
  console.log('[!] dimorphicSubtoolbarTarget not found, check formatting');
}

// 4. Update header.identity to remove dimorphic mode
const headerIdentityTarget = `   <header className="identity" style={{ top: '94px' }}>
    <div className="eyebrow">
     <span className="status-dot" style={mode === 'dimorphic' ? { background: '#ec4899', boxShadow: '0 0 8px #ec4899' } : undefined} />{' '}
     {mode === 'female' ? 'FEMALE 3D ATLAS' :
      mode === 'dimorphic' ? 'SEX-DIMORPHIC PARITY (107 STRUCTURES)' :
      mode === 'pregnancy' ? 'GESTATIONAL DYNAMICS' :
      mode === 'aging' ? 'LIFESPAN ONTOGENY' :
      'MALE 3D ATLAS'}
    </div>
    <h1>
     {mode === 'female' ? 'OmniWoman' :
      mode === 'dimorphic' ? 'Dimorphic Parity' :
      'Human Atlas'}
     <Badge variant="outline" className="edition" style={mode === 'dimorphic' ? { borderColor: '#ec4899', color: '#f472b6' } : undefined}>
      {mode === 'dimorphic' ? '107' : '3D'}
     </Badge>
    </h1>
    <div className="identity-meta">
     {atlas ? atlas.parts.length.toLocaleString() : '2,234'} modeled structures{' '}
     <span>·</span>{' '}
     {mode === 'dimorphic' ? (
      dimorphicFilter === 'female' ? '77 Female-Only Unique Structures' :
      dimorphicFilter === 'male' ? '30 Male-Only Unique Structures' :
      '107 Dimorphic Structures (77 🌸 + 30 ⚡) · ' + (dimorphicArrangement === 'side-by-side' ? 'Side-by-Side Dual View' : 'Exact Superimposed Parity')
     ) : (atlas?.name || 'Human Anatomy')}
    </div>
   </header>`;

const headerIdentityReplacement = `   <header className="identity" style={{ top: '94px' }}>
    <div className="eyebrow">
     <span className="status-dot" />{' '}
     {mode === 'female' ? (femalePath === 'female-dimorphic' ? 'FEMALE-ONLY UNIQUE ANATOMY (77)' : 'FEMALE 3D ATLAS') :
      mode === 'male' ? (malePath === 'male-dimorphic' ? 'MALE-ONLY UNIQUE ANATOMY (30)' : 'MALE 3D ATLAS') :
      mode === 'pregnancy' ? 'GESTATIONAL DYNAMICS' :
      'LIFESPAN ONTOGENY'}
    </div>
    <h1>
     {mode === 'female' ? 'OmniWoman' :
      mode === 'male' ? 'OmniMan' :
      'Human Atlas'}
     <Badge variant="outline" className="edition">
      3D
     </Badge>
    </h1>
    <div className="identity-meta">
     {atlas ? atlas.parts.length.toLocaleString() : '2,234'} modeled structures{' '}
     <span>·</span>{' '}
     {atlas?.name || 'Human Anatomy'}
    </div>
   </header>`;

if (content.includes(headerIdentityTarget)) {
  content = content.replace(headerIdentityTarget, headerIdentityReplacement);
  console.log('[✓] Updated headerIdentity');
} else {
  console.log('[!] headerIdentityTarget not found');
}

// 5. Update nav btn-toggle-dimorphic-side
const navToggleSideTarget = `    <Button
     variant="ghost"
     id="btn-toggle-dimorphic-side"
     className={panel === 'layers' && leftPanelTab === 'dimorphic' ? 'active' : ''}
     onClick={() => {
      setLeftPanelTab('dimorphic');
      setPanel(p => (p === 'layers' && leftPanelTab === 'dimorphic') ? null : 'layers');
     }}
     aria-label="Sex-Unique Anatomy Sidebar"
     style={{
      border: '1px solid rgba(244, 114, 182, 0.4)',
      background: 'linear-gradient(135deg, rgba(236,72,153,0.22), rgba(56,189,248,0.22))',
      color: '#f8fafc',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
     }}
     title="Toggle 107 Sex-Unique Anatomy in Left Panel"
    >
     <span>🚻</span>
     <span>Sex-Unique (107)</span>
    </Button>`;

const navToggleSideReplacement = `    <Button
     variant="ghost"
     id="btn-toggle-dimorphic-side"
     className={panel === 'layers' && leftPanelTab === 'dimorphic' ? 'active' : ''}
     onClick={() => {
      setLeftPanelTab('dimorphic');
      setPanel(p => (p === 'layers' && leftPanelTab === 'dimorphic') ? null : 'layers');
     }}
     aria-label="Sex-Unique Anatomy Sidebar"
     style={{
      border: mode === 'male' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(244, 114, 182, 0.4)',
      background: mode === 'male' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(236, 72, 153, 0.16)',
      color: '#f8fafc',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
     }}
     title={mode === 'male' ? "Toggle 30 Men's Unique Anatomy in Left Panel" : "Toggle 77 Women's Unique Anatomy in Left Panel"}
    >
     <span>{mode === 'male' ? '⚡' : '🌸'}</span>
     <span>{mode === 'male' ? "Men's Unique (30)" : "Women's Unique (77)"}</span>
    </Button>`;

if (content.includes(navToggleSideTarget)) {
  content = content.replace(navToggleSideTarget, navToggleSideReplacement);
  console.log('[✓] Updated navToggleSide');
} else {
  console.log('[!] navToggleSideTarget not found');
}

// 6. Update left panel tab button & content
const leftPanelTabTarget = `    <div className="dimorphic-panel-tab-bar">
     <button
      type="button"
      className={\`dimorphic-panel-tab \${leftPanelTab === 'systems' ? 'active' : ''}\`}
      onClick={() => setLeftPanelTab('systems')}
     >
      🧬 Systems
     </button>
     <button
      type="button"
      className={\`dimorphic-panel-tab dimorphic-tab-btn \${leftPanelTab === 'dimorphic' ? 'active' : ''}\`}
      onClick={() => setLeftPanelTab('dimorphic')}
     >
      🚻 Sex-Unique (107)
     </button>
    </div>

    {leftPanelTab === 'dimorphic' ? (
     <div className="flex flex-col flex-1 min-h-0">
      <div className="dimorphic-filter-row">
       <button
        type="button"
        className={\`dimorphic-filter-btn \${dimorphicSexFilter === 'all' ? 'active' : ''}\`}
        onClick={() => setDimorphicSexFilter('all')}
       >
        All (107)
       </button>
       <button
        type="button"
        className={\`dimorphic-filter-btn female-active \${dimorphicSexFilter === 'female' ? 'active' : ''}\`}
        onClick={() => setDimorphicSexFilter('female')}
       >
        🌸 Female (77)
       </button>
       <button
        type="button"
        className={\`dimorphic-filter-btn \${dimorphicSexFilter === 'male' ? 'active' : ''}\`}
        onClick={() => setDimorphicSexFilter('male')}
       >
        ⚡ Male (30)
       </button>
      </div>
      <div className="dimorphic-search-input-wrap">
       <span className="dimorphic-search-icon">🔍</span>
       <input
        type="text"
        className="dimorphic-search-input"
        placeholder="Filter 107 sex-unique parts..."
        value={dimorphicSearch}
        onChange={e => setDimorphicSearch(e.target.value)}
       />
      </div>`;

const leftPanelTabReplacement = `    <div className="dimorphic-panel-tab-bar">
     <button
      type="button"
      className={\`dimorphic-panel-tab \${leftPanelTab === 'systems' ? 'active' : ''}\`}
      onClick={() => setLeftPanelTab('systems')}
     >
      🧬 Systems
     </button>
     <button
      type="button"
      className={\`dimorphic-panel-tab dimorphic-tab-btn \${leftPanelTab === 'dimorphic' ? 'active' : ''}\`}
      onClick={() => setLeftPanelTab('dimorphic')}
     >
      {mode === 'male' ? "⚡ Male-Unique (30)" : "🌸 Female-Unique (77)"}
     </button>
    </div>

    {leftPanelTab === 'dimorphic' ? (
     <div className="flex flex-col flex-1 min-h-0">
      <div className="dimorphic-search-input-wrap" style={{ marginTop: '8px' }}>
       <span className="dimorphic-search-icon">🔍</span>
       <input
        type="text"
        className="dimorphic-search-input"
        placeholder={mode === 'male' ? "Filter 30 men's unique parts..." : "Filter 77 women's unique parts..."}
        value={dimorphicSearch}
        onChange={e => setDimorphicSearch(e.target.value)}
       />
      </div>`;

if (content.includes(leftPanelTabTarget)) {
  content = content.replace(leftPanelTabTarget, leftPanelTabReplacement);
  console.log('[✓] Updated leftPanelTab');
} else {
  console.log('[!] leftPanelTabTarget not found');
}

// 7. Update left panel footer
const leftPanelFootTarget = `      <div className="panel-foot">
       <span>{filteredDimorphicParts.length} of 107 dimorphic parts</span>
       <Button variant="ghost" onClick={() => { setDimorphicSearch(''); setDimorphicSexFilter('all'); }}>
        Reset
       </Button>
      </div>`;

const leftPanelFootReplacement = `      <div className="panel-foot">
       <span>{filteredDimorphicParts.length} of {mode === 'male' ? maleUniqueParts.length : femaleUniqueParts.length} parts</span>
       <Button variant="ghost" onClick={() => setDimorphicSearch('')}>
        Reset
       </Button>
      </div>`;

if (content.includes(leftPanelFootTarget)) {
  content = content.replace(leftPanelFootTarget, leftPanelFootReplacement);
  console.log('[✓] Updated leftPanelFoot');
} else {
  console.log('[!] leftPanelFootTarget not found');
}

// 8. Update bottom shelf tray top header and remove All 107
const shelfTrayTopTarget = `       <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-white">🚻 Sex-Unique Structures (107 Combined)</span>
        <span className="text-[10px] text-slate-400">· Exact 3D Positions &amp; Anatomy</span>
       </div>
       <div className="flex items-center gap-2">
        <div className="flex gap-1">
         <button
          type="button"
          className={\`dimorphic-filter-btn \${dimorphicSexFilter === 'all' ? 'active' : ''}\`}
          onClick={() => setDimorphicSexFilter('all')}
         >
          All (107)
         </button>
         <button
          type="button"
          className={\`dimorphic-filter-btn female-active \${dimorphicSexFilter === 'female' ? 'active' : ''}\`}
          onClick={() => setDimorphicSexFilter('female')}
         >
          🌸 Female (77)
         </button>
         <button
          type="button"
          className={\`dimorphic-filter-btn \${dimorphicSexFilter === 'male' ? 'active' : ''}\`}
          onClick={() => setDimorphicSexFilter('male')}
         >
          ⚡ Male (30)
         </button>
        </div>
        <button
         type="button"
         className="text-slate-400 hover:text-white text-xs px-2 py-1 cursor-pointer"
         onClick={() => setBottomTrayOpen(false)}
        >
         ✕
        </button>
       </div>`;

const shelfTrayTopReplacement = `       <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-white">
         {mode === 'male' ? "⚡ Men's Unique Structures (30)" : "🌸 Women's Unique Structures (77)"}
        </span>
        <span className="text-[10px] text-slate-400">· Exact 3D Positions &amp; Anatomy</span>
       </div>
       <div className="flex items-center gap-2">
        <button
         type="button"
         className="text-slate-400 hover:text-white text-xs px-2 py-1 cursor-pointer"
         onClick={() => setBottomTrayOpen(false)}
        >
         ✕
        </button>
       </div>`;

if (content.includes(shelfTrayTopTarget)) {
  content = content.replace(shelfTrayTopTarget, shelfTrayTopReplacement);
  console.log('[✓] Updated shelfTrayTop');
} else {
  console.log('[!] shelfTrayTopTarget not found');
}

// 9. Update modal tabs: remove tab-toggle-combined
const modalTabsTarget = `      {/* Sex-Specific Catalog Switcher Tabs */}
      <div style={{
       display: 'flex',
       gap: '8px',
       padding: '12px 24px 0 24px',
       background: 'rgba(9, 14, 28, 0.98)',
       borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
       <button
        type="button"
        id="tab-toggle-combined"
        onClick={() => setSexCatalogTab('combined')}
        style={{
         flex: 1.2,
         padding: '10px 16px',
         borderRadius: '8px 8px 0 0',
         fontSize: '13px',
         fontWeight: 700,
         cursor: 'pointer',
         background: sexCatalogTab === 'combined' ? 'linear-gradient(135deg, rgba(236,72,153,0.35), rgba(14,165,233,0.35))' : 'rgba(255,255,255,0.03)',
         color: sexCatalogTab === 'combined' ? '#ffffff' : '#94a3b8',
         borderTop: sexCatalogTab === 'combined' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
         borderLeft: sexCatalogTab === 'combined' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
         borderRight: sexCatalogTab === 'combined' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
         borderBottom: 'none',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         gap: '8px',
         boxShadow: sexCatalogTab === 'combined' ? '0 0 16px rgba(56,189,248,0.25)' : 'none',
         transition: 'all 0.15s ease'
        }}
       >
        🚻 All 107 Combined (77 🌸 + 30 ⚡)
       </button>
       <button
        type="button"
        id="tab-toggle-female"`;

const modalTabsReplacement = `      {/* Sex-Specific Catalog Switcher Tabs */}
      <div style={{
       display: 'flex',
       gap: '8px',
       padding: '12px 24px 0 24px',
       background: 'rgba(9, 14, 28, 0.98)',
       borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
       <button
        type="button"
        id="tab-toggle-female"`;

if (content.includes(modalTabsTarget)) {
  content = content.replace(modalTabsTarget, modalTabsReplacement);
  console.log('[✓] Updated modalTabs');
} else {
  console.log('[!] modalTabsTarget not found');
}

// 10. Update modal header
const modalHeaderTarget = `      <header className="female-catalog-head" style={{
       background: sexCatalogTab === 'combined'
        ? 'linear-gradient(180deg, rgba(236, 72, 153, 0.14) 0%, rgba(14, 165, 233, 0.14) 50%, rgba(9, 14, 28, 0) 100%)'
        : sexCatalogTab === 'female'
        ? 'linear-gradient(180deg, rgba(236, 72, 153, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
        : 'linear-gradient(180deg, rgba(14, 165, 233, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
      }}>
       {sexCatalogTab === 'combined' ? (
        <div>
         <span className="female-catalog-badge" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(56,189,248,0.3))', borderColor: 'rgba(255,255,255,0.35)', color: '#ffffff' }}>
          🚻 107 VERIFIED SEX-DIMORPHIC STRUCTURES COMBINED (77 FEMALE + 30 MALE)
         </span>
         <div className="female-catalog-heading">Human Sex-Unique Anatomy · Combined Parity &amp; Dimorphism Catalog</div>
         <div className="female-catalog-sub">
          Comprehensive inventory of sexually dimorphic human anatomy: 77 female structures (Gynecoid Pelvis, Clitoral-Vestibular Complex, Uterovaginal Architecture, Mammary Dissection) + 30 male structures (Android Pelvis, Penile Erectile Bodies, Testicular &amp; Spermatic Conduit, Prostate Gland).
         </div>
        </div>
       ) : sexCatalogTab === 'female' ? (`;

const modalHeaderReplacement = `      <header className="female-catalog-head" style={{
       background: sexCatalogTab === 'female'
        ? 'linear-gradient(180deg, rgba(236, 72, 153, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
        : 'linear-gradient(180deg, rgba(14, 165, 233, 0.14) 0%, rgba(9, 14, 28, 0) 100%)'
      }}>
       {sexCatalogTab === 'female' ? (`;

if (content.includes(modalHeaderTarget)) {
  content = content.replace(modalHeaderTarget, modalHeaderReplacement);
  console.log('[✓] Updated modalHeader');
} else {
  console.log('[!] modalHeaderTarget not found');
}

// 11. Remove sexCatalogTab === 'combined' controls block
// Find from `{sexCatalogTab === 'combined' ? (` to `) : sexCatalogTab === 'female' ? (`
const combinedControlsRegex = /\{sexCatalogTab === 'combined' \? \([\s\S]*?\n\s*\) : sexCatalogTab === 'female' \? \(/;
if (combinedControlsRegex.test(content)) {
  content = content.replace(combinedControlsRegex, "{sexCatalogTab === 'female' ? (");
  console.log('[✓] Removed combined controls block');
} else {
  console.log('[!] combinedControlsRegex not found');
}

// 12. Remove sexCatalogTab === 'combined' grid block
const combinedGridRegex = /\{sexCatalogTab === 'combined' \? \([\s\S]*?\n\s*\) : sexCatalogTab === 'female' \? \(/;
if (combinedGridRegex.test(content)) {
  content = content.replace(combinedGridRegex, "{sexCatalogTab === 'female' ? (");
  console.log('[✓] Removed combined grid block');
} else {
  console.log('[!] combinedGridRegex not found');
}

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Finished updating app/page.tsx!');
