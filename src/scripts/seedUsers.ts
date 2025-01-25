import mongoose from "mongoose";
import User from "../models/User";
import dotenv from "dotenv";

dotenv.config();

const connectToDatabase = async () => {
    await mongoose.connect(process.env.MONGODB_URI || "");
};

const seedUsers = async () => {
    await connectToDatabase();
    const users = [
        {
            username: "god",
        },
        {
            username: "nate",
        },
    ];
    await User.insertMany(users);
    console.log("Profiles seeded successfully");
    mongoose.connection.close();
};

seedUsers().catch((err) => console.error(err));