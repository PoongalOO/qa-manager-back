import express from 'express';
const router = express.Router();
import { DataTypes, literal } from 'sequelize';
import defineRun from '../../models/runs.js';
import defineProject from '../../models/projects.js';
import defineMember from '../../models/members.js';
import authMiddleware from '../../middleware/auth.js';
import { Op } from 'sequelize';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const Run = defineRun(sequelize, DataTypes);
  const Project = defineProject(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);

  Project.hasMany(Member, { foreignKey: 'projectId' });
  Run.belongsTo(Project, { foreignKey: 'projectId' });

  router.get('/my', verifySignedIn, async (req, res) => {
    try {
      const userId = req.userId;

      // find projectIds the user owns or is a member of
      const accessibleProjects = await Project.findAll({
        include: [
          {
            model: Member,
            attributes: [],
            where: { userId },
            required: false,
          },
        ],
        where: {
          [Op.or]: [
            { userId },
            sequelize.where(sequelize.col('Members.userId'), userId),
          ],
        },
        attributes: ['id'],
      });

      const projectIds = accessibleProjects.map((p) => p.id);

      if (projectIds.length === 0) {
        return res.json([]);
      }

      const runs = await Run.findAll({
        where: { projectId: projectIds },
        include: [
          {
            model: Project,
            attributes: ['name'],
          },
        ],
        attributes: {
          include: [
            [literal('(SELECT COUNT(*) FROM RunCases WHERE RunCases.runId = `Run`.id)'), 'caseCount'],
          ],
        },
        order: [['projectId', 'ASC'], ['id', 'ASC']],
      });

      res.json(runs);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
