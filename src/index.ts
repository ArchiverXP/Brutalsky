import { AtpAgent, AtpSessionEvent, AtpSessionData, RichText, AppBskyRichtextFacet, Agent } from '@atproto/api'
import { engine } from 'express-handlebars';
import express, { Express, request, response } from 'express';
import { Router, Request, Response } from "express";

import path from 'path';
import session from 'express-session'
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session'
import {fileURLToPath} from 'url';
import { dirname } from 'path';
import multer from 'multer'
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises';
let savedSessionData: AtpSessionData;
const port = 3020;
const ip = "0.0.0.0";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app: Express = express();


app.use(cookieParser());

app.use(cookieSession({
    name: 'session',
    keys: ['FUCK', "YOU"],
    secure: false
}));


export const agent = new AtpAgent({
    service: 'https://bsky.social',
    
})


app.engine('hbs', engine({
    extname: ".hbs",
    defaultLayout: false,
}));


const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
app.use(express.json());

app.use(express.urlencoded({ extended: true }));





app.set('view engine', 'hbs');

app.use(express.static(path.join(__dirname, '/public')));

console.log(__dirname);
console.log(__filename);

app.get("/", async (req: Request, res: Response) => {
    const { username, password } = req.cookies
    if(username || password){
        await agent.login({
            identifier: username,
            password: password
        });
        res.redirect('/home')
    }
    else{
        console.log("no");
        res.render('main')
    }
    

    
});




app.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if(agent.session){
        console.log("Already logged in! :D");
    }
    console.log("WOKE");

    const sesh = req.cookies;

    try {
        
        await agent.login({
            identifier: username,
            password: password
        });

        res.cookie("username", username, { httpOnly: true });
        res.cookie("password", password, { httpOnly: true });

        res.redirect("/home");
    } catch (error) {
        console.log(error);
        res.status(400).send("Oops, Authorization failed! (400)");
    }
})




app.get("/home", express.urlencoded({ extended: true }), async (req, res) => {

    const {username, password} = req.cookies;


    if(!username || !password){
        res.redirect('/');
    }
    try {
        const {data} = await agent.getTimeline({limit: 20});
        const { feed: postsArray, cursor: nextPage } = data;
        res.render('home', {
            feed: postsArray,
            cursor: nextPage
        });
     } catch (XRPCError) {
    
        console.log(XRPCError);
    }
});


app.post("/home", express.urlencoded({ extended: true }), async (req, res) => {

    const {data} = await agent.getTimeline({limit: 15});

    try {

     } catch (error) {
        res.status(400).send("Oops, Authorization failed! (400)");
    }
});

let file2uh = "a";

app.post('/sendstatus', upload.single("embed"), express.urlencoded({extended: true}), async (req, res) => {
    console.log(req.body);
    console.log(req.files);
    const rt = new RichText({
        text: req.body.bodytext,
      });


    await rt.detectFacets(agent);

     await agent.post({
          "$type": "app.bsky.feed.post",
           text: rt.text,
            facets: rt.facets,
            createdAt: new Date().toISOString()
     })
    

    res.redirect("/home")
})



app.listen(port, ip, () => {
    console.log("Listening on", port)
})
