const { MongoClient } = require("mongodb");

const url = process.env.MONGO_DB_URL
const client = new MongoClient(url)

async function run() {
    try {
        await client.connect();
        console.log("Connected correctly to server")

        const database = client.db("picks_db")
        const col = database.collection("users")

        const doc = {"score": 100, "idk": 3}
        const result = await col.insertOne(doc)

        console.log(`A document was inserted with the _id: ${result.insertedId}`);
    } catch (err) {
        console.log(err.stack);
    }
    finally {
        await client.close();
    }
}

run().catch(console.dir);
