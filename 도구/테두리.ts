import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hwpx } from "../server/hwpx";
import { parse, find, attr, kids } from "../server/xml";
import { Zip } from "../server/zip";

const buf = readFileSync(join(import.meta.dir, "..", "서식", "개인별 서비스 비용총괄(서식8).hwpx"));
const z = new Zip(buf);
const doc = parse(z.text("Contents/header.xml"));
const 볼것 = new Set(["51", "52", "53", "165"]);
for (const bf of find(doc.root, "borderFill")) {
  const id = attr(bf, "id");
  if (!볼것.has(String(id))) continue;
  const 줄 = ["leftBorder", "rightBorder", "topBorder", "bottomBorder"].map((n) => {
    const b = kids(bf, n)[0];
    return b ? `${n.replace("Border", "").padEnd(6)}${attr(b, "type")}/${attr(b, "width")}` : "";
  }).filter(Boolean).join("  ");
  const 채움 = kids(bf, "fillBrush")[0] ? " (채움있음)" : "";
  console.log(`bf${id}: ${줄}${채움}`);
}
