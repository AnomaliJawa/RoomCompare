import express from 'express';
import { MAX_SURVEY_BYTES, SURVEY_ID_PATTERN } from '../config.js';
import { ApiError } from '../errors.js';
import { readJson } from '../middleware.js';
import { stamp } from '../services/sessions.js';
import { requireUser } from './accounts.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Stored as sent: the app validates, knowing a draft from a published survey; the server scopes them to the account. */
export function surveyRoutes({ ctx }) {
  const router = express.Router();

  router.get('/surveys', async (req, res) => {
    const user = await requireUser(req, ctx);
    res.status(200).json({ surveys: await ctx().backend.listSurveys(user.id) });
  });

  router.all('/surveys/:id', async (req, res) => {
    const surveyId = req.params.id;
    if (!SURVEY_ID_PATTERN.test(surveyId)) throw new ApiError(404, 'There is no survey at that address.');

    if (req.method === 'PUT') {
      const user = await requireUser(req, ctx);
      const { survey } = await readJson(req);
      if (!isRecord(survey) || survey.id !== surveyId) {
        throw new ApiError(400, 'The survey sent does not match its address.');
      }
      const data = JSON.stringify(survey);
      if (Buffer.byteLength(data, 'utf8') > MAX_SURVEY_BYTES) {
        throw new ApiError(413, 'That survey is too large to save.');
      }
      const now = stamp(new Date());
      const created = typeof survey.createdAt === 'string' ? survey.createdAt : now;
      await ctx().backend.putSurvey(user.id, surveyId, data, created, now);
      res.status(204).end();
      return;
    }

    if (req.method === 'DELETE') {
      const user = await requireUser(req, ctx);
      // Deleting what is gone succeeds, so a retried delete does not look like a failure.
      await ctx().backend.deleteSurvey(user.id, surveyId);
      res.status(204).end();
      return;
    }

    throw new ApiError(404, 'That is not something this server does.');
  });

  return router;
}
