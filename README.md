# Mention API

## Overview

The Mention API allows you to create and fetch posts. Below are the available endpoints and their usage.

## Endpoints

### Create a New Post

**URL:** `/posts`

**Method:** `POST`

**Request Body:**
```json
{
  "authorId": "string",
  "content": "string"
}
```

**Response:**
- `201 Created` on success
- `500 Internal Server Error` on failure

**Example:**
```bash
curl -X POST http://localhost:3000/posts -H "Content-Type: application/json" -d '{
  "authorId": "author123",
  "content": "This is a new post"
}'
```

### Get All Posts

**URL:** `/posts`

**Method:** `GET`

**Response:**
- `200 OK` on success
- `500 Internal Server Error` on failure

**Example:**
```bash
curl http://localhost:3000/posts
```

**Response Body:**
```json
{
  "feed": [
    {
      "post": {
        "uri": "string",
        "cid": "string",
        "author": {
          "did": "string",
          "handle": "string",
          "displayName": "string",
          "avatar": "string",
          "associated": {
            "chat": {
              "allowIncoming": "string"
            }
          },
          "labels": ["string"],
          "createdAt": "date"
        },
        "record": {
          "$type": "string",
          "createdAt": "date",
          "embed": "any",
          "langs": ["string"],
          "text": "string"
        },
        "embed": "any",
        "replyCount": 0,
        "repostCount": 0,
        "likeCount": 0,
        "quoteCount": 0,
        "indexedAt": "date",
        "labels": ["string"]
      },
      "feedContext": "string"
    }
  ],
  "cursor": "string"
}
```

## Running the API

To run the API, use the following commands:

```bash
npm install
npm start
```

The API will be available at `http://localhost:3000`.
# mention-api
