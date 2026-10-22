import fs from "node:fs";
import path from "node:path";
import { alignOpenApiOperationPatterns } from "../../sdkwork-specs/tools/lib/align-api-operation-patterns.mjs";
import {
  isCreateOperation,
  sdkWorkEnvelopeComponentSchemas,
} from "../../sdkwork-specs/tools/lib/openapi-envelope-schemas.mjs";

const courseRoot = path.resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");

const surfaces = [
  {
    operationsPath: "apis/app-api/course/operations.json",
    routeManifestPath:
      "sdks/_route-manifests/app-api/sdkwork-routes-course-app-api.route-manifest.json",
    authorityPath: "sdks/sdkwork-course-app-sdk/openapi/sdkwork-course-app-api.openapi.yaml",
    sdkgenPath: "sdks/sdkwork-course-app-sdk/openapi/sdkwork-course-app-api.sdkgen.yaml",
    assemblyPath: "sdks/sdkwork-course-app-sdk/sdk-manifest.json",
    routeCrate: "sdkwork-routes-course-app-api",
    routeCrateRoot: "crates/sdkwork-routes-course-app-api",
    title: "SDKWork Course App API",
    audience:
      "Learner and client applications for course discovery, enrollment, progress, live sessions, comments, and applications.",
  },
  {
    operationsPath: "apis/backend-api/course/operations.json",
    routeManifestPath:
      "sdks/_route-manifests/backend-api/sdkwork-routes-course-backend-api.route-manifest.json",
    authorityPath:
      "sdks/sdkwork-course-backend-sdk/openapi/sdkwork-course-backend-api.openapi.yaml",
    sdkgenPath:
      "sdks/sdkwork-course-backend-sdk/openapi/sdkwork-course-backend-api.sdkgen.yaml",
    assemblyPath: "sdks/sdkwork-course-backend-sdk/sdk-manifest.json",
    routeCrate: "sdkwork-routes-course-backend-api",
    routeCrateRoot: "crates/sdkwork-routes-course-backend-api",
    title: "SDKWork Course Backend API",
    audience:
      "Operator and admin consoles for course catalog governance, moderation, reporting, and audit workflows.",
  },
];

const driftErrors = [];

for (const surface of surfaces) {
  const operationPlan = readJson(surface.operationsPath);
  validateOperationPlan(operationPlan, surface);

  const routeManifest = buildRouteManifest(operationPlan, surface);
  const sdkgen = buildOpenApi(operationPlan, surface);
  // The published authority document is the pattern-aligned projection; the
  // generator consumes the raw sdkgen input so it keeps the canonical
  // `resource.action` operation ids.
  const openApi = alignOpenApiOperationPatterns(structuredClone(sdkgen)).document;

  if (checkOnly) {
    assertNoDrift(surface.routeManifestPath, routeManifest);
    assertNoDrift(surface.authorityPath, openApi);
    assertNoDrift(surface.sdkgenPath, sdkgen);
    assertAssemblyCount(surface.assemblyPath, operationPlan.operations.length);
    continue;
  }

  writeJson(surface.routeManifestPath, routeManifest);
  writeJson(surface.authorityPath, openApi);
  writeJson(surface.sdkgenPath, sdkgen);
  syncAssemblyCount(surface.assemblyPath, operationPlan.operations.length);
}

if (checkOnly) {
  if (driftErrors.length > 0) {
    console.error(driftErrors.join("\n"));
    process.exit(1);
  }
  console.log("course OpenAPI authorities are materialized and in sync");
}

function assertNoDrift(relativePath, expectedValue) {
  const fullPath = path.join(courseRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    driftErrors.push(`missing materialized artifact: ${relativePath}`);
    return;
  }
  const actual = readJson(relativePath);
  const expectedText = `${JSON.stringify(expectedValue, null, 2)}\n`;
  const actualText = `${JSON.stringify(actual, null, 2)}\n`;
  if (actualText !== expectedText) {
    driftErrors.push(`OpenAPI drift detected: ${relativePath} (run pnpm run api:materialize)`);
  }
}

