import passport from 'passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import jwt from 'jwt-simple'
import { ObjectId } from 'mongodb'
import nodeify from 'nodeify'
import bcrypt from 'bcrypt'
import appConfig from './app'

const configure = (passport, models) => {

    const userFromPayload = async (jwtPayload) => {
        if (!jwtPayload.userId) {
            throw new Error('No userId in JWT')
        }
        return await models.User.findOneById(ObjectId(jwtPayload.userId))
    }

    passport.use(new Strategy({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: appConfig.jwt,
        passReqToCallback: true,
    }, (request, jwtPayload, done) => nodeify(userFromPayload(jwtPayload), done)
    ))
}

export default configure