import { Router } from 'express';
import {
  getMembersHandler,
  getMemberByIdHandler,
  createMemberHandler,
  updateMemberHandler,
  deleteMemberHandler
} from '../controllers/memberController';
import { authenticateJwt, requireRole } from '../middlewares/authMiddleware';

export const createMemberRouter = (dbInstance?: any) => {
  const router = Router();

  // All member management endpoints require authentication and ADMIN role
  router.use(authenticateJwt);
  router.use(requireRole(['ADMIN']));

  router.get('/', getMembersHandler(dbInstance));
  router.get('/:id', getMemberByIdHandler(dbInstance));
  router.post('/', createMemberHandler(dbInstance));
  router.put('/:id', updateMemberHandler(dbInstance));
  router.delete('/:id', deleteMemberHandler(dbInstance));

  return router;
};

export default createMemberRouter();
