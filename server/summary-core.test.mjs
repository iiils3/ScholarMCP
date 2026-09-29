import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMaterial, validateSummary, summaryPrompt, MAX_SOURCE_CHARS } from './summary-core.mjs';

const id = '24c44113-fbdd-4d67-9603-4947bcad0ad2';
test('material bounds prevent oversized provider requests', () => {
  assert.equal(validateMaterial({courseId:id,name:' Lecture ',text:'x'.repeat(100)}).name,'Lecture');
  assert.throws(() => validateMaterial({courseId:id,name:'Lecture',text:'x'.repeat(MAX_SOURCE_CHARS+1)}), {code:'invalid_text'});
  assert.throws(() => validateMaterial({courseId:'------------------------------------',name:'Lecture',text:'x'.repeat(100)}), {code:'invalid_course'});
});
test('summary requires a stable idempotency key and material ID', () => {
  assert.deepEqual(validateSummary({materialId:id,idempotencyKey:'request_123456'}),{materialId:id,idempotencyKey:'request_123456'});
  assert.throws(() => validateSummary({materialId:id,idempotencyKey:'short'}), {code:'invalid_idempotency_key'});
});
test('prompt labels the student source', () => {
  assert.match(summaryPrompt({name:'Lecture 1',extracted_text:'Specific content'}), /Source: Lecture 1\nSpecific content/);
});
