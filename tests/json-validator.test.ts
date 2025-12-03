/**
 * JSON Validator Engine Tests
 */

import { JSONValidatorEngine } from '../src/engines/json-validator';

describe('JSONValidatorEngine', () => {
  let engine: JSONValidatorEngine;

  beforeEach(() => {
    engine = new JSONValidatorEngine({} as any);
  });

  describe('validate', () => {
    it('should validate valid JSON', async () => {
      const result = await engine.validate('{"name": "test", "value": 123}');
      
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual({ name: 'test', value: 123 });
      expect(result.repaired).toBe(false);
    });

    it('should validate JSON arrays', async () => {
      const result = await engine.validate('[1, 2, 3]');
      
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([1, 2, 3]);
    });

    it('should handle nested JSON', async () => {
      const nested = JSON.stringify({
        level1: {
          level2: {
            level3: { value: 'deep' }
          }
        }
      });
      
      const result = await engine.validate(nested);
      
      expect(result.valid).toBe(true);
      expect(result.structure.depth).toBeGreaterThan(2);
    });

    it('should report invalid JSON', async () => {
      const result = await engine.validate('not json at all');
      
      expect(result.valid).toBe(false);
      expect(result.parsed).toBeNull();
    });

    it('should include limitations and methodology', async () => {
      const result = await engine.validate('{}');
      
      expect(result.limitations).toBeDefined();
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.methodology).toBeDefined();
    });
  });

  describe('JSON repair', () => {
    it('should repair trailing commas', async () => {
      const result = await engine.validate('{"name": "test",}');
      
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(true);
      expect(result.repairMethod).toBe('trailing comma removal');
    });

    it('should repair single quotes', async () => {
      const result = await engine.validate("{'name': 'test'}");
      
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(true);
      expect(result.repairMethod).toBe('single to double quotes');
    });

    it('should repair unquoted keys', async () => {
      const result = await engine.validate('{name: "test"}');
      
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(true);
      expect(result.repairMethod).toBe('unquoted keys');
    });

    it('should extract JSON from surrounding text', async () => {
      const result = await engine.validate('Here is the JSON: {"valid": true} end of response');
      
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(true);
      expect(result.repairMethod).toBe('extract JSON from text');
    });

    it('should extract array from surrounding text', async () => {
      const result = await engine.validate('The array is: [1, 2, 3] done');
      
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(true);
    });

    it('should fail on completely invalid content', async () => {
      const result = await engine.validate('this has no json whatsoever');
      
      expect(result.valid).toBe(false);
      expect(result.repaired).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('should validate against schema', async () => {
      const schema = { name: 'string', age: 'number' };
      const result = await engine.validate('{"name": "John", "age": 30}', schema);
      
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.schemaErrors).toHaveLength(0);
    });

    it('should report missing required fields', async () => {
      const schema = { name: 'string', age: 'number' };
      const result = await engine.validate('{"name": "John"}', schema);
      
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(false);
      expect(result.schemaErrors).toContain('Missing required field: age');
    });

    it('should report type mismatches', async () => {
      const schema = { name: 'string', age: 'number' };
      const result = await engine.validate('{"name": "John", "age": "thirty"}', schema);
      
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(false);
      expect(result.schemaErrors.some(e => e.includes('expected number'))).toBe(true);
    });

    it('should validate array types', async () => {
      const schema = { items: 'array' };
      const result = await engine.validate('{"items": [1, 2, 3]}', schema);
      
      expect(result.schemaValid).toBe(true);
    });

    it('should report when array expected but not provided', async () => {
      const schema = { items: 'array' };
      const result = await engine.validate('{"items": "not an array"}', schema);
      
      expect(result.schemaValid).toBe(false);
      expect(result.schemaErrors.some(e => e.includes('expected array'))).toBe(true);
    });

    it('should handle null schema', async () => {
      const result = await engine.validate('{"name": "test"}', null);
      
      expect(result.schemaValid).toBe(true);
    });

    it('should handle non-object data with schema', async () => {
      const schema = { name: 'string' };
      const result = await engine.validate('"just a string"', schema);
      
      expect(result.valid).toBe(true);
      expect(result.schemaValid).toBe(false);
      expect(result.schemaErrors).toContain('Data is not an object');
    });
  });

  describe('structure analysis', () => {
    it('should calculate depth correctly', async () => {
      const shallow = await engine.validate('{"a": 1}');
      const deep = await engine.validate('{"a": {"b": {"c": {"d": 1}}}}');
      
      expect(shallow.structure.depth).toBeLessThan(deep.structure.depth);
    });

    it('should count keys correctly', async () => {
      const result = await engine.validate('{"a": 1, "b": 2, "c": {"d": 3}}');
      
      expect(result.structure.keyCount).toBe(4); // a, b, c, d
    });

    it('should warn about deep nesting', async () => {
      // Create deeply nested object
      let nested: any = { value: 'deep' };
      for (let i = 0; i < 12; i++) {
        nested = { level: nested };
      }
      
      const result = await engine.validate(JSON.stringify(nested));
      
      expect(result.structure.issues.some(i => i.includes('Deep nesting'))).toBe(true);
    });

    it('should handle empty objects', async () => {
      const result = await engine.validate('{}');
      
      expect(result.structure.depth).toBe(0);
      expect(result.structure.keyCount).toBe(0);
    });

    it('should handle arrays in structure analysis', async () => {
      const result = await engine.validate('[{"a": 1}, {"b": 2}]');
      
      expect(result.structure.keyCount).toBe(2);
    });

    it('should handle null/undefined data', async () => {
      const result = await engine.validate('null');
      
      expect(result.valid).toBe(true);
      expect(result.structure.issues).toContain('No valid data to analyze');
    });
  });
});
