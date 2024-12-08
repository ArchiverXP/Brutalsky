import { AtpAgent, AtpSessionEvent, AtpSessionData, RichText, AppBskyRichtextFacet, Agent, AppBskyFeedGetTimeline } from '@atproto/api'
import { engine } from 'express-handlebars';
import express, { Express, NextFunction, request, response } from 'express';
import { Router, Request, Response } from "express";

import path from 'path';
import session from 'express-session'
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session'
import {fileURLToPath} from 'url';
import { dirname } from 'path';
//import multer from 'multer'
//import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises';
import { Blob } from 'buffer';
let savedSessionData: AtpSessionData;
const port = 3020;
const ip = "0.0.0.0";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app: Express = express();


app.use(cookieParser());

app.use(cookieSession({
    name: 'session',
    keys: ['FUN', "YOU"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false
}));


export const agent = new AtpAgent({
    service: 'https://bsky.social',
    
})


app.engine('hbs', engine({
    extname: ".hbs",
    defaultLayout: false,
    helpers: {
        isEqual: function (value, value2, options){
            return (value == value2) ? options.fn(this) : options.inverse(this);
        }
    }
}));


//const storage = multer.memoryStorage()
//const upload = multer({ storage: storage })
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




//for old web browsers: ie: dsi web browser
app.post('/post', async(req: Request, res: Response, next: NextFunction) =>{
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

        res.cookie("username", username);
        res.cookie("password", password);

        res.redirect("/home");
    } catch (error) {
        console.log(error);
        res.status(400).send("Oops, Authorization failed! (400)");
    }
})


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



async function getThread(uri){
    const {data} = await agent.getPostThread({uri: uri})
}



app.get("/home", express.urlencoded({ extended: true }), async (req, res) => {

    const {username, password} = req.cookies;

    let val = 20;
    if(!username || !password){
        res.redirect('/');
    }
    try {
        

        const {data} = await agent.getTimeline({limit: 20, cursor: ""});

        const { feed: postsArray, cursor: nextPage, limit: val} = data;

        const NotifCount = await agent.countUnreadNotifications();

        console.log(data.cursor);
        res.render('home', {
            feed: postsArray,
            notifcount: NotifCount.data.count,
            cursor: "",
            limit: val
        });
        

     } catch (XRPCError) {
    
        console.log(XRPCError);
    }
});



app.get('/profile/:user', async (req: Request, res: Response) => {
        const user = req.params['user']
        console.log(req.params)
        const getProfile = await agent.getProfile({actor: user})
        const {data} = await agent.getAuthorFeed({actor: user})
        
        res.render('profile', {
            user: getProfile,
            posts: data.feed
        })
})


app.get('/notifications', async (req: Request, res: Response) => {

    const {data} = await agent.listNotifications();
    
    const {notifications: postsArray2} = data;

    res.render('notifs', {
        notifs: postsArray2
    })
});



app.get('/page/:limit', async (req: Request, res: Response) => {
    const {username, password} = req.cookies;
    
    console.log(req.params.limit)

    
    

    if(!username || !password){
        res.redirect('/');
    }
    try {
        const {data} = await agent.getTimeline({limit: 20, cursor: req.params.limit.toString()});
        const { feed: postsArray, cursor: nextPage} = data;

        // debug: console.log(data.feed);
        res.render('home', {
            feed: postsArray,
            cursor: nextPage,
        });


     } catch (XRPCError) {
    
        console.log(XRPCError);
    }
});


let file2uh = "a";


app.post('/sendstatus', express.urlencoded({extended: true}), async (req, res) => {
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
    
    res.redirect('/home')
})

app.post('/like',  async (req: Request, res: Response) => {

    await agent.like(req.body.uri, req.body.cid);

    res.redirect('/home')
});

app.post('/repost',  async (req: Request, res: Response) => {
    await agent.repost(req.body.uri2, req.body.cid2)

    res.redirect('/home')   
});



app.listen(port, ip, () => {
    console.log("Listening on", port)
})
