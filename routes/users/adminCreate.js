import express from 'express';
import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import defineUser from '../../models/users.js';
import authMiddleware from '../../middleware/auth.js';
import { roles } from './authSettings.js';
const router = express.Router();

export default function (sequelize) {
  const { verifySignedIn, verifyAdmin } = authMiddleware(sequelize);
  const User = defineUser(sequelize, DataTypes);

  router.post('/admin-create', verifySignedIn, verifyAdmin, async (req, res) => {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password) {
      return res.status(400).send('Email, username and password are required');
    }

    try {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(409).send('Email already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRoleIndex = roles.findIndex((entry) => entry.uid === 'user');
      const roleIndex = role !== undefined ? role : userRoleIndex;

      const user = await User.create({
        email,
        username,
        password: hashedPassword,
        role: roleIndex,
      });

      user.password = undefined;
      res.status(201).json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).send('Failed to create account');
    }
  });

  return router;
}
