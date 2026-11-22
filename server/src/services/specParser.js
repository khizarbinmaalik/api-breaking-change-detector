import YAML from 'yaml';

function specError(message) {
  const err = new Error(message);
  err.status = 422; // the file exists but its content can't be used
  return err;
}

// Turns raw spec text into a JavaScript object, or throws a clear error.
export function parseSpec(rawSpec) {
  let doc;
  try {
    doc = YAML.parse(rawSpec);
  } catch (err) {
    throw specError(`The spec file is not valid YAML or JSON: ${err.message}`);
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw specError('The spec file does not contain an OpenAPI document');
  }
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw specError('Only OpenAPI 3.x specs are supported (the "openapi" version field is missing or not 3.x)');
  }
  if (!doc.paths || typeof doc.paths !== 'object') {
    throw specError('The spec has no "paths" section');
  }

  return doc;
}

// Follows a local reference like "#/components/schemas/User" inside the document.
function resolvePointer(doc, ref) {
  if (!ref.startsWith('#/')) {
    throw specError(`Only local $ref values (starting with "#/") are supported, found: ${ref}`);
  }
  const parts = ref
    .slice(2)
    .split('/')
    .map((p) => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'));

  let node = doc;
  for (const part of parts) node = node?.[part];
  if (node === undefined) throw specError(`Could not resolve reference ${ref}`);
  return node;
}

// Returns a copy of doc.paths with every $ref replaced by the thing it points to.
export function resolvePaths(doc) {
  let budget = 200000; // maximum number of nodes we are willing to build

  function walk(node, stack) {
    if (--budget < 0) throw specError('The spec is too large or too deeply nested to analyze');

    if (Array.isArray(node)) return node.map((item) => walk(item, stack));

    if (node && typeof node === 'object') {
      if (typeof node.$ref === 'string') {
        const ref = node.$ref;
        if (stack.includes(ref)) return { circularRef: ref }; // stop the infinite loop
        return walk(resolvePointer(doc, ref), [...stack, ref]);
      }
      const copy = {};
      for (const [key, value] of Object.entries(node)) copy[key] = walk(value, stack);
      return copy;
    }

    return node; // strings, numbers, booleans, null
  }

  return walk(doc.paths, []);
}