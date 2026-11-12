import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value)), "utf8").digest("hex");
}

function collectChanges(before, after, path, output) {
  if (Object.is(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const hasBefore = Object.hasOwn(before, key);
      const hasAfter = Object.hasOwn(after, key);
      const nextPath = path ? `${path}.${key}` : key;
      if (!hasBefore || !hasAfter) {
        output.push({
          path: nextPath,
          before_exists: hasBefore,
          after_exists: hasAfter,
          ...(hasBefore ? { before: before[key] } : {}),
          ...(hasAfter ? { after: after[key] } : {})
        });
      } else {
        collectChanges(before[key], after[key], nextPath, output);
      }
    }
    return;
  }
  // Arrays are kept whole: index-level diffs can falsely imply identity or continuity.
  output.push({ path, before_exists: true, after_exists: true, before, after });
}

/**
 * Compare two validated public-state snapshots without changing either input.
 * Results are observed differences, not claims about why a change occurred.
 */
export function compareSnapshots({ before, after, beforeSource, afterSource }) {
  if (!isRecord(before) || !isRecord(after)) {
    throw new Error("before and after must be JSON objects");
  }
  if (typeof before.updated !== "string" || Number.isNaN(Date.parse(before.updated))) {
    throw new Error("before snapshot requires a valid updated timestamp");
  }
  if (typeof after.updated !== "string" || Number.isNaN(Date.parse(after.updated))) {
    throw new Error("after snapshot requires a valid updated timestamp");
  }
  if (Date.parse(after.updated) < Date.parse(before.updated)) {
    throw new Error("after snapshot must not predate before snapshot");
  }

  const changes = [];
  collectChanges(before, after, "", changes);
  return {
    report_version: 1,
    interpretation: "observed_differences_only",
    confidence: "observed",
    before: {
      source: beforeSource ?? "unspecified",
      updated: before.updated,
      sha256: digest(before)
    },
    after: {
      source: afterSource ?? "unspecified",
      updated: after.updated,
      sha256: digest(after)
    },
    change_count: changes.length,
    changes
  };
}

async function readJson(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} JSON: ${error.message}`);
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const beforePath = args[args.indexOf("--before") + 1];
  const afterPath = args[args.indexOf("--after") + 1];
  if (!beforePath || !afterPath || beforePath.startsWith("--") || afterPath.startsWith("--")) {
    console.error("Usage: node src/memory/snapshot-diff.mjs --before <OLDER.json> --after <NEWER.json>");
    process.exitCode = 2;
  } else {
    try {
      const [before, after] = await Promise.all([
        readJson(beforePath, "before"),
        readJson(afterPath, "after")
      ]);
      console.log(JSON.stringify(compareSnapshots({
        before,
        after,
        beforeSource: beforePath,
        afterSource: afterPath
      }), null, 2));
    } catch (error) {
      console.error(`Snapshot comparison failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
