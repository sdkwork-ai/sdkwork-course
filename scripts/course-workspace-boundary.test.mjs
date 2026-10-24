import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseYaml } from "../../sdkwork-specs/tools/deploy/yaml-resolver.mjs";

const courseRoot = path.resolve(import.meta.dirname, "..");

const requiredFiles = [
  "README.md",
  "package.json",
  "pnpm-workspace.yaml",
  "Cargo.toml",
  "sdkwork.app.config.json",
  "deployments/deploy.yaml",
  "specs/course-capabilities.yaml",
  "specs/database/course-schema.contract.json",
  "database/database.manifest.json",
  "database/ddl/baseline/postgres/0001_course_baseline.sql",
  "apis/README.md",
  "apis/app-api/course/operations.json",
  "apis/backend-api/course/operations.json",
  "scripts/materialize-course-openapi.mjs",
  "scripts/dev/generate-course-http-layers.mjs",
  "sdks/README.md",
  "sdks/_route-manifests/app-api/sdkwork-routes-course-app-api.route-manifest.json",
  "sdks/_route-manifests/backend-api/sdkwork-routes-course-backend-api.route-manifest.json",
  "sdks/sdkwork-course-app-sdk/sdk-manifest.json",
  "sdks/sdkwork-course-app-sdk/README.md",
  "sdks/sdkwork-course-app-sdk/bin/generate-sdk.ps1",
  "sdks/sdkwork-course-app-sdk/openapi/sdkwork-course-app-api.openapi.yaml",
  "sdks/sdkwork-course-app-sdk/openapi/sdkwork-course-app-api.sdkgen.yaml",
  "sdks/sdkwork-course-app-sdk/specs/README.md",
  "sdks/sdkwork-course-app-sdk/specs/component.spec.json",
  "sdks/sdkwork-course-backend-sdk/sdk-manifest.json",
  "sdks/sdkwork-course-backend-sdk/README.md",
  "sdks/sdkwork-course-backend-sdk/bin/generate-sdk.ps1",
  "sdks/sdkwork-course-backend-sdk/openapi/sdkwork-course-backend-api.openapi.yaml",
  "sdks/sdkwork-course-backend-sdk/openapi/sdkwork-course-backend-api.sdkgen.yaml",
  "sdks/sdkwork-course-backend-sdk/specs/README.md",
  "sdks/sdkwork-course-backend-sdk/specs/component.spec.json",
  "sdks/_shared/course-contracts/package.json",
  "sdks/_shared/course-contracts/specs/component.spec.json",
  "sdks/_shared/course-contracts/src/index.ts",
  "sdks/_shared/course-contracts/src/course-api.ts",
  "sdks/_shared/course-contracts/src/course-domain.ts",
  "crates/sdkwork-content-course-service/Cargo.toml",
  "crates/sdkwork-content-course-service/specs/component.spec.json",
  "crates/sdkwork-content-course-service/src/lib.rs",
  "crates/sdkwork-content-course-service/src/domain/commands.rs",
  "crates/sdkwork-content-course-service/src/domain/models.rs",
  "crates/sdkwork-content-course-service/src/ports/repository.rs",
  "crates/sdkwork-content-course-service/src/ports/provider.rs",
  "crates/sdkwork-content-course-service/src/service/course_service.rs",
  "crates/sdkwork-content-course-repository-sqlx/Cargo.toml",
  "crates/sdkwork-content-course-repository-sqlx/specs/component.spec.json",
  "crates/sdkwork-content-course-repository-sqlx/src/lib.rs",
  "crates/sdkwork-content-course-repository-sqlx/src/db/schema.rs",
  "crates/sdkwork-content-course-repository-sqlx/src/repository/course_repository.rs",
  "crates/sdkwork-routes-course-http-auth/Cargo.toml",
  "crates/sdkwork-routes-course-http-auth/src/api_response.rs",
  "crates/sdkwork-routes-course-app-api/Cargo.toml",
  "crates/sdkwork-routes-course-app-api/specs/component.spec.json",
  "crates/sdkwork-routes-course-app-api/src/lib.rs",
  "crates/sdkwork-routes-course-app-api/src/routes.rs",
  "crates/sdkwork-routes-course-app-api/src/http_handlers.rs",
  "crates/sdkwork-routes-course-app-api/src/manifest.rs",
  "crates/sdkwork-routes-course-backend-api/Cargo.toml",
  "crates/sdkwork-routes-course-backend-api/specs/component.spec.json",
  "crates/sdkwork-routes-course-backend-api/src/lib.rs",
  "crates/sdkwork-routes-course-backend-api/src/routes.rs",
  "crates/sdkwork-routes-course-backend-api/src/http_handlers.rs",
  "crates/sdkwork-routes-course-backend-api/src/manifest.rs",
  "crates/sdkwork-course-embedded-bootstrap/Cargo.toml",
  "crates/sdkwork-course-database-host/Cargo.toml",
  "crates/sdkwork-api-course-assembly/Cargo.toml",
];

