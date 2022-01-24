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

const conversion = {}
conversion["match_15_5"] = ["match_11_9_0", true] // need to reverse
conversion["match_7119077_8131728"] = ["match_46_44_0", false]
conversion["match_2672298_8375259"] = ["match_43_47_0", false]
conversion["match_726228_8118983"] = ["match_10_14_0", false]
conversion["match_6209166_6209804"] = ["match_8_12_0", false]
conversion["match_1883502_7119388"] = ["match_32_33_0", false]
conversion["match_7121518_8254112"] = ["match_92_88_0", true]
conversion["match_46_7422789"] = ["match_39_38_0", false]
conversion["match_8261197_8360138"] = ["match_30_28_0", false]
conversion["match_5055770_8118197"] = ["match_93_89_0", false]
conversion["match_8604954_8607159"] = ["match_65_70_0", false]
conversion["match_7118032_8261774"] = ["match_80_86_0", false]
conversion["match_8255888_8310936"] = ["match_35_34_0", false]
conversion["match_7391077_8254400"] = ["match_42_41_0", false]

async function run() {
    try {
        await client.connect();

        console.log("Connected correctly to server")

        const database = client.db("picks_db")
        const collection = database.collection("users")

        await collection.find().forEach(async function(doc) {
            const query = {"_id": doc._id}
            console.log(doc._id)

            const update_doc = { $set : {} }

            for (const [key, val] of Object.entries(conversion)) {
                if (doc[key] !== undefined) {
                    if (val[1]) {
                        update_doc.$set[val[0]] = 100-doc[key]
                    }
                    else {
                        update_doc.$set[val[0]] = doc[key]
                    }
                }
            }

            const result = await collection.updateOne(query, update_doc)
            console.log("updated!")
        })
    } catch (err) {
        console.log(err.stack);
    }
}

run()
