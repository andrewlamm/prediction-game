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
const port = 4000

app.use(cors())

app.set('trust proxy', 1)

require('dotenv').config()

let bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({
  extended: true
}));

const valid_team_id = new Set()

const url = process.env.MONGO_CSGO
const client = new MongoClient(url)

let database = undefined
let collection = undefined

async function connect_to_db() {
    return new Promise(async function(resolve, reject) {
        try {
            await client.connect();
            console.log("Connected correctly to server")

            database = client.db("csgo_picks")
            collection = database.collection("users")

            resolve(1)
        } catch (err) {
            console.log(err.stack);
            reject(1)
        }
    })
}

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(new SteamStrategy({
        returnURL: `${process.env.WEBSITE_LINK}auth/steam/return`,
        realm: process.env.WEBSITE_LINK,
        apiKey: process.env.STEAM_KEY
    },
    function(identifier, profile, done) {
        process.nextTick(function () {
            profile.identifier = identifier;
            return done(null, profile);
        });
    }
));

app.use(session({
    secret: process.env.SESSION_SECRET,
    name: 'pog',
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize())
app.use(passport.session())

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next()
    res.redirect('/');
}

app.set('view engine', 'hbs')
app.use(express.static(`${__dirname}/views`));

hbs.registerPartials(`${__dirname}/views/partials`)

hbs.registerHelper('if_equals', function(arg1, arg2) {
    if (arg1 === arg2) return true
    return false
})

hbs.registerHelper('check_win', function(score, bo3, score2) {
    if (score === "W") return true
    if (score > score2) {
        return true
    }
    return false
})

hbs.registerHelper('check_exists', function(s) {
    if (s === undefined || s === null) return false
    return true
})

hbs.registerHelper('display_average', function(score) {
    if (score > 50) return score
    return 100-score
})

function calc_score(score) {
    return 25 - (Math.pow(score - 100, 2) / 100)
}

hbs.registerHelper('display_score', function(score, team1score, team2score, bo3) {
    if ((score === 50 && (team1score !== 0 || team2score !== 0)) || team1score === "W" || team2score === "W") {
        return `<span class="font-semibold">0.0</span>`
    }
    if (team1score > team2score) {
        if (score < 50) {
            return `<span class="text-green-700 font-semibold">+${calc_score(100-score).toFixed(1)}</span>`
        }
        else {
            return `<span class="text-red-700 font-semibold">${calc_score(100-score).toFixed(1)}</span>`
        }
    }
    else if (team2score > team1score) {
        if (score < 50) {
            return `<span class="text-red-700 font-semibold">${calc_score(score).toFixed(1)}</span>`
        }
        else {
            return `<span class="text-green-700 font-semibold">+${calc_score(score).toFixed(1)}</span>`
        }
    }
})

hbs.registerHelper('check_not50', function(score) {
    if (score === 50) return false
    return true
})

hbs.registerHelper('check_team1', function(score) {
    if (score > 50) return false
    return true
})

hbs.registerHelper('determine_win', function(score, team1score, team2score, is_bo3) {
    if (team1score === "W" || team2score === "W") return false

    if (score > 50 && team2score > team1score) return true
    else if (score < 50 && team1score > team2score) return true

    return false
})

hbs.registerHelper('find_left', function(score) {
    return score-50
})

hbs.registerHelper('round_tenth', function(s) {
    return s.toFixed(1)
})

hbs.registerHelper('positive_plus', function(n) {
    if (n >= 0) {
        return '+'
    }
})

hbs.registerHelper('find_color', function(n) {
    if (n > 0) {
        return 'text-green-700'
    }
    else if (n < 0) {
        return 'text-red-700'
    }
})

hbs.registerHelper('if_incorrect', function(n) {
    if (n > 0) return 'text-red-700'
})

hbs.registerHelper('replace_spaces', function(s) {
    return s.replace(/ /g, "_")
})

hbs.registerHelper('replace_periods', function(s) {
    return s.replace(/\./g, "_")
})

hbs.registerHelper('replace_dashes', function(s) {
    return s.replace(/-/g, "_")
})

hbs.registerHelper('replace_invalid_char', function(s) {
    s = s.replace(/-/g, "_")
    s = s.replace(/\./g, "_")
    s = s.replace(/ /g, "_")
    return s
})

hbs.registerHelper('turn_to_ordinal', function(num) {
    let ones = num % 10
    let tens = num % 100
    if (ones == 1 && tens != 11) {
      return num + "st";
    }
    if (ones == 2 && tens != 12) {
      return num + "nd";
    }
    if (ones == 3 && tens != 13) {
      return num + "rd";
    }
    return num + "th";
})

hbs.registerHelper('turn_id_to_text', function(n) {
    const s = n + ""
    let new_s = ""
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "0") new_s += "zero"
        if (s[i] === "1") new_s += "one"
        if (s[i] === "2") new_s += "two"
        if (s[i] === "3") new_s += "three"
        if (s[i] === "4") new_s += "four"
        if (s[i] === "5") new_s += "five"
        if (s[i] === "6") new_s += "six"
        if (s[i] === "7") new_s += "seven"
        if (s[i] === "8") new_s += "eight"
        if (s[i] === "9") new_s += "nine"
    }
    return new_s
})

hbs.registerHelper('convert_time', function(time) {
    time *= 1000
    const s = new Date(time).toLocaleTimeString("en-US", {timeZone: "America/New_York"})
    return s.substring(0, s.indexOf(":", 3)) + s.substring(s.indexOf(" "))
})