const forbiddenOwnershipPatterns = [
  /\bcommerce[_-]/iu,
  /\bproduct[_-]/iu,
  /\border[_-]/iu,
  /\bpayment[_-]/iu,
  /\bwallet[_-]/iu,
  /\bcheckout[_-]/iu,
  /\bsubscription[_-]/iu,
  /\bmembership[_-]/iu,
  /\binvoice[_-]/iu,
  /\brefund[_-]/iu,
  /@sdkwork\/(?:commerce|product|order|payment|wallet|checkout|subscription|membership|invoice|refund)/iu,
  /\/(?:app|backend)\/v3\/api\/(?:catalog|products|orders|payments|wallet|checkout|subscriptions|memberships|invoices|refunds)\b/iu,
];

const forbiddenScanAllowlist = new Set([
  "README.md",
  "AGENTS.md",
  "scripts/course-workspace-boundary.test.mjs",
  // The catalog seeds quote real Bilibili chapter titles, which can contain
  // hyphenated English words such as "product-management". That is course copy,
  // not course-owned commerce or product domain code.
  "database/seeds/catalog/bilibili-catalog.json",
  "database/seeds/common/010_course_catalog_instructors.sql",
  "database/seeds/common/011_catalog_programming.sql",
  "database/seeds/common/012_catalog_ai.sql",
  "database/seeds/common/013_catalog_data.sql",
  "database/seeds/common/014_catalog_design.sql",
  "database/seeds/common/015_catalog_product.sql",
  "database/seeds/common/016_catalog_operations.sql",
  "database/seeds/common/017_catalog_workplace.sql",
  "database/seeds/common/018_catalog_language.sql",
  "database/seeds/common/019_catalog_finance.sql",
  "database/seeds/common/020_catalog_growth.sql",
]);

