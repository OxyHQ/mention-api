import mongoose from "mongoose";
import Profile from "../models/Profile";

import dotenv from "dotenv";

dotenv.config();

const seedProfiles = async () => {
  await mongoose.connect(process.env.MONGODB_URI || "");

  const profiles = [
    {
      did: "did:plc:uyh5huzxtthtkg6htsgt56lh",
      userID: "678b29d19085a13337ca9fd4",
      name: {
        first: "Nate",
        last: "Isern",
      },
      avatar:
        "https://cdn.bsky.app/img/avatar/plain/did:plc:uyh5huzxtthtkg6htsgt56lh/bafkreif2pzoz4mklwmjf2nnifbu5xtnpp7ri4mdun7bvmz5iehowolomry@jpeg",
      associated: {
        lists: 0,
        feedgens: 0,
        starterPacks: 0,
        labeler: false,
      },
      labels: [],
      created_at: new Date("2023-04-29T20:25:48.941Z"),
      description:
        "Creator of the Universe. \n\nDaily free newsletter & animated podcast here: https://www.thegodpodcast.com",
      indexedAt: new Date("2024-12-11T08:13:14.150Z"),
      banner:
        "https://cdn.bsky.app/img/banner/plain/did:plc:uyh5huzxtthtkg6htsgt56lh/bafkreicrbhmacdjf6cifjeev7my6opleobti2x3w4tydfmiw3v6dt5b23i@jpeg",
      followersCount: 395394,
      followsCount: 465,
      postsCount: 1088,
      pinnedPost: {
        cid: "bafyreigpqwqt5lfgehhr65qd4zaq4b4p5x3l2v5wkcilpz23vrcb42w3tu",
        uri: "at://did:plc:uyh5huzxtthtkg6htsgt56lh/app.bsky.feed.post/3lcxoe6dzmk2e",
      },
      _count: {
        followers: 395394,
        following: 465,
        posts: 1088,
      },
    },
    {
      did: "did:plc:i5mdaf5woj7m2sfprnlibkcw",
      userID: "7456746467464674",
      name: {
        first: "God",
        last: "",
      },
      avatar:
        "https://cdn.bsky.app/img/avatar/plain/did:plc:i5mdaf5woj7m2sfprnlibkcw/bafkreidcv5oxudccylrp4cccskfw3iv2zxltauxqizoqxvlbi4etkk7q2u@jpeg",
      associated: {
        lists: 0,
        feedgens: 0,
        starterPacks: 0,
        labeler: false,
      },
      labels: [],
      created_at: new Date("2024-11-07T20:30:13.887Z"),
      description: "Investigative journalist and antifascist activist",
      indexedAt: new Date("2024-12-19T21:38:34.048Z"),
      banner:
        "https://cdn.bsky.app/img/banner/plain/did:plc:i5mdaf5woj7m2sfprnlibkcw/default@jpeg",
      followersCount: 52000,
      followsCount: 1200,
      postsCount: 3405,
      pinnedPost: {
        cid: "bafyreicsz7lajpgkxphwdnkve5ptvqjvx7wuq5s7ehjnkidj7sem5kls34",
        uri: "at://did:plc:i5mdaf5woj7m2sfprnlibkcw/app.bsky.feed.post/3ldoth47oac2b",
      },
      _count: {
        followers: 0,
        following: 0,
        posts: 3405,
      },
    }];

  await Profile.insertMany(profiles);
  console.log("Profiles seeded successfully");
  mongoose.connection.close();
};

seedProfiles().catch((err) => console.error(err));