hbs.registerHelper('convert_date', function(time) {
    time *= 1000
    const s = new Date(time).toLocaleDateString("en-US", {timeZone: "America/New_York"})

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const mon = MONTHS[parseInt(s.substring(0, s.indexOf("/")))-1]
    const date = turn_to_ordinal(parseInt(s.substring(s.indexOf("/")+1, s.indexOf("/", 3))))
    const year = s.substring(s.indexOf("/", 3)+1)

    return `${mon} ${date}, ${year}`
})

hbs.registerHelper('check_diff_negative', function(start) {
    const now = new Date().getTime()

    const diff = (start*1000) - now

    if (diff < 0) {
        return true
    }
    return false
})

hbs.registerHelper('set_timer', function(start) {
    const now = new Date().getTime()

    const diff = (start*1000) - now
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / (3600000));
    const minutes = Math.floor((diff % 3600000) / (60000));
    const seconds = Math.floor((diff % 60000) / 1000);

    if (diff < 0) {
        return "LIVE"
    }
    else if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`
    }
    else {
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
        else if (minutes > 0) return `${minutes}m ${seconds}s`
        return `${seconds}s`
    }
})

function turn_to_ordinal(num) {
    let ones = num % 10
    let tens = num % 100
    if (ones == 1 && tens != 11) {
      return num + "st";
    }
    if (ones == 2 && tens != 12) {
      return num + "nd";
    }
    if (ones == 3 && tens != 13) {
      return num + "rd";
    }
    return num + "th";
}

let parsed_data = {}

function retrieve_data() {
    return new Promise(async function(resolve, reject) {
        const options = {
            hostname: 'liquipedia.net',
            port: 443,
            path: `/counterstrike/api.php?action=parse&format=json&page=BLAST/Premier/2022/Spring/Groups`,
            method: 'GET',
            headers: {
                'User-Agent': 'DPCScenarios',
                'Accept-Encoding': 'gzip',
                'Access-Control-Allow-Origin': '*'
            }
        }

        const request = https.get(options, response => {
            var chunks = []
            response.on('data', function(chunk) {
                chunks.push(chunk);
            });

            response.on('end', async function() {
                var buffer = Buffer.concat(chunks);

                zlib.gunzip(buffer, function(err, decoded) {
                    // console.log(decoded.toString())
                    parsed_data = JSON.parse(decoded.toString()).parse.text
                    resolve(1)
                });
            })
        })
    })
}

const LEAGUE_IDS = [1]
// WEU, CN, NA, SEA, EEU, SA
const leagueid_to_name = {1: "BLAST Premier Spring Groups"}
const team_to_logo = {}
let match_table = {}
let all_match_list = {}
const dota_match_id_to_match = {}
const team_to_league_id = {}
const team_to_id = {}
const id_to_team = {}
let curr_id = 0

async function find_teams() {
    return new Promise(async function(resolve, reject) {
        for (let divisions_j = 0; divisions_j < 1; divisions_j++) {

            // await new Promise(resolve => setTimeout(resolve, 30000))

            await retrieve_data()

            const soup = new JSSoup(parsed_data["*"])
            const team_list = soup.findAll("div", {"class": "teamcard"})

            match_table[LEAGUE_IDS[divisions_j]] = {}

            for (let i = 0; i < team_list.length; i++) {
                let team1 = `${team_list[i].contents[0].contents[0].contents[0].attrs.title}`
                if (team1.indexOf("(") !== -1) {
                    team1 = team1.substring(0, team1.indexOf("(")-1)
                }
                // console.log(team1)

                match_table[LEAGUE_IDS[divisions_j]][team1] = {}

                team_to_id[team1] = curr_id
                id_to_team[curr_id] = team1

                curr_id += 1

                for (let j = 0; j < team_list.length; j++) {
                    if (i === j) continue
                    let team2 = `${team_list[j].contents[0].contents[0].contents[0].attrs.title}`
                    if (team2.indexOf("(") !== -1) {
                        team2 = team2.substring(0, team2.indexOf("(")-1)
                    }
                    match_table[LEAGUE_IDS[divisions_j]][team1][team2] = []
                }
                team_to_league_id[team1] = LEAGUE_IDS[divisions_j]
                // team_to_logo[team1] = `https://liquipedia.net${logo_list[i].contents[0].contents[0].contents[0].attrs.src}`
            }

            //hard coded matches

            match_table = {"1":{"Astralis":{"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[491702],"Natus Vincere":[379342],"Ninjas in Pyjamas":[],"OG":[467899,506627],"Team Liquid":[],"Team Vitality":[]},"BIG":{"Astralis":[],"Complexity Gaming":[574217],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[947040,810984],"OG":[],"Team Liquid":[],"Team Vitality":[]},"Complexity Gaming":{"Astralis":[],"BIG":[574217],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[450009],"MIBR":[752361],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[],"Team Vitality":[]},"Evil Geniuses":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[],"Team Vitality":[620532]},"FaZe Clan":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[175176],"Team Vitality":[]},"G2 Esports":{"Astralis":[],"BIG":[],"Complexity Gaming":[450009],"Evil Geniuses":[],"FaZe Clan":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[838365,437475],"OG":[],"Team Liquid":[],"Team Vitality":[]},"MIBR":{"Astralis":[491702],"BIG":[],"Complexity Gaming":[752361],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"Natus Vincere":[823460],"Ninjas in Pyjamas":[],"OG":[690531],"Team Liquid":[],"Team Vitality":[]},"Natus Vincere":{"Astralis":[379342],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[823460],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[],"Team Vitality":[]},"Ninjas in Pyjamas":{"Astralis":[],"BIG":[947040,810984],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[838365,437475],"MIBR":[],"Natus Vincere":[],"OG":[],"Team Liquid":[],"Team Vitality":[]},"OG":{"Astralis":[467899,506627],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[],"G2 Esports":[],"MIBR":[690531],"Natus Vincere":[],"Ninjas in Pyjamas":[],"Team Liquid":[],"Team Vitality":[]},"Team Liquid":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[],"FaZe Clan":[175176],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Vitality":[]},"Team Vitality":{"Astralis":[],"BIG":[],"Complexity Gaming":[],"Evil Geniuses":[620532],"FaZe Clan":[],"G2 Esports":[],"MIBR":[],"Natus Vincere":[],"Ninjas in Pyjamas":[],"OG":[],"Team Liquid":[]}}}
            all_match_list = {"175176":{"team1":"FaZe Clan","team2":"Team Liquid","index":0,"start_time":1643554800,"end_time":9999999999,"team1score":0,"team2score":0,"is_completed":false,"is_live":false,"is_bo3":1,"total_guess":1119,"number_guesses":18},"379342":{"team1":"Natus Vincere","team2":"Astralis","index":0,"start_time":1643480100,"end_time":1643485004,"team1score":17,"team2score":19,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":30,"number_guesses":4},"437475":{"team1":"G2 Esports","team2":"Ninjas in Pyjamas","index":1,"start_time":1643403600,"end_time":1643409407,"team1score":22,"team2score":19,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":81,"number_guesses":9},"450009":{"team1":"G2 Esports","team2":"Complexity Gaming","index":0,"start_time":1643378400,"end_time":1643387833,"team1score":16,"team2score":12,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":1192,"number_guesses":24},"467899":{"team1":"Astralis","team2":"OG","index":0,"start_time":1643468400,"end_time":1643477799,"team1score":8,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":1038,"number_guesses":18},"491702":{"team1":"MIBR","team2":"Astralis","index":0,"start_time":1643486700,"end_time":1643490404,"team1score":9,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":370,"number_guesses":4},"506627":{"team1":"OG","team2":"Astralis","index":1,"start_time":1643492100,"end_time":1643495804,"team1score":16,"team2score":8,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":190,"number_guesses":4},"574217":{"team1":"Complexity Gaming","team2":"BIG","index":0,"start_time":1643393400,"end_time":1643397406,"team1score":10,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":360,"number_guesses":9},"620532":{"team1":"Team Vitality","team2":"Evil Geniuses","index":0,"start_time":1643551200,"end_time":1643554601,"team1score":16,"team2score":3,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":1098,"number_guesses":18},"690531":{"team1":"MIBR","team2":"OG","index":0,"start_time":1643475900,"end_time":1643479604,"team1score":9,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":312,"number_guesses":6},"752361":{"team1":"Complexity Gaming","team2":"MIBR","index":0,"start_time":1643889600,"end_time":9999999999,"team1score":0,"team2score":0,"is_completed":false,"is_live":false,"is_bo3":3,"total_guess":120,"number_guesses":4},"810984":{"team1":"Ninjas in Pyjamas","team2":"BIG","index":1,"start_time":1643398800,"end_time":1643402806,"team1score":16,"team2score":9,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":276,"number_guesses":6},"823460":{"team1":"Natus Vincere","team2":"MIBR","index":0,"start_time":1643464800,"end_time":1643477789,"team1score":12,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":771,"number_guesses":18},"838365":{"team1":"G2 Esports","team2":"Ninjas in Pyjamas","index":0,"start_time":1643389200,"end_time":1643392606,"team1score":16,"team2score":6,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":150,"number_guesses":6},"947040":{"team1":"BIG","team2":"Ninjas in Pyjamas","index":0,"start_time":1643383200,"end_time":1643387833,"team1score":12,"team2score":16,"is_completed":true,"is_live":false,"is_bo3":1,"total_guess":1424,"number_guesses":24}}
        }
        resolve(1)
    })
}