const legacyRuntimePatterns = [
  /"code"\s*:\s*"2000"/u,
  /"msg"\s*:\s*"SUCCESS"/u,
  /localStorage\.getItem\(['"]token['"]\)/u,
  /apply_foundation_migration/u,
  /\bfetch\(\s*['"]\/app\/v3\/api\/auth\//u,
  /\balert\s*\(/u,
  /开发中/u,
];

const legacyRuntimeAllowlist = new Set([
  "scripts/course-workspace-boundary.test.mjs",
]);

const requiredCourseTables = [
  "course_category",
  "course_instructor",
  "course_catalog",
  "course_offering",
  "course_section",
  "course_lesson",
  "course_resource_ref",
  "course_live_session",
  "course_enrollment",
  "course_learning_progress",
  "course_lesson_progress",
  "course_reaction",
  "course_application",
  "course_audit_log",
];

const sdkFamilies = [
  {
    root: "sdks/sdkwork-course-app-sdk",
    workspace: "sdkwork-course-app-sdk",
    title: "SDKWork Course App API SDK",
    sdkType: "app",
    surface: "app-api",
    apiAuthority: "sdkwork-course-app-api",
    apiPrefix: "/app/v3/api",
    authoritySpec: "openapi/sdkwork-course-app-api.openapi.yaml",
    generationInputSpec: "openapi/sdkwork-course-app-api.sdkgen.yaml",
    operationsPath: "apis/app-api/course/operations.json",
    routeManifestPath: "sdks/_route-manifests/app-api/sdkwork-routes-course-app-api.route-manifest.json",
    routeCrate: "sdkwork-routes-course-app-api",
    packageName: "@sdkwork/course-app-sdk",
    languages: ["typescript"],
  },
  {
    root: "sdks/sdkwork-course-backend-sdk",
    workspace: "sdkwork-course-backend-sdk",
    title: "SDKWork Course Backend API SDK",
    sdkType: "backend",
    surface: "backend-api",
    apiAuthority: "sdkwork-course-backend-api",
    apiPrefix: "/backend/v3/api",
    authoritySpec: "openapi/sdkwork-course-backend-api.openapi.yaml",
    generationInputSpec: "openapi/sdkwork-course-backend-api.sdkgen.yaml",
    operationsPath: "apis/backend-api/course/operations.json",
    routeManifestPath:
      "sdks/_route-manifests/backend-api/sdkwork-routes-course-backend-api.route-manifest.json",
    routeCrate: "sdkwork-routes-course-backend-api",
    packageName: "@sdkwork/course-backend-sdk",
    languages: ["typescript"],
  },
];

function readText(relativePath) {
  const raw = fs.readFileSync(path.join(courseRoot, relativePath));
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    return raw.slice(3).toString("utf8");
  }
  return raw.toString("utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readApiSpec(relativePath) {
  const fullPath = path.join(courseRoot, relativePath);
  const source = readText(relativePath);
  if (relativePath.endsWith(".yaml") || relativePath.endsWith(".yml")) {
    return parseYaml(source, courseRoot);
  }
  return JSON.parse(source);
}

function collectTextFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "target" ||
      entry.name === "generated"
    ) {
      return [];
    }

    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectTextFiles(fullPath) : [fullPath];
  });
}

function collectOperations(document) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!["get", "post", "patch", "put", "delete"].includes(method)) {
        continue;
      }

      operations.push({
        method: method.toUpperCase(),
        operationId: operation.operationId,
        path: routePath,
        resource: operation["x-sdkwork-resource"],
        tag: operation.tags?.[0],
        apiAuthority: operation["x-sdkwork-api-authority"],
        domain: operation["x-sdkwork-domain"],
        sourceRouteCrate: operation["x-sdkwork-source-route-crate"],
        security: operation.security,
      });
    }
  }

  return operations.sort((left, right) => operationKey(left).localeCompare(operationKey(right)));
}

function routeKey(operation) {
  return `${operation.method} ${operation.path}`;
}

function collectOperationPlanContracts(operationPlan) {
  return operationPlan.operations
    .map((operation) => ({
      method: operation.method,
      operationId: operation.operationId,
      path: operation.path,
      resource: operation.resource,
    }))
    .sort((left, right) => operationKey(left).localeCompare(operationKey(right)));
}

function collectRouteManifestContracts(routeManifest) {
  return routeManifest.routes
    .map((route) => ({
      method: route.method,
      operationId: route.operationId,
      path: route.path,
      resource: route.resource,
    }))
    .sort((left, right) => operationKey(left).localeCompare(operationKey(right)));
}

function operationKey(operation) {
  return `${operation.method} ${operation.path} ${operation.operationId}`;
}

function assertSdkworkV3PathAndSecurity(document, family) {
  const violations = collectOperations(document).flatMap((operation) => {
    const operationViolations = [];
    if (!operation.path.startsWith(family.apiPrefix)) {
      operationViolations.push(`${operation.method} ${operation.path}: invalid prefix`);
    }

    for (const segment of operation.path.split("/").filter(Boolean)) {
      if (segment.startsWith("{") && segment.endsWith("}")) {
        if (!/^\{[a-z][A-Za-z0-9]*\}$/u.test(segment)) {
          operationViolations.push(`${operation.method} ${operation.path}: path parameter ${segment} is not lowerCamelCase`);
        }
        continue;
      }

      if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(segment)) {
        operationViolations.push(`${operation.method} ${operation.path}: static segment ${segment} is not lower_snake_case`);
      }
    }

    assert.equal(operation.apiAuthority, family.apiAuthority);
    assert.equal(operation.domain, "content");
    assert.equal(operation.sourceRouteCrate, family.routeCrate);
    const internalAnonymousRoutes = new Set([
      "/app/v3/api/course_entitlements/grant",
    ]);
    if (internalAnonymousRoutes.has(operation.path)) {
      assert.deepEqual(operation.security, []);
    } else {
      assert.deepEqual(
        operation.security,
        [{ AuthToken: [], AccessToken: [] }],
        `${operation.method} ${operation.path} must declare operation-level dual token security`,
      );
    }

    return operationViolations;
  });

  assert.deepEqual(violations, []);
}

