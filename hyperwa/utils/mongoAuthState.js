const { connectDb } = require('./db');
const logger = require('../Core/logger');

async function useMongoAuthState() {
    const db = await connectDb();
    const collection = db.collection('auth');

    const state = {
        creds: null,
        keys: {}
    };

    // Load existing auth state
    try {
        const authDoc = await collection.findOne({ _id: 'session' });
        if (authDoc) {
            state.creds = authDoc.creds;
            state.keys = authDoc.keys || {};
        }
    } catch (error) {
        logger.warn('Failed to load auth state from MongoDB:', error);
    }

    const saveCreds = async () => {
        try {
            await collection.replaceOne(
                { _id: 'session' },
                {
                    _id: 'session',
                    creds: state.creds,
                    keys: state.keys,
                    updatedAt: new Date()
                },
                { upsert: true }
            );
        } catch (error) {
            logger.error('Failed to save auth state to MongoDB:', error);
        }
    };

    return {
        state: {
            creds: state.creds,
            keys: {
                get: (type, ids) => {
                    const key = `${type}:${ids.join(',')}`;
                    return state.keys[key];
                },
                set: (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const key = `${category}:${id}`;
                            state.keys[key] = data[category][id];
                        }
                    }
                }
            }
        },
        saveCreds
    };
}

module.exports = { useMongoAuthState };