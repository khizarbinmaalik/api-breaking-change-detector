import { SIMPLE_KEYS } from './specNormalizer.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A short label for a schema, used in change records
function brief(schema) {
  if (!schema) return 'none';
  if (schema.circularRef) return 'circular';
  return schema.type ?? 'any';
}

// `add(type, direction, location, extra)` records one change
function diffSchema(before, after, add, direction, location) {
  // Missing on one side, or a circular marker: compare coarsely
  if (!before || !after || before.circularRef || after.circularRef) {
    if (!same(before, after)) {
      add('SCHEMA_CHANGED', direction, location, { before: brief(before), after: brief(after) });
    }
    return;
  }

  if (!same(before.type, after.type)) {
    add('TYPE_CHANGED', direction, location, { before: before.type ?? null, after: after.type ?? null });
  }

  for (const key of SIMPLE_KEYS) {
    if (!same(before[key], after[key])) {
      add('CONSTRAINT_CHANGED', direction, location, {
        field: key,
        before: before[key] ?? null,
        after: after[key] ?? null,
      });
    }
  }

  // Enums: a whole enum appearing or disappearing is different from one value changing
  if (!before.enum && after.enum) add('ENUM_ADDED', direction, location);
  else if (before.enum && !after.enum) add('ENUM_REMOVED', direction, location);
  else if (before.enum && after.enum) {
    for (const v of before.enum) {
      if (!after.enum.some((x) => same(x, v))) add('ENUM_VALUE_REMOVED', direction, location, { before: v });
    }
    for (const v of after.enum) {
      if (!before.enum.some((x) => same(x, v))) add('ENUM_VALUE_ADDED', direction, location, { after: v });
    }
  }

  // Properties: match by name
  const bProps = new Map((before.properties || []).map((p) => [p.name, p]));
  const aProps = new Map((after.properties || []).map((p) => [p.name, p]));
  for (const [name, p] of bProps) {
    const loc = `${location} > ${name}`;
    const q = aProps.get(name);
    if (!q) {
      add('PROPERTY_REMOVED', direction, loc, { before: { required: p.required, type: brief(p.schema) } });
      continue;
    }
    if (p.required !== q.required) {
      add('PROPERTY_REQUIRED_CHANGED', direction, loc, { before: p.required, after: q.required });
    }
    diffSchema(p.schema, q.schema, add, direction, loc); // go deeper
  }
  for (const [name, q] of aProps) {
    if (!bProps.has(name)) {
      add('PROPERTY_ADDED', direction, `${location} > ${name}`, {
        after: { required: q.required, type: brief(q.schema) },
      });
    }
  }

  // Array items
  if (before.items || after.items) {
    diffSchema(before.items ?? null, after.items ?? null, add, direction, `${location} > items`);
  }

  // Rarer keywords: just note that they changed
  for (const key of ['additionalProperties', 'allOf', 'oneOf', 'anyOf']) {
    if (!same(before[key], after[key])) add('SCHEMA_KEYWORD_CHANGED', direction, location, { field: key });
  }
}

function diffContent(beforeContent, afterContent, add, direction, location) {
  const bm = new Map(beforeContent.map((c) => [c.mediaType, c]));
  const am = new Map(afterContent.map((c) => [c.mediaType, c]));
  for (const [mediaType, c] of bm) {
    const loc = `${location} ${mediaType}`;
    const d = am.get(mediaType);
    if (!d) add('MEDIA_TYPE_REMOVED', direction, loc);
    else diffSchema(c.schema, d.schema, add, direction, loc);
  }
  for (const mediaType of am.keys()) {
    if (!bm.has(mediaType)) add('MEDIA_TYPE_ADDED', direction, `${location} ${mediaType}`);
  }
}

function diffEndpoint(b, a, changes) {
  const endpoint = b.key;
  const add = (type, direction, location, extra = {}) =>
    changes.push({ type, endpoint, direction, location, ...extra });

  if (b.deprecated !== a.deprecated) {
    add(a.deprecated ? 'ENDPOINT_DEPRECATED' : 'ENDPOINT_UNDEPRECATED', null, endpoint);
  }

  // Parameters, matched by "in:name" (for example "query:limit")
  const bp = new Map(b.parameters.map((p) => [`${p.in}:${p.name}`, p]));
  const ap = new Map(a.parameters.map((p) => [`${p.in}:${p.name}`, p]));
  for (const [k, p] of bp) {
    const loc = `parameter ${k}`;
    const q = ap.get(k);
    if (!q) { add('PARAM_REMOVED', 'request', loc, { before: { required: p.required } }); continue; }
    if (p.required !== q.required) add('PARAM_REQUIRED_CHANGED', 'request', loc, { before: p.required, after: q.required });
    diffSchema(p.schema, q.schema, add, 'request', loc);
  }
  for (const [k, q] of ap) {
    if (!bp.has(k)) add('PARAM_ADDED', 'request', `parameter ${k}`, { after: { required: q.required } });
  }

  // Request body
  const bb = b.requestBody;
  const ab = a.requestBody;
  if (!bb && ab) add('REQUEST_BODY_ADDED', 'request', 'request body', { after: { required: ab.required } });
  else if (bb && !ab) add('REQUEST_BODY_REMOVED', 'request', 'request body');
  else if (bb && ab) {
    if (bb.required !== ab.required) {
      add('REQUEST_BODY_REQUIRED_CHANGED', 'request', 'request body', { before: bb.required, after: ab.required });
    }
    diffContent(bb.content, ab.content, add, 'request', 'request body');
  }

  // Responses, matched by status code
  const br = new Map(b.responses.map((r) => [r.status, r]));
  const ar = new Map(a.responses.map((r) => [r.status, r]));
  for (const [status, r] of br) {
    const s = ar.get(status);
    if (!s) add('RESPONSE_REMOVED', 'response', `response ${status}`);
    else diffContent(r.content, s.content, add, 'response', `response ${status}`);
  }
  for (const status of ar.keys()) {
    if (!br.has(status)) add('RESPONSE_ADDED', 'response', `response ${status}`);
  }
}

// The main function: two normalized endpoint lists in, a list of change records out
export function diffEndpoints(beforeList, afterList) {
  const changes = [];
  const before = new Map(beforeList.map((e) => [e.key, e]));
  const after = new Map(afterList.map((e) => [e.key, e]));

  for (const key of before.keys()) {
    if (!after.has(key)) changes.push({ type: 'ENDPOINT_REMOVED', endpoint: key, direction: null, location: key });
  }
  for (const key of after.keys()) {
    if (!before.has(key)) changes.push({ type: 'ENDPOINT_ADDED', endpoint: key, direction: null, location: key });
  }
  for (const [key, b] of before) {
    const a = after.get(key);
    if (a) diffEndpoint(b, a, changes);
  }
  return changes;
}