import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineProject from '../../models/projects.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import defineTag from '../../models/tags.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseResult from '../../models/runCaseResults.js';
import defineUser from '../../models/users.js';
import defineMember from '../../models/members.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { roles, memberRoles } from '../users/authSettings.js';

export default function (sequelize) {
  const Project = defineProject(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseResult = defineRunCaseResult(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);

  Project.hasMany(Folder, { foreignKey: 'projectId' });
  Folder.hasMany(Case, { foreignKey: 'folderId' });
  Folder.belongsTo(Project, { foreignKey: 'projectId' });
  Case.belongsTo(Folder, { foreignKey: 'folderId' });
  Case.hasMany(RunCase, { foreignKey: 'caseId' });
  Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });
  RunCase.belongsTo(Case, { foreignKey: 'caseId' });
  RunCase.hasMany(RunCaseResult, { foreignKey: 'runCaseId' });
  RunCaseResult.belongsTo(RunCase, { foreignKey: 'runCaseId' });
  RunCaseResult.belongsTo(User, { foreignKey: 'userId' });

  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibilityMiddleware(sequelize);

  async function isManager(projectId, userId) {
    const user = await User.findByPk(userId);
    if (user) {
      const adminIdx = roles.findIndex((r) => r.uid === 'administrator');
      const qaIdx = roles.findIndex((r) => r.uid === 'qa-manager');
      if (user.role === adminIdx || user.role === qaIdx) return true;
    }
    const project = await Project.findByPk(projectId);
    if (!project) return false;
    if (project.userId === userId) return true;
    const member = await Member.findOne({ where: { userId, projectId } });
    if (member) {
      const managerIdx = memberRoles.findIndex((r) => r.uid === 'manager');
      if (member.role === managerIdx) return true;
    }
    return false;
  }

  router.get(
    '/byproject',
    verifySignedIn,
    verifyProjectVisibleFromProjectId,
    verifyProjectVisibleFromRunId,
    async (req, res) => {
      const { projectId, runId, status, tag, search, viewUserId } = req.query;

      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      if (!runId) return res.status(400).json({ error: 'runId is required' });

      try {
        const manager = await isManager(projectId, req.userId);

        const caseWhereClause = {};
        if (search) {
          const searchTerm = search.trim();
          if (searchTerm.length > 100) return res.status(400).json({ error: 'too long search param' });
          if (searchTerm.length >= 1) {
            caseWhereClause[Op.or] = [
              { title: { [Op.like]: `%${searchTerm}%` } },
              { description: { [Op.like]: `%${searchTerm}%` } },
            ];
          }
        }

        let statusFilter = undefined;
        let runCaseRequired = false;
        if (status) {
          const statusValues = status.split(',').map((t) => parseInt(t.trim(), 10)).filter((t) => !isNaN(t));
          if (statusValues.length > 0) {
            statusFilter = { status: { [Op.in]: statusValues } };
            runCaseRequired = true;
          }
        }

        const tagInclude = { model: Tags, attributes: ['id', 'name'], through: { attributes: [] } };
        if (tag) {
          const tagIds = tag.split(',').map((t) => parseInt(t.trim(), 10)).filter((t) => !isNaN(t));
          if (tagIds.length > 0) { tagInclude.where = { id: { [Op.in]: tagIds } }; tagInclude.required = true; }
        }

        // RunCaseResult include: managers see all, others see only their own
        const runCaseResultInclude = {
          model: RunCaseResult,
          attributes: ['id', 'runCaseId', 'userId', 'status', 'createdAt', 'updatedAt'],
          required: false,
          include: [{ model: User, attributes: ['id', 'username'] }],
        };
        if (!manager) {
          runCaseResultInclude.where = { userId: req.userId };
        }

        const cases = await Case.findAll({
          where: caseWhereClause,
          include: [
            { model: Folder, where: { projectId }, attributes: [] },
            {
              model: RunCase,
              attributes: [
                'id', 'runId', 'status',
                [
                  sequelize.literal(
                    '(SELECT COUNT(*) FROM `comments` WHERE `comments`.`commentableType` = ' +
                      sequelize.escape('RunCase') +
                      ' AND `comments`.`commentableId` = `RunCases`.`id`' +
                      ' AND `comments`.`userId` = ' +
                      sequelize.escape(manager && viewUserId ? parseInt(viewUserId, 10) : req.userId) + ')'
                  ),
                  'commentCount',
                ],
              ],
              required: runCaseRequired,
              where: { [Op.and]: [{ runId }, statusFilter] },
              include: [runCaseResultInclude],
            },
            tagInclude,
          ],
        });
        res.json(cases);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    }
  );

  return router;
}
