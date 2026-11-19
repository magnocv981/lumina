# Security Specification — Lumina ePub Reader & Library

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `userId` (`request.auth.uid == userId` and `data.ownerId == request.auth.uid`).
2. `UserProfile` contains no unverified identity claims and can only be read or written by the authenticated verified owner.
3. `BookChapter` under `/users/{userId}/books/{bookId}/chapters/{chapterId}` cannot exist without a valid parent `Book` owned by `userId`.
4. `Bookmark` under `/users/{userId}/bookmarks/{bookmarkId}` cannot be created unless the referenced `bookId` exists under `/users/{userId}/books/{bookId}`.
5. `ownerId`, `id`, and `createdAt` are immutable after document creation.
6. All `createdAt` and `updatedAt` timestamps must match server `request.time`.
7. Unbounded arrays are prohibited (`categoryIds.size() <= 10`). Every string has strict `.size()` bounds.

## 2. The "Dirty Dozen" Payloads
1. **Cross-Tenant Read/List**: User B attempts `list` on `/users/userA/books`. Expected: `PERMISSION_DENIED`.
2. **Identity Spoofing on Create**: User A creates `/users/userA/books/b1` with `ownerId: "userB"`. Expected: `PERMISSION_DENIED`.
3. **Unverified Email Write**: User A with `email_verified: false` creates a category. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection**: User A creates a book with extra field `isAdmin: true`. Expected: `PERMISSION_DENIED`.
5. **ID Poisoning**: User A writes to `/users/userA/books/invalid$id*with!chars`. Expected: `PERMISSION_DENIED`.
6. **Oversized String Exhaustion**: User A creates a book with a 300-char title (>200). Expected: `PERMISSION_DENIED`.
7. **Unbounded Array**: User A creates a book with 15 `categoryIds` (>10). Expected: `PERMISSION_DENIED`.
8. **Type Poisoning in Array**: User A creates a book with `categoryIds: [12345]`. Expected: `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: User A creates a bookmark with a past timestamp instead of `request.time`. Expected: `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: User A updates a book and tries to change `createdAt` or `ownerId`. Expected: `PERMISSION_DENIED`.
11. **Orphaned Bookmark**: User A creates a bookmark referencing `bookId: "nonexistent_book"`. Expected: `PERMISSION_DENIED`.
12. **Orphaned Chapter**: User A writes a chapter under `/users/userA/books/nonexistent/chapters/ch0`. Expected: `PERMISSION_DENIED`.
