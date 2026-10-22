import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const courseRoot = path.resolve(import.meta.dirname, "..");
const sdkRoot = path.join(
  courseRoot,
  "sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi/src",
);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const sdkSource = fs.readFileSync(path.join(sdkRoot, "sdk.ts"), "utf8");
const apiResources = new Map();
for (const match of sdkSource.matchAll(/import\s+\{\s*(\w+),\s*create\w+\s*\}\s+from\s+'\.\/api\/([\w-]+)'/gu)) {
  apiResources.set(match[1], path.join(sdkRoot, "api", `${match[2]}.ts`));
}
const resourceNames = new Map();
for (const match of sdkSource.matchAll(/public readonly (\w+): (\w+);/gu)) {
  resourceNames.set(match[1], match[2]);
}

test("every course PC SDK resource call resolves to a generated SDK operation", () => {
  const violations = [];
  const packages = path.join(courseRoot, "apps/sdkwork-course-pc/packages");
  for (const packageName of fs.readdirSync(packages)) {
    const sourceRoot = path.join(packages, packageName, "src");
    if (!fs.existsSync(sourceRoot)) continue;
    for (const filePath of walk(sourceRoot)) {
      if (!/\.(?:ts|tsx)$/u.test(filePath)) continue;
      const source = fs.readFileSync(filePath, "utf8");
      for (const match of source.matchAll(/\bsdk\.(\w+)\.(\w+)\s*\(/gu)) {
        const [, resource, method] = match;
        const className = resourceNames.get(resource);
        const apiFile = className ? apiResources.get(className) : null;
        if (!className || !apiFile) {
          if (resource === "courseComments") {
            violations.push(`${path.relative(courseRoot, filePath)}: removed courseComments API`);
          }
          continue;
        }
        const apiSource = fs.readFileSync(apiFile, "utf8");
        if (!apiSource.includes(`async ${method}(`)) {
          violations.push(
            `${path.relative(courseRoot, filePath)}: sdk.${resource}.${method} is missing from generated SDK`,
          );
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("course PC sources no longer call the retired course comment API", () => {
  const violations = [];
  for (const filePath of walk(path.join(courseRoot, "apps/sdkwork-course-pc/packages"))) {
    if (!/\.(?:ts|tsx)$/u.test(filePath) || filePath.includes("node_modules")) continue;
    const source = fs.readFileSync(filePath, "utf8");
    if (/\bcourseComments\b/u.test(source)) {
      violations.push(path.relative(courseRoot, filePath));
    }
  }
  assert.deepEqual(violations, []);
});