function assertAssemblyCount(relativePath, expectedCount) {
  const assembly = readJson(relativePath);
  if (assembly.ownerOnlyOperationCount !== expectedCount) {
    driftErrors.push(
      `assembly drift detected: ${relativePath} expected ${expectedCount} operations (run pnpm run api:materialize)`,
    );
  }
}

function readJson(relativePath) {
  const raw = fs.readFileSync(path.join(courseRoot, relativePath));
  const text =
    raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
      ? raw.slice(3).toString("utf8")
      : raw.toString("utf8");
  return JSON.parse(text);
}

function writeJson(relativePath, value) {
  const fullPath = path.join(courseRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateOperationPlan(operationPlan, surface) {
  const requiredTopLevel = [
    "surface",
    "apiAuthority",
    "sdkFamily",
    "apiPrefix",
    "domain",
    "capability",
    "owner",
  ];

  for (const key of requiredTopLevel) {
    if (!operationPlan[key]) {
      throw new Error(`${surface.operationsPath} is missing ${key}`);
    }
  }

  if (operationPlan.domain !== "content") {
    throw new Error(`${surface.operationsPath} must use domain content`);
  }

  const seen = new Set();
  for (const operation of operationPlan.operations ?? []) {
    const key = `${operation.method} ${operation.path}`;
    if (seen.has(key)) {
      throw new Error(`${surface.operationsPath} contains duplicate route ${key}`);
    }
    seen.add(key);

    if (!operation.path.startsWith(operationPlan.apiPrefix)) {
      throw new Error(`${operation.operationId} must start with ${operationPlan.apiPrefix}`);
    }

    for (const field of ["method", "path", "operationId", "resource", "authMode"]) {
      if (!operation[field]) {
        throw new Error(`${operation.operationId} must declare ${field}`);
      }
    }
  }
}

function buildRouteManifest(operationPlan, surface) {
  return {
    schemaVersion: 1,
    kind: "sdkwork.route.manifest",
    packageName: surface.routeCrate,
    surface: operationPlan.surface,
    owner: operationPlan.owner,
    domain: operationPlan.domain,
    capability: operationPlan.capability,
    apiAuthority: operationPlan.apiAuthority,
    sdkFamily: operationPlan.sdkFamily,
    prefix: operationPlan.apiPrefix,
    source: {
      crateRoot: surface.routeCrateRoot,
      crateImport: surface.routeCrate.replaceAll("-", "_"),
      operations: surface.operationsPath,
    },
    routes: operationPlan.operations.map((operation) => ({
      method: operation.method,
      path: operation.path,
      operationId: operation.operationId,
      resource: operation.resource,
      tags: [operation.resource],
      auth: {
        mode: operation.authMode,
        required: true,
        permission: operation.permission ?? null,
        tenantScope: "tenant",
        dataScope: "organization",
      },
      handler: {
        module: "crate::handlers",
        name: handlerName(operation.operationId),
      },
      schemas: {
        request: hasRequestBody(operation.method) ? "CourseCommandBody" : null,
        response: operation.method === "DELETE" ? null : responseSchemaName(operation),
        problem: "ProblemDetail",
      },
      ownership: {
        owner: operationPlan.owner,
        domain: operationPlan.domain,
        capability: operationPlan.capability,
        apiAuthority: operationPlan.apiAuthority,
        sdkFamily: operationPlan.sdkFamily,
      },
      idempotency: operation.idempotency ?? null,
      auditEvent: operation.auditEvent ?? null,
    })),
  };
}

function buildOpenApi(operationPlan, surface) {
  const paths = {};
  for (const operation of operationPlan.operations) {
    paths[operation.path] ??= {};
    paths[operation.path][operation.method.toLowerCase()] = buildOpenApiOperation(
      operationPlan,
      surface,
      operation,
    );
  }

  return {
    openapi: "3.1.2",
    info: {
      title: surface.title,
      version: "1.0.0",
      description: surface.audience,
      "x-sdkwork-api-authority": operationPlan.apiAuthority,
      "x-sdkwork-sdk-family": operationPlan.sdkFamily,
      "x-sdkwork-audience": surface.audience,
    },
    "x-sdkwork-owner": operationPlan.owner,
    "x-sdkwork-domain": operationPlan.domain,
    "x-sdkwork-api-authority": operationPlan.apiAuthority,
    "x-sdkwork-sdk-family": operationPlan.sdkFamily,
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local sdkwork-course runtime",
      },
    ],
    security: [{ AuthToken: [], AccessToken: [] }],
    paths,
    components: buildComponents(),
    "x-sdkwork-request-context": {
      contextObject: "AppRequestContext",
      serverRequestId: "server-owned",
      clientRequestIdHeader: "forbidden",
      tenantSource: "AuthToken + AccessToken",
      organizationSource: "AuthToken + AccessToken",
      userSource: "AuthToken + AccessToken",
    },
  };
}

