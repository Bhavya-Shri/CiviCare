import jwt from 'jsonwebtoken'
import { query } from './db.js'
import { HttpError } from './http.js'

function secret() {
  return process.env.JWT_SECRET || 'dev-only-change-me'
}

export function signToken(user) {
  return jwt.sign({ sub: user.user_id, role: user.role }, secret(), { expiresIn: '12h' })
}

export async function requireUser(req, _res, next) {
  try {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw new HttpError(401, 'Sign in is required.', 'unauthorized')
    const payload = jwt.verify(token, secret())
    const rows = await query(
      `SELECT user_id, email, role, account_status FROM users WHERE user_id = $1`,
      [payload.sub],
    )
    const user = rows[0]
    if (!user || user.account_status !== 'active') {
      throw new HttpError(401, 'This account cannot be used.', 'unauthorized')
    }
    if (user.role !== payload.role) {
      throw new HttpError(401, 'Sign in again.', 'unauthorized')
    }
    req.user = user
    next()
  } catch (error) {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    next(new HttpError(401, 'Sign in again.', 'unauthorized'))
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'You do not have access to that action.', 'forbidden'))
      return
    }
    next()
  }
}
