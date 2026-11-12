const prisma = require('../db/prisma');
const AppError = require('../utils/AppError');

/**
 * Looks up a user record by normalized email.
 */
async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Persists a new user record and maps unique email conflicts to HTTP 409.
 */
async function createUser({ name, email, passwordHash }) {
  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });
  } catch (error) {
    if (error && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }
    throw error;
  }
}

module.exports = {
  findByEmail,
  createUser,
};
