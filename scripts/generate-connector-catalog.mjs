#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const servicesDir = path.join(repoRoot, "connectors", "services");
const catalogPath = path.join(repoRoot, "connectors", "catalog.json");
const checkOnly = process.argv.includes("--check");

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = stableObject(value[key]);
      return sorted;
    }, {});
}

async function readConnectors() {
  const files = (await readdir(servicesDir)).filter((file) => file.endsWith(".json")).sort();
  const connectors = [];

  for (const file of files) {
    const absolute = path.join(servicesDir, file);
    const connector = JSON.parse(await readFile(absolute, "utf8"));
    connectors.push(stableObject(connector));
  }

  connectors.sort((left, right) => left.id.localeCompare(right.id));
  return connectors;
}

function buildCatalog(connectors) {
  const categories = [...new Set(connectors.map((connector) => connector.category))].sort();
  const platformSupport = connectors.reduce(
    (summary, connector) => {
      for (const platform of ["android", "ios"]) {
        const status = connector.platforms?.[platform] ?? "unsupported";
        summary[platform][status] = (summary[platform][status] ?? 0) + 1;
      }
      return summary;
    },
    { android: {}, ios: {} },
  );

  return stableObject({
    schemaVersion: 1,
    generatedBy: "scripts/generate-connector-catalog.mjs",
    source: "connectors/services/*.json",
    connectorCount: connectors.length,
    categories,
    platformSupport,
    connectors,
  });
}

const catalog = buildCatalog(await readConnectors());
const serialized = `${JSON.stringify(catalog, null, 2)}\n`;

if (checkOnly) {
  let current;
  try {
    current = await readFile(catalogPath, "utf8");
  } catch {
    console.error("connectors/catalog.json is missing. Run node scripts/generate-connector-catalog.mjs.");
    process.exit(1);
  }

  if (current !== serialized) {
    console.error("connectors/catalog.json is out of date. Run node scripts/generate-connector-catalog.mjs.");
    process.exit(1);
  }

  console.log("Connector catalog is up to date.");
} else {
  await writeFile(catalogPath, serialized);
  console.log(`Wrote connectors/catalog.json with ${catalog.connectorCount} connector(s).`);
}