async function loop_leagues() {
    return new Promise(async function(resolve, reject) {
        for (let i = 0; i < LEAGUE_IDS.length; i++) {
            console.log(LEAGUE_IDS[i])
            await get_team_logos(LEAGUE_IDS[i])
        }
        resolve(1)
    })
}

async function get_team_logos(id) {
    team_to_logo["Astralis"] = "/imgs/astralis.png"
    team_to_logo["BIG"] = "/imgs/big.png"
    team_to_logo["Complexity Gaming"] = "/imgs/col.png"
    team_to_logo["Evil Geniuses"] = "/imgs/eg.png"
    team_to_logo["FaZe Clan"] = "/imgs/faze.png"
    team_to_logo["G2 Esports"] = "/imgs/g2.png"
    team_to_logo["MIBR"] = "/imgs/mibr.png"
    team_to_logo["Natus Vincere"] = "/imgs/navi.png"
    team_to_logo["Ninjas in Pyjamas"] = "/imgs/nip.png"
    team_to_logo["OG"] = "/imgs/og.png"
    team_to_logo["Team Liquid"] = "/imgs/liquid.png"
    team_to_logo["Team Vitality"] = "/imgs/vitality.png"
}

async function get_averages() {
    await collection.find().forEach(async function(doc) {
        for (const [key, val] of Object.entries(doc)) {
            if (key !== "_id" && key !== "display_name" && key !== "steam_url" && key !== "score" && key !== "correct" && key !== "profile_picture" && key !== "incorrect") {
                let underscore_count = 0
                for (let i = 0; i < key.length; i++) {
                    if (key[i] === "_") underscore_count += 1
                }
                if (underscore_count !== 3) continue
                const team1 = id_to_team[parseInt(key.substring(6, key.indexOf("_", 6)))]
                const team2 = id_to_team[parseInt(key.substring(key.indexOf("_", 6)+1, key.indexOf("_", key.indexOf("_", 6)+1)))]
                const index = parseInt(key.substring(key.indexOf("_", key.indexOf("_", 6)+1)+1))

                const match_id = match_table[team_to_league_id[team1]][team1][team2][index]

                all_match_list[match_id].number_guesses += 1
                all_match_list[match_id].total_guess += val
            }
        }
    })
}

