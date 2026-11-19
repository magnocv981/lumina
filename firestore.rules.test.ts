/**
 * Security Rule Verification Matrix for Lumina ePub Reader
 * Documents expected PERMISSION_DENIED outcomes for the Dirty Dozen payloads.
 */

export interface SecurityTestCase {
  name: string;
  path: string;
  operation: 'create' | 'update' | 'get' | 'list';
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    name: '01. Cross-tenant list attack',
    path: '/users/userA/books',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '02. Identity spoofing via ownerId mismatch',
    path: '/users/userA/books/book1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'book1', ownerId: 'userB', title: 'Test' },
  },
  {
    name: '03. Unverified email write attempt',
    path: '/users/userA/categories/cat1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '04. Shadow field injection',
    path: '/users/userA/books/book1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'book1', ownerId: 'userA', isAdmin: true },
  },
  {
    name: '05. Path variable ID poisoning',
    path: '/users/userA/books/bad$id',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '06. Oversized title string',
    path: '/users/userA/books/book1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'x'.repeat(201) },
  },
  {
    name: '07. Unbounded categoryIds array (>10)',
    path: '/users/userA/books/book1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { categoryIds: Array.from({ length: 11 }, (_, i) => `c${i}`) },
  },
  {
    name: '08. Array element type poisoning',
    path: '/users/userA/books/book1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { categoryIds: [12345] },
  },
  {
    name: '09. Forged client timestamp',
    path: '/users/userA/bookmarks/bm1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    name: '10. Immutable createdAt mutation on update',
    path: '/users/userA/books/book1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Orphaned bookmark referencing missing book',
    path: '/users/userA/bookmarks/bm1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { bookId: 'missing_book' },
  },
  {
    name: '12. Orphaned chapter under missing book',
    path: '/users/userA/books/missing_book/chapters/ch0',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
];
