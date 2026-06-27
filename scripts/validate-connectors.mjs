#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const servicesDir = path.join(repoRoot, "connectors", "services");
const allowedCategories = new Set([
  "infrastructure",
  "networking",
  "media",
  "observability",
  "developer-tools",
  "gaming",
  "utility",
]);
const allowedAuth = new Set([
  "none",
  "api_key",
  "bearer_token",
  "basic",
  "session_cookie",
  "custom",
]);
const allowedPlatformStatus = new Set([
  "planned",
  "supported",
  "partial",
  "unsupported",
]);
const allowedEndpointRisk = new Set(["read", "safe-write", "destructive"]);
const allowedActionRisk = new Set(["safe-write", "destructive"]);

function fail(file, message) {
  return `${file}: ${message}`;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validateConnector(file, connector) {
  const errors = [];
  const idPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;

  if (!isObject(connector)) errors.push(fail(file, "root must be an object"));
  if (connector.schemaVersion !== 1) errors.push(fail(file, "schemaVersion must be 1"));
  if (!idPattern.test(connector.id ?? "")) errors.push(fail(file, "id must be kebab-case"));
  if (!connector.displayName || typeof connector.displayName !== "string") {
    errors.push(fail(file, "displayName is required"));
  }
  if (!allowedCategories.has(connector.category)) {
    errors.push(fail(file, `category must be one of ${Array.from(allowedCategories).join(", ")}`));
  }
  if (!isObject(connector.baseUrl) || !connector.baseUrl.placeholder) {
    errors.push(fail(file, "baseUrl.placeholder is required"));
  }
  if (!isObject(connector.auth) || !allowedAuth.has(connector.auth.type)) {
    errors.push(fail(file, "auth.type is invalid or missing"));
  }
  if (!isObject(connector.capabilities)) {
    errors.push(fail(file, "capabilities is required"));
  } else {
    for (const key of ["read", "write", "destructiveActions"]) {
      if (typeof connector.capabilities[key] !== "boolean") {
        errors.push(fail(file, `capabilities.${key} must be boolean`));
      }
    }
  }
  if (!isObject(connector.platforms)) {
    errors.push(fail(file, "platforms is required"));
  } else {
    for (const key of ["ios", "android"]) {
      if (!allowedPlatformStatus.has(connector.platforms[key])) {
        errors.push(fail(file, `platforms.${key} is invalid`));
      }
    }
  }
  if (!Array.isArray(connector.endpoints) || connector.endpoints.length === 0) {
    errors.push(fail(file, "at least one endpoint is required"));
  }

  const endpointIds = new Set();
  for (const endpoint of connector.endpoints ?? []) {
    if (!idPattern.test(endpoint.id ?? "")) errors.push(fail(file, "endpoint id must be kebab-case"));
    if (endpointIds.has(endpoint.id)) errors.push(fail(file, `duplicate endpoint id ${endpoint.id}`));
    endpointIds.add(endpoint.id);
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method)) {
      errors.push(fail(file, `endpoint ${endpoint.id} has invalid method`));
    }
    if (!endpoint.path || typeof endpoint.path !== "string") {
      errors.push(fail(file, `endpoint ${endpoint.id} needs a path`));
    }
    if (!allowedEndpointRisk.has(endpoint.risk ?? "read")) {
      errors.push(fail(file, `endpoint ${endpoint.id} has invalid risk`));
    }
    if (endpoint.risk === "destructive" && endpoint.requiresConfirmation !== true) {
      errors.push(fail(file, `destructive endpoint ${endpoint.id} must require confirmation`));
    }
  }

  const metricIds = new Set();
  for (const metric of connector.metrics ?? []) {
    if (!idPattern.test(metric.id ?? "")) errors.push(fail(file, "metric id must be kebab-case"));
    if (metricIds.has(metric.id)) errors.push(fail(file, `duplicate metric id ${metric.id}`));
    metricIds.add(metric.id);
    if (!endpointIds.has(metric.sourceEndpoint)) {
      errors.push(fail(file, `metric ${metric.id} references unknown endpoint ${metric.sourceEndpoint}`));
    }
  }

  const actionIds = new Set();
  for (const action of connector.actions ?? []) {
    if (!idPattern.test(action.id ?? "")) errors.push(fail(file, "action id must be kebab-case"));
    if (actionIds.has(action.id)) errors.push(fail(file, `duplicate action id ${action.id}`));
    actionIds.add(action.id);
    if (!endpointIds.has(action.endpointId)) {
      errors.push(fail(file, `action ${action.id} references unknown endpoint ${action.endpointId}`));
    }
    if (!allowedActionRisk.has(action.risk)) {
      errors.push(fail(file, `action ${action.id} has invalid risk`));
    }
    if (!action.confirmationText) {
      errors.push(fail(file, `action ${action.id} must include confirmationText`));
    }
  }

  if (connector.capabilities?.destructiveActions === false) {
    const destructive = [
      ...(connector.endpoints ?? []).filter((endpoint) => endpoint.risk === "destructive"),
      ...(connector.actions ?? []).filter((action) => action.risk === "destructive"),
    ];
    if (destructive.length > 0) {
      errors.push(fail(file, "destructive items exist but capabilities.destructiveActions is false"));
    }
  }

  return errors;
}

const files = (await readdir(servicesDir)).filter((file) => file.endsWith(".json")).sort();
const seenIds = new Map();
const errors = [];

for (const file of files) {
  const absolute = path.join(servicesDir, file);
  let connector;
  try {
    connector = JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    errors.push(fail(file, `invalid JSON: ${error.message}`));
    continue;
  }
  errors.push(...validateConnector(file, connector));
  if (connector?.id) {
    if (seenIds.has(connector.id)) {
      errors.push(fail(file, `id duplicates ${seenIds.get(connector.id)}`));
    }
    seenIds.set(connector.id, file);
  }
}

if (errors.length > 0) {
  console.error(`Connector validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${files.length} connector(s).`);