test("course workspace owns the expected source, API, SDK, and Rust crate files", () => {
  const missingFiles = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(courseRoot, relativePath)));
  assert.deepEqual(missingFiles, []);
});

test("course Rust crates use SDKWork responsibility-specific workspace layout", () => {
  const cargo = fs.readFileSync(path.join(courseRoot, "Cargo.toml"), "utf8");

  for (const member of [
    "crates/sdkwork-content-course-service",
    "crates/sdkwork-content-course-repository-sqlx",
    "crates/sdkwork-routes-course-http-auth",
    "crates/sdkwork-routes-course-app-api",
    "crates/sdkwork-routes-course-backend-api",
    "crates/sdkwork-course-embedded-bootstrap",
    "crates/sdkwork-course-database-host",
    "crates/sdkwork-api-course-assembly",
  ]) {
    assert.ok(cargo.includes(member), `Cargo workspace must include ${member}`);
  }

  assert.match(cargo, /sdkwork-web-core/u, "Cargo workspace must declare sdkwork-web-framework dependencies");
  assert.match(cargo, /sdkwork-utils-rust/u, "Cargo workspace must declare sdkwork-utils-rust");
  assert.match(cargo, /sdkwork-drive-app-sdk-generated-rust/u, "Cargo workspace must declare Drive Rust SDK");

  assert.ok(
    !fs.existsSync(path.join(courseRoot, "packages/native-rust/course/sdkwork-course-rust/Cargo.toml")),
    "legacy packages/native-rust/course/sdkwork-course-rust crate must not remain as a public Rust crate",
  );
  assert.ok(
    !fs.existsSync(path.join(courseRoot, "packages")),
    "application root must not keep top-level packages/ as a generic workspace directory",
  );
});

test("course API operation plans, route manifests, and OpenAPI documents stay aligned", () => {
  for (const family of sdkFamilies) {
    const operationPlan = readJson(family.operationsPath);
    const routeManifest = readJson(family.routeManifestPath);
    const openApi = readApiSpec(`${family.root}/${family.authoritySpec}`);
    const sdkgen = readApiSpec(`${family.root}/${family.generationInputSpec}`);

    assert.equal(operationPlan.surface, family.surface);
    assert.equal(operationPlan.apiAuthority, family.apiAuthority);
    assert.equal(operationPlan.sdkFamily, family.workspace);
    assert.equal(operationPlan.apiPrefix, family.apiPrefix);
    assert.equal(routeManifest.kind, "sdkwork.route.manifest");
    assert.equal(routeManifest.packageName, family.routeCrate);
    assert.equal(routeManifest.surface, family.surface);
    assert.equal(routeManifest.apiAuthority, family.apiAuthority);
    assert.equal(routeManifest.sdkFamily, family.workspace);
    assert.equal(routeManifest.prefix, family.apiPrefix);

    const expectedContractObjects = collectOperationPlanContracts(operationPlan);
    const expectedContracts = expectedContractObjects.map(operationKey);
    assert.deepEqual(collectRouteManifestContracts(routeManifest).map(operationKey), expectedContracts);
    // The published authority document is the pattern-aligned projection, so
    // it intentionally rewrites operation ids (`reorder` → `update`). It must
    // still expose exactly the planned routes; the sdkgen input keeps the
    // canonical `<resource>.<action>` ids and is compared in full.
    assert.deepEqual(
      collectOperations(openApi).map(routeKey).sort(),
      expectedContractObjects.map(routeKey).sort(),
    );
    assert.deepEqual(collectOperations(sdkgen).map(operationKey), expectedContracts);
  }
});

test("course OpenAPI documents use SDKWork v3 path, ownership, and security standards", () => {
  for (const family of sdkFamilies) {
    assertSdkworkV3PathAndSecurity(readApiSpec(`${family.root}/${family.authoritySpec}`), family);
    assertSdkworkV3PathAndSecurity(readApiSpec(`${family.root}/${family.generationInputSpec}`), family);
  }
});

