import mongoose from "mongoose";
import Profile from "../models/Profile";

const seedProfiles = async () => {
  await mongoose.connect(
    "mongodb+srv://oxy:eIhvjPXoARTuGGZA@cluster0oxy.lh5pg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0Oxy"
  );

  const profiles = [
    {
      did: "did:plc:uyh5huzxtthtkg6htsgt56lh",
      handle: "godpod.bsky.social",
      displayName: "God",
      avatar:
        "https://cdn.bsky.app/img/avatar/plain/did:plc:uyh5huzxtthtkg6htsgt56lh/bafkreif2pzoz4mklwmjf2nnifbu5xtnpp7ri4mdun7bvmz5iehowolomry@jpeg",
      associated: {
        lists: 0,
        feedgens: 0,
        starterPacks: 0,
        labeler: false,
      },
      labels: [],
      createdAt: new Date("2023-04-29T20:25:48.941Z"),
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
    },
    {
      did: "did:plc:i5mdaf5woj7m2sfprnlibkcw",
      handle: "jim-stewartson.bsky.social",
      displayName: "Jim Stewartson, Antifascist",
      avatar:
        "https://cdn.bsky.app/img/avatar/plain/did:plc:i5mdaf5woj7m2sfprnlibkcw/bafkreidcv5oxudccylrp4cccskfw3iv2zxltauxqizoqxvlbi4etkk7q2u@jpeg",
      associated: {
        lists: 0,
        feedgens: 0,
        starterPacks: 0,
        labeler: false,
      },
      labels: [],
      createdAt: new Date("2024-11-07T20:30:13.887Z"),
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
    },
  ];

  await Profile.insertMany(profiles);
  console.log("Profiles seeded successfully");
  mongoose.connection.close();
};

seedProfiles().catch((err) => console.error(err));
