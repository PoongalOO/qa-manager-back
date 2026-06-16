import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseResult from '../../models/runCaseResults.js';
import defineUser from '../../models/users.js';
import defineRun from '../../models/runs.js';
import defineMember from '../../models/members.js';
import defineProject from '../../models/projects.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { roles, memberRoles } from '../users/authSettings.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectReporterFromRunId } = editableMiddleware(sequelize);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseResult = defineRunCaseResult(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  const Project = defineProject(sequelize, DataTypes);

  RunCase.hasMany(RunCaseResult, { foreignKey: 'runCaseId' });
  RunCaseResult.belongsTo(RunCase, { foreignKey: 'runCaseId' });

  async function isManager(runId, userId) {
    const user = await User.findByPk(userId);
    if (user) {
      const adminIdx = roles.findIndex((r) => r.uid === 'administrator');
      const qaIdx = roles.findIndex((r) => r.uid === 'qa-manager');
      if (user.role === adminIdx || user.role === qaIdx) return true;
    }
    const run = await Run.findByPk(runId);
    if (!run) return false;
    const project = await Project.findByPk(run.projectId);
    if (!project) return false;
    if (project.userId === userId) return true;
    const member = await Member.findOne({ where: { userId, projectId: run.projectId } });
    if (member) {
      const managerIdx = memberRoles.findIndex((r) => r.uid === 'manager');
      if (member.role === managerIdx) return true;
    }
    return false;
  }

  // Existing endpoint — manager-level include/exclude + status update on RunCase
  router.post('/update', verifySignedIn, verifyProjectReporterFromRunId, async (req, res) => {
    const runId = req.query.runId;
    const runCases = req.body;
    const t = await sequelize.transaction();

    const createRunCase = async (runCase) => {
      return RunCase.create({ runId, caseId: runCase.caseId, status: runCase.status }, { transaction: t });
    };

    const deleteRunCase = async (runCase) => {
      await RunCase.destroy({ where: { runId, caseId: runCase.caseId }, transaction: t });
      return null;
    };

    const updateRunCase = async (runCase) => {
      await RunCase.update({ status: runCase.status }, { where: { id: runCase.id }, transaction: t });
      return runCase;
    };

    try {
      const results = await Promise.all(
        runCases.map(async (step) => {
          if (step.editState === 'new') return createRunCase(step);
          if (step.editState === 'deleted') return deleteRunCase(step);
          if (step.editState === 'changed') return updateRunCase(step);
          return step;
        })
      );
      await t.commit();
      res.json(results.filter((r) => r !== null));
    } catch (error) {
      console.error(error);
      await t.rollback();
      res.status(500).send('Internal Server Error');
    }
  });

  // New endpoint — save per-user test results (upsert RunCaseResult)
  router.post('/myresults', verifySignedIn, verifyProjectReporterFromRunId, async (req, res) => {
    const results = req.body; // [{ runCaseId, status }]
    if (!Array.isArray(results) || results.length === 0) {
      return res.json([]);
    }
    try {
      const saved = await Promise.all(
        results.map(({ runCaseId, status }) =>
          RunCaseResult.upsert({ runCaseId, userId: req.userId, status })
        )
      );
      res.json(saved);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