test("course SDK families declare discoverable ownership metadata outside generated output", () => {
  for (const family of sdkFamilies) {
    const assembly = readJson(`${family.root}/sdk-manifest.json`);
    const componentSpec = readJson(`${family.root}/specs/component.spec.json`);
    const familyReadme = fs.readFileSync(path.join(courseRoot, family.root, "README.md"), "utf8");
    const specsReadme = fs.readFileSync(path.join(courseRoot, family.root, "specs/README.md"), "utf8");
    const operationPlan = readJson(family.operationsPath);

    assert.equal(assembly.workspace, family.workspace);
    assert.equal(assembly.title, family.title);
    assert.equal(assembly.sdkOwner, "sdkwork-course");
    assert.equal(assembly.apiAuthority, family.apiAuthority);
    assert.equal(assembly.authoritySpec, family.authoritySpec);
    assert.equal(assembly.generationInputSpec, family.generationInputSpec);
    assert.equal(assembly.ownerOnlyOperationCount, operationPlan.operations.length);
    assert.equal(assembly.discoverySurface.sdkTarget, family.sdkType);
    assert.equal(assembly.discoverySurface.apiPrefix, family.apiPrefix);
    assert.deepEqual(assembly.sdkDependencies, []);
    assert.deepEqual(assembly.metadata?.standardProfile, "sdkwork-v3");
    assert.equal(assembly.generator?.package, "@sdkwork/sdk-generator");
    assert.equal(assembly.generator?.entrypoint, "../sdkwork-sdk-generator/bin/sdkgen.js");

    assert.equal(componentSpec.schemaVersion, 1);
    assert.equal(componentSpec.kind, "sdkwork.component.spec");
    assert.equal(componentSpec.component.name, family.workspace);
    assert.equal(componentSpec.component.type, "sdk-family");
    assert.equal(componentSpec.component.root, family.root);
    assert.equal(componentSpec.component.domain, "content");
    assert.equal(componentSpec.component.capability, "course");
    assert.deepEqual(componentSpec.component.languages, family.languages);
    assert.equal(componentSpec.component.generated, true);
    assert.equal(componentSpec.contracts.apiAuthority, family.apiAuthority);
    assert.equal(componentSpec.contracts.apiPrefix, family.apiPrefix);
    assert.deepEqual(componentSpec.contracts.sdkDependencies, assembly.sdkDependencies);
    assert.ok(componentSpec.verification.commands.length > 0);

    for (const requiredText of [
      family.workspace,
      family.apiAuthority,
      family.apiPrefix,
      family.packageName,
      "@sdkwork/sdk-generator",
      "../sdkwork-sdk-generator/bin/sdkgen.js",
      "--standard-profile sdkwork-v3",
    ]) {
      assert.ok(familyReadme.includes(requiredText), `${family.root}/README.md must include ${requiredText}`);
    }
    assert.ok(specsReadme.includes(family.workspace));
    assert.ok(specsReadme.includes(family.apiAuthority));
  }
});

test("course SDK language declarations match generated transport workspaces", () => {
  for (const family of sdkFamilies) {
    const assembly = readJson(`${family.root}/sdk-manifest.json`);
    const declaredLanguages = assembly.languages.map((language) => language.language).sort();
    assert.deepEqual(declaredLanguages, family.languages);

    for (const language of assembly.languages) {
      const generatedPath = path.join(courseRoot, family.root, language.generatedPath);
      assert.ok(fs.existsSync(generatedPath), `${family.workspace} ${language.language} generated output is missing`);
      assert.ok(
        fs.existsSync(path.join(generatedPath, "sdkwork-sdk.json")),
        `${family.workspace} ${language.language} generated sdkwork-sdk.json is missing`,
      );
      assert.ok(
        fs.existsSync(path.join(generatedPath, ".sdkwork", "sdkwork-generator-manifest.json")),
        `${family.workspace} ${language.language} generator manifest is missing`,
      );
      assert.ok(
        fs.existsSync(path.join(generatedPath, ".sdkwork", "sdkwork-generator-changes.json")),
        `${family.workspace} ${language.language} generator changes report is missing`,
      );
      assert.ok(
        fs.existsSync(path.join(generatedPath, ".sdkwork", "sdkwork-generator-report.json")),
        `${family.workspace} ${language.language} generator report is missing`,
      );
      assert.ok(
        fs.existsSync(path.join(generatedPath, "custom")),
        `${family.workspace} ${language.language} custom root is missing`,
      );
    }
  }
});

