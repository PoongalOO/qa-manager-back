import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import adminCreateRoute from './adminCreate.js';
import { roles } from './authSettings.js';

const userRoleIndex = roles.findIndex((entry) => entry.uid === 'user');
const adminRoleIndex = roles.findIndex((entry) => entry.uid === 'administrator');
const qaManagerRoleIndex = roles.findIndex((entry) => entry.uid === 'qa-manager');

// mock authentication middleware
vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: vi.fn((req, res, next) => {
      req.userId = 1;
      next();
    }),
    verifyAdmin: vi.fn((req, res, next) => {
      next();
    }),
  }),
}));

// mock defineUser
const mockUser = {
  findOne: vi.fn(),
  create: vi.fn(),
};
vi.mock('../../models/users.js', () => ({
  default: () => mockUser,
}));

// mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: async (pw) => `hashed_${pw}`,
  },
}));

describe('adminCreate', () => {
  let app;
  const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', adminCreateRoute(sequelize));
    vi.clearAllMocks();
  });

  it('should return 400 when email is missing', async () => {
    const response = await request(app)
      .post('/users/admin-create')
      .send({ username: 'alice', password: 'password123' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Email, username and password are required');
  });

  it('should return 400 when username is missing', async () => {
    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Email, username and password are required');
  });

  it('should return 400 when password is missing', async () => {
    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Email, username and password are required');
  });

  it('should return 409 when email already exists', async () => {
    mockUser.findOne.mockResolvedValue({ id: 2, email: 'alice@example.com' });

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice', password: 'password123' });

    expect(response.status).toBe(409);
    expect(response.text).toBe('Email already exists');
  });

  it('should create user with default user role when role is not provided', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const createdUser = { id: 2, email: 'alice@example.com', username: 'alice', role: userRoleIndex, password: 'hashed_password123' };
    mockUser.create.mockResolvedValue(createdUser);

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice', password: 'password123' });

    expect(response.status).toBe(201);
    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com', username: 'alice', role: userRoleIndex })
    );
  });

  it('should create user with the specified role', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const createdUser = { id: 3, email: 'bob@example.com', username: 'bob', role: qaManagerRoleIndex, password: 'hashed_password123' };
    mockUser.create.mockResolvedValue(createdUser);

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'bob@example.com', username: 'bob', password: 'password123', role: qaManagerRoleIndex });

    expect(response.status).toBe(201);
    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: qaManagerRoleIndex })
    );
  });

  it('should create user with administrator role when specified', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const createdUser = { id: 4, email: 'admin2@example.com', username: 'admin2', role: adminRoleIndex, password: 'hashed_password123' };
    mockUser.create.mockResolvedValue(createdUser);

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'admin2@example.com', username: 'admin2', password: 'password123', role: adminRoleIndex });

    expect(response.status).toBe(201);
    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: adminRoleIndex })
    );
  });

  it('should hash the password before storing', async () => {
    mockUser.findOne.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({ id: 2, email: 'alice@example.com', username: 'alice', role: userRoleIndex });

    await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice', password: 'password123' });

    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed_password123' })
    );
  });

  it('should not return the password in the response', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const createdUser = { id: 2, email: 'alice@example.com', username: 'alice', role: userRoleIndex, password: 'hashed_password123' };
    mockUser.create.mockResolvedValue(createdUser);

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.user.password).toBeUndefined();
  });

  it('should return 500 on internal server error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUser.findOne.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/users/admin-create')
      .send({ email: 'alice@example.com', username: 'alice', password: 'password123' });

    expect(response.status).toBe(500);
    expect(response.text).toBe('Failed to create account');
  });
});
