import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import express from "express";
import prisma from "../db/code/prisma.js";
import { signupSchema, loginSchema } from "../schemas/auth-schemas.js";

export async function signUp(req, res, next) {
  try {
    const signUpValidation = signupSchema.safeParse(req.body);
    if (!signUpValidation.success) {
      return res.status(400).json({
        success: false,
        errors: signUpValidation.error.flatten().fieldErrors,
      });
    }

    // 1. EXTRACT NAME HERE
    const { name, email, password } = signUpValidation.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
        },
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 2. SAVE NAME TO DATABASE HERE
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: passwordHash,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User account created successfully",
    });
  } catch (error) {
    next(error);
  }
}
export async function logIn(req, res, next) {
  try {
    const loginValidation = loginSchema.safeParse(req.body);
    if (!loginValidation.success) {
      return res.status(400).json({
        success: false,
        errors: loginValidation.error.flatten().fieldErrors,
      });
    }
    const { email, password } = loginValidation.data;
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: { currency: true },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const token = jwt.sign(
      {
        userId: user.id.toString(),
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,

      user: {
        name: user.name,
        email: user.email,
        currency: user.currency ? { code: user.currency.code } : null,
      },

      //   userId: user.id.toString(),
      //   user: {
      //     email: user.email,
      //   },
    });
  } catch (error) {
    next(error);
  }
}
