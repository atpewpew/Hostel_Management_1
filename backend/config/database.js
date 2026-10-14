import dns from 'node:dns';
import mongoose from 'mongoose';
import { logger } from '../middleware/logger.js';
import { seedDemoDataIfEmpty } from '../script/seedDemoData.js';

// Resolve MongoDB Atlas SRV records smoothly on Windows
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
    // Ignore if not permitted in environment
}

let mongodInstance = null;

const maskMongoUri = (uri) => {
    return uri.replace(/:([^:@]+)@/, ':****@');
};

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hostelia';
    const isAtlas = mongoUri.includes('mongodb+srv://') || !mongoUri.includes('localhost');
    const masked = maskMongoUri(mongoUri);

    try {
        const timeoutMs = isAtlas ? 10000 : 2500;
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: timeoutMs });
        logger.info(`Connected to MongoDB successfully at ${masked}`);
        await seedDemoDataIfEmpty();
    } catch (error) {
        logger.warn(`Could not connect to configured MongoDB (${masked}): ${error.message}`);

        if (isAtlas) {
            logger.error(
                'Note: MongoDB Atlas connection failed. Check your network, credentials, or Atlas IP Whitelist.'
            );
        }

        logger.info('Spinning up embedded MongoDB instance for zero-setup local execution...');
        try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            mongodInstance = await MongoMemoryServer.create({
                instance: {
                    dbName: 'hostelia',
                },
            });
            const embeddedUri = mongodInstance.getUri();
            logger.info(`Embedded MongoDB ready at ${embeddedUri}`);
            await mongoose.connect(embeddedUri);
            logger.info('Connected to embedded MongoDB successfully');
            await seedDemoDataIfEmpty();
        } catch (embeddedErr) {
            logger.error('Failed to start embedded MongoDB:', embeddedErr);
            process.exit(1);
        }
    }
};

process.on('SIGINT', async () => {
    if (mongodInstance) {
        await mongodInstance.stop();
    }
    process.exit(0);
});

export default connectDB;