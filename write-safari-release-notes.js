import { parseArgs } from "./deps.js";
import { launch } from "./deps.js";
import { writeCSV } from "./deps.js";

const args = parseArgs(Deno.args);
const inputUrl = args._[0] ? String(args._[0]) : null;

const astral = await launch({
  headless: true,
  args: ["--disable-gpu", "--no-sandbox"],
  logLevel: "debug",
});

const page = await astral.newPage();

async function getLinks() {
  await page.goto(
    "https://developer.apple.com/documentation/safari-release-notes"
  );
  await page.waitForSelector(".content");
  const links = await page.evaluate(() => {
    const hrefs = Array.from(
      new Set(
        Array.from(
          document.querySelectorAll('a[href*="safari-release-notes/"]')
        ).map((a) => a.href
             )
      )
    );
    return hrefs;
  });

  return links;
}

async function parseReleaseNotes(url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitForSelector("#main");

  const data = await page.evaluate(() => {
    const data = [];
    const getTextContent = (el) => (el ? el.textContent.trim() : "");

    const mainContent = document.querySelector(".content");

    if (mainContent) {
      const version =
            document.querySelector("h1")?.textContent?.match(/Safari (\d+(.\d+)?(\sBeta)?)/)?.[1] ||
            "unknown_version";

      mainContent.querySelectorAll("h3").forEach((h3) => {
        const category = getTextContent(h3);

        let nextSibling = h3.nextElementSibling;
        while (nextSibling && nextSibling.tagName !== "H3") {
          if (nextSibling.tagName === "H4") {
            //const subcategory = getTextContent(nextSibling);

            let contentSibling = nextSibling.nextElementSibling;
            while (
              contentSibling &&
                !["H3", "H4"].includes(contentSibling.tagName)
            ) {
              if (contentSibling.tagName === "UL") {
                const items = Array.from(
                  contentSibling.querySelectorAll("li")
                ) || [];

                for (const item of items) {
                  const links = Array.from(
                    item.querySelectorAll("a")
                  ).map((a) => a.href) || [];

                  const refs = Array.from(
                    getTextContent(item).match(/\((\d+(@[^)]+)?)\)/g) || []
                  ).map((ref) => `https://bugs.webkit.org/buglist.cgi?content=${ref.replace("(", "").replace(")", "").trim()}`) || [];

                  data.push(["", version, category, getTextContent(item), links.join(" \n"), refs.join(" \n")])
                }
              }
              contentSibling = contentSibling.nextElementSibling;
            }
          }
          nextSibling = nextSibling.nextElementSibling;
        }
      });
    }

    return data;
  });
  return data;
}

async function fileExists(path) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error;
    }
  }
}

async function main() {
  const outputDir = "./output/safari-release-notes";
  const links = inputUrl ? [inputUrl] : await getLinks();
  await Deno.mkdir(outputDir, { recursive: true });

  for (const link of links) {
    const nameParts = link.split("/");
    const filepath = `${outputDir}/${nameParts[5]}.csv`;

    if (!(await fileExists(filepath))) {
      const data = await parseReleaseNotes(link);

      const f = await Deno.open(filepath, {
        write: true,
        create: true,
        truncate: true,
      });

      await writeCSV(f, data);

      f.close();

      console.log(`Data written to ${filepath}`);
    } else {
      console.log(`${filepath} already exists.`);
    }
  }

  await astral.close();
}

await main();
