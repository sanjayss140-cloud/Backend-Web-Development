const express = require('express');
const { posts } = require('../data');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const PRIVILEGED_ROLES = ['moderator', 'admin'];

/**
 * Resolves a post by id and checks owner-or-privileged authorization (404 before 403).
 */
function loadOwnedOrPrivileged(req, res) {
  const postIndex = posts.findIndex((p) => p.id === req.params.id);
  if (postIndex === -1) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
    return null;
  }

  const post = posts[postIndex];
  const isOwner = post.authorId === req.user.id;
  const isPrivileged = PRIVILEGED_ROLES.includes(req.user.role);
  if (!isOwner && !isPrivileged) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this resource' } });
    return null;
  }

  return { post, postIndex };
}

// List posts — any authenticated user.
router.get('/', (req, res) => {
  return res.status(200).json(posts);
});

// Create a post — the caller becomes the author.
router.post('/', (req, res) => {
  const post = {
    id: String(posts.length + 1),
    authorId: req.user.id,
    title: req.body?.title ?? 'Untitled',
    hidden: false,
  };
  posts.push(post);
  return res.status(201).json(post);
});

// Update a post — owner or moderator/admin only.
router.patch('/:id', (req, res) => {
  const found = loadOwnedOrPrivileged(req, res);
  if (!found) return;
  found.post.title = req.body?.title ?? found.post.title;
  return res.status(200).json(found.post);
});

// Delete a post — owner or moderator/admin only.
router.delete('/:id', (req, res) => {
  const found = loadOwnedOrPrivileged(req, res);
  if (!found) return;
  posts.splice(found.postIndex, 1);
  return res.status(200).json({ ok: true });
});

// Hide a post — moderator/admin only.
router.post('/:id/hide', requireRole('moderator', 'admin'), (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
  post.hidden = true;
  return res.status(200).json(post);
});

module.exports = router;
