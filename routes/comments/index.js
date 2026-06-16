import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineComment from '../../models/comments.js';
import defineUser from '../../models/users.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import defineProject from '../../models/projects.js';
import defineMember from '../../models/members.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { roles, memberRoles } from '../users/authSettings.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromCommentableId } = visibilityMiddleware(sequelize);
  const Comment = defineComment(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const Project = defineProject(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  Comment.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Comment, { foreignKey: 'userId', onDelete: 'CASCADE' });

  async function isProjectManager(commentableId, userId) {
    const user = await User.findByPk(userId);
    if (user) {
      const adminIdx = roles.findIndex((r) => r.uid === 'administrator');
      const qaIdx = roles.findIndex((r) => r.uid === 'qa-manager');
      if (user.role === adminIdx || user.role === qaIdx) return true;
    }
    const rc = await RunCase.findByPk(commentableId);
    if (!rc) return false;
    const run = await Run.findByPk(rc.runId);
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

  router.get('/', verifySignedIn, verifyProjectVisibleFromCommentableId, async (req, res) => {
    const { commentableType, commentableId, viewUserId } = req.query;

    if (!commentableType || !commentableId) {
      return res.status(400).json({ error: 'commentableType and commentableId are required' });
    }

    try {
      const whereClause = { commentableType, commentableId };

      // RunCase comments are per-user; managers may request a specific tester's comments
      if (commentableType === 'RunCase') {
        const manager = await isProjectManager(commentableId, req.userId);
        if (manager && viewUserId) {
          whereClause.userId = parseInt(viewUserId, 10);
        } else {
          whereClause.userId = req.userId;
        }
      }

      const comments = await Comment.findAll({
        where: whereClause,
        include: [{ model: User, attributes: ['id', 'username', 'email'] }],
        order: [['createdAt', 'ASC']],
      });
      res.json(comments);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
