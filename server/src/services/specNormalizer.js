import { parseSpec, resolvePaths } from './specParser.js';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byJson = (a, b) => cmp(JSON.stringify(a), JSON.stringify(b));

// Constraints that can make a schema stricter or looser
const SIMPLE_KEYS = [
  'format', 'nullable', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum',
  'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems',
  'readOnly', 'writeOnly',
];

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (schema.circularRef) return { circularRef: schema.circularRef };

  const out = {};
  if (schema.type !== undefined) out.type = schema.type;
  for (const key of SIMPLE_KEYS) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  if (Array.isArray(schema.enum)) out.enum = [...schema.enum].sort(byJson);

  if (schema.properties && typeof schema.properties === 'object') {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    out.properties = Object.keys(schema.properties)
      .sort()
      .map((name) => ({
        name,
        required: required.has(name),
        schema: normalizeSchema(schema.properties[name]),
      }));
  }

  if (schema.items) out.items = normalizeSchema(schema.items);

  if (schema.additionalProperties !== undefined) {
    out.additionalProperties =
      typeof schema.additionalProperties === 'object'
        ? normalizeSchema(schema.additionalProperties)
        : schema.additionalProperties;
  }

  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[key])) out[key] = schema[key].map(normalizeSchema).sort(byJson);
  }

  return out;
}

// Endpoint part
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function normalizeContent(content) {
  if (!content || typeof content !== 'object') return [];
  return Object.keys(content)
    .sort()
    .map((mediaType) => ({ mediaType, schema: normalizeSchema(content[mediaType]?.schema) }));
}

// Path-level parameters apply to every operation; operation-level ones override them.
function normalizeParameters(pathLevel, opLevel) {
  const merged = new Map();
  const all = [
    ...(Array.isArray(pathLevel) ? pathLevel : []),
    ...(Array.isArray(opLevel) ? opLevel : []),
  ];
  for (const p of all) {
    if (!p || typeof p !== 'object' || !p.name || !p.in) continue;
    merged.set(`${p.in}:${p.name}`, {
      name: p.name,
      in: p.in,
      required: p.in === 'path' ? true : p.required === true, // path params are always required
      schema: normalizeSchema(p.schema),
    });
  }
  return [...merged.values()].sort((a, b) => cmp(`${a.in}:${a.name}`, `${b.in}:${b.name}`));
}

function normalizeRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  return { required: body.required === true, content: normalizeContent(body.content) };
}

function normalizeResponses(responses) {
  if (!responses || typeof responses !== 'object') return [];
  return Object.keys(responses)
    .sort()
    .map((status) => ({ status, content: normalizeContent(responses[status]?.content) }));
}

// Raw spec text -> sorted list of normalized endpoints
export function normalizeSpec(rawSpec) {
  const doc = parseSpec(rawSpec);
  const paths = resolvePaths(doc);
  const endpoints = [];

  for (const [path, item] of Object.entries(paths)) {
    if (!path.startsWith('/') || !item || typeof item !== 'object') continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      endpoints.push({
        key: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        deprecated: op.deprecated === true,
        parameters: normalizeParameters(item.parameters, op.parameters),
        requestBody: normalizeRequestBody(op.requestBody),
        responses: normalizeResponses(op.responses),
      });
    }
  }

  return endpoints.sort((a, b) => cmp(a.key, b.key));
}