test("course database contract and baseline DDL define the professional VOD and live course tables", () => {
  const contract = readJson("specs/database/course-schema.contract.json");
  const baseline = fs.readFileSync(
    path.join(courseRoot, "database/ddl/baseline/postgres/0001_course_baseline.sql"),
    "utf8",
  );

  assert.equal(contract.kind, "sdkwork.course.database.contract");
  assert.equal(contract.domain, "content");
  assert.equal(contract.capability, "course");

  const contractTables = new Set(contract.tables.map((table) => table.name));
  assert.deepEqual(requiredCourseTables.filter((tableName) => !contractTables.has(tableName)), []);

  const missingTables = requiredCourseTables.filter(
    (tableName) => !baseline.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`),
  );
  assert.deepEqual(missingTables, []);
  assert.doesNotMatch(baseline, /\b(?:commerce|product|order|payment|wallet|checkout|subscription|membership|invoice|refund)_/iu);
});

test("course HTTP route crates mount sdkwork-web-framework handlers", () => {
  for (const relativePath of [
    "crates/sdkwork-routes-course-app-api/src/routes.rs",
    "crates/sdkwork-routes-course-backend-api/src/routes.rs",
  ]) {
    const source = fs.readFileSync(path.join(courseRoot, relativePath), "utf8");
    assert.match(source, /http_handlers/u, `${relativePath} must wire http_handlers`);
    assert.match(source, /build_sdkwork_course/u, `${relativePath} must expose mounted router builder`);
    assert.doesNotMatch(source, /"code"\s*:\s*"2000"/u, `${relativePath} must not use legacy success envelope`);
  }

  for (const relativePath of [
    "crates/sdkwork-routes-course-app-api/src/http_handlers.rs",
    "crates/sdkwork-routes-course-backend-api/src/http_handlers.rs",
  ]) {
    const source = fs.readFileSync(path.join(courseRoot, relativePath), "utf8");
    assert.match(source, /handler_value_to_response/u, `${relativePath} must map handler output through sdkwork-web-framework`);
    assert.doesNotMatch(source, /"code"\s*:\s*"2000"/u, `${relativePath} must not use legacy success envelope`);
  }

  const apiResponse = fs.readFileSync(
    path.join(courseRoot, "crates/sdkwork-routes-course-http-auth/src/api_response.rs"),
    "utf8",
  );
  assert.match(apiResponse, /SdkWorkApiResponse/u, "api_response.rs must serialize SdkWorkApiResponse");
  assert.match(apiResponse, /SdkWorkProblemDetail/u, "api_response.rs must serialize ProblemDetail");
});

test("course runtime source avoids legacy HTTP, auth, and migration debt", () => {
  const violations = collectTextFiles(courseRoot).flatMap((fullPath) => {
    const relativePath = path.relative(courseRoot, fullPath).replaceAll("\\", "/");
    if (legacyRuntimeAllowlist.has(relativePath)) {
      return [];
    }
    if (!/\.(?:rs|ts|tsx|mjs|js)$/u.test(relativePath)) {
      return [];
    }

    const content = fs.readFileSync(fullPath, "utf8");
    return legacyRuntimePatterns.flatMap((pattern) => {
      const match = content.match(pattern);
      return match ? [`${relativePath}: ${match[0]}`] : [];
    });
  });

  assert.deepEqual(violations, []);
});

test("course OpenAPI authorities contain no legacy TODO placeholders", () => {
  for (const family of sdkFamilies) {
    for (const specPath of [family.authoritySpec, family.generationInputSpec]) {
      const source = readText(`${family.root}/${specPath}`);
      assert.doesNotMatch(source, /TODO\(course\)/u, `${family.root}/${specPath} must not contain TODO(course)`);
      assert.doesNotMatch(source, /CourseOperationResult/u, `${family.root}/${specPath} must not use legacy CourseOperationResult envelope`);
      assert.doesNotMatch(source, /"requestId"/u, `${family.root}/${specPath} must not use legacy requestId field`);
    }
  }
});

test("course source keeps course ownership separated from commerce and payment domains", () => {
  const violations = collectTextFiles(courseRoot).flatMap((fullPath) => {
    const relativePath = path.relative(courseRoot, fullPath).replaceAll("\\", "/");
    if (forbiddenScanAllowlist.has(relativePath)) {
      return [];
    }

    const content = fs.readFileSync(fullPath, "utf8");
    return forbiddenOwnershipPatterns.flatMap((pattern) => {
      const match = content.match(pattern);
      return match ? [`${relativePath}: ${match[0]}`] : [];
    });
  });

  assert.deepEqual(violations, []);
});
