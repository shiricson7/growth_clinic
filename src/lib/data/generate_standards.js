const fs = require('fs');
const path = require('path');

const csvPath = '/Users/shiricson/dev/growth_clinic/height_chart_LMS.csv';
const outputPath = path.join(__dirname, 'standards.ts');

try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');

    // Skip header (lines 0, 1)
    // Data starts at line 2 (index 2)
    // csv structure: sex, age_y, age_m, L, M, S, p1...

    const standards = [];

    for (let i = 2; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 6) continue;

        // Column Mapping based on file view:
        // 0: Sex
        // 1: Age(Y)
        // 2: Age(M)
        // 3: L
        // 4: M
        // 5: S
        // 6: 1st, 7: 3rd, 8: 5th, 9: 10th, 10: 15th, 11: 25th, 12: 50th, 13: 75th, 14: 85th, 15: 90th, 16: 95th, 17: 97th, 18: 99th

        const sex = parseInt(cols[0]);
        const ageMonth = parseInt(cols[2]);
        const L = parseFloat(cols[3]);
        const M = parseFloat(cols[4]);
        const S = parseFloat(cols[5]);
        const p3 = parseFloat(cols[7]);
        const p50 = parseFloat(cols[12]);
        const p97 = parseFloat(cols[17]);

        if (!isNaN(sex) && !isNaN(ageMonth)) {
            standards.push({ sex, age_month: ageMonth, L, M, S, p3, p50, p97 });
        }
    }

    const fileContent = `export interface GrowthStandard {
  sex: 1 | 2; // 1: Male, 2: Female
  age_month: number;
  L: number;
  M: number;
  S: number;
  p3: number;
  p50: number;
  p97: number;
}

export const GROWTH_STANDARDS: GrowthStandard[] = ${JSON.stringify(standards, null, 2)};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`Successfully generated standards.ts with ${standards.length} entries.`);

} catch (err) {
    console.error('Error:', err);
}