async function start() {
    await connect_to_db()
    await find_teams()
    await loop_leagues()
    console.log("complete, waiting 30 seconds")
    await new Promise(resolve => setTimeout(resolve, 30000))
    // console.log(team_to_id)
    await start_find_live_matches()
    // for (let i = 0; i < LEAGUE_IDS.length; i++)
    //     console.log(match_table[LEAGUE_IDS[i]])
    await get_averages()
    const repeated_timer = setInterval(repeated_functions, 60000) // 120000
}

start()

let live_matches_data = {}
const curr_live_matches = new Set()

async function find_live_matches() {
    live_matches_data = {}
    curr_live_matches.clear()
    await get_matches_data()
    await get_live_matches()
    await completed_matches_data()
}

async function get_matches_data() {
    return new Promise(function(resolve, reject) {
        const options = {
            hostname: 'liquipedia.net',
            port: 443,
            path: '/counterstrike/api.php?action=parse&format=json&page=Liquipedia:Matches',
            method: 'GET',
            headers: {
              'User-Agent': 'DPCScenarios',
              'Accept-Encoding': 'gzip',
              'Access-Control-Allow-Origin': '*'
            }
        }

        const request = https.get(options, response => {
            var chunks = []
            response.on('data', function(chunk) {
                chunks.push(chunk);
            });

            response.on('end', async function() {
                var buffer = Buffer.concat(chunks);

                zlib.gunzip(buffer, function(err, decoded) {
                    live_matches_data = JSON.parse(decoded.toString()).parse.text
                    resolve(1)
                });
            })
        })
    })
}

async function get_live_matches() {
    return new Promise(function(resolve, reject) {
        // console.log("live")
        const soup = new JSSoup(live_matches_data["*"])
        const match_list = soup.findAll("div", {"class": "matches-list"})[0]

        for (let i = 0; i < match_list.contents[1].contents[1].contents.length; i += 2) {
            // console.log(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]._text)
            if (match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0] !== undefined && match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]._text.indexOf("BLAST Premier") !== -1) { // remember to add check for (page does not exist)
                let team1 = match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0].contents[0].contents[0].contents[0].contents[0].attrs.title
                if (team1.indexOf("(") !== -1) {
                    team1 = team1.substring(0, team1.indexOf("(")-1)
                }
                if (team1 === "To Be Determined" || team1 === "TBD") {
                    // console.log("TBD spotted")
                    continue
                }

                if (match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0].contents[2].contents[0].contents[2] === undefined) {
                    // console.log("tbd ...")
                    continue
                }
                let team2 = match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0].contents[2].contents[0].contents[2].contents[0].attrs.title
                if (team2.indexOf("(") !== -1) {
                    team2 = team2.substring(0, team2.indexOf("(")-1)
                }

                if (team1 === "King of Kings") team1 = "APU King of Kings"
                if (team2 === "King of Kings") team2 = "APU King of Kings"

                if (team2 === "TBD" || team2 === "To Be Determined") {
                    console.log("TBD spotted")
                    continue
                }

                // console.log(team1, team2)

                const match_id = match_table[team_to_league_id[team1]][team1][team2][match_table[team_to_league_id[team1]][team1][team2].length-1]
                if (all_match_list[match_id] === undefined || all_match_list[match_id].is_completed) {
                    console.log(`new match - ${team1} vs ${team2}`)
                    let new_match_id = parseInt(Math.random()*1000000)
                    while (new_match_id in all_match_list) {
                        new_match_id = parseInt(Math.random()*1000000)
                    }
                    all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[team_to_league_id[team1]][team1][team2].length, "start_time": parseInt(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"]), "end_time": 9999999999, "team1score": 0, "team2score": 0, "is_completed": false, "is_live": false, "is_bo3": undefined, "total_guess": 0, "number_guesses": 0}
                    match_table[team_to_league_id[team1]][team1][team2].push(new_match_id)
                    match_table[team_to_league_id[team1]][team2][team1].push(new_match_id)

                    curr_live_matches.add(new_match_id)

                    if (parseInt(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"]) > 1643673600) {
                        all_match_list[new_match_id].is_bo3 = 3
                    }
                    else {
                        all_match_list[new_match_id].is_bo3 = 1
                    }
                }
                else {
                    // console.log(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0]._text)
                    if (match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0]._text.indexOf("vs") !== -1) {
                        if (Date().now / 1000 > parseInt(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"]) )
                        all_match_list[match_id].is_live = false
                    }
                    else {
                        console.log(`Live: ${team1} vs ${team2}`)
                        all_match_list[match_id].is_live = true
                        curr_live_matches.add(match_id)
                    }

                    if (parseInt(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"]) > 1643673600) {
                        all_match_list[match_id].is_bo3 = 3
                    }
                    else {
                        all_match_list[match_id].is_bo3 = 1
                    }

                    all_match_list[match_id].start_time = parseInt(match_list.contents[1].contents[1].contents[i].nextElement.contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"])
                }
            }
        }
        resolve(1)
    })
}

