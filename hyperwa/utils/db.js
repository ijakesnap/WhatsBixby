
const config = require('../config');
const { MongoClient } = require('mongodb');
const { Sequelize } = require('sequelize');

const MONGO_URI = config.get('mongo.uri');
const DB_NAME = config.get('mongo.dbName');
const OPTIONS = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

const client = new MongoClient(MONGO_URI, OPTIONS);

async function connectDb() {
    if (!client.topology?.isConnected()) {
        await client.connect();
    }
    return client.db(DB_NAME);
}

// Sequelize database setup matching WhatsBixby structure
const DATABASE = process.env.DATABASE_URL ? new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    ssl: true,
    protocol: 'postgres',
    dialectOptions: {
        native: true,
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
}) : new Sequelize({
    dialect: 'sqlite',
    storage: './database.db',
    logging: false
});

module.exports = { connectDb, DATABASE };
