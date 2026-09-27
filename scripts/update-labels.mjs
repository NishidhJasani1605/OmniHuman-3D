import fs from 'fs';

let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(
  "{p === 'female-fullbody' ? '✨ Full-Body Parity (2,280)' : p === 'female-trunk-hra' ? '🏛️ NIH HRA Trunk (358)' : '🔬 VHF Hybrid (2,280)'}",
  "{p === 'female-fullbody' ? '✨ Full-Body Parity (2,279)' : p === 'female-trunk-hra' ? '🏛️ NIH HRA Trunk (357)' : '🔬 VHF Hybrid (2,279)'}"
);

fs.writeFileSync('app/page.tsx', code, 'utf8');
console.log('Updated app/page.tsx counts to 2,279 and 357');
