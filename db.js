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

        // const database = client.db("picks_db")
        const database = client.db("csgo_picks")
        const collection = database.collection("users")

        // await collection.find().forEach(async function(doc) {
        //     const query = {"_id": doc._id}
        //     console.log(doc._id)

        //     const update_doc = { $set : {} }

        //     for (const [key, val] of Object.entries(conversion)) {
        //         if (doc[key] !== undefined) {
        //             if (val[1]) {
        //                 update_doc.$set[val[0]] = 100-doc[key]
        //             }
        //             else {
        //                 update_doc.$set[val[0]] = doc[key]
        //             }
        //         }
        //     }

        //     const result = await collection.updateOne(query, update_doc)
        //     console.log("updated!")
        // })
        const query = {"_id": "matches_data"}

        let match_table = {"1":{"Astralis":{"BIG":[739894],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[491702],"Natus Vincere":[379342],"Ninjas in Pyjamas":[],"OG":[467899,506627],"Team Liquid":[],"Team Vitality":[]},"BIG":{"Astralis":[739894],"Complexity Gaming":[574217],"Evil Geniuses":[844106],"FaZe Clan":[129165],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[947040,810984],"OG":[],"Team Liquid":[],"Team Vitality":[]},"Complexity Gaming":{"Astralis":[],"BIG":[574217],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[450009],"MIBR":[752361],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[],"Team Vitality":[]},"Evil Geniuses":{"Astralis":[],"BIG":[844106],"Complexity Gaming":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[179141],"Team Vitality":[620532]},"FaZe Clan":{"Astralis":[],"BIG":[129165],"Complexity Gaming":[],"Evil Geniuses":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[175176,947892],"Team Vitality":[304294,392404]},"G2 Esports":{"Astralis":[],"BIG":[],"Complexity Gaming":[450009],"Evil Geniuses":[],"FaZe Clan":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[838365,437475],"OG":[],"Team Liquid":[],"Team Vitality":[271361]},"MIBR":{"Astralis":[491702],"BIG":[],"Complexity Gaming":[752361],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"Natus Vincere":[823460],"Ninjas in Pyjamas":[],"OG":[690531],"Team Liquid":[],"Team Vitality":[847875]},"Natus Vincere":{"Astralis":[379342],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[823460],"Ninjas in Pyjamas":[621689],"OG":[],"Team Liquid":[108519],"Team Vitality":[]},"Ninjas in Pyjamas":{"Astralis":[],"BIG":[947040,810984],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[838365,437475],"MIBR":[],"Natus Vincere":[621689],"OG":[237682],"Team Liquid":[],"Team Vitality":[]},"OG":{"Astralis":[467899,506627],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[690531],"Natus Vincere":[],"Ninjas in Pyjamas":[237682],"Team Liquid":[],"Team Vitality":[]},"Team Liquid":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[179141],"FaZe Clan":[175176,947892],"G2 Esports":[],"MIBR":[],"Natus Vincere":[108519],"Ninjas in Pyjamas":[],"OG":[],"Team Vitality":[]},"Team Vitality":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[620532],"FaZe Clan":[304294,392404],"G2 Esports":[271361],"MIBR":[847875],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[]}}}
        let all_match_list = {"108519":{"team1":"Natus Vincere","team2":"Team Liquid","index":0,"start_time":1643900400,"end_time":1643909847,"team1score":2,"team2score":0,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":71,"number_guesses":3},"129165":{"team1":"FaZe Clan","team2":"BIG","index":0,"start_time":1644082200,"end_time":9999999999,"team1score":0,"team2score":0,"is_completed":false,"is_live":false,"is_bo3":3,"total_guess":100,"number_guesses":3},"175176":{"team1":"FaZe Clan","team2":"Team Liquid","index":0,"start_time":1643554800,"end_time":1643561362,"team1score":19,"team2score":15,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":373,"number_guesses":6},"179141":{"team1":"Evil Geniuses","team2":"Team Liquid","index":0,"start_time":1643566800,"end_time":1643572025,"team1score":17,"team2score":19,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":135,"number_guesses":2},"237682":{"team1":"OG","team2":"Ninjas in Pyjamas","index":0,"start_time":1644075000,"end_time":9999999999,"team1score":0,"team2score":0,"is_completed":false,"is_live":false,"is_bo3":3,"total_guess":149,"number_guesses":3},"271361":{"team1":"G2 Esports","team2":"Team Vitality","index":0,"start_time":1644062400,"end_time":9999999999,"team1score":0,"team2score":0,"is_completed":false,"is_live":false,"is_bo3":3,"total_guess":139,"number_guesses":3},"304294":{"team1":"Team Vitality","team2":"FaZe Clan","index":0,"start_time":1643561100,"end_time":1643566026,"team1score":19,"team2score":15,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":42,"number_guesses":2},"379342":{"team1":"Natus Vincere","team2":"Astralis","index":0,"start_time":1643480100,"end_time":1643485004,"team1score":17,"team2score":19,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":15,"number_guesses":2},"392404":{"team1":"Team Vitality","team2":"FaZe Clan","index":1,"start_time":1643580600,"end_time":1643585314,"team1score":10,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":58,"number_guesses":2},"437475":{"team1":"G2 Esports","team2":"Ninjas in Pyjamas","index":1,"start_time":1643403600,"end_time":1643409407,"team1score":22,"team2score":19,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":27,"number_guesses":3},"450009":{"team1":"G2 Esports","team2":"Complexity Gaming","index":0,"start_time":1643378400,"end_time":1643387833,"team1score":16,"team2score":12,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":298,"number_guesses":6},"467899":{"team1":"Astralis","team2":"OG","index":0,"start_time":1643468400,"end_time":1643477799,"team1score":8,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":346,"number_guesses":6},"491702":{"team1":"MIBR","team2":"Astralis","index":0,"start_time":1643486700,"end_time":1643490404,"team1score":9,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":185,"number_guesses":2},"506627":{"team1":"OG","team2":"Astralis","index":1,"start_time":1643492100,"end_time":1643495804,"team1score":16,"team2score":8,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":95,"number_guesses":2},"574217":{"team1":"Complexity Gaming","team2":"BIG","index":0,"start_time":1643393400,"end_time":1643397406,"team1score":10,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":120,"number_guesses":3},"620532":{"team1":"Team Vitality","team2":"Evil Geniuses","index":0,"start_time":1643551200,"end_time":1643554601,"team1score":16,"team2score":3,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":366,"number_guesses":6},"621689":{"team1":"Ninjas in Pyjamas","team2":"Natus Vincere","index":0,"start_time":1643985300,"end_time":1643997404,"team1score":2,"team2score":1,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":187,"number_guesses":3},"690531":{"team1":"MIBR","team2":"OG","index":0,"start_time":1643475900,"end_time":1643479604,"team1score":9,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":104,"number_guesses":2},"739894":{"team1":"Astralis","team2":"BIG","index":0,"start_time":1643999100,"end_time":1644007006,"team1score":0,"team2score":2,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":115,"number_guesses":3},"752361":{"team1":"Complexity Gaming","team2":"MIBR","index":0,"start_time":1643889600,"end_time":1643898447,"team1score":0,"team2score":2,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":160,"number_guesses":3},"810984":{"team1":"Ninjas in Pyjamas","team2":"BIG","index":1,"start_time":1643398800,"end_time":1643402806,"team1score":16,"team2score":9,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":92,"number_guesses":2},"823460":{"team1":"Natus Vincere","team2":"MIBR","index":0,"start_time":1643464800,"end_time":1643477789,"team1score":12,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":257,"number_guesses":6},"838365":{"team1":"G2 Esports","team2":"Ninjas in Pyjamas","index":0,"start_time":1643389200,"end_time":1643392606,"team1score":16,"team2score":6,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":50,"number_guesses":2},"844106":{"team1":"Evil Geniuses","team2":"BIG","index":0,"start_time":1643910000,"end_time":1643923048,"team1score":1,"team2score":2,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":156,"number_guesses":3},"847875":{"team1":"Team Vitality","team2":"MIBR","index":0,"start_time":1643976000,"end_time":1643984205,"team1score":2,"team2score":0,"is_completed":true,"is_live":false,"is_bo3":3,"total_guess":90,"number_guesses":3},"947040":{"team1":"BIG","team2":"Ninjas in Pyjamas","index":0,"start_time":1643383200,"end_time":1643387833,"team1score":12,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":356,"number_guesses":6},"947892":{"team1":"FaZe Clan","team2":"Team Liquid","index":1,"start_time":1643573700,"end_time":1643579214,"team1score":19,"team2score":17,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":106,"number_guesses":2}}

        const update_doc = { $set : {"all_match_list": all_match_list, "match_table": match_table} }

        const result = await collection.updateOne(query, update_doc);
        console.log("match data updated!");
    } catch (err) {
        console.log(err.stack);
    }
}

run()
