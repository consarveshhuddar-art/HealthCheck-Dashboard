/**
 * Shared Allure / scenario-txt parsing for PR E2E backfill scripts.
 */

export function normalizeScenarioName(testName) {
  return testName
    ?.replace(/\s*\[.*?\]$/, "")
    ?.replace(/\s*\(.*?\)$/, "")
    ?.replace(/\s*\|.*$/, "")
    ?.trim();
}

export function executionDedupeKey(testName, parameters) {
  const base = normalizeScenarioName(testName) || testName;
  if (!Array.isArray(parameters) || parameters.length === 0) return base;
  const sig = parameters
    .map((p) => {
      if (typeof p === "string") return p;
      const n = p?.name ?? p?.key ?? "";
      const v = p?.value ?? p?.val ?? "";
      return n ? `${n}=${v}` : String(v ?? "");
    })
    .filter((s) => s?.trim())
    .join(",");
  return sig ? `${base}|${sig}` : base;
}

export function normalizeExecutionStatus(raw) {
  const s = String(raw ?? "").toLowerCase();
  if (s === "passed" || s === "pass") return "passed";
  if (s === "failed" || s === "fail") return "failed";
  if (s === "broken") return "broken";
  if (s === "skipped" || s === "skip") return "skipped";
  return "unknown";
}

export function sanitizeErrorMessage(msg) {
  const err = msg?.trim();
  if (!err || err === "categories" || err === "Product defects" || err === "Test defects") {
    return "No error details available";
  }
  return err;
}

/**
 * Collect leaf test executions from Allure categories/suites tree.
 */
export function collectExecutionsFromTree(node, errorContext, executions, seen) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectExecutionsFromTree(item, errorContext, executions, seen);
    return;
  }
  if (typeof node !== "object") return;

  const status = normalizeExecutionStatus(node.status);
  const name = node.name?.toString();
  const params = node.parameters ?? [];
  const hasChildCases =
    Array.isArray(node.children) && node.children.some((c) => c?.status);

  if (name && status !== "unknown" && !hasChildCases) {
    const base = normalizeScenarioName(name) || name;
    const key = executionDedupeKey(base, params);
    if (!seen.has(key)) {
      seen.add(key);
      const isFail = status === "failed" || status === "broken";
      executions.push({
        test_name: base,
        test_name_full: name,
        status,
        error_message: isFail ? sanitizeErrorMessage(errorContext) : null,
        duration_ms: node.time?.duration ?? 0,
        module: null,
        tags: JSON.stringify(node.tags ?? []),
        parameters: JSON.stringify(
          Array.isArray(params)
            ? params.map((p) =>
                typeof p === "string" ? { name: "param", value: p } : p,
              )
            : params,
        ),
      });
    }
    return;
  }

  let nextError = errorContext;
  if (name && !node.status && Array.isArray(node.children)) {
    const childHasStatus = node.children.some((c) => c?.status);
    nextError = childHasStatus ? name : errorContext || name;
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      collectExecutionsFromTree(c, nextError, executions, seen);
    }
  }
  if (Array.isArray(node.items)) {
    for (const c of node.items) {
      collectExecutionsFromTree(c, nextError, executions, seen);
    }
  }
}

export function collectFailedFromTree(node, errorContext, failures, seen) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFailedFromTree(item, errorContext, failures, seen);
    return;
  }
  if (typeof node !== "object") return;
  const status = node.status?.toString();
  const name = node.name?.toString();
  if ((status === "failed" || status === "broken") && name) {
    const base = normalizeScenarioName(name) || name;
    const params = node.parameters ?? [];
    const key = executionDedupeKey(base, params);
    if (!seen.has(key)) {
      seen.add(key);
      failures.push({
        test_name: base,
        test_name_full: name,
        status: normalizeExecutionStatus(status),
        error_message: sanitizeErrorMessage(errorContext),
        duration_ms: node.time?.duration ?? 0,
        module: null,
        tags: JSON.stringify(node.tags ?? []),
        parameters: JSON.stringify(
          Array.isArray(params)
            ? params.map((p) =>
                typeof p === "string" ? { name: "param", value: p } : p,
              )
            : params,
        ),
      });
    }
    const hasChildCases =
      Array.isArray(node.children) && node.children.some((c) => c?.status);
    if (!hasChildCases) return;
  }
  let nextError = errorContext;
  if (name && !status && Array.isArray(node.children)) {
    const childHasStatus = node.children.some((c) => c?.status);
    nextError = childHasStatus ? name : errorContext || name;
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectFailedFromTree(c, nextError, failures, seen);
  }
  if (Array.isArray(node.items)) {
    for (const c of node.items) collectFailedFromTree(c, nextError, failures, seen);
  }
}

function parseScenarioLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  let status = null;
  if (upper.endsWith(" PASSED") || upper.includes(": PASSED")) status = "passed";
  else if (upper.endsWith(" FAILED") || upper.includes(": FAILED")) status = "failed";
  else if (upper.endsWith(" SKIPPED") || upper.includes(": SKIPPED")) status = "skipped";
  else if (upper.endsWith(" BROKEN") || upper.includes(": BROKEN")) status = "broken";

  if (!status) return null;

  let name = trimmed;
  for (const token of [" PASSED", " FAILED", " SKIPPED", " BROKEN", ": PASSED", ": FAILED", ": SKIPPED", ": BROKEN"]) {
    const idx = name.toUpperCase().lastIndexOf(token);
    if (idx > 0) {
      name = name.slice(0, idx).trim();
      break;
    }
  }

  const base = normalizeScenarioName(name) || name;
  return {
    test_name: base,
    test_name_full: trimmed,
    status: normalizeExecutionStatus(status),
    error_message: status === "failed" || status === "broken" ? "From scenario log" : null,
    duration_ms: 0,
    module: null,
    tags: "[]",
    parameters: "[]",
  };
}

export function parseExecutionsFromScenarioTxt(text) {
  const executions = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const row = parseScenarioLine(line);
    if (!row) continue;
    const key = executionDedupeKey(row.test_name, []);
    if (seen.has(key)) continue;
    seen.add(key);
    executions.push(row);
  }
  return executions;
}

export function mergeExecutions(primary, extra) {
  const seen = new Set(primary.map((e) => executionDedupeKey(e.test_name, [])));
  for (const row of extra) {
    const key = executionDedupeKey(row.test_name, []);
    if (seen.has(key)) continue;
    seen.add(key);
    primary.push(row);
  }
  return primary;
}
