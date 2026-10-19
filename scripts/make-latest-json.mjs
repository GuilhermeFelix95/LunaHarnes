// Gera o latest.json que o atualizador do Tauri lê no release.
// Uso: node scripts/make-latest-json.mjs <pasta-do-build> <dono/repo> <versão> [notas]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Monta o documento no formato estático do Tauri para Windows x64. */
export function buildLatest({ version, notes, pubDate, signature, url }) {
  if (!SEMVER.test(version)) throw new Error(`versão inválida: "${version}" (esperado x.y.z)`);
  if (!signature.trim()) throw new Error("assinatura vazia: rode o build com TAURI_SIGNING_PRIVATE_KEY");
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      "windows-x86_64": { signature: signature.trim(), url },
    },
  };
}

/** Nome do único instalador NSIS entre os arquivos da pasta de build. */
export function installerName(fileNames) {
  const found = fileNames.filter((name) => name.endsWith("-setup.exe"));
  if (found.length !== 1) throw new Error(`instalador NSIS não encontrado de forma única (achados: ${found.length})`);
  return found[0];
}

function main([dir, repo, version, notes = ""]) {
  if (!dir || !repo || !version) {
    throw new Error("uso: node scripts/make-latest-json.mjs <pasta-do-build> <dono/repo> <versão> [notas]");
  }
  const name = installerName(readdirSync(dir));
  const signature = readFileSync(join(dir, `${name}.sig`), "utf8");
  const url = `https://github.com/${repo}/releases/download/v${version}/${name}`;
  const latest = buildLatest({ version, notes, pubDate: new Date().toISOString(), signature, url });
  writeFileSync(join(dir, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  console.log(`latest.json gerado para ${name}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`make-latest-json: ${error.message}`);
    process.exit(1);
  }
}
