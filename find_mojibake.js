const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.js') || f.endsWith('.html'));

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const problemLines = [];
    lines.forEach((line, idx) => {
        if (/â€|â€“|â€”|â€™|â€˜|ðŸ|â—|âœ|â–|â‰|â˜|â¬|â†|â‚¬|\?\?\?\?/.test(line)) {
            problemLines.push({ lineNum: idx + 1, text: line.trim() });
        }
    });
    if (problemLines.length > 0) {
        console.log(`=== File: ${file} (${problemLines.length} occurrences) ===`);
        problemLines.slice(0, 15).forEach(p => console.log(`  Line ${p.lineNum}: ${p.text.slice(0, 100)}`));
    }
}
