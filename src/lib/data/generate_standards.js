const fs = require('fs');
const path = require('path');

const heightCsvPath = path.resolve(__dirname, '../../../height_chart_LMS.csv');
const weightCsvPath = path.resolve(__dirname, '../../../weight_chart_LMS.csv');
const outputPath = path.join(__dirname, 'standards.ts');

const parseCsv = (csvPath) => {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    const standards = [];

    for (let i = 2; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 6) continue;

        const sex = parseInt(cols[0], 10);
        const ageMonth = parseInt(cols[2], 10);
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

    return standards;
};

try {
    const heightStandards = parseCsv(heightCsvPath);
    const weightStandards = parseCsv(weightCsvPath);
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

export const GROWTH_STANDARDS: Record<"height" | "weight", GrowthStandard[]> = {
  height: ${JSON.stringify(heightStandards, null, 2)},
  weight: ${JSON.stringify(weightStandards, null, 2)}
};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(
        `Successfully generated standards.ts with ${heightStandards.length} height and ${weightStandards.length} weight entries.`
    );

} catch (err) {
    console.error('Error:', err);
}
