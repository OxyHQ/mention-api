import mongoose from 'mongoose';
import User from '../models/User';
import Profile from '../models/Profile';
import { logger } from '../utils/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mention';

async function migrateProfilesToUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB');

    // Get all profiles
    const profiles = await Profile.find({});
    logger.info(`Found ${profiles.length} profiles to migrate`);

    // Keep track of processed users to avoid duplicates
    const processedUsers = new Set();

    // Migrate each profile
    for (const profile of profiles) {
      try {
        // Skip if we've already processed this user
        if (processedUsers.has(profile.userID.toString())) {
          logger.warn(`Skipping duplicate profile for userID: ${profile.userID}`);
          continue;
        }

        // Find the corresponding user
        const user = await User.findById(profile.userID);
        
        if (!user) {
          logger.warn(`No user found for profile with userID: ${profile.userID}`);
          continue;
        }

        // Update user with profile data
        await User.findByIdAndUpdate(user._id, {
          name: profile.name,
          privacySettings: profile.privacySettings,
          avatar: profile.avatar,
          associated: profile.associated,
          labels: profile.labels,
          description: profile.description,
          coverPhoto: profile.coverPhoto,
          location: profile.location,
          website: profile.website,
          pinnedPost: profile.pinnedPost,
          _count: profile._count,
        }, { new: true });

        // Mark this user as processed
        processedUsers.add(profile.userID.toString());
        logger.info(`Successfully migrated profile for user: ${user._id}`);

        // Delete the old profile
        await Profile.findByIdAndDelete(profile._id);
        logger.info(`Deleted old profile for user: ${user._id}`);
      } catch (error) {
        logger.error(`Error migrating profile for userID ${profile.userID}:`, error);
      }
    }

    // Drop the profiles collection after successful migration
    if (mongoose.connection.db) {
      try {
        await mongoose.connection.db.dropCollection('profiles');
        logger.info('Successfully dropped profiles collection');
      } catch (error) {
        logger.warn('Could not drop profiles collection:', error);
      }
    }

    logger.info('Migration completed');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run migration if this script is run directly
if (require.main === module) {
  migrateProfilesToUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
} 