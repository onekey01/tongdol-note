import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Zip } from "../server/zip";
import { parse, find, attr, kids } from "../server/xml";

const z = new Zip(readFileSync(join(import.meta.dir, "..", "서식", "개인별 서비스 비용총괄(서식8).hwpx")));
const doc = parse(z.text("Contents/section0.xml"));
const hdr = parse(z.text("Contents/header.xml"));
const 글자모양 = new Map<string, string>();
for (const c of find(hdr.root, "charPr"))
  글자모양.set(String(attr(c, "id")), String(attr(c, "height")));
const 문단모양 = new Map<string, Node2>();
type Node2 = any;
for (const pp of find(hdr.root, "paraPr")) 문단모양.set(String(attr(pp, "id")), pp);

for (const p of find(doc.root, "p")) {
  const runs = kids(p, "run");
  const tbls = runs.flatMap((r) => kids(r, "tbl"));
  if (!tbls.length) continue;
  const 그run = runs.find((r) => kids(r, "tbl").length)!;
  const cid = String(attr(그run, "charPrIDRef"));
  const pid = String(attr(p, "paraPrIDRef"));
  const pp = 문단모양.get(pid);
  const ls = pp ? kids(pp, "lineSpacing")[0] : null;
  console.log(`표높이=${attr(kids(tbls[0], "sz")[0]!, "height")}` +
    ` charPr#${cid} 글자높이=${글자모양.get(cid)}` +
    ` paraPr#${pid} 줄간격=${ls ? attr(ls, "type") + "/" + attr(ls, "value") : "?"}`);
}
