// Dataloader 
export const batch = (collection, ids) => (
    collection.find({ _id: { $in: ids } })
        .toArray()
        .then(data => {
            let map = data.reduce((a, e) => ({ ...a, [e._id]: e }), {})
            return ids.map(id => map[id])
        })
)
