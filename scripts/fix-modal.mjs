import fs from 'fs';

let content = fs.readFileSync('app/page.tsx', 'utf8');

// Fix borderColor
content = content.replace(
  `      <div className="female-catalog-shell" style={{
       borderColor: sexCatalogTab === 'combined'
        ? 'rgba(255, 255, 255, 0.45)'
        : sexCatalogTab === 'female'
        ? 'rgba(244, 114, 182, 0.4)'
        : 'rgba(56, 189, 248, 0.4)'
      }}>`,
  `      <div className="female-catalog-shell" style={{
       borderColor: sexCatalogTab === 'female'
        ? 'rgba(244, 114, 182, 0.4)'
        : 'rgba(56, 189, 248, 0.4)'
      }}>`
);

// Fix grid block
const gridRegex = /\{sexCatalogTab === 'combined' \? \([\s\S]*?\n\s*\) : sexCatalogTab === 'female' \? \(/;
if (gridRegex.test(content)) {
  content = content.replace(gridRegex, "{sexCatalogTab === 'female' ? (");
  console.log('[✓] Removed combined grid block');
} else {
  console.log('[!] gridRegex not matched');
}

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done!');