async function completed_matches_data() {
    return new Promise(async function(resolve, reject) {
        // console.log("completed")
        const soup = new JSSoup(live_matches_data["*"])
        const match_list = soup.findAll("div", {"class": "matches-list"})[0]

        for (let i = 0; i < match_list.contents[1].contents[3].contents.length; i += 2) {
            // console.log(match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]._text)
            if (match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]._text.indexOf("BLAST Premier") !== -1) {
                let team1 = match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[0].contents[0].contents[0].contents[0].attrs.title
                let team2 = match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[2].contents[0].contents[2].contents[0].attrs.title

                if (team1.indexOf("(") !== -1) {
                    team1 = team1.substring(0, team1.indexOf("(")-1)
                }
                if (team2.indexOf("(") !== -1) {
                    team2 = team2.substring(0, team2.indexOf("(")-1)
                }

                if (team1 === "King of Kings") team1 = "APU King of Kings"
                if (team2 === "King of Kings") team2 = "APU King of Kings"

                // console.log(team1, team2)

                let match_index = -1
                for (let i = 0; i < match_table[team_to_league_id[team1]][team1][team2].length; i++) {
                    if (all_match_list[match_table[team_to_league_id[team1]][team1][team2][i]].is_live) {
                        match_index = i
                        break
                    }
                }

                if (match_index !== -1) {
                    console.log(`${team1} vs ${team2} match complete`)

                    const match_id = match_table[team_to_league_id[team1]][team1][team2][match_index]

                    if (curr_live_matches.has(match_id)) {
                        console.log("just kidding")
                        continue
                    }

                    let team1_win = true

                    all_match_list[match_id].is_live = false
                    all_match_list[match_id].is_completed = true
                    all_match_list[match_id].end_time = Math.floor(Date.now() / 1000)

                    if (match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement._text === undefined) {
                        team1_win = false
                        if (match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text === "W") {
                            all_match_list[match_id].team1score = "FF" // 0
                            all_match_list[match_id].team2score = "W" // 2
                            console.log("forfeited match, skip")
                            continue
                        }
                        else {
                            all_match_list[match_id].team1score = parseInt(match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0]._text)
                            all_match_list[match_id].team2score = parseInt(match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text)
                            if (all_match_list[match_id].team2score === null) {
                                parseInt(match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0]._text)
                                team1_win = true
                            }
                        }
                    }
                    else {
                        if (match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement._text === "W") {
                            all_match_list[match_id].team1score = "W" // 2
                            all_match_list[match_id].team2score = "FF" // 0
                            console.log("forfeited match, skip")
                            continue
                        }
                        else {
                            all_match_list[match_id].team1score = parseInt(match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement._text)

                            const team2text = match_list.contents[1].contents[3].contents[i].nextElement.contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text
                            const team2score = parseInt(team2text.substring(1))
                            all_match_list[match_id].team2score = team2score
                        }

                    }

                    await collection.find().forEach(async function(doc) {
                        const query = {"_id": doc._id}
                        console.log(doc._id)
                        const field = `match_${team_to_id[team1]}_${team_to_id[team2]}_${all_match_list[match_id].index}`

                        const update_doc = { $set : {} }

                        if (doc[field] === undefined) {
                            console.log("prediction missing, skipping...")
                        }
                        else {
                            if (team1_win) {
                                if (parseInt(doc[field]) > 50) {
                                    update_doc.$set.score = parseFloat((doc.score + parseFloat(calc_score(100-doc[field]).toFixed(1))).toFixed(1))
                                    update_doc.$set.incorrect = doc.incorrect+1
                                }
                                else if (parseInt(doc[field]) < 50) {
                                    update_doc.$set.score = parseFloat((doc.score + parseFloat(calc_score(100-doc[field]).toFixed(1))).toFixed(1))
                                    update_doc.$set.correct = doc.correct+1
                                }

                                const result = await collection.updateOne(query, update_doc)
                                console.log("victory doc updated!")
                            }
                            else {
                                if (parseInt(doc[field]) > 50) {
                                    update_doc.$set.score = parseFloat((doc.score + parseFloat(calc_score(doc[field]).toFixed(1))).toFixed(1))
                                    update_doc.$set.correct = doc.correct+1
                                }
                                else if (parseInt(doc[field]) < 50) {
                                    update_doc.$set.score = parseFloat((doc.score + parseFloat(calc_score(doc[field]).toFixed(1))).toFixed(1))
                                    update_doc.$set.incorrect = doc.incorrect+1
                                }

                                const result = await collection.updateOne(query, update_doc)
                                console.log("victory doc updated!")
                            }
                        }
                    })
                }
            }
        }
        resolve(1)
    })
}

async function start_find_live_matches() {
    return new Promise(async function(resolve, reject) {
        console.log("start - ", new Date().toLocaleString("en-US", {timeZone: "America/New_York"}))
        await find_live_matches()
        resolve(1)
    })
}

async function repeated_functions() {
    console.log("repeat - ", new Date().toLocaleString("en-US", {timeZone: "America/New_York"}))
    await find_live_matches()
}

async function check_document_exists(req, res, next) {
    // res.locals.document_exists = false
    if (req.user === undefined) {
        // console.log("not signed in")
        res.locals.user_doc = {}
        next()
    }
    else {
        // console.log(req.user)
        const query = {"_id": req.user._json.steamid}
        const results = await collection.findOne(query)

        // console.log(results)

        res.locals.user_doc = results

        if (results === null) {
            const doc = {"_id": req.user._json.steamid, "display_name": req.user._json.personaname, "steam_url": req.user._json.profileurl, "profile_picture": req.user.photos[2].value, "score": 0.0, "correct": 0, "incorrect": 0}
            const result = await collection.insertOne(doc)

            res.locals.user_doc = doc
            req.user.points = 0

            console.log(`A document was inserted with the _id: ${result.insertedId}`)
            next()
        }
        else {
            req.user.points = results.score

            const query = {"_id": req.user._json.steamid}
            const update_doc = {
                $set : {
                    "display_name": req.user._json.personaname,
                    "profile_picture": req.user.photos[2].value,
                }
            }
            const result = await collection.updateOne(query, update_doc);
            // console.log("name updated!");

            next()
        }
    }
}

async function find_averages(req, res, next) {
    const field_totals = {}
    const field_numbers = {}
    await collection.find().forEach(async function(doc) {
        for (const [key, val] of Object.entries(doc)) {
            if (key !== "_id" && key !== "display_name" && key !== "steam_url" && key !== "score" && key !== "correct" && key !== "profile_picture" && key !== "incorrect") {
                if (!(key in field_totals)) {
                    field_totals[key] = 0
                    field_numbers[key] = 0
                }

                field_totals[key] += val
                field_numbers[key] += 1
            }
        }
    })
    res.locals.average_guess = {}
    for (const [key, val] of Object.entries(field_totals)) {
        res.locals.average_guess[key] = Math.round((val / field_numbers[key]))
    }
    next()
}

function get_complete_matches(req, res, next) {
    res.locals.complete_matches = {}
    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]] = []
    }

    for (const [match_id, val] of Object.entries(all_match_list)) {
        if (val.is_completed || val.is_live) {
            // console.log(`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`)
            // if (res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] !== undefined) {
            //     console.log(val)
            //     console.log(`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`)
            //     console.log(`${val.team1} ${val.team1score} - ${val.team2score} ${val.team2} (avg: ${res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`]}, user: ${res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`]})`)
            // }
            if (val.number_guesses === 0) {
                res.locals.complete_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1score": val.team1score, "team2score": val.team2score, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "end_time": val.end_time, "is_live": val.is_live, "average_guess": undefined, "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "is_bo3": val.is_bo3, "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
            }
            else {
                res.locals.complete_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1score": val.team1score, "team2score": val.team2score, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "end_time": val.end_time, "is_live": val.is_live, "average_guess": Math.round(val.total_guess / val.number_guesses), "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "is_bo3": val.is_bo3, "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
            }
        }
    }

    res.locals.all_complete_matches = []
    for (const [league, val] of Object.entries(res.locals.complete_matches)) {
        for (let i = 0; i < res.locals.complete_matches[league].length; i++) {
            res.locals.all_complete_matches.push(res.locals.complete_matches[league][i])
        }
    }

    res.locals.all_complete_matches.sort(function(a, b){
        if (a.is_live) return -1
        if (b.is_live) return 1
        return a.end_time < b.end_time ? 1 : -1
    })

    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].sort(function(a, b){
            if (a.is_live) return -1
            if (b.is_live) return 1
            return a.end_time < b.end_time ? 1 : -1
        })
    }

    next()
}

function get_upcoming_matches(req, res, next) {
    res.locals.upcoming_matches = {}
    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]] = []
    }

    for (const [match_id, val] of Object.entries(all_match_list)) {
        if (!val.is_completed && !val.is_live) {
            if (val.number_guesses === 0) {
                if (res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] === undefined) {
                    res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "start_time": val.start_time, "average_guess": 50, "your_guess": 50, "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
                }
                else {
                    res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "start_time": val.start_time, "average_guess": 50, "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
                }
            }
            else {
                if (res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] === undefined) {
                    res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "start_time": val.start_time, "average_guess": Math.floor(val.total_guess / val.number_guesses), "your_guess": 50, "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
                }
                else {
                    res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "start_time": val.start_time, "average_guess": Math.floor(val.total_guess / val.number_guesses), "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "league_id": leagueid_to_name[team_to_league_id[val.team1]]})
                }
            }
        }
    }

    res.locals.all_upcoming_matches = []
    for (const [league, val] of Object.entries(res.locals.upcoming_matches)) {
        for (let i = 0; i < res.locals.upcoming_matches[league].length; i++) {
            res.locals.all_upcoming_matches.push(res.locals.upcoming_matches[league][i])
        }
    }

    res.locals.all_upcoming_matches.sort(function(a, b){
        return a.start_time < b.start_time ? -1 : 1
    })
    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]].sort(function(a, b){
            return a.start_time < b.start_time ? -1 : 1
        })
    }
    // console.log(res.locals.upcoming_matches)
    next()
}

async function insert_guess(req, res, next) {
    console.log(req.body)
    const team1 = id_to_team[req.body.team1id]
    const team2 = id_to_team[req.body.team2id]
    const index = req.body.index
    if (req.user === undefined) {
        console.log("can't do that, not logged in")
        next()
    }
    else if (!(team1 in team_to_id && team2 in team_to_id)) {
        console.log("can't do that, not valid team id")
        next()
    }
    else if (match_table[team_to_league_id[team1]][team1][team2].length <= index) {
        console.log("can't do that, not valid index")
        next()
    }
    else {
        const match_id = match_table[team_to_league_id[team1]][team1][team2][index]
        if (all_match_list[match_id].is_live || all_match_list[match_id].is_completed) {
            console.log("can't do that, match completed/live")
            next()
        }
        else if (isNaN(req.body.guess)) {
            console.log("can't do that, guess not a number")
            next()
        }
        else {
            if (req.body.guess < 0 || req.body.guess > 100) {
                console.log("can't do that, guess not a valid number")
                next()
            }
            else {
                const query = {"_id": req.user._json.steamid}

                const results = await collection.findOne(query)

                if (results[`match_${req.body.team1id}_${req.body.team2id}_${index}`] !== undefined) {
                    all_match_list[match_id].total_guess -= results[`match_${req.body.team1id}_${req.body.team2id}_${index}`]
                }
                else {
                    all_match_list[match_id].number_guesses += 1
                }
                all_match_list[match_id].total_guess += parseInt(req.body.guess) // need to test these lines and up

                const update_doc = { $set : {} }

                update_doc.$set[`match_${req.body.team1id}_${req.body.team2id}_${index}`] = parseInt(req.body.guess)

                const result = await collection.updateOne(query, update_doc);
                console.log("document updated!");

                next()
            }
        }
    }
}

