
const config = require('../config');
const { MongoClient } = require('mongodb');
const { Sequelize, DataTypes } = require('sequelize');

const MONGO_URI = config.get('mongo.uri');
const DB_NAME = config.get('mongo.dbName');
const OPTIONS = config.get('mongo.options');

const client = new MongoClient(MONGO_URI, OPTIONS);

async function connectDb() {
    if (!client.topology?.isConnected()) {
        await client.connect();
    }
    return client.db(DB_NAME);
}

// Sequelize database setup for additional features
const sequelizeDb = new Sequelize(process.env.DATABASE_URL || 'sqlite:./database.db', {
    dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    storage: './database.db',
    logging: false,
    ssl: process.env.DATABASE_URL ? true : false,
    dialectOptions: process.env.DATABASE_URL ? {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    } : {}
});

module.exports = { connectDb, sequelizeDb };
