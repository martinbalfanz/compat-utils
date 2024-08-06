import { parse } from "./deps.js";
import { writeCSV } from "./deps.js";
import { parseFlags } from "./deps.js";

const args = parseFlags(Deno.args, {
  alias: {
    p: "progress",
    t: "threshold",
    v: "verbose",
    i1: "input1",
    i2: "input2",
    o: "output"
  },
  default: {
    threshold: 80,
    input1: "./output/all-webkit-blog.csv",
    input2: "./output/all-safari-release-notes.csv",
    output: "./output/combined.csv"
  }
});
const showProgress = args.p;
const threshold = Number(args.threshold)

const csv1 = await Deno.readTextFile(args.input1);
const csv2 = await Deno.readTextFile(args.input2);

const data1 = await parse(csv1, { skipFirstRow: false });
const data2 = await parse(csv2, { skipFirstRow: false });

function cleanupRN(text) {
  return text.replace(/(\s*\([^)]*\))+$/g, '').trim();
}

function extractQualifierWithAt(text) {
  const match = text.match(/\(\d+@[^)]+\)/);
  return match ? match[0] : null;
}

function extractNumericQualifier(text) {
  const match = text.match(/\(\d+\)$/);
  return match ? match[0] : null;
}

function isSimilar(text1, text2) {
  if (text1 === text2) {
    return true;
  }

  const qualifier1WithAt = extractQualifierWithAt(text1);
  const qualifier2WithAt = extractQualifierWithAt(text2);

  if (qualifier1WithAt && qualifier2WithAt && qualifier1WithAt === qualifier2WithAt) {
    return true;
  }

  const cleanedText1 = cleanupRN(text1);
  const cleanedText2 = cleanupRN(text2);

  return cleanedText1 === cleanedText2;
}

const combinedData = [];
const totalRows = data1.length + data2.length;
let processedRows = 0;

for (const row1 of data1) {
  for (const row2 of data2) {
    if (isSimilar(row1[3], row2[3])) {
      if (args.verbose) {console.log(`1: ${row1[3]}\n2: ${row2[3]}`)};
      row1[1] = row1[1] ? `${row1[1]}, ${row2[1]}` : row2[1];
      break;
    }
  }
  combinedData.push(row1);
  processedRows++;
  if (showProgress && (processedRows % 10 === 0 || processedRows === totalRows)) {
    console.log(`Progress: ${Math.round((processedRows / totalRows) * 100)}%`);
  }
}

for (const row2 of data2) {
  //if (parseInt(row2[1]) < 17) { continue; }

  if (!combinedData.some(row1 => isSimilar(row1[3], row2[3]))) {
    combinedData.push(row2);
  }
  processedRows++;
  if (showProgress && (processedRows % 10 === 0 || processedRows === totalRows)) {
    console.log(`Progress: ${Math.round((processedRows / totalRows) * 100)}%`);
  }
}

const f = await Deno.open(args.output, {
  write: true,
  create: true,
  truncate: true,
});

await writeCSV(f, combinedData);

f.close();

console.log(`Combined CSV written to ${args.output}`);
