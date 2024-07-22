#!/usr/bin/env sh

deno run -A write-webkit-blog.js
deno run -A write-safari-release-notes.js

echo "combining webkit-blog files"
rm -f ./output/all-webkit-blog.csv
for f in ./output/webkit-blog/*.csv; do (cat "${f}"; echo) >> ./output/all-webkit-blog.csv; done

echo "combining safari release-notes files"
rm -f ./output/all-safari-release-notes.csv
for f in ./output/safari-release-notes/*.csv; do (cat "${f}"; echo) >> ./output/all-safari-release-notes.csv; done

deno run -A combine.js