import { Router } from 'express';
import { BucketType } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, AuthRequest, prisma } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

export const eventRouter = Router();

// Get event by unique code (public endpoint, no DJ auth)
eventRouter.get('/code/:code', async (req, res) => {
  const { code } = req.params;
  const event = await prisma.event.findUnique({
    where: { uniqueCode: code.toUpperCase() },
    include: { buckets: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Generate a client JWT token for this event
  const clientToken = jwt.sign(
    { role: 'client', eventId: event.id, code: event.uniqueCode },
    process.env.JWT_SECRET as string,
    { expiresIn: '30d' }
  );

  res.json({ event, clientToken });
});

// Require DJ Admin Auth for subsequent routes
eventRouter.use(requireAuth);

// Create new event and generate unique code
const createSchema = z.object({
  eventName: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string().email(),
});

eventRouter.post('/', async (req: AuthRequest, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error);
  const { eventName, contactName, phone, email } = parse.data;

  // Verify user is a DJ
  if (req.user?.role !== 'dj') {
    return res.status(403).json({ error: 'Only DJs can create events' });
  }

  const event = await prisma.event.create({
    data: {
      eventName,
      contactName,
      phone,
      email,
      userId: req.user.id,
      buckets: {
        create: [
          { bucketType: BucketType.ceremony },
          { bucketType: BucketType.reception },
          { bucketType: BucketType.do_not_play },
        ],
      },
    },
    include: { buckets: true },
  });

  res.status(201).json(event);
});

// List DJ's events (protected)
eventRouter.get('/', async (req: AuthRequest, res) => {
  if (req.user?.role !== 'dj') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const events = await prisma.event.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(events);
});

