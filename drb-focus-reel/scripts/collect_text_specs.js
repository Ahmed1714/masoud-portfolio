// Runs an AE build script against a do-nothing mock of the AE API and prints every text spec it asks for.
// Usage: node scripts/collect_text_specs.js <script.jsx>  > specs.json
const fs = require("fs");
const vm = require("vm");
const handler = {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === "numKeys" || p === "length") return 0;
    if (p === "value") return [540, 960, 0];
    if (p === "width" || p === "height") return 1000;
    if (p === "duration") return 16;
    if (p === "then") return undefined;
    return make();
  },
  set() { return true; },
  apply() { return make(); },
  construct() { return make(); },
};
function make() { return new Proxy(function () {}, handler); }
const ctx = {
  __TEXT_SPECS: [], app: make(), $: { fileName: "/mock/script.jsx" },
  File: make(), Folder: make(), ImportOptions: make(), KeyframeEase: make(), Shape: make(),
  MarkerValue: make(), TextDocument: make(), ParagraphJustification: make(), BlendingMode: make(),
  PropertyValueType: make(), alert() {}, confirm() { return true; }, Math, Error,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], "utf8"), ctx);
const seen = {}, out = [];
for (const s of ctx.__TEXT_SPECS) if (!seen[s.name]) { seen[s.name] = 1; out.push(s); }
process.stdout.write(JSON.stringify(out, null, 1));
