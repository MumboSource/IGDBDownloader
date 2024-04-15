const { existsSync, readdirSync, writeFileSync, appendFileSync, mkdirSync } = require("fs")
const fetch = require("node-fetch");
const  { setTimeout } = require('timers/promises');
const _chalk = import("chalk").then(m=>m.default);

require('dotenv').config()
let process_arguments = process.argv;

process_arguments.shift();
process_arguments.shift();

if(process_arguments.length != 1) {
    throw new Error("Improper Argument Length\nUsage: node . <folder/file>");
}

const location = __dirname + "/" + process_arguments[0];
let files = [];

if(location.endsWith(".json") && existsSync(location)) {
    files.push(require(location))
} else {
    if(!existsSync(location)) {
        throw new Error(`${location} could not be found or is not a valid directory/file`);
    }

    for(const file of readdirSync(location)) {
        if(file.endsWith(".json")) {
            const data  = require(location + "/" + file);

            if(!data || !data.title) {
                throw new Error(`Data format in ${file} in improper`)
            }

            files.push(data)
        }
    }
}

// Get Twitch Auth
(async()=>{
    const {red, green} = await _chalk;
    const auth_res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=client_credentials`, {
        method: "POST"
    });

    const {access_token, expires_in, token_type} = await auth_res.json();

    console.log(access_token, expires_in, token_type);

    //fields *; where id = 1942;

    if(!existsSync("output")){
        mkdirSync("output")
    }


    for(const id in files){
        const game = files[id];

        const slug = game.title.toLowerCase()
            .normalize("NFD").replace(/\p{Diacritic}/gu, "")
            .replaceAll(" ", "-")
            .replaceAll("&", "and")
            .replaceAll(/[\.\'\,]/g, "")
            .replaceAll(/[^A-Za-z0-9-]/g, "-")
            .replaceAll(/-+/g, "-")
            .replaceAll(/^-|-$/g, "");

        if(existsSync(__dirname + "/output/" + game.slug + ".json") || existsSync(__dirname + "/output/FAILED_" + game.slug + ".json")){
            continue
        }

        const response = await fetch(`https://api.igdb.com/v4/games/`, {
            method: "POST",
            headers: {
                "Client-ID": process.env.CLIENT_ID,
                "Authorization": `Bearer ${access_token}`
            },
            body: `fields *; where slug = "${slug}";`
        })

        const json = await response.json();

        if(json[0] && json[0].id) {
            console.log(green(`[${id}/${files.length}] Located data for ${game.title} ( ${slug} )`))
            writeFileSync(__dirname + "/output/" + game.slug + ".json", JSON.stringify(json[0]));
        }else {
            console.log(red(`[${id}/${files.length}] Failed to locate data for ${game.title} ( ${slug} )`))
            writeFileSync(__dirname + "/output/FAILED_" + game.slug + ".json", JSON.stringify(json));
        }

        await setTimeout(.4 * 1000)
    }
})()