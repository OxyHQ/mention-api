import mongoose from "mongoose";
import Post from "../models/Post";

import dotenv from "dotenv";

dotenv.config();

const seedPosts = async () => {
  await mongoose.connect(process.env.MONGODB_URI || "");

  const posts = [
    {
      uri: "at://did:plc:uyh5huzxtthtkg6htsgt56lh/app.bsky.feed.post/3ldphoft2ns2u",
      cid: "bafyreiec2o5dknytczkyihzucaz5dztlfd67ijj4hnkwtbyzgwprt4jdxu",
      author: {
        did: "did:plc:uyh5huzxtthtkg6htsgt56lh",
        handle: "godpod.bsky.social",
        displayName: "God",
        avatar:
          "https://cdn.bsky.app/img/avatar/plain/did:plc:uyh5huzxtthtkg6htsgt56lh/bafkreif2pzoz4mklwmjf2nnifbu5xtnpp7ri4mdun7bvmz5iehowolomry@jpeg",
        associated: {
          chat: {
            allowIncoming: "all",
          },
        },
        labels: [],
        created_at: new Date("2023-04-29T20:25:48.941Z"),
      },
      record: {
        $type: "app.bsky.feed.post",
        created_at: new Date("2024-12-20T03:40:33.596Z"),
        embed: {},
        langs: ["en"],
        text: "Billionaires have more money than they could ever need but never enough to fill the holes in their souls. They would send every last one of you into an early grave if it meant paying one cent less in taxes.",
      },
      embed: {},
      replyCount: 316,
      repostCount: 2328,
      likeCount: 10935,
      quoteCount: 130,
      indexedAt: new Date("2024-12-20T03:40:33.857Z"),
      labels: [],
    },
    {
      uri: "at://did:plc:i5mdaf5woj7m2sfprnlibkcw/app.bsky.feed.post/3ldoth47oac2b",
      cid: "bafyreicsz7lajpgkxphwdnkve5ptvqjvx7wuq5s7ehjnkidj7sem5kls34",
      author: {
        did: "did:plc:i5mdaf5woj7m2sfprnlibkcw",
        handle: "jim-stewartson.bsky.social",
        displayName: "Jim Stewartson, Antifascist",
        avatar:
          "https://cdn.bsky.app/img/avatar/plain/did:plc:i5mdaf5woj7m2sfprnlibkcw/bafkreidcv5oxudccylrp4cccskfw3iv2zxltauxqizoqxvlbi4etkk7q2u@jpeg",
        associated: {
          chat: {
            allowIncoming: "all",
          },
        },
        labels: [],
        created_at: new Date("2024-11-07T20:30:13.887Z"),
      },
      record: {
        $type: "app.bsky.feed.post",
        created_at: new Date("2024-12-19T21:38:33.806Z"),
        embed: {},
        langs: ["en"],
        text: "Trying to imagine pitching this movie 50 years ago:\n“So this guy from apartheid goes to America and cons his way to collecting half a trillion dollars and buys a President with it. Then he starts to order Congress around from his computer which is actually a portable telephone.”",
      },
      embed: {},
      replyCount: 187,
      repostCount: 1217,
      likeCount: 7272,
      quoteCount: 45,
      indexedAt: new Date("2024-12-19T21:38:34.048Z"),
      labels: [],
    },
    // ...add more posts as needed...
  ];

  await Post.insertMany(posts);
  console.log("Posts seeded successfully");
  mongoose.connection.close();
};

seedPosts().catch((err) => console.error(err));
