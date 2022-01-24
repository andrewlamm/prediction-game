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
const { object } = require('webidl-conversions')
app.use(bodyParser.urlencoded({
  extended: true
}));

const valid_team_id = new Set()

const url = process.env.MONGO_DB_URL
const client = new MongoClient(url)

let database = undefined
let collection = undefined

async function connect_to_db() {
    return new Promise(async function(resolve, reject) {
        try {
            await client.connect();
            console.log("Connected correctly to server")

            database = client.db("picks_db")
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

hbs.registerHelper('check_win', function(score, bo3) {
    if (score === "W") return true
    if (score === Math.floor(bo3 / 2)+1) {
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
    if (score === 50 || team1score === "W" || team2score === "W") {
        return `<span class="font-semibold">0.0</span>`
    }
    if (team1score === Math.floor(bo3/2)+1) {
        if (score < 50) {
            return `<span class="text-green-700 font-semibold">+${calc_score(100-score).toFixed(1)}</span>`
        }
        else {
            return `<span class="text-red-700 font-semibold">${calc_score(100-score).toFixed(1)}</span>`
        }
    }
    else if (team2score === Math.floor(bo3/2)+1) {
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
    if (score > 50 && team2score === Math.floor(is_bo3 / 2)+1) return true
    else if (score < 50 && team1score === Math.floor(is_bo3 / 2)+1) return true
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

let parsed_data = {}

const regions = ["Western_Europe", "China", "North_America", "Southeast_Asia", "Eastern_Europe", "South_America"]
const divisions = ["Division_I", "Division_II"]

function retrieve_data(region, division) {
    return new Promise(async function(resolve, reject) {
        const options = {
            hostname: 'liquipedia.net',
            port: 443,
            path: `/dota2/api.php?action=parse&format=json&page=Dota_Pro_Circuit/2021-22/1/${region}/${division}`,
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

const LEAGUE_IDS = [13738, 13716, 13741, 13747, 13709, 13712, 13740, 13717, 13742, 13748, 13710, 13713]
// WEU, CN, NA, SEA, EEU, SA
const leagueid_to_name = {13738: "Western Europe Division I", 13716: "China Division I", 13741: "North America Division I", 13747: "Southeast Asia Division I", 13709: "Eastern Europe Division I", 13712: "South America Division I", 13740: "Western Europe Division II", 13717: "China Division II", 13742: "North America Division II", 13748: "Southeast Asia Division II", 13710: "Eastern Europe Division II", 13713: "South America Division II"}
const team_to_logo = {}
const match_table = {}
const all_match_list = {}
const dota_match_id_to_match = {}
const team_to_league_id = {}
const team_to_id = {}
const id_to_team = {}
let curr_id = 0

async function find_teams() {
    return new Promise(async function(resolve, reject) {
        for (let divisions_j = 0; divisions_j < divisions.length; divisions_j++) {
            for (let region_i = 0; region_i < regions.length; region_i++) {
                console.log(regions[region_i], divisions[divisions_j])

                await new Promise(resolve => setTimeout(resolve, 30000))

                await retrieve_data(regions[region_i], divisions[divisions_j])

                const soup = new JSSoup(parsed_data["*"])
                const team_list = soup.findAll("div", {"class": "teamcard"})
                const logo_list = soup.findAll("span", "logo-darkmode")

                match_table[LEAGUE_IDS[divisions_j*6+region_i]] = {}

                for (let i = 0; i < team_list.length; i++) {
                    let team1 = `${team_list[i].contents[0].contents[0].attrs.title}`
                    if (team1.indexOf("(") !== -1) {
                        team1 = team1.substring(0, team1.indexOf("(")-1)
                    }

                    match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1] = {}

                    team_to_id[team1] = curr_id
                    id_to_team[curr_id] = team1

                    curr_id += 1

                    for (let j = 0; j < team_list.length; j++) {
                        if (i === j) continue
                        let team2 = `${team_list[j].contents[0].contents[0].attrs.title}`
                        if (team2.indexOf("(") !== -1) {
                            team2 = team2.substring(0, team2.indexOf("(")-1)
                        }
                        match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2] = []
                    }
                    team_to_league_id[team1] = LEAGUE_IDS[divisions_j*6+region_i]
                    // team_to_logo[team1] = `https://liquipedia.net${logo_list[i].contents[0].contents[0].contents[0].attrs.src}`
                }

                const match_list = soup.findAll("tr", {"class": "match-row"})

                for (let i = 0; i < match_list.length; i++) {
                    if (match_list[i].contents[1].contents[0]._text !== "-") {
                        // console.log(match_table[LEAGUE_IDS[divisions_j*6+region_i]])

                        let team1 = match_list[i].contents[1].contents[0].nextElement.contents[0].contents[0].contents[0].contents[0].contents[0].contents[0].attrs.title
                        let team2 = match_list[i].contents[1].contents[0].nextElement.contents[0].contents[0].contents[1].contents[0].contents[2].contents[0].attrs.title

                        if (team1.indexOf("(") !== -1) {
                            team1 = team1.substring(0, team1.indexOf("(")-1)
                        }
                        if (team2.indexOf("(") !== -1) {
                            team2 = team2.substring(0, team2.indexOf("(")-1)
                        }

                        if (team1 === "Team Unique") team1 = "Mind Games"
                        if (team2 === "Team Unique") team2 = "Mind Games"

                        // console.log(team1, team2)

                        if (match_list[i].contents[1].contents[0]._text === "FF" || match_list[i].contents[2].contents[0]._text === "FF") {
                            end_time = -1

                            let new_match_id = parseInt(Math.random()*1000000)
                            while (new_match_id in all_match_list) {
                                new_match_id = parseInt(Math.random()*1000000)
                            }
                            if (match_list[i].contents[1].contents[0]._text === "FF") {
                                // all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": end_time, "team1score": 0, "team2score": 2, "is_completed": true, "is_live": false, "is_bo3": 3}
                                all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": end_time, "team1score": "FF", "team2score": "W", "is_completed": true, "is_live": false, "is_bo3": 3}
                            }
                            else {
                                // all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": end_time, "team1score": 2, "team2score": 0, "is_completed": true, "is_live": false, "is_bo3": 3}
                                all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": end_time, "team1score": "W", "team2score": "FF", "is_completed": true, "is_live": false, "is_bo3": 3}
                            }
                            match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].push(new_match_id)
                            match_table[LEAGUE_IDS[divisions_j*6+region_i]][team2][team1].push(new_match_id)
                        }
                        else {
                            if (match_list[i].contents[1].attrs.style === "font-weight:bold" || match_list[i].contents[2].attrs.style === "font-weight:bold") {
                                const matches_num = match_list[i].contents[1].contents[0].nextElement.contents[0].contents.length
                                const links_num = match_list[i].contents[1].contents[0].nextElement.contents[0].contents[matches_num-1].contents.length
                                const title_string = match_list[i].contents[1].contents[0].nextElement.contents[0].contents[matches_num-1].contents[links_num-2].attrs.title
                                const last_match_id = title_string.substring(title_string.indexOf(":")+2)

                                let new_match_id = parseInt(Math.random()*1000000)
                                while (new_match_id in all_match_list) {
                                    new_match_id = parseInt(Math.random()*1000000)
                                }
                                dota_match_id_to_match[last_match_id] = new_match_id

                                if (parseInt(match_list[i].contents[1].contents[0]._text) === 2 || parseInt(match_list[i].contents[2].contents[0]._text) === 2) {
                                    all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": -1, "team1score": parseInt(match_list[i].contents[1].contents[0]._text), "team2score": parseInt(match_list[i].contents[2].contents[0]._text), "is_completed": true, "is_live": false, "is_bo3": 3}
                                }
                                else {
                                    all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": -1, "team1score": parseInt(match_list[i].contents[1].contents[0]._text), "team2score": parseInt(match_list[i].contents[2].contents[0]._text), "is_completed": true, "is_live": false, "is_bo3": 1}
                                }
                                match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].push(new_match_id)
                                match_table[LEAGUE_IDS[divisions_j*6+region_i]][team2][team1].push(new_match_id)
                            }
                            else {
                                let new_match_id = parseInt(Math.random()*1000000)
                                while (new_match_id in all_match_list) {
                                    new_match_id = parseInt(Math.random()*1000000)
                                }
                                all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": -1, "team1score": 0, "team2score": 0, "is_completed": false, "is_live": true, "is_bo3": undefined}
                                match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].push(new_match_id)
                                match_table[LEAGUE_IDS[divisions_j*6+region_i]][team2][team1].push(new_match_id)
                            }
                        }
                    }
                }

                for (const [team1, val] of Object.entries(match_table[LEAGUE_IDS[divisions_j*6+region_i]])) {
                    for (const [team2, val2] of Object.entries(val)) {
                        if (match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length === 0) {
                            let new_match_id = parseInt(Math.random()*1000000)
                            while (new_match_id in all_match_list) {
                                new_match_id = parseInt(Math.random()*1000000)
                            }
                            all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].length, "start_time": undefined, "end_time": -1, "team1score": 0, "team2score": 0, "is_completed": false, "is_live": false, "is_bo3": 3}
                            match_table[LEAGUE_IDS[divisions_j*6+region_i]][team1][team2].push(new_match_id)
                            match_table[LEAGUE_IDS[divisions_j*6+region_i]][team2][team1].push(new_match_id)
                        }
                    }
                }
            }
        }
        resolve(1)
    })
}

async function loop_leagues() {
    return new Promise(async function(resolve, reject) {
        for (let i = 0; i < LEAGUE_IDS.length; i++) {
            console.log(LEAGUE_IDS[i])
            await get_team_logos(LEAGUE_IDS[i])
            await get_match_scores(LEAGUE_IDS[i])
        }
        resolve(1)
    })
}

async function get_team_logos(id) {
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/leagues/${id}/teams`).then(
            function(response) {
                var parsed = response.data

                for (let i = 0; i < parsed.length; i++) {
                    if (parsed[i].team_id === 8261500) { //because xtreme gaming is cringe
                        parsed[i].name = "Xtreme Gaming"
                    }

                    if (parsed[i].name === "Tundra Esports ") parsed[i].name = "Tundra Esports"
                    if (parsed[i].name === "INVICTUS GAMING") parsed[i].name = "Invictus Gaming"
                    if (parsed[i].name === "phoenix gaming") parsed[i].name = "Phoenix Gaming"
                    if (parsed[i].name === "Undying") parsed[i].name = "Team Undying"
                    if (parsed[i].name === "Lava BestPc") parsed[i].name = "Lava"
                    if (parsed[i].name === "beastcoast") parsed[i].name = "Beastcoast"
                    if (parsed[i].name === "Noping VPN") parsed[i].name = "NoPing e-sports"
                    if (parsed[i].name === "Infamous U.esports.") parsed[i].name = "Infamous"
                    if (parsed[i].name === "Ybb gaming") parsed[i].name = "Ybb Gaming"
                    if (parsed[i].name === "CDEC ") parsed[i].name = "CDEC Gaming"
                    if (parsed[i].name === "SHENZHEN") parsed[i].name = "ShenZhen"
                    if (parsed[i].name === "Team Magma") parsed[i].name = "Team MagMa"
                    if (parsed[i].name === "felt") parsed[i].name = "Felt"
                    if (parsed[i].name === "DogChamp") parsed[i].name = "Team DogChamp"
                    if (parsed[i].name === "Talon") parsed[i].name = "Talon Esports"
                    if (parsed[i].name === "Spawn.496") parsed[i].name = "SPAWN.496"
                    if (parsed[i].name === "Balrogs e-Sport") parsed[i].name = "Balrogs"
                    if (parsed[i].name === "OB.Neon") parsed[i].name = "Neon Esports"
                    if (parsed[i].name === "Lilgun ") parsed[i].name = "Lilgun"
                    if (parsed[i].name === "Our Way") parsed[i].name = "Wolf Team"


                    // console.log(parsed[i].name)
                    if (parsed[i].name in team_to_id) {
                        // console.log("pog")
                        team_to_logo[parsed[i].name] = parsed[i].logo_url
                    }
                    // else {
                    //     console.log(`"${parsed[i].name}"`)
                    // }
                }
                resolve(1)
            }, (error) => {
                reject(error)
            }
        )
    })
}

async function get_match_scores(id) {
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/leagues/${id}/matches`).then(
            function(response) {
                var parsed = response.data

                for (let i = 0; i < parsed.length; i++) {
                    if (parsed[i].match_id in dota_match_id_to_match) {
                        all_match_list[dota_match_id_to_match[parsed[i].match_id]].end_time = parsed[i].start_time + parsed[i].duration
                    }
                }

                resolve(1)
            }, (error) => {
                reject(error)
            }
        )
    })
}

async function start() {
    await connect_to_db()
    await find_teams()
    await loop_leagues()
    // console.log("complete, waiting 30 seconds")
    // await new Promise(resolve => setTimeout(resolve, 30000))
    // for (let i = 0; i < LEAGUE_IDS.length; i++)
    //     console.log(match_table[LEAGUE_IDS[i]])
    // console.log(team_to_id)
    repeated_functions()
    const repeated_timer = setInterval(repeated_functions, 60000) // 120000
}

start()

let live_matches_data = new Set()

async function find_live_matches() {
    live_matches_data.clear()
    await get_matches_data()
    await get_live_matches()
    await completed_matches_data()
}

async function get_matches_data() {
    return new Promise(function(resolve, reject) {
        const options = {
            hostname: 'liquipedia.net',
            port: 443,
            path: '/dota2/api.php?action=parse&format=json&page=Liquipedia:Upcoming_and_ongoing_matches',
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

        for (let i = 0; i < match_list.contents[1].contents[1].contents.length; i++) {
            if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].attrs.style === "background-color:#ffffcc;" && match_list.contents[1].contents[1].contents[i].contents[0].contents[1].contents[0].contents[1].contents[1].contents[0].contents[0]._text.indexOf("DPC") !== -1) { // remember to add check for (page does not exist)
                let team1 = match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[0].contents[0].contents[0].contents[0].attrs.title
                if (team1.indexOf("(") !== -1) {
                    team1 = team1.substring(0, team1.indexOf("(")-1)
                }
                let team2 = match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[2].contents[0].contents[2].contents[0].attrs.title
                if (team2.indexOf("(") !== -1) {
                    team2 = team2.substring(0, team2.indexOf("(")-1)
                }

                if (team1 === "King of Kings") team1 = "APU King of Kings"
                if (team2 === "King of Kings") team2 = "APU King of Kings"

                if (team1 === "TBD" || team2 === "TBD") continue

                // console.log(team1, team2)

                const match_id = match_table[team_to_league_id[team1]][team1][team2][match_table[team_to_league_id[team1]][team1][team2].length-1]
                if (all_match_list[match_id].is_completed) {
                    console.log(`new match - ${team1} vs ${team2}`)
                    let new_match_id = parseInt(Math.random()*1000000)
                    while (new_match_id in all_match_list) {
                        new_match_id = parseInt(Math.random()*1000000)
                    }
                    all_match_list[new_match_id] = {"team1": team1, "team2": team2, "index": match_table[team_to_league_id[team1]][team1][team2].length, "start_time": match_list.contents[1].contents[1].contents[i].contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"], "end_time": 9999999999, "team1score": 0, "team2score": 0, "is_completed": false, "is_live": false, "is_bo3": undefined}
                    match_table[team_to_league_id[team1]][team1][team2].push(new_match_id)
                    match_table[team_to_league_id[team1]][team2][team1].push(new_match_id)

                    live_matches_data.add(new_match_id)

                    if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[1].contents[1].contents[1].contents[0]._text === "Bo3") {
                        all_match_list[new_match_id].is_bo3 = 3
                    }
                    else if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[1].contents[1].contents[1].contents[0]._text === "Bo5") {
                        all_match_list[new_match_id].is_bo3 = 5
                    }
                    else {
                        all_match_list[new_match_id].is_bo3 = 1
                    }
                }
                else {
                    if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[1].contents[0].contents[0]._text === "vs") {
                        all_match_list[match_id].is_live = false
                    }
                    else {
                        console.log(`Live: ${team1} vs ${team2}`)
                        all_match_list[match_id].is_live = true
                    }

                    if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[1].contents[1].contents[1].contents[0]._text === "Bo3") {
                        all_match_list[match_id].is_bo3 = 3
                    }
                    else if (match_list.contents[1].contents[1].contents[i].contents[0].contents[0].contents[1].contents[1].contents[1].contents[0]._text === "Bo5") {
                        all_match_list[match_id].is_bo3 = 5
                    }
                    else {
                        all_match_list[match_id].is_bo3 = 1
                    }
                    all_match_list[match_id].start_time = match_list.contents[1].contents[1].contents[i].contents[0].contents[1].contents[0].contents[0].contents[0].attrs["data-timestamp"]
                    live_matches_data.add(match_id)
                }
            }
        }
        resolve(1)
    })
}

