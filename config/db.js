import { prod } from '../config'

const devConfig = {
  host: process.env.MONGO_HOST || 'localhost',
  name: process.env.MONGO_NAME || 'NodeGraphQLStarter',
  port: process.env.MONGO_PORT || 27017,
}

const prodConfig = {
  host: process.env.MONGO_HOST || 'localhost',
  name: process.env.MONGO_NAME || 'NodeGraphQLStarter',
  port: process.env.MONGO_PORT || 27017,
}

const config = prod ? prodConfig : devConfig
export default config