function get_matches_prev_day(req, res, next) {
    const threshold = (Date.now() / 1000) - 84000
    res.locals.prev_day_matches = new Set()

    for (const [key, val] of Object.entries(all_match_list)) {
        if (val.end_time > threshold && val.is_completed) {
            res.locals.prev_day_matches.add(key)
        }
    }

    next()
}

async function get_leaderboard(req, res, next) {
    const leaderboard = []
    res.locals.total_users = 0
    await collection.find().forEach(async function(doc) {
        res.locals.total_users += 1
        let day_points = 0
        res.locals.prev_day_matches.forEach(function(key) {
            const doc_id = `match_${team_to_id[all_match_list[key].team1]}_${team_to_id[all_match_list[key].team2]}_${all_match_list[key].index}`
            if (doc[doc_id] !== undefined) {
                if (all_match_list[key].team1score > all_match_list[key].team2score) {
                    day_points += parseFloat(calc_score(100-doc[doc_id]).toFixed(1))
                }
                else {
                    day_points += parseFloat(calc_score(doc[doc_id]).toFixed(1))
                }
            }
        })
        leaderboard.push({"display_name": doc.display_name, "user_id": doc._id, "steam_url": doc.steam_url, "score": doc.score, "correct": doc.correct, "rank": 1, "day_points": day_points})
    })
    leaderboard.sort(function(a, b){
        if (a.score === b.score) {
            return a.correct < b.correct ? 1 : -1
        }
        return a.score < b.score ? 1 : -1
    })
    res.locals.leaderboard = leaderboard

    if (req.user === undefined) {
        for (let i = 1; i < res.locals.leaderboard.length; i++) {
            if (res.locals.leaderboard[i].correct === res.locals.leaderboard[i-1].correct && res.locals.leaderboard[i].score === res.locals.leaderboard[i-1].score) {
                res.locals.leaderboard[i].rank = res.locals.leaderboard[i-1].rank
            }
            else {
                res.locals.leaderboard[i].rank = i+1
            }
        }

        next()
    }
    else {
        if (res.locals.leaderboard[0].user_id === req.user._json.steamid) {
            req.user.user_rank = 1
        }
        for (let i = 1; i < res.locals.leaderboard.length; i++) {
            if (res.locals.leaderboard[i].correct === res.locals.leaderboard[i-1].correct && res.locals.leaderboard[i].score === res.locals.leaderboard[i-1].score) {
                res.locals.leaderboard[i].rank = res.locals.leaderboard[i-1].rank
                if (res.locals.leaderboard[i].user_id === req.user._json.steamid) {
                    req.user.user_rank = res.locals.leaderboard[i].rank
                }
            }
            else {
                res.locals.leaderboard[i].rank = i+1
                if (res.locals.leaderboard[i].user_id === req.user._json.steamid) {
                    req.user.user_rank = res.locals.leaderboard[i].rank
                }
            }
        }

        next()
    }
}

async function get_user_info(req, res, next) {
    if (isNaN(req.params.userID)) {
        res.locals.user_info = undefined
        next()
    }

    const query = {"_id": req.params.userID}
    const results = await collection.findOne(query)

    if (results === null) {
        res.locals.user_info = undefined
        next()
    }
    else {
        const threshold = (Date.now() / 1000) - 84000
        let day_score = 0
        let day_picks = 0
        let day_incorrect = 0

        res.locals.user_info = results

        res.locals.user_info.matches = []

        for (const [key, val] of Object.entries(results)) {
            if (key !== "_id" && key !== "display_name" && key !== "steam_url" && key !== "score" && key !== "correct" && key !== "profile_picture" && key !== "matches" && key !== "incorrect") {
                let underscore_count = 0
                for (let i = 0; i < key.length; i++) {
                    if (key[i] === "_") underscore_count += 1
                }
                if (underscore_count !== 3) continue
                const team1 = id_to_team[parseInt(key.substring(6, key.indexOf("_", 6)))]
                const team2 = id_to_team[parseInt(key.substring(key.indexOf("_", 6)+1, key.indexOf("_", key.indexOf("_", 6)+1)))]
                const index = parseInt(key.substring(key.indexOf("_", key.indexOf("_", 6)+1)+1))

                // console.log(team1, team2, index)
                const match_id = match_table[team_to_league_id[team1]][team1][team2][index]

                // console.log(all_match_list[match_id].end_time, threshold)
                if (all_match_list[match_id].end_time > threshold) {
                    if (all_match_list[match_id].is_completed) {
                        if (all_match_list[match_id].team1score > all_match_list[match_id].team2score) {
                            const points = parseFloat(calc_score(100-val).toFixed(1))
                            day_score += points
                            if (val < 50) {
                                day_picks += 1
                            }
                            else if (val > 50) {
                                day_incorrect += 1
                            }
                        }
                        else {
                            const points = parseFloat(calc_score(val).toFixed(1))
                            day_score += points
                            if (val > 50) {
                                day_picks += 1
                            }
                            else if (val < 50) {
                                day_incorrect += 1
                            }
                        }
                    }
                }

                if ((req.user !== undefined && req.params.userID === req.user._json.steamid) || all_match_list[match_id].is_completed || all_match_list[match_id].is_live) {
                    res.locals.user_info.matches.push({"team1": all_match_list[match_id].team1, "team2": all_match_list[match_id].team2, "team1score": all_match_list[match_id].team1score, "team2score": all_match_list[match_id].team2score, "team1image": team_to_logo[all_match_list[match_id].team1], "team2image": team_to_logo[all_match_list[match_id].team2], "start_time": all_match_list[match_id].start_time, "end_time": all_match_list[match_id].end_time, "is_live": all_match_list[match_id].is_live, "is_completed": all_match_list[match_id].is_completed, "user_guess": val, "is_bo3": all_match_list[match_id].is_bo3})
                }
            }
        }

        res.locals.user_info.matches.sort(function(a, b) {
            if (a.is_live) return -1
            if (b.is_live) return 1
            if (a.end_time === b.end_time) {
                return a.start_time < b.start_time ? -1 : 1
            }
            if (!a.is_completed) return -1
            if (!a.is_completed) return 1
            return a.end_time < b.end_time ? 1 : -1
        })

        res.locals.user_info.day_score = day_score
        res.locals.user_info.day_picks = day_picks
        res.locals.user_info.day_incorrect = day_incorrect

        next()
    }
}

