import { Router } from 'express';
import {
  getPublicPaymentInfoHandler,
  getPublicPaymentQRHandler,
  notifyPublicPaymentHandler
} from '../controllers/publicPaymentController';

export const createPublicPaymentRouter = (dbInstance?: any) => {
  const router = Router();

  // Public endpoints (no JWT required)
  router.get('/info', getPublicPaymentInfoHandler(dbInstance));
  router.get('/qr', getPublicPaymentQRHandler(dbInstance));
  router.post('/notify', notifyPublicPaymentHandler(dbInstance));

  return router;
};

export const createPublicPaymentInfoRouter = (dbInstance?: any) => {
  const router = Router();
  router.get('/', getPublicPaymentInfoHandler(dbInstance));
  return router;
};

export default createPublicPaymentRouter();
