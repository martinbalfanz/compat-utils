import { parseArgs } from "jsr:@std/cli/parse-args";
import { launch } from "https://deno.land/x/astral/mod.ts";
import { writeJson } from "https://deno.land/x/jsonfile/mod.ts";
import { writeCSV } from "jsr:@vslinko/csv";

const args = parseArgs(Deno.args);
const inputUrl = args._[0] ? String(args._[0]) : null;

const astral = await launch({
  headless: true,
  args: ["--disable-gpu", "--no-sandbox"],
  logLevel: "debug",
});

const page = await astral.newPage();

async function getLinks() {
  await page.goto("https://webkit.org/blog/");
  await page.waitForSelector("#posts");

  const links = await page.evaluate(() => {
    const hrefs = Array.from(
      new Set(
        Array.from(document.querySelectorAll('a[href*="release-notes"]')).map(
          (a) => a.href
        )
      )
    );
    return hrefs;
  });

  return links;
}

async function parseReleaseNotes(url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitForSelector("#content");

  const data = await page.evaluate(() => {
    const data = [];
    const getTextContent = (el) => (el ? el.textContent.trim() : "");
    const getLink = (el) => (el ? el.href : "");

    const mainContent = document.querySelector(".bodycopy");

    if (mainContent) {
      const version =
        document.querySelector("h1")?.textContent?.match(/\d+/)?.[0] ||
        "unknown_version";

      mainContent.querySelectorAll("h3").forEach((h3) => {
        const category = getTextContent(h3);

        let nextSibling = h3.nextElementSibling;
        while (nextSibling && nextSibling.tagName !== "H3") {
          if (nextSibling.tagName === "H4") {
            const subcategory = getTextContent(nextSibling);

            let contentSibling = nextSibling.nextElementSibling;
            while (
              contentSibling &&
              !["H3", "H4"].includes(contentSibling.tagName)
            ) {
              if (contentSibling.tagName === "UL") {
                const items = Array.from(
                  contentSibling.querySelectorAll("li")
                );

                for (const item of items) {
                  data.push([version, "", category, getTextContent(item), getLink(item.querySelector("a"))]);
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
  const outputDir = "./output/webkit-blog";
  const links = inputUrl ? [inputUrl] : await getLinks();
  await Deno.mkdir(outputDir, { recursive: true });

  for (const link of links) {
    const nameParts = link.split("/");
    const filepath = `${outputDir}/${nameParts[4]}-${nameParts[5]}.csv`;

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