async function get_user_rank(req, res, next) {
    const leaderboard = []
    if (res.locals.user_info === undefined) {
        next()
    }
    else {
        res.locals.total_users = 0
        await collection.find().forEach(async function(doc) {
            res.locals.total_users += 1
            leaderboard.push({"display_name": doc.display_name, "user_id": doc._id, "steam_url": doc.steam_url, "score": doc.score, "correct": doc.correct, "rank": 1})
        })
        leaderboard.sort(function(a, b){
            if (a.score === b.score) {
                return a.correct < b.correct ? 1 : -1
            }
            return a.score < b.score ? 1 : -1
        })
        res.locals.leaderboard = leaderboard
        res.locals.user_info.total_players = leaderboard.length

        if (res.locals.leaderboard[0].user_id === res.locals.user_info._id) {
            res.locals.user_info.rank = 1
        }
        for (let i = 1; i < res.locals.leaderboard.length; i++) {
            if (res.locals.leaderboard[i].correct === res.locals.leaderboard[i-1].correct && res.locals.leaderboard[i].score === res.locals.leaderboard[i-1].score) {
                res.locals.leaderboard[i].rank = res.locals.leaderboard[i-1].rank
                if (res.locals.leaderboard[i].user_id === res.locals.user_info._id) {
                    res.locals.user_info.rank = res.locals.leaderboard[i].rank
                    break
                }
            }
            else {
                res.locals.leaderboard[i].rank = i+1
                if (res.locals.leaderboard[i].user_id === res.locals.user_info._id) {
                    res.locals.user_info.rank = res.locals.leaderboard[i].rank
                    break
                }
            }
        }

        next()
    }
}

app.get('/', [check_document_exists, get_upcoming_matches, get_complete_matches, get_matches_prev_day, get_leaderboard], (req, res) => {
    const recent_upcoming = []
    for (let i = 0; i < res.locals.all_upcoming_matches.length; i++) {
        if (i >= 3) break
        recent_upcoming.push(res.locals.all_upcoming_matches[i])
    }
    const recent_completed = []
    for (let i = 0; i < res.locals.all_complete_matches.length; i++) {
        if (i >= 3) break
        recent_completed.push(res.locals.all_complete_matches[i])
    }
    const top_players = []
    for (let i = 0; i < res.locals.leaderboard.length; i++) {
        if (i >= 5) break
        top_players.push(res.locals.leaderboard[i])
    }
    res.render('index', {user: req.user, "upcoming_matches": recent_upcoming, "recent_completed": recent_completed, "top_players": top_players})
})

app.get('/upcoming_matches', [check_document_exists, get_matches_prev_day, get_upcoming_matches, get_leaderboard], (req, res) => {
    res.render('upcoming_matches_liquepedia', {user: req.user, upcoming_matches: res.locals.upcoming_matches, total_users: res.locals.total_users})
})

app.get('/complete_matches', [check_document_exists, get_matches_prev_day, get_complete_matches, get_leaderboard], (req, res) => {
    res.render('complete_matches_liquepedia', {user: req.user, completed_games: res.locals.complete_matches, total_users: res.locals.total_users})
})

app.get('/leaderboard', [check_document_exists, get_matches_prev_day, get_leaderboard], (req, res) => {
    res.render('leaderboard', {user: req.user, leaderboard: res.locals.leaderboard, total_users: res.locals.total_users})
})

app.get('/user/:userID', [get_user_info, get_user_rank], (req, res) => {
    res.render('user_info_liquepedia', {user: req.user, user_info: res.locals.user_info})
})

app.post('/insert_guess', [insert_guess], (req, res) => {
    res.send()
})

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
})

app.get('/testing', function(req, res) {
    if (req.user !== undefined && (req.user._json.steamid === "76561199063897236" || req.user._json.steamid === "76561198251387562")) {
        res.send(all_match_list)
    }
    else {
        res.send()
    }
})

app.get('/testing2', function(req, res) {
    if (req.user !== undefined && (req.user._json.steamid === "76561199063897236" || req.user._json.steamid === "76561198251387562")) {
        res.send(match_table)
    }
    else {
        res.send()
    }
})

app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), function(req, res) {
    res.redirect('/');
})

app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), function(req, res) {
    res.redirect('/');
})

app.listen(process.env.PORT || 4000, () => console.log("Server is running..."));
