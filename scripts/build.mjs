// Stellt den Ordner www/ für die Handy-App zusammen:
// App-Seite, Laufzeit, Bibliotheken und Schriften lokal (die App braucht für die Oberfläche kein Netz),
// config.js aus Umgebungsvariablen (Cloud-Bau) oder aus src/config.js (lokal).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const www = path.join(root, "www");
const nm = (p) => path.join(root, "node_modules", p);
const cp = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

// App-Dateien
for (const f of ["index.html", "rwe-runtime.js"]) cp(path.join(root, "src", f), path.join(www, f));

// Bibliotheken
cp(nm("@supabase/supabase-js/dist/umd/supabase.js"), path.join(www, "lib/supabase.js"));
cp(nm("jsbarcode/dist/JsBarcode.all.min.js"), path.join(www, "lib/JsBarcode.all.min.js"));
cp(nm("jspdf/dist/jspdf.umd.min.js"), path.join(www, "lib/jspdf.umd.min.js"));
cp(nm("pdfjs-dist/build/pdf.min.js"), path.join(www, "lib/pdfjs/pdf.min.js"));
cp(nm("pdfjs-dist/build/pdf.worker.min.js"), path.join(www, "lib/pdfjs/pdf.worker.min.js"));

// Schriften
const fonts = [
  ["Archivo Narrow", "@fontsource/archivo-narrow", "archivo-narrow", [600, 700]],
  ["Source Sans 3", "@fontsource/source-sans-3", "source-sans-3", [400, 600, 700]],
  ["JetBrains Mono", "@fontsource/jetbrains-mono", "jetbrains-mono", [500, 700]],
];
let css = "";
for (const [family, pkg, slug, weights] of fonts) {
  for (const w of weights) {
    for (const sub of ["latin", "latin-ext"]) {
      const file = `${slug}-${sub}-${w}-normal.woff2`;
      const from = nm(`${pkg}/files/${file}`);
      if (!fs.existsSync(from)) continue;
      cp(from, path.join(www, "fonts", file));
      const range = sub === "latin"
        ? "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
        : "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
      css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format("woff2");unicode-range:${range}}\n`;
    }
  }
}
fs.writeFileSync(path.join(www, "fonts/fonts.css"), css);

// Konfiguration
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
if (url && key) {
  fs.writeFileSync(path.join(www, "config.js"), `window.RWE_CONFIG=${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key })};\n`);
} else if (fs.existsSync(path.join(root, "src/config.js"))) {
  cp(path.join(root, "src/config.js"), path.join(www, "config.js"));
} else {
  console.error("FEHLT: SUPABASE_URL und SUPABASE_ANON_KEY (oder src/config.js nach Vorlage src/config.example.js)");
  process.exit(1);
}
console.log("www/ fertig");
