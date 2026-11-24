const breaking = (reason) => ({ severity: 'breaking', reason });
const safe = (reason) => ({ severity: 'safe', reason });

const LOWER_BOUNDS = ['minimum', 'minLength', 'minItems'];
const UPPER_BOUNDS = ['maximum', 'maxLength', 'maxItems'];

// Rules for changes to constraints like nullable, minimum, maxLength, format...
function classifyConstraint(c) {
  const { field, before, after } = c;
  const request = c.direction === 'request';

  if (field === 'nullable') {
    const nowNullable = after === true;
    if (request) {
      return nowNullable ? safe('The field now also accepts null') : breaking('The field no longer accepts null');
    }
    return nowNullable
      ? breaking('The field can now be null in responses')
      : safe('The field can no longer be null in responses');
  }

  if (LOWER_BOUNDS.includes(field) || UPPER_BOUNDS.includes(field)) {
    // "Tighter" means fewer values are allowed than before
    const tighter = LOWER_BOUNDS.includes(field)
      ? (after ?? -Infinity) > (before ?? -Infinity)
      : (after ?? Infinity) < (before ?? Infinity);
    if (request) {
      return tighter
        ? breaking(`Stricter input limit: ${field} changed from ${before} to ${after}`)
        : safe(`Looser input limit: ${field} changed from ${before} to ${after}`);
    }
    return tighter
      ? safe(`Stronger guarantee for responses: ${field} changed from ${before} to ${after}`)
      : breaking(`Weaker guarantee for responses: ${field} changed from ${before} to ${after}`);
  }

  // format, pattern, readOnly, writeOnly, exclusiveMinimum...: when unsure, flag it
  return breaking(`"${field}" changed from ${before} to ${after}`);
}

export function classifyChange(c) {
  const request = c.direction === 'request';

  switch (c.type) {
    // --- Endpoints ---
    case 'ENDPOINT_REMOVED':
      return breaking('Clients calling this endpoint will fail');
    case 'ENDPOINT_ADDED':
      return safe('New endpoint');
    case 'ENDPOINT_DEPRECATED':
      return safe('Marked as deprecated; it still works');
    case 'ENDPOINT_UNDEPRECATED':
      return safe('No longer marked as deprecated');

    // --- Parameters ---
    case 'PARAM_ADDED':
      return c.after?.required
        ? breaking('New required parameter: existing clients do not send it')
        : safe('New optional parameter');
    case 'PARAM_REMOVED':
      return safe('Parameter removed; clients can still send it but it has no effect');
    case 'PARAM_REQUIRED_CHANGED':
      return c.after ? breaking('Parameter is now required') : safe('Parameter is now optional');

    // --- Request body ---
    case 'REQUEST_BODY_ADDED':
      return c.after?.required
        ? breaking('A required request body was added')
        : safe('An optional request body was added');
    case 'REQUEST_BODY_REMOVED':
      return safe('Request body removed; clients can still send it');
    case 'REQUEST_BODY_REQUIRED_CHANGED':
      return c.after ? breaking('Request body is now required') : safe('Request body is now optional');

    // --- Responses and content types ---
    case 'RESPONSE_ADDED':
      return safe('New response documented');
    case 'RESPONSE_REMOVED': {
      const status = c.location.match(/^response (\S+)/)?.[1] ?? '';
      return status.startsWith('2')
        ? breaking(`Success response ${status} was removed`)
        : safe(`Response ${status} was removed`);
    }
    case 'MEDIA_TYPE_ADDED':
      return safe('New content type supported');
    case 'MEDIA_TYPE_REMOVED':
      return breaking(
        request ? 'The server no longer accepts this content type' : 'Clients can no longer receive this content type'
      );

    // --- Schemas (properties, types, enums) ---
    case 'TYPE_CHANGED':
      return breaking(`Type changed from ${c.before} to ${c.after}`);

    case 'PROPERTY_ADDED':
      if (request) {
        return c.after?.required
          ? breaking('New required property in the request: existing clients do not send it')
          : safe('New optional property in the request');
      }
      return safe('New property in the response; clients ignore fields they do not know');

    case 'PROPERTY_REMOVED':
      return request
        ? safe('Property removed from the request; clients can still send it')
        : breaking('Property removed from the response; clients that read it will break');

    case 'PROPERTY_REQUIRED_CHANGED':
      if (request) {
        return c.after ? breaking('Property is now required in the request') : safe('Property is now optional in the request');
      }
      return c.after
        ? safe('Property is now always present in the response')
        : breaking('Property may now be missing from the response');

    case 'ENUM_ADDED':
      return request
        ? breaking('Input is now limited to a fixed list of values')
        : safe('Responses are now limited to a fixed list of values');
    case 'ENUM_REMOVED':
      return request
        ? safe('Input is no longer limited to a fixed list of values')
        : breaking('Responses may now contain values outside the old fixed list');
    case 'ENUM_VALUE_ADDED':
      return request
        ? safe(`The server now also accepts "${c.after}"`)
        : breaking(`Responses may now contain a new value "${c.after}" that clients do not expect`);
    case 'ENUM_VALUE_REMOVED':
      return request
        ? breaking(`The server no longer accepts "${c.before}"`)
        : safe(`Responses will no longer contain "${c.before}"`);

    case 'CONSTRAINT_CHANGED':
      return classifyConstraint(c);

    case 'SCHEMA_CHANGED':
    case 'SCHEMA_KEYWORD_CHANGED':
      return breaking('The structure changed in a way that cannot be checked automatically');

    default:
      return breaking(`Unrecognized change (${c.type}); flagged to be safe`);
  }
}

export function classifyChanges(changes) {
  return changes.map((c) => ({ ...c, ...classifyChange(c) }));
}

export function summarize(classified) {
  const breakingCount = classified.filter((c) => c.severity === 'breaking').length;
  return { total: classified.length, breaking: breakingCount, safe: classified.length - breakingCount };
}