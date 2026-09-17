// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * POST /api/auth/login
 * Handles user authentication, password verification, and JWT generation.
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      }
    );

    // Return response without password hash
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/admin-test
 * Protected test endpoint for ADMIN role verification.
 */
const adminTest = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Welcome ADMIN! You have elevated access.",
      user: {
        id: req.user.userId || req.user.id,
        username: req.user.username,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  adminTest,
};
