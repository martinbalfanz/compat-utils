import { parse } from "jsr:@std/csv";
import { writeCSV } from "jsr:@vslinko/csv";
import { parse as parseFlags } from "jsr:@std/flags";
import * as fuzzball from "npm:fuzzball";

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

function isSimilar(text1, text2) {
    return fuzzball.ratio(text1, text2) >= threshold;
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

console.log("Combined CSV written to combined.csv");
