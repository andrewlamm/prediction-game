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

        const query = {"_id": "matches_data"}
        const result = await collection.findOne(query)

        // console.log(result)

        // Object.defineProperty(result["match_table"]['10'], "RSG", Object.getOwnPropertyDescriptor(result["match_table"]['10'], "ChubbyBoiz"))
        // delete result["match_table"]['10']["ChubbyBoiz"]

        // for (const [key, val] of Object.entries(result["match_table"]['10'])) {
        //     // console.log(key)
        //     if (key === "RSG") continue
        //     Object.defineProperty(result["match_table"][10][key], "RSG", Object.getOwnPropertyDescriptor(result["match_table"][10][key], "ChubbyBoiz"))
        //     delete result["match_table"][10][key]["ChubbyBoiz"]
        // }

        // console.log(result["match_table"]['10'])

        // const update_doc = { $set : {} }

        // update_doc["$set"]["match_table"] = result["match_table"]
        // const update_result = await collection.updateOne(query, update_doc)
        // console.log("updated!")

        result["all_match_list"]["334927"]["team2"] = "RSG"
        result["all_match_list"]["21796"]["team2"] = "RSG"
        result["all_match_list"]["170407"]["team2"] = "RSG"

        const update_doc = { $set : {} }

        update_doc["$set"]["all_match_list"] = result["all_match_list"]
        const update_result = await collection.updateOne(query, update_doc)
        console.log("updated!")


        // await collection.find().forEach(async function(doc) {
        //     if (doc._id !== "matches_data") {
        //         const query = {"_id": doc._id}
        //         console.log(doc._id)

        //         const update_doc = { $set : {} }

        //         for (let i = 0; i < LEAGUE_IDS.length; i++) {
        //             update_doc["$set"][`score_${LEAGUE_IDS[i]}`] = 0
        //             update_doc["$set"][`correct_${LEAGUE_IDS[i]}`] = 0
        //             update_doc["$set"][`incorrect_${LEAGUE_IDS[i]}`] = 0
        //         }

        //         const result = await collection.updateOne(query, update_doc)
        //         console.log("updated!")
        //     }
        // })
    } catch (err) {
        console.log(err.stack);
    }
}

run()
