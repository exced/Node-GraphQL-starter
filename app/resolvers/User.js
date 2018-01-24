const resolver = {
    User: {
        id: (user) => user._id,
    },
    Query: {
        users: (root, { offset, limit }, { User }) => (
            User.all({ offset, limit })
        ),
        user: (root, { id }, { User }) => User.findOneById(id),
    },
    Mutation: {
        createUser: async (root, { input }, { User }) => {
            const id = await User.insert(input)
            return User.findOneById(id)
        },
        updateUser: async (root, { id, input }, { User }) => {
            await User.updateById(id, input)
            return User.findOneById(id)
        },
        removeUser: (root, { id }, { User }) => User.removeById(id),
    },
    Subscription: {
        userCreated: user => user,
        userUpdated: user => user,
        userRemoved: id => id,
    },
}

export default resolver