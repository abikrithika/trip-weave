import express from "express";
import prisma from "../db/code/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Protect all routes in this file
router.use(authMiddleware);

// GET route to fetch chat history
router.get('/:id/messages', async (req, res) => {
  try {
    const conversationId = BigInt(req.params.id);

    const messages = await prisma.message.findMany({
      where: { conversationId: conversationId },
      orderBy: { timestamp: 'asc' }, 
    });

    const serializedMessages = messages.map(msg => ({
      ...msg,
      id: msg.id.toString(),
      conversationId: msg.conversationId.toString()
    }));

    res.json(serializedMessages);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Failed to retrieve chat history" });
  }
});

// NEW: Get or create the current user's active conversation
router.get('/current', async (req, res) => {
  try {
    // Safely check for either id or userId in the decoded token
    const rawUserId = req.user.id || req.user.userId;
    
    if (!rawUserId) {
      return res.status(400).json({ error: "User ID missing from token payload." });
    }

    const userId = BigInt(rawUserId); 

    // Look for the user's latest conversation (ignoring strict enum status)
    let conversation = await prisma.conversation.findFirst({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId: userId }
      });
    }

    res.json({ id: conversation.id.toString() });
  } catch (error) {
    console.error("Error fetching/creating conversation:", error);
    res.status(500).json({ error: "Failed to manage conversation" });
  }
});

// POST route to save a new message
router.post('/:id/messages', async (req, res) => {
  try {
    const conversationId = BigInt(req.params.id);
    const { senderRole, textContent } = req.body; 

    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversationId,
        senderRole: senderRole,     
        textContent: textContent
      }
    });

    const serializedMessage = {
      ...newMessage,
      id: newMessage.id.toString(),
      conversationId: newMessage.conversationId.toString()
    };

    res.status(201).json(serializedMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

export default router;