import User from './User'


const models = {
    User,
}
export default models

export const configureModels = (context) => (
    Object.keys(models).reduce((a, e) => ({
        ...a, [e]: new models[e](a)
    }), context)
)