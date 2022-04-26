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

        // result["all_match_list"]["928205"]["is_live"] = false
        // result["all_match_list"]["928205"]["start_time"] = 1647795600

        // result["all_match_list"]["36186"]["start_time"] = 1647806100
        // result["all_match_list"]["928205"]["start_time"] = 1648054800

        // 604800 seconds in week

        // result["all_match_list"]["813169"]["start_time"] = 1649178000
        // result["all_match_list"]["376789"]["start_time"] = 1649217600
        // result["all_match_list"]["376789"]["is_live"] = false
        // result["all_match_list"]["160542"]["end_time"] = 1648073549
        // result["all_match_list"]["916037"]["start_time"] = 1649390400
        // result["all_match_list"]["587906"]["start_time"] = 1649401200
        // result["all_match_list"]["723611"]["start_time"] = 1650448800
        // result["all_match_list"]["200321"]["start_time"] = 1650427200
        // result["all_match_list"]["916037"]["start_time"] = 1650610800

        // result["all_match_list"]["555260"]["is_live"] = true
        // result["all_match_list"]["615640"]["is_live"] = true
        // result["all_match_list"]["926794"]["is_live"] = true
        // result["all_match_list"]["17737"]["is_live"] = true
        // result["all_match_list"]["49597"]["is_live"] = true
        // result["all_match_list"]["684214"]["is_live"] = true

        // result["all_match_list"]["555260"]["end_time"] = result["all_match_list"]["555260"]["start_time"] + 40
        // result["all_match_list"]["615640"]["end_time"] = result["all_match_list"]["615640"]["start_time"] + 40
        // result["all_match_list"]["926794"]["end_time"] = result["all_match_list"]["926794"]["start_time"] + 40
        // result["all_match_list"]["17737"]["end_time"] = result["all_match_list"]["17737"]["start_time"] + 40
        // result["all_match_list"]["49597"]["end_time"] = result["all_match_list"]["49597"]["start_time"] + 40
        // result["all_match_list"]["684214"]["end_time"] = result["all_match_list"]["684214"]["start_time"] + 40

        result["all_match_list"]["684214"]["team1score"] = 2
        result["all_match_list"]["684214"]["team2score"] = 1
        result["all_match_list"]["684214"]["is_completed"] = true
        result["all_match_list"]["684214"]["end_time"] = result["all_match_list"]["684214"]["start_time"] + 40

        result["all_match_list"]["519299"]["team1score"] = "FF"
        result["all_match_list"]["519299"]["team2score"] = "W"
        result["all_match_list"]["519299"]["is_completed"] = true
        result["all_match_list"]["519299"]["end_time"] = result["all_match_list"]["519299"]["start_time"] + 1

        // result["all_match_list"]["889290"]["team1score"] = "FF"
        // result["all_match_list"]["889290"]["team2score"] = "W"
        // result["all_match_list"]["889290"]["is_completed"] = true
        // result["all_match_list"]["889290"]["end_time"] = result["all_match_list"]["889290"]["start_time"] + 1

        const update_doc = { $set : {} }

        update_doc["$set"]["all_match_list"] = result["all_match_list"]
        const update_result = await collection.updateOne(query, update_doc)
        console.log("updated!")

        // UPDATING SPECIFIC TEAMS

        // console.log(result)

        // Object.defineProperty(result["match_table"]['5'], "BB Team", Object.getOwnPropertyDescriptor(result["match_table"]['5'], "Winstrike Team"))
        // delete result["match_table"]['5']["Winstrike Team"]

        // for (const [key, val] of Object.entries(result["match_table"]['5'])) {
        //     // console.log(key)
        //     if (key === "BB Team") continue
        //     Object.defineProperty(result["match_table"][5][key], "BB Team", Object.getOwnPropertyDescriptor(result["match_table"][5][key], "Winstrike Team"))
        //     delete result["match_table"][5][key]["Winstrike Team"]
        // }

        // console.log(result["match_table"]['5'])

        // const update_doc = { $set : {} }

        // update_doc["$set"]["match_table"] = result["match_table"]
        // const update_result = await collection.updateOne(query, update_doc)
        // console.log("updated!")

        // result["all_match_list"]["334927"]["team2"] = "RSG"
        // result["all_match_list"]["21796"]["team2"] = "RSG"
        // result["all_match_list"]["170407"]["team2"] = "RSG"

        // const update_doc = { $set : {} }

        // update_doc["$set"]["all_match_list"] = result["all_match_list"]
        // const update_result = await collection.updateOne(query, update_doc)
        // console.log("updated!")

        /// UPDATE CERTAIN USER

        // const query = {"_id": "76561198300027169"}

        // const update_doc = { $set : {} }

        // for (let i = 0; i < LEAGUE_IDS.length; i++) {
        //     update_doc["$set"][`correct_${LEAGUE_IDS[i]}`] = 0
        //     update_doc["$set"][`incorrect_${LEAGUE_IDS[i]}`] = 0
        // }

        // const result = await collection.updateOne(query, update_doc)
        // console.log("updated!")

        /// UPDATE ALL USERS


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
