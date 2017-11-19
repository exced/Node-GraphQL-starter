import { makeExecutableSchema } from 'graphql-tools'
import { merge } from 'lodash'
import path from 'path'
import { fileLoader, mergeTypes } from 'merge-graphql-schemas'
import { ObjectId } from 'mongodb'
import { GraphQLScalarType } from 'graphql'
import { Kind } from 'graphql/language'

// ObjectID
const ObjectIDType = `scalar ObjectID`
const ObjectID = new GraphQLScalarType({
    name: 'ObjectID',
    description: 'Id representation, based on Mongo Object Ids',
    parseValue: (value) => ObjectId(value),
    serialize: (value) => value.toString(),
    parseLiteral: (ast) => (ast.kind === Kind.STRING) ? ObjectId(ast.value) : null,
})

// Merge TypeDefs
const typesArray = fileLoader(path.join(__dirname, './types'))
const typeDefs = mergeTypes([ObjectIDType, ...typesArray])

// Merge Resolvers
const resolversArray = fileLoader(path.join(__dirname, './resolvers'))
const resolvers = merge({ ObjectID }, ...resolversArray)

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
})

export default schema