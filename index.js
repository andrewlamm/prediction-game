const express = require('express')
const app = express()
const axios = require('axios')
const cors = require('cors')
let hbs = require('hbs')
const passport = require('passport')
const session = require('cookie-session')
const SteamStrategy = require('passport-steam').Strategy
const { MongoClient } = require('mongodb');
const port = 4000

app.use(cors())

app.set('trust proxy', 1)

require('dotenv').config()

let bodyParser = require('body-parser')
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
        returnURL: 'http://localhost:4000/auth/steam/return',
        realm: 'http://localhost:4000/',
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
    if (score === 2) return true
    return false
})

hbs.registerHelper('display_average', function(score) {
    if (score > 50) return score
    return 100-score
})

function calc_score(score) {
    return 25 - (Math.pow(score - 100, 2) / 100)
}

hbs.registerHelper('display_score', function(score, team1score, team2score) {
    if (score === 50) {
        return `<span class="font-semibold">0.0</span>`
    }
    if (team1score === 2) {
        if (score < 50) {
            return `<span class="text-green-700 font-semibold">+${calc_score(100-score).toFixed(1)}</span>`
        }
        else {
            return `<span class="text-red-700 font-semibold">${calc_score(100-score).toFixed(1)}</span>`
        }
    }
    else if (team2score === 2) {
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

hbs.registerHelper('find_left', function(score) {
    return score-50
})

hbs.registerHelper('round_tenth', function(s) {
    return s.toFixed(1)
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

const LEAGUE_IDS = [13738, 13716, 13741, 13747, 13709, 13712, 13740, 13717, 13742, 13748, 13710, 13713]
// WEU, CN, NA, SEA, EEU, SA
const leagueid_to_name = {13738: "Western Europe Division I", 13716: "China Division I", 13741: "North America Division I", 13747: "Southeast Asia Division I", 13709: "Eastern Europe Division I", 13712: "South America Division I", 13740: "Western Europe Division II", 13717: "China Division II", 13742: "North America Division II", 13748: "Southeast Asia Division II", 13710: "Eastern Europe Division II", 13713: "South America Division II"}
const match_table = {}
const team_to_img = {}
const id_to_team = {}
const team_to_id = {}
const valid_teams = new Set()
const match_id_table = {}

// WEU Div2
valid_teams.add(8261397)
valid_teams.add(8343488)
valid_teams.add(8344760)
valid_teams.add(8390848)
valid_teams.add(8598715)
valid_teams.add(8112124)
valid_teams.add(8597391)
valid_teams.add(8605863)

// NA Div2
valid_teams.add(8205424)
valid_teams.add(8230115)
valid_teams.add(8262639)
valid_teams.add(8607159)
valid_teams.add(8604954)
valid_teams.add(8581426)
valid_teams.add(8606828)
valid_teams.add(8261882)

async function loop_leagues() {
    return new Promise(async function(resolve, reject) {
        for (let i = 0; i < LEAGUE_IDS.length; i++) {
            console.log(LEAGUE_IDS[i])
            await get_league_teams(LEAGUE_IDS[i])
            await get_match_scores(LEAGUE_IDS[i])
        }
        // console.log(match_table)
        resolve(1)
    })
}

async function get_league_teams(id) {
    match_table[id] = {}
    match_id_table[id] = {}
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/leagues/${id}/teams`).then(
            function(response) {
                var parsed = response.data

                for (let i = 0; i < parsed.length; i++) {
                    if (id === 13740 || id === 13742) {
                        if (!valid_teams.has(parsed[i].team_id)) {
                            continue
                        }
                    }
                    if (parsed[i].team_id === 8261500) { //because xtreme gaming is cringe
                        parsed[i].name = "Xtreme Gaming"
                    }

                    valid_team_id.add(parsed[i].team_id)

                    id_to_team[parsed[i].team_id] = parsed[i].name
                    team_to_id[parsed[i].name] = parsed[i].team_id
                    match_table[id][parsed[i].team_id] = {}
                    match_id_table[id][parsed[i].team_id] = {}
                    for (let j = 0; j < parsed.length; j++) {
                        if (id === 13740 || id === 13742) {
                            if (!valid_teams.has(parsed[j].team_id)) {
                                continue
                            }
                        }
                        if (i !== j) {
                            match_table[id][parsed[i].team_id][parsed[j].team_id] = -1
                            match_id_table[id][parsed[i].team_id][parsed[j].team_id] = -1
                        }
                    }

                    team_to_img[parsed[i].team_id] = parsed[i].logo_url
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
                    if (id === 13740 || id === 13742) {
                        if (!valid_teams.has(parsed[i].radiant_team_id) || !valid_teams.has(parsed[i].dire_team_id)) {
                            continue
                        }
                    }

                    if ((match_table[id][parsed[i].radiant_team_id][parsed[i].dire_team_id] === 2 && parsed[i].radiant_win) || (match_table[id][parsed[i].dire_team_id][parsed[i].radiant_team_id] === 2 && !parsed[i].radiant_win)) { // ignore tiebreaks
                        continue
                    }

                    match_id_table[id][parsed[i].radiant_team_id][parsed[i].dire_team_id] = parsed[i].match_id
                    match_id_table[id][parsed[i].dire_team_id][parsed[i].radiant_team_id] = parsed[i].match_id
                    if (match_table[id][parsed[i].radiant_team_id][parsed[i].dire_team_id] === -1) {
                        match_table[id][parsed[i].radiant_team_id][parsed[i].dire_team_id] = 0
                        match_table[id][parsed[i].dire_team_id][parsed[i].radiant_team_id] = 0
                    }

                    if (parsed[i].radiant_win) {
                        match_table[id][parsed[i].radiant_team_id][parsed[i].dire_team_id] += 1
                    }
                    else {
                        match_table[id][parsed[i].dire_team_id][parsed[i].radiant_team_id] += 1
                    }
                }

                //HARD CODE MISTAKES
                if (id === 13712) {
                    match_table[id][7391077][7119077] = 2 // TP vs Lava
                    match_table[id][7119077][7298091] = 2 // Lava vs Noping
                }
                else if (id === 13709) {
                    match_table[id][7422789][8255888] = 2 // Unique (Mind Games) forfeit game 1 vs HellRaisers
                }
                else if (id === 13716) {
                    match_table[id][6209804][5] = 2 // RNG 2-1 iG
                }
                else if (id === 13740) {
                    match_table[id][8390848][8597391] = 2 // CF 2-0 CHILLAX
                    match_table[id][8605863][8112124] = 1 // Entity 1-2 Brame
                    match_table[id][8261397][8598715] = 0 // NoBountyHunter FF-W Into the Breach
                    match_table[id][8597391][8261397] = 2 // CHILLAX W-FF NoBountyHunter
                    match_table[id][8261397][8597391] = 0  // NoBountyHunter FF-W CHILLAX
                    match_table[id][8112124][8261397] = 2 // Brame W-FF NoBountyHunter
                    match_table[id][8261397][8112124] = 0  // NoBountyHunter FF-W Brame
                    match_table[id][8390848][8261397] = 2 // Chicken Fighters W-FF NoBountyHunter
                    match_table[id][8261397][8390848] = 0  // NoBountyHunter FF-W Chicken Fighters
                    match_table[id][8605863][8261397] = 2 // Entity W-FF NoBountyHunter
                    match_table[id][8261397][8605863] = 0  // NoBountyHunter FF-W Entity
                }
                else if (id === 13717) {
                    match_table[id][1520578][7356881] = 0 // CDEC FF-W SHENZHEN
                    match_table[id][7356881][1520578] = 2 // SHENZHEN w-FF CDEC
                }
                else if (id === 13713) {
                    match_table[id][1061269][6767209] = 2 // Our Way (Wolf Team) 2 - 1 Inverse
                    match_table[id][6767209][1061269] = 1 // Inverse 1 - 2 Our Way
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
    await loop_leagues()
    repeated_functions()
    const repeated_timer = setInterval(repeated_functions, 120000) // 120000
}

start()

const current_live = new Set()
const to_be_removed = new Set()

async function find_live_matches() {
    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        await find_live_matches_league(LEAGUE_IDS[i])
    }
}

async function find_live_matches_league(id) {
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.steampowered.com/IDOTA2Match_570/GetLiveLeagueGames/v1/?key=${process.env.STEAM_KEY}&league_id=${id}`).then(
            function(response) {
                var parsed = response.data.result.games

                for (let i = 0; i < parsed.length; i++) {
                    const team1 = parsed[i].radiant_team.team_id
                    const team2 = parsed[i].dire_team.team_id

                    current_live.add(parsed[i].match_id)

                    if (match_table[id][team1][team2] === -1) {
                        match_table[id][team1][team2] = 0
                        match_table[id][team2][team1] = 0
                    }
                }
                resolve(1)
            }, (error) => {
                reject(error)
            }
        )
    })
}

async function check_live_games() {
    to_be_removed.clear()
    for (const game_id of current_live) {
        await check_live_game_id(game_id)
    }
    for (const game_id of to_be_removed) {
        current_live.delete(game_id)
    }
}

async function check_live_game_id(game_id) {
    return new Promise(async function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/matches/${game_id}`).then(
            async function(response) {
                var parsed = response.data
                if (parsed.error === undefined) {
                    const team1 = parsed.radiant_team_id
                    const team2 = parsed.dire_team_id

                    console.log(`${game_id} game done!`)
                    // console.log(parsed)

                    if (match_table[parsed.league.leagueid][team1][team2] === 2 || match_table[parsed.league.leagueid][team2][team1] === 2) { // tiebreak game

                    }
                    else {
                        if (parsed.radiant_win) {
                            match_table[parsed.league.leagueid][team1][team2] += 1
                        }
                        else {
                            match_table[parsed.league.leagueid][team2][team1] += 1
                        }

                        to_be_removed.add(game_id)

                        if (match_table[parsed.league.leagueid][team1][team2] === 2 || match_table[parsed.league.leagueid][team2][team1] === 2) {
                            console.log("match complete")
                            await collection.find().forEach(async function(doc) { // check again
                                const query = {"_id": doc._id}
                                if (team1 > team2) { //'5' > '15', '15' is team2, '5' is team 1
                                    const field = `match_${team2}_${team1}`

                                    const update_doc = { $set : {} }

                                    if (match_table[parsed.league.leagueid][team1][team2] === 2) {
                                        if (parseInt(doc[field]) < 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(doc[field]) * 10) / 10
                                        }
                                        else if (parseInt(doc[field]) > 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(doc[field]) * 10) / 10
                                            update_doc.$set.correct = doc.correct+1
                                        }

                                        const result = await collection.updateOne(query, update_doc)
                                        console.log("victory doc updated!")
                                    }
                                    else {
                                        if (parseInt(doc[field]) < 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(100-doc[field]) * 10) / 10
                                            update_doc.$set.correct = doc.correct+1
                                        }
                                        else if (parseInt(doc[field]) > 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(100-doc[field]) * 10) / 10
                                        }

                                        const result = await collection.updateOne(query, update_doc)
                                        console.log("victory doc updated!")
                                    }
                                }
                                else { // '15' is team1, '5' is team 2
                                    const field = `match_${team1}_${team2}`

                                    const update_doc = { $set : {} }

                                    if (match_table[parsed.league.leagueid][team1][team2] === 2) {
                                        if (parseInt(doc[field]) < 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(100-doc[field]) * 10) / 10
                                            update_doc.$set.correct = doc.correct+1
                                        }
                                        else if (parseInt(doc[field]) > 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(100-doc[field]) * 10) / 10
                                        }

                                        const result = await collection.updateOne(query, update_doc)
                                        console.log("victory doc updated!")
                                    }
                                    else {
                                        if (parseInt(doc[field]) < 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(doc[field]) * 10) / 10
                                        }
                                        else if (parseInt(doc[field]) > 50) {
                                            update_doc.$set.score = doc.score + Math.round(calc_score(doc[field]) * 10) / 10
                                            update_doc.$set.correct = doc.correct+1
                                        }

                                        const result = await collection.updateOne(query, update_doc)
                                        console.log("victory doc updated!")
                                    }
                                }
                            })
                        }
                    }
                    resolve(1)
                }
                else {
                    resolve(1)
                }
            }, (error) => {
                resolve(error)
            }
        )
    })
}

function repeated_functions() {
    console.log("repeat - ", new Date().toString())
    console.log(current_live)
    find_live_matches()
    check_live_games()
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
            const doc = {"_id": req.user._json.steamid, "display_name": req.user._json.personaname, "steam_url": req.user._json.profileurl, "score": 0.0, "correct": 0}
            const result = await collection.insertOne(doc)

            res.locals.user_doc = doc

            console.log(`A document was inserted with the _id: ${result.insertedId}`)
            next()
        }
        else {
            next()
        }
    }
}

async function find_averages(req, res, next) {
    const field_totals = {}
    const field_numbers = {}
    await collection.find().forEach(async function(doc) {
        for (const [key, val] of Object.entries(doc)) {
            if (key !== "_id" && key !== "display_name" && key !== "steam_url" && key !== "score" && key !== "correct") {
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
        for (const [team1, val] of Object.entries(match_table[LEAGUE_IDS[i]])) {
            for (const [team2, score] of Object.entries(val)) {
                if (team2 < team1) continue
                if (match_table[LEAGUE_IDS[i]][team1][team2] === -1) continue

                if (match_table[LEAGUE_IDS[i]][team1][team2] === 2 || match_table[LEAGUE_IDS[i]][team2][team1] === 2) {
                    res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1score": match_table[LEAGUE_IDS[i]][team1][team2], "team2score": match_table[LEAGUE_IDS[i]][team2][team1], "team1image": team_to_img[team1], "team2image": team_to_img[team2], "match_id": match_id_table[LEAGUE_IDS[i]][team1][team2], "is_live": false, "average_guess": res.locals.average_guess[`match_${team1}_${team2}`], "your_guess": res.locals.user_doc[`match_${team1}_${team2}`]})
                }
                else {
                    res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1score": match_table[LEAGUE_IDS[i]][team1][team2], "team2score": match_table[LEAGUE_IDS[i]][team2][team1], "team1image": team_to_img[team1], "team2image": team_to_img[team2], "match_id": 9999999999, "is_live": true, "average_guess": res.locals.average_guess[`match_${team1}_${team2}`], "your_guess": res.locals.user_doc[`match_${team1}_${team2}`]})
                }
            }
        }

        res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].sort(function(a, b) {
            return a.match_id < b.match_id ? 1 : -1
        })
    }
    next()
}

function get_upcoming_matches(req, res, next) {
    res.locals.upcoming_matches = {}
    for (let i = 0; i < LEAGUE_IDS.length; i++) {
        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]] = []
        for (const [team1, val] of Object.entries(match_table[LEAGUE_IDS[i]])) {
            for (const [team2, score] of Object.entries(val)) {
                if (team2 < team1) continue
                if (match_table[LEAGUE_IDS[i]][team1][team2] === -1) {
                    if (res.locals.average_guess[`match_${team1}_${team2}`] === undefined) {
                        res.locals.average_guess[`match_${team1}_${team2}`] = 50
                    }

                    if (res.locals.user_doc[`match_${team1}_${team2}`] === undefined) {
                        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1id": team1, "team2id": team2, "team1image": team_to_img[team1], "team2image": team_to_img[team2], "average_guess": res.locals.average_guess[`match_${team1}_${team2}`], "your_guess": 50})
                    }
                    else {
                        res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1id": team1, "team2id": team2, "team1image": team_to_img[team1], "team2image": team_to_img[team2], "average_guess": res.locals.average_guess[`match_${team1}_${team2}`], "your_guess": res.locals.user_doc[`match_${team1}_${team2}`]})
                    }
                }
            }
        }
    }
    // console.log(res.locals.upcoming_matches)
    next()
}

async function insert_guess(req, res, next) {
    console.log(req.body)
    if (req.user === undefined) {
        console.log("can't do that, not logged in")
        next()
    }
    else if (isNaN(req.body.team1id) || isNaN(req.body.team2id)) {
        console.log("can't do that, team not a number")
        next()
    }
    else if (!valid_team_id.has(parseInt(req.body.team1id)) || !valid_team_id.has(parseInt(req.body.team2id))) {
        console.log("can't do that, not valid team")
        next()
    }
    else {
        if (req.body.team2id > req.body.team1id) {
            if (isNaN(req.body.guess)) {
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

                    update_doc.$set[`match_${req.body.team1id}_${req.body.team2id}`] = parseInt(req.body.guess)

                    const result = await collection.updateOne(query, update_doc);
                    console.log("document updated!");

                    next()
                }
            }
        }
        else {
            console.log("can't do that, invalid format")
        }
    }
}

async function get_leaderboard(req, res, next) {
    const leaderboard = []
    await collection.find().forEach(async function(doc) {
        leaderboard.push({"display_name": doc.display_name, "user_id": doc._id, "steam_url": doc.steam_url, "score": doc.score, "correct": doc.correct, "rank": 1})
    })
    leaderboard.sort(function(a, b){
        if (a.score === b.score) {
            return a.correct < b.correct ? 1 : -1
        }
        return a.score < b.score ? 1 : -1
    })
    res.locals.leaderboard = leaderboard

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

app.get('/', (req, res) => {
    res.render('index', {user: req.user})
})

app.get('/upcoming_matches', [check_document_exists, find_averages, get_upcoming_matches], (req, res) => {
    res.render('upcoming_matches', {user: req.user, upcoming_matches: res.locals.upcoming_matches})
})

app.get('/complete_matches', [check_document_exists, find_averages, get_complete_matches], (req, res) => {
    res.render('complete_matches', {user: req.user, completed_games: res.locals.complete_matches})
})

app.get('/leaderboard', [check_document_exists, get_leaderboard], (req, res) => {
    res.render('leaderboard', {user: req.user, leaderboard: res.locals.leaderboard})
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