async function completed_matches_data(game_id) {
    return new Promise(async function(resolve, reject) {
        // console.log("completed")
        const soup = new JSSoup(live_matches_data["*"])
        const match_list = soup.findAll("div", {"class": "matches-list"})[0]

        for (let i = 0; i < match_list.contents[1].contents[2].contents.length; i++) {
            if (match_list.contents[1].contents[2].contents[i].contents[0].contents[1].contents[0].contents[1].contents[1].contents[0].contents[0]._text.indexOf("DPC") !== -1) {
                let team1 = match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[0].contents[0].contents[0].contents[0].attrs.title
                let team2 = match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[2].contents[0].contents[2].contents[0].attrs.title

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

                    if (live_matches_data.has(match_id)) {
                        console.log("just kidding")
                        continue
                    }

                    let team1_win = true

                    all_match_list[match_id].is_live = false
                    all_match_list[match_id].is_completed = true
                    all_match_list[match_id].end_time = Math.floor(Date.now() / 1000)

                    if (match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement._text === undefined) {
                        team1_win = false
                        if (match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text === "W") {
                            all_match_list[match_id].team1score = "FF" // 0
                            all_match_list[match_id].team2score = "W" // 2
                            console.log("forfeited match, skip")
                            continue
                        }
                        else {
                            all_match_list[match_id].team1score = parseInt(match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0]._text.substring(0, 1))
                            all_match_list[match_id].team2score = parseInt(match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text)
                        }
                    }
                    else {
                        if (match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement._text === "W") {
                            all_match_list[match_id].team1score = "W" // 2
                            all_match_list[match_id].team2score = "FF" // 0
                            console.log("forfeited match, skip")
                            continue
                        }
                        else {
                            all_match_list[match_id].team1score = parseInt(match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement._text)

                            const team2text = match_list.contents[1].contents[2].contents[i].contents[0].contents[0].contents[1].contents[0].nextElement.nextElement._text
                            const team2score = parseInt(team2text.substring(1, 2))
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

function repeated_functions() {
    console.log("repeat - ", new Date().toLocaleString("en-US", {timeZone: "America/New_York"}))
    find_live_matches()
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
            console.log("name updated!");

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
            res.locals.complete_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1score": val.team1score, "team2score": val.team2score, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "end_time": val.end_time, "is_live": val.is_live, "average_guess": res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "is_bo3": val.is_bo3})
        }
    }

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
            if (res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] === undefined) {
                res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] = 50
            }

            if (res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`] === undefined) {
                res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "average_guess": res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "your_guess": 50})
            }
            else {
                res.locals.upcoming_matches[leagueid_to_name[team_to_league_id[val.team1]]].push({"team1": val.team1, "team2": val.team2, "team1id": team_to_id[val.team1], "team2id": team_to_id[val.team2], "index": val.index, "match_id": match_id, "team1image": team_to_logo[val.team1], "team2image": team_to_logo[val.team2], "average_guess": res.locals.average_guess[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`], "your_guess": res.locals.user_doc[`match_${team_to_id[val.team1]}_${team_to_id[val.team2]}_${val.index}`]})
            }
        }
    }

    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]].sort(function(a, b){
            return a.start_time < b.start_time ? 1 : -1
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
                const update_doc = { $set : {} }

                update_doc.$set[`match_${req.body.team1id}_${req.body.team2id}_${index}`] = parseInt(req.body.guess)

                const result = await collection.updateOne(query, update_doc);
                console.log("document updated!");

                next()
            }
        }
    }
}

async function get_leaderboard(req, res, next) {
    const leaderboard = []
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

                if (all_match_list[match_id].is_completed || all_match_list[match_id].is_live) {
                    res.locals.user_info.matches.push({"team1": all_match_list[match_id].team1, "team2": all_match_list[match_id].team2, "team1score": all_match_list[match_id].team1score, "team2score": all_match_list[match_id].team2score, "team1image": team_to_logo[all_match_list[match_id].team1], "team2image": team_to_logo[all_match_list[match_id].team2], "end_time": all_match_list[match_id].end_time, "is_live": all_match_list[match_id].is_live, "user_guess": val, "is_bo3": all_match_list[match_id].is_bo3})
                }
            }
        }


        res.locals.user_info.matches.sort(function(a, b) {
            if (a.is_live) return -1
            if (b.is_live) return 1
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

app.get('/', [check_document_exists], (req, res) => {
    res.render('index', {user: req.user})
})

app.get('/upcoming_matches', [check_document_exists, find_averages, get_upcoming_matches, get_leaderboard], (req, res) => {
    res.render('upcoming_matches_liquepedia', {user: req.user, upcoming_matches: res.locals.upcoming_matches, total_users: res.locals.total_users})
})

app.get('/complete_matches', [check_document_exists, find_averages, get_complete_matches, get_leaderboard], (req, res) => {
    res.render('complete_matches_liquepedia', {user: req.user, completed_games: res.locals.complete_matches, total_users: res.locals.total_users})
})

app.get('/leaderboard', [check_document_exists, get_leaderboard], (req, res) => {
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

app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), function(req, res) {
    res.redirect('/');
})

app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), function(req, res) {
    res.redirect('/');
})

app.listen(process.env.PORT || 4000, () => console.log("Server is running..."));