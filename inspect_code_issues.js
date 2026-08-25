const fs = require('fs');
const lines = fs.readFileSync('editor.js', 'utf8').split('\n');
const codeIssues = [];
lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    if (/[\u0080-\u00FF]|\?\?\?\?/.test(line)) {
        if (/â|ðŸ|\?\?\?\?|Ã|â€“|â€”|â€™/.test(line)) {
            codeIssues.push({ lineNum: idx + 1, text: trimmed });
        }
    }
});
console.log(`Found ${codeIssues.length} code issues in editor.js:`);
codeIssues.forEach(c => console.log(`${c.lineNum}: ${c.text}`));
