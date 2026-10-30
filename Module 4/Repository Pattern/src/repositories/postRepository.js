/**
 * Post Repository
 *
 * Implements the standard 5-method repository contract over an in-memory Map-backed store.
 * Storage-swap proof: The internal store uses a Map rather than an array, proving that
 * the consuming service depends on a stable contract rather than a specific storage technology.
 *
 * Storage Swap Analysis (Transitioning to a Prisma-backed implementation):
 *
 * What will CHANGE when replacing this with Prisma:
 * 1. Storage mechanism: The in-memory Map (`posts`) and manual ID generator (`nextId`) will be replaced
 *    by the Prisma Client instance (e.g., `const prisma = new PrismaClient()`).
 * 2. Method implementations: Operations will invoke Prisma model delegates
 *    (e.g., `prisma.post.findMany()`, `prisma.post.findUnique()`, `prisma.post.create()`,
 *    `prisma.post.update()`, `prisma.post.delete()`).
 * 3. Asynchrony: Methods will become `async` and return Promises that resolve to database results.
 * 4. Persistence & integrity: ID autoincrement, foreign key constraints, and persistence to disk
 *    will be managed by the database engine rather than in-memory process state.
 *
 * What will REMAIN UNCHANGED:
 * 1. Method signatures & contract: The 5 core methods (`findAll`, `findById`, `create`, `update`, `remove`)
 *    remain the single source of truth for post data access.
 * 2. Return shapes & semantics:
 *    - `findAll()` returns an array (empty array if none, never null).
 *    - `findById(id)` returns the record or null if not found (not an exception).
 *    - `create(fields)` returns the created record containing the generated id.
 *    - `update(id, patch)` returns the updated record, or null if id not found.
 *    - `remove(id)` returns a boolean indicating whether the record existed and was removed.
 * 3. Calling layers: `postService.js`, `postController.js`, routes, and API responses require
 *    zero modifications to business logic, validations, or response contracts.
 */

const postStore = require('../data/postStore');

// Map-backed store (storage-swap proof: replaces array-based store with a Map)
const posts = new Map();
let nextId = 1;

// Initialize repository storage from postStore if available
if (postStore && Array.isArray(postStore.posts)) {
  for (const post of postStore.posts) {
    posts.set(post.id, { ...post });
    if (post.id >= nextId) {
      nextId = post.id + 1;
    }
  }
} else {
  // Default seed data
  posts.set(1, { id: 1, title: 'First post', body: 'Repository boundaries protect change.', authorId: 7 });
  posts.set(2, { id: 2, title: 'Second post', body: 'Services should speak in domain language.', authorId: 8 });
  nextId = 3;
}

function findAll() {
  return Array.from(posts.values()).map((post) => ({ ...post }));
}

function findById(id) {
  const post = posts.get(Number(id));
  return post ? { ...post } : null;
}

function create(fields = {}) {
  const record = {
    ...fields,
    id: nextId++,
    body: fields.body !== undefined && fields.body !== null ? fields.body : '',
  };
  posts.set(record.id, record);
  return { ...record };
}

function update(id, patch = {}) {
  const numericId = Number(id);
  const existing = posts.get(numericId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    id: existing.id,
  };
  posts.set(numericId, updated);
  return { ...updated };
}

function remove(id) {
  const numericId = Number(id);
  return posts.delete(numericId);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