function buildOpenApiOperation(operationPlan, surface, operation) {
  const requiresPermission = Boolean(operation.permission);
  const responses = {
    ...successResponses(operation),
    400: problemResponse("Invalid request"),
    401: problemResponse("Authentication required"),
    404: problemResponse("Course resource not found"),
    409: problemResponse("Conflict or idempotency mismatch"),
    500: problemResponse("Internal server error"),
  };
  if (requiresPermission) {
    responses[403] = problemResponse("Permission denied");
  }

  const operationObject = {
    tags: [operation.resource],
    summary: `${toTitle(operation.operationId)}.`,
    description: operationDescription(operation),
    operationId: operation.operationId,
    parameters: [
      ...pathParameters(operation.path),
      ...queryParameters(operation),
      ...idempotencyParameters(operation),
    ],
    responses,
    security: operation.authMode === "anonymous" ? [] : [{ AuthToken: [], AccessToken: [] }],
    "x-sdkwork-owner": operationPlan.owner,
    "x-sdkwork-api-authority": operationPlan.apiAuthority,
    "x-sdkwork-domain": operationPlan.domain,
    "x-sdkwork-resource": operation.resource,
    "x-sdkwork-auth-mode": operation.authMode,
    "x-sdkwork-tenant-scope": "tenant",
    "x-sdkwork-data-scope": "organization",
    "x-sdkwork-audit-event": operation.auditEvent ?? null,
    "x-sdkwork-idempotent": operation.idempotency ?? null,
    "x-sdkwork-source": surface.operationsPath,
    "x-sdkwork-source-route-crate": surface.routeCrate,
    "x-sdkwork-request-context": "AppRequestContext",
    "x-sdkwork-server-request-id": true,
  };

  if (requiresPermission) {
    operationObject["x-sdkwork-permission"] = operation.permission;
  }

  if (hasRequestBody(operation.method)) {
    operationObject.requestBody = {
      required: true,
      description: `Typed command body for ${operation.operationId}.`,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CourseCommandBody" },
        },
      },
    };
  }

  return operationObject;
}

function buildComponents() {
  return {
    securitySchemes: {
      AuthToken: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "SDKWork auth token supplied by the appbase TokenManager.",
      },
      AccessToken: {
        type: "apiKey",
        in: "header",
        name: "Access-Token",
        description: "SDKWork access token supplied by the appbase TokenManager.",
      },
    },
    schemas: {
      ...sdkWorkEnvelopeComponentSchemas,
      CourseCommandBody: {
        type: "object",
        additionalProperties: true,
        description:
          "Operation-specific command payload. Domain fields are validated by the course service layer.",
      },
    },
  };
}

