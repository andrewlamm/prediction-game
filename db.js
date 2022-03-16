const express = require('express')
const app = express()
const axios = require('axios')
const cors = require('cors')
let hbs = require('hbs')
const passport = require('passport')
const session = require('cookie-session')
const SteamStrategy = require('passport-steam').Strategy
const { MongoClient } = require('mongodb')
const zlib = require('zlib')
const https = require("https")
var JSSoup = require('jssoup').default

app.use(cors())

app.set('trust proxy', 1)

require('dotenv').config()

const url = process.env.MONGO_DB_URL
const client = new MongoClient(url)

const LEAGUE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

async function run() {
    try {
        await client.connect();

        console.log("Connected correctly to server")

        const database = client.db("picks_db")
        const collection = database.collection("users")

        await collection.find().forEach(async function(doc) {
            if (doc._id !== "matches_data") {
                const query = {"_id": doc._id}
                console.log(doc._id)

                const update_doc = { $set : {} }

                for (let i = 0; i < LEAGUE_IDS.length; i++) {
                    update_doc["$set"][`score_${LEAGUE_IDS[i]}`] = 0
                    update_doc["$set"][`correct_${LEAGUE_IDS[i]}`] = 0
                    update_doc["$set"][`incorrect_${LEAGUE_IDS[i]}`] = 0
                }

                const result = await collection.updateOne(query, update_doc)
                console.log("updated!")
            }
        })
    } catch (err) {
        console.log(err.stack);
    }
}

run()
