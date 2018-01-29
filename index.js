import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express'
import { formatError } from 'apollo-errors'
import { execute, subscribe } from 'graphql'
import { createServer } from 'http'
import { SubscriptionServer } from 'subscriptions-transport-ws'
import bodyParser from 'body-parser'
import passport from 'passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import { ObjectId } from 'mongodb'
import nodeify from 'nodeify'
import bcrypt from 'bcrypt'
import jwt from 'jwt-simple'

import config, { db, configurePassport, dev } from './config'
import schema from './app/schema'
import { configureModels } from './app/models'
import { subscriptionManager } from './app/subscription'

const start = async () => {

  // DB Connection
  const mongo = await MongoClient.connect(`mongodb://${db.host}:${db.port}/${db.name}`)

  // Add models to context
  const models = configureModels({ db: mongo })

  // Server configuration
  const server = express()

  server.use(cors())
  server.use(bodyParser.urlencoded({ extended: true }))
  server.use(bodyParser.json())
  server.use(passport.initialize())

  // Authentication config
  const userFromPayload = async (jwtPayload) => {
    if (!jwtPayload.userId) {
      throw new Error('No userId in JWT')
    }
    return await models.User.findOneById(ObjectId(jwtPayload.userId))
  }
  passport.use(new Strategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwt,
    passReqToCallback: true,
  }, (request, jwtPayload, done) => nodeify(userFromPayload(jwtPayload), done)
  ))

  // Routing
  // Authentication
  server.post('/signin', async (req, res, next) => {
    try {
      const { username, password } = req.body
      if (!username || !password) {
        throw new Error('username or password field is missing')
      }
      const user = await models.User.collection.findOne({ username })
      if (!user || !(await bcrypt.compare(password, user.hash))) {
        throw new Error('user not found matching username/password combination')
      }
      res.json({ token: jwt.encode({ userId: user._id, username: user.username, roles: user.roles }, config.jwt) })
    } catch (e) {
      next(e)
    }
  })

  server.post('/signup', async (req, res, next) => {
    try {
      const { username, password } = req.body
      if (!username || !password) {
        throw new Error('username or password field is missing')
      }
      const exists = await models.User.collection.findOne({ username })
      if (exists) {
        throw new Error('username already in use')
      }
      const user = await models.User.insert({ username, password })
      res.json({ token: jwt.encode({ userId: user._id, username: user.username, roles: user.roles }, config.jwt) })
    } catch (e) {
      next(e)
    }
  })

  // GraphQL 
  server.use('/graphql', (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user) => {
      graphqlExpress(() => {
        const query = req.query.query || req.body.query
        if (query && query.length > 2000) {
          throw new Error('Query too large.')
        }
        return {
          schema,
          context: { ...models, user }, // add current user to context
          debug: dev,
          formatError,
        }
      })(req, res, next)
    })(req, res, next)
  })

  // GraphiQL
  if (dev) {
    server.use('/graphiql', graphiqlExpress({
      endpointURL: '/graphql',
      subscriptionsEndpoint: `ws://${config.host}:${config.port}/subscriptions`
    }))
  }

  server.listen(config.port, () =>
    console.log(`✨ ✨ GraphQL Server is now running on http://${config.host}:${config.port} ✨ ✨`)
  )

  // WebSocket server for subscriptions
  const wsServer = createServer((req, res) => {
    res.writeHead(404)
    res.end()
  })

  wsServer.listen(config.ws, () =>
    console.log(`✨ ✨ GraphQL WS Server is now running on ws://${config.host}:${config.ws}/subscriptions ✨ ✨`)
  )

  new SubscriptionServer({
    execute,
    subscribe,
    schema
  }, {
      server: wsServer,
      path: '/subscriptions',
    }
  )
}

// Finally starts server
start()
  .then(() => {
    console.log('✨ ✨ Everything\'s going on ✨ ✨')
  })
  .catch((e) => {
    console.error('Uncaught error in startup')
    console.error(e)
    console.trace(e)
  })
