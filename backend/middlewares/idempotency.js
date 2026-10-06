const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');

const idempotency = async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key || !req.user) {
    return next();
  }

  const trimmedKey = String(key).trim();
  const userId = req.user._id || req.user.id;
  
  // Deterministic request fingerprint (SHA-256 of body)
  const sortedBody = req.body ? JSON.stringify(req.body, Object.keys(req.body).sort()) : '';
  const requestHash = crypto.createHash('sha256').update(sortedBody).digest('hex');

  try {
    const existing = await IdempotencyKey.findOne({ 
      key: trimmedKey, 
      userId 
    });

    if (existing) {
      // 1. Conflict detection: Key reused for a different endpoint or altered body
      if (existing.endpoint !== req.originalUrl || existing.requestHash !== requestHash) {
        return res.status(409).json({
          status: 'error',
          error: {
            code: 'IDEMPOTENCY_KEY_REUSE_CONFLICT',
            message: 'Idempotency-Key has already been used for a different request payload or endpoint.'
          }
        });
      }

      // 2. In-flight protection: Request is currently being processed
      if (existing.status === 'IN_FLIGHT') {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < 30000) { // 30 second in-flight lease
          return res.status(429).json({
            status: 'error',
            error: {
              code: 'OPERATION_IN_FLIGHT',
              message: 'An identical request with this Idempotency-Key is currently in progress. Please retry shortly.'
            }
          });
        }
      }

      // 3. Replay cached response for completed idempotent operation
      if (existing.status === 'COMPLETED') {
        res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
        return res.status(existing.responseStatus).json(existing.responseBody);
      }
    }

    // Atomically claim in-flight state
    let record;
    try {
      record = await IdempotencyKey.findOneAndUpdate(
        { key: trimmedKey, userId },
        {
          $setOnInsert: {
            key: trimmedKey,
            userId,
            endpoint: req.originalUrl,
            requestHash,
            status: 'IN_FLIGHT',
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    } catch (upsertErr) {
      if (upsertErr.code === 11000) {
        // Race condition: another concurrent process inserted this key first
        return res.status(429).json({
          status: 'error',
          error: {
            code: 'OPERATION_IN_FLIGHT',
            message: 'Concurrent request detected for this Idempotency-Key.'
          }
        });
      }
      throw upsertErr;
    }

    // Intercept res.json to finalize cache state
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        IdempotencyKey.updateOne(
          { _id: record._id },
          {
            status: 'COMPLETED',
            responseStatus: res.statusCode,
            responseBody: body
          }
        ).catch(err => console.error('[IDEMPOTENCY] Cache commit error:', err.message));
      } else {
        // Remove or mark failed to allow retrying after client error or system fault
        IdempotencyKey.deleteOne({ _id: record._id })
          .catch(err => console.error('[IDEMPOTENCY] Cache cleanup error:', err.message));
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = idempotency;
