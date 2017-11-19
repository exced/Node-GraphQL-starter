import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express'
import { execute, subscribe } from 'graphql'
import { createServer } from 'http'
import { SubscriptionServer } from 'subscriptions-transport-ws'
import bodyParser from 'body-parser'
import passport from 'passport'
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

    server.use('*', cors({ origin: `http://${config.host}:${config.port}` }))
    server.use(bodyParser.urlencoded({ extended: true }))
    server.use(bodyParser.json())
    server.use(passport.initialize())
    configurePassport(passport, models)

    // Routing
    // Authentication
    server.post('/login', async (req, res, next) => {
        try {
            const { email, password } = req.body
            if (!email || !password) {
                throw new Error('email or password field is missing')
            }
            const user = await models.User.collection.findOne({ email })
            if (!user || !(await bcrypt.compare(password, user.hash))) {
                throw new Error('user not found matching email/password combination')
            }
            res.json({ token: jwt.encode({ userId: user._id.toString() }, config.jwt) })
        } catch (e) {
            next(e)
        }
    })

    // GraphQL 
    server.use('/graphql', (req, res, next) => {
        passport.authenticate('jwt', { session: false }, (err, user) => {
            graphqlExpress(() => {
                // Get the query, the same way express-graphql does it
                // https://github.com/graphql/express-graphql/blob/3fa6e68582d6d933d37fa9e841da5d2aa39261cd/src/index.js#L257
                const query = req.query.query || req.body.query
                if (query && query.length > 2000) {
                    // None of our app's queries are this long
                    // Probably indicates someone trying to send an overly expensive query
                    throw new Error('Query too large.')
                }
                return {
                    schema,
                    context: { ...models, user }, // add current user to context
                    debug: dev,
                    formatError: (e) => console.log(e),
                }
            })(req, res, next)
        })(req, res, next)
    })

    // GraphiQL
    server.use('/graphiql', graphiqlExpress({
        endpointURL: '/graphql',
        subscriptionsEndpoint: `ws://${config.host}:${config.port}/subscriptions`
    }))

    server.listen(config.port, () =>
        console.log(`✨ ✨ GraphQL Server is now running on http://${config.host}:${config.port} ✨ ✨`)
    )

    // WebSocket server for subscriptions
    const wsServer = createServer((req, res) => {
        res.writeHead(404)
        res.end()
    })

    wsServer.listen(config.ws, () =>
        console.log(`✨ ✨ GraphQL WS Server is now running on http://${config.host}:${config.ws} ✨ ✨`)
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