/**
 * Minimal JSON Schema (draft-07 subset) validator for tests.
 *
 * Supports the constructs used by schema/verify-result.schema.json:
 * type, required, properties, additionalProperties (boolean),
 * items, enum, const, minItems, maxItems, minimum, maximum,
 * $ref to '#/definitions/*'.
 *
 * Intentionally NOT a general JSON Schema implementation — just enough
 * to prove the packaged schema accepts real runtime outputs and
 * rejects malformed ones.
 */

type Schema = Record<string, any>;

interface Ctx {
  errors: string[];
  root: Schema;
}

function typeOf(v: any): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function resolveRef(schema: Schema, ctx: Ctx): Schema {
  let s = schema;
  let guard = 0;
  while (s.$ref && guard++ < 10) {
    const ref: string = s.$ref;
    if (!ref.startsWith('#/definitions/')) {
      ctx.errors.push(`unsupported $ref: ${ref}`);
      return s;
    }
    const name = ref.slice('#/definitions/'.length);
    s = ctx.root.definitions?.[name];
    if (!s) {
      ctx.errors.push(`unresolved $ref: ${ref}`);
      return schema;
    }
  }
  return s;
}

function validate(value: any, rawSchema: Schema, path: string, ctx: Ctx): void {
  const schema = resolveRef(rawSchema, ctx);

  if (schema.const !== undefined && value !== schema.const) {
    ctx.errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    ctx.errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
    return;
  }

  if (schema.type) {
    const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = types.some(t =>
      t === actual ||
      (t === 'integer' && actual === 'number' && Number.isInteger(value)) ||
      (t === 'number' && actual === 'number')
    );
    if (!ok) {
      ctx.errors.push(`${path}: expected type ${types.join('|')}, got ${actual}`);
      return;
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      ctx.errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      ctx.errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      ctx.errors.push(`${path}: fewer than ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      ctx.errors.push(`${path}: more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, ctx));
    }
    return;
  }

  if (typeOf(value) === 'object') {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value)) {
        ctx.errors.push(`${path}.${req}: required property missing`);
      }
    }
    for (const [key, val] of Object.entries(value)) {
      // JSON.stringify drops undefined values — they are absent from the
      // serialized contract, so skip them here.
      if (val === undefined) continue;
      if (key in props) {
        validate(val, props[key], `${path}.${key}`, ctx);
      } else if (schema.additionalProperties === false) {
        ctx.errors.push(`${path}.${key}: additional property not allowed`);
      } else if (typeof schema.additionalProperties === 'object') {
        validate(val, schema.additionalProperties, `${path}.${key}`, ctx);
      }
    }
  }
}

/**
 * Validate a value against a draft-07 schema (subset). Returns error
 * paths; empty array means valid.
 */
export function validateAgainstSchema(value: any, schema: Schema): string[] {
  const ctx: Ctx = { errors: [], root: schema };
  validate(value, schema, '$', ctx);
  return ctx.errors;
}
