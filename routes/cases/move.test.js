import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import caseMoveRoute from './move.js';
import { roles, memberRoles } from '../users/authSettings.js';

const adminRoleIndex = roles.findIndex((e) => e.uid === 'administrator');
const qaManagerRoleIndex = roles.findIndex((e) => e.uid === 'qa-manager');
const userRoleIndex = roles.findIndex((e) => e.uid === 'user');
const developerRoleIndex = memberRoles.findIndex((e) => e.uid === 'developer');

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: vi.fn((req, res, next) => {
      req.userId = 1;
      next();
    }),
  }),
}));

const mockUser = { findByPk: vi.fn() };
vi.mock('../../models/users.js', () => ({ default: () => mockUser }));

const mockProject = { findOne: vi.fn(), hasMany: vi.fn() };
vi.mock('../../models/projects.js', () => ({ default: () => mockProject }));

const mockMember = { belongsTo: vi.fn() };
vi.mock('../../models/members.js', () => ({ default: () => mockMember }));

const mockCase = { findAll: vi.fn(), update: vi.fn() };
vi.mock('../../models/cases.js', () => ({ default: () => mockCase }));

describe('PUT /cases/move', () => {
  let app;
  const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/cases', caseMoveRoute(sequelize));
    vi.clearAllMocks();
  });

  // ── Authorization ──────────────────────────────────────────────────────────

  it('should allow admin to move cases', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });
    mockCase.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockCase.update.mockResolvedValue([2]);

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1, 2], targetFolderId: 5 });

    expect(response.status).toBe(200);
  });

  it('should allow QA manager to move cases', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: qaManagerRoleIndex });
    mockCase.findAll.mockResolvedValue([{ id: 1 }]);
    mockCase.update.mockResolvedValue([1]);

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1], targetFolderId: 5 });

    expect(response.status).toBe(200);
  });

  it('should allow project developer to move cases', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: userRoleIndex });
    mockProject.findOne.mockResolvedValue({
      id: 1,
      userId: 99,
      Members: [{ userId: 1, role: developerRoleIndex }],
    });
    mockCase.findAll.mockResolvedValue([{ id: 1 }]);
    mockCase.update.mockResolvedValue([1]);

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1], targetFolderId: 5 });

    expect(response.status).toBe(200);
  });

  it('should return 403 for user without project developer role', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: userRoleIndex });
    mockProject.findOne.mockResolvedValue({ id: 1, userId: 99, Members: [] });

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1], targetFolderId: 5 });

    expect(response.status).toBe(403);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('should return 400 when caseIds is missing', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ targetFolderId: 5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('caseIds(array) and targetFolderId are required');
  });

  it('should return 400 when caseIds is an empty array', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [], targetFolderId: 5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('caseIds(array) and targetFolderId are required');
  });

  it('should return 400 when targetFolderId is missing', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1, 2] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('caseIds(array) and targetFolderId are required');
  });

  it('should return 404 when some cases are not found', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });
    mockCase.findAll.mockResolvedValue([{ id: 1 }]); // 1 found, 2 requested

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1, 2], targetFolderId: 5 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Some cases not found');
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('should return 200 with correct response body and call Case.update', async () => {
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });
    mockCase.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockCase.update.mockResolvedValue([3]);

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1, 2, 3], targetFolderId: 7 });

    expect(response.status).toBe(200);
    expect(response.body.movedCaseIds).toEqual([1, 2, 3]);
    expect(response.body.targetFolderId).toBe(7);
    expect(mockCase.update).toHaveBeenCalledWith({ folderId: 7 }, { where: { id: [1, 2, 3] } });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('should return 500 on internal server error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUser.findByPk.mockResolvedValue({ id: 1, role: adminRoleIndex });
    mockCase.findAll.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .put('/cases/move?projectId=1')
      .send({ caseIds: [1], targetFolderId: 5 });

    expect(response.status).toBe(500);
  });
});
