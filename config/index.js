import app from './app'
import db from './db'
import passport from './passport'

const prod = (process.env.NODE_ENV === 'production')
const dev = !prod

export { db, passport as configurePassport, prod, dev }
export default app