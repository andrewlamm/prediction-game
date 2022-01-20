const express = require('express')
const app = express()
const axios = require('axios')
const cors = require('cors')
let hbs = require('hbs')
const passport = require('passport')
const session = require('express-session')
const SteamStrategy = require('passport-steam').Strategy
const { MongoClient } = require('mongodb');
const port = 4000

app.use(cors())

app.set('trust proxy', 1)

require('dotenv').config()

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

app.use(session({ //fix
    secret: 'your secret',
    name: 'name of session id',
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

hbs.registerHelper('find_left', function(score) {
    return score-50
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

const valid_games = new Set()

async function get_match_scores(id) {
    valid_games.clear()
    return new Promise(function(resolve, reject) {
        axios.get(`https://datdota.com/api/leagues/${id}`).then(
            async function(response) {
                var parsed = response.data
                var games = parsed.data.recentGames

                for (let i = 0; i < games.length; i++) {
                    valid_games.add(games[i].match_id)
                }

                console.log(valid_games)
                await get_match_scores_opendota(id)

                resolve(1)
            }, (error) => {
                reject(error)
            }
        )
    })
}

function get_match_scores_opendota(id) {
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/leagues/${id}/matches`).then(
            function(response) {
                var parsed = response.data

                for (let i = 0; i < parsed.length; i++) {
                    if (!valid_games.has(parsed[i].match_id)) {

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

                resolve(1)
            }, (error) => {
                reject(error)
            }
        )
    })
}

async function start() {
    // await connect_to_db()
    await loop_leagues()
    repeated_functions()
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
    return new Promise(function(resolve, reject) {
        axios.get(`https://api.opendota.com/api/matches/${game_id}`).then(
            function(response) {
                var parsed = response.data
                if (parsed.error === undefined) {
                    const team1 = parsed.radiant_team_id
                    const team2 = parsed.dire_team_id

                    if (parsed.radiant_win) {
                        match_table[parsed.league.leagueid][team1][team2] += 1
                    }
                    else {
                        match_table[parsed.league.leagueid][team2][team1] += 1
                    }

                    to_be_removed.add(game_id)

                    // ADD VICTORY CHECKS HERE

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
    console.log("repeat")
    console.log(current_live)
    find_live_matches()
    check_live_games()
}
const repeated_timer = setInterval(repeated_functions, 120000) // 120000

async function check_document_exists(req, res, next) {
    // res.locals.document_exists = false
    if (req.user === undefined) {
        console.log("not signed in")
        next()
    }
    else {
        console.log(req.user._json)
        const query = {"_id": req.user._json.steamid}
        const results = await collection.findOne(query)

        console.log(results)

        res.locals.user_doc = results // fix

        if (results === null) {
            const doc = {"_id": req.user._json.steamid, "display_name": "asdf", "steam_url": "awesome", "score": 0, "correct": 0}
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
    const cursor = await collection.find()

    await cursor.forEach(console.dir)
}

function get_doc_data(req, res, next) {
    if (req.user === undefined) {
        console.log("not signed in")
        next()
    }
    else {

    }
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
                    res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1score": match_table[LEAGUE_IDS[i]][team1][team2], "team2score": match_table[LEAGUE_IDS[i]][team2][team1], "team1image": team_to_img[team1], "team2image": team_to_img[team2], "match_id": match_id_table[LEAGUE_IDS[i]][team1][team2], "is_live": false})
                }
                else {
                    res.locals.complete_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1score": match_table[LEAGUE_IDS[i]][team1][team2], "team2score": match_table[LEAGUE_IDS[i]][team2][team1], "team1image": team_to_img[team1], "team2image": team_to_img[team2], "match_id": 9999999999, "is_live": true})
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
                    res.locals.upcoming_matches[leagueid_to_name[LEAGUE_IDS[i]]].push({"team1": id_to_team[team1], "team2": id_to_team[team2], "team1id": team1, "team2id": team2, "team1image": team_to_img[team1], "team2image": team_to_img[team2], "average_guess": parseInt(Math.random()*100), "your_guess": parseInt(Math.random()*100)})
                }
            }
        }
    }
    // console.log(res.locals.upcoming_matches)
    next()
}

app.get('/', (req, res) => {
    res.render('index', {user: req.user})
})

app.get('/upcoming_matches', [check_document_exists, get_upcoming_matches], (req, res) => {
    res.render('upcoming_matches', {user: req.user, upcoming_matches: res.locals.upcoming_matches})
})

app.get('/complete_matches', [check_document_exists, get_complete_matches], (req, res) => {
    res.render('complete_matches', {user: req.user, completed_games: res.locals.complete_matches})
})

app.get('/leaderboard', (req, res) => {
    res.render('leaderboard', {user: req.user})
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

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})
