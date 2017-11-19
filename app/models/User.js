import DataLoader from 'dataloader'
import { batch } from './helpers'
import { pubsub } from '../subscription'
import bcrypt from 'bcrypt'
import { ROLE_USER, ROLE_ADMIN, ROLE_SUPERADMIN } from './UserRoles'

const SALT_ROUNDS = 10

export default class User {

    constructor(context) {
        this.context = context
        this.collection = this.context.db.collection('User')
        this.loader = new DataLoader(ids => batch(this.collection, ids))
    }

    findOneById = (id) => this.loader.load(id)

    all = ({ lastCreatedAt = 0, offset = 0, limit = 10 }) => (
        this.collection
            .find({ createdAt: { $gt: lastCreatedAt } })
            .sort({ createdAt: 1 })
            .skip(offset)
            .limit(limit)
            .toArray()
    )

    insert = async (doc) => {
        // We don't want to store passwords plaintext!
        const { password, ...rest } = doc
        const hash = await bcrypt.hash(password, SALT_ROUNDS)
        const docToInsert = {
            ...rest,
            hash,
            roles: [ROLE_USER],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
        const id = (await this.collection.insertOne(docToInsert)).insertedId
        pubsub.publish('userInserted', await this.findOneById(id))
        return id
    }

    updateById = (id, doc) => {
        const ret = this.collection.update({ _id: id }, {
            $set: {
                ...doc,
                updatedAt: Date.now(),
            },
        })
        this.loader.clear(id)
        pubsub.publish('userUpdated', this.findOneById(id))
        return ret
    }

    removeById = (id) => {
        const ret = this.collection.remove({ _id: id })
        this.loader.clear(id)
        pubsub.publish('userRemoved', id)
        return ret
    }

}