function courseSuccessResponseSchemaRef(operation) {
  const method = operation.method.toUpperCase();
  const action = operation.operationId.split(".").pop() ?? "";

  if (method === "GET" && operation.operationId.endsWith(".list")) {
    return "#/components/schemas/SdkWorkListResponse";
  }

  const commandActions = new Set([
    "cancel",
    "delete",
    "publish",
    "unpublish",
    "close",
    "grant",
    "revoke",
    "start",
    "end",
    "attach",
    "reorder",
    "replace",
    "heartbeat",
    "leave",
    "join",
    "repair",
    "moderate",
    "review",
    "convertToCourse",
  ]);

  if (method === "DELETE" || commandActions.has(action)) {
    return "#/components/schemas/SdkWorkCommandResponse";
  }

  if (isCreateOperation({ method: method.toLowerCase(), operationId: operation.operationId })) {
    return "#/components/schemas/SdkWorkResourceResponse";
  }

  return "#/components/schemas/SdkWorkResourceResponse";
}

function responseSchemaName(operation) {
  const ref = courseSuccessResponseSchemaRef(operation);
  return ref.split("/").pop();
}

function successResponse(operation, description = "Success") {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: courseSuccessResponseSchemaRef(operation) },
      },
    },
  };
}

function successResponses(operation) {
  const method = operation.method.toUpperCase();
  const action = operation.operationId.split(".").at(-1);
  if (method === "DELETE") {
    return { 204: { description: "Deleted" } };
  }
  if (method === "POST" && action === "create") {
    return { 201: successResponse(operation, "Created") };
  }
  return { 200: successResponse(operation) };
}

function pathParameters(routePath) {
  const parameters = [...routePath.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]);
  return parameters.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function queryParameters(operation) {
  if (operation.method !== "GET") {
    return [];
  }

  if (!operation.operationId.endsWith(".list")) {
    return [];
  }

  const declared = Array.isArray(operation.query) && operation.query.length > 0
    ? operation.query
    : ["q", "cursor", "page", "page_size", "status"];

  return declared.map((name) => {
    if (name === "page") {
      return { name, in: "query", required: false, schema: { type: "integer", format: "int32", minimum: 1 } };
    }
    if (name === "page_size") {
      return {
        name,
        in: "query",
        required: false,
        schema: { type: "integer", format: "int32", minimum: 1, maximum: 200, default: 20 },
      };
    }
    return { name, in: "query", required: false, schema: { type: "string" } };
  });
}

function idempotencyParameters(operation) {
  if (!operation.idempotency) {
    return [];
  }

  return [
    {
      name: "Idempotency-Key",
      in: "header",
      required: operation.idempotency === "required",
      schema: { type: "string", minLength: 8, maxLength: 256 },
      description: "Client retry idempotency key.",
    },
  ];
}

function problemResponse(description) {
  return {
    description,
    content: {
      "application/problem+json": {
        schema: { $ref: "#/components/schemas/ProblemDetail" },
      },
    },
  };
}

function hasRequestBody(method) {
  return ["PATCH", "POST", "PUT"].includes(method);
}

function handlerName(operationId) {
  return operationId
    .replaceAll(".", "_")
    .replace(/[A-Z]/gu, (match) => `_${match.toLowerCase()}`)
    .replaceAll("__", "_")
    .toLowerCase();
}

function toTitle(operationId) {
  return operationId
    .replaceAll(".", " ")
    .replace(/[A-Z]/gu, (match) => ` ${match}`)
    .replace(/\s+/gu, " ")
    .trim();
}

function operationDescription(operation) {
  const action = operation.operationId.split(".").pop() ?? "execute";
  return `${toTitle(operation.resource)} ${action} operation for the course learning domain.`;
}

function syncAssemblyCount(relativePath, count) {
  const assembly = readJson(relativePath);
  assembly.ownerOnlyOperationCount = count;
  writeJson(relativePath, assembly);
}
