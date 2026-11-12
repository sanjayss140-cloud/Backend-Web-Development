const prisma = require('../db/prisma');

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
};

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

async function findPublicById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: PUBLIC_USER_SELECT,
  });
}

module.exports = {
  toPublicUser,
  findByEmail,
  findPublicById,
};
