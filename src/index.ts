import { AtpAgent, AtpSessionEvent, AtpSessionData, RichText, AppBskyRichtextFacet, Agent, AppBskyFeedGetTimeline } from '@atproto/api'
import { engine, ExpressHandlebars  } from 'express-handlebars';
import express, { Express, NextFunction, request, response } from 'express';
import { Router, Request, Response } from "express";
import Handlebars from 'handlebars';
import path from 'path';
import session from 'express-session'
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session'
import {fileURLToPath} from 'url';
import { dirname } from 'path';
import multer from 'multer'
import sharp from 'sharp'
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
    maxAge: 128 * 60 * 60 * 1000,
    secure: false
}));


export const agent = new AtpAgent({
    service: 'https://bsky.social',
    
})



app.engine('hbs', engine({
    extname: ".hbs",
    defaultLayout: false,
    handlebars: Handlebars,
    helpers: {
        isEqual: function (value, value2, options){
            return (value == value2) ? options.fn(this) : options.inverse(this);
        },
        isNotEqual: function (value, value2, options){
            return (value != value2) ? options.fn(this) : options.inverse(this);
        },
        containsUser: function(value, value2, options){
            value = Handlebars.escapeExpression(value);
            value2 = Handlebars.escapeExpression(value2);
            return (value2.indexOf(value) > -1) ? options.fn(this) : options.inverse(this);
        }

    }
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

        const notifs = NotifCount.data.count;

        console.log(data.cursor);
        res.render('home', {
            feed: postsArray,
            notifcount: notifs,
            cursor: "",
            limit: val
        });
        

     } catch (XRPCError) {
    
        console.log(XRPCError);
    }
});



app.get('/profile/:user', async (req: Request, res: Response) => {
        const user = req.params['user']
        const mainuser = req.cookies.username;
        console.log(req.params)
        const getProfile = await agent.getProfile({actor: user})

        const MainProf = await agent.did
        const {data} = await agent.getAuthorFeed({actor: user})
        res.render('profile', {
            user: getProfile,
            posts: data.feed,
            mainProfile: MainProf
        })
})


app.get('/profile/:user/:limit', async (req: Request, res: Response) => {
    const {username, password} = req.cookies;
    
    console.log(req.params.limit)

    
    const user = req.params['user']
    console.log(req.params)

    


    if(!username || !password){
        res.redirect('/');
    }
    try {
        const {data} = await agent.getAuthorFeed({actor: user, cursor: req.params.limit.toString()})
        const {actor: user2, cursor: nextPage} = data;
        const getProfile = await agent.getProfile({actor: user})

        // debug: console.log(data.feed);
        res.render('profile', {
            user: getProfile,
            posts: data.feed,
            cursor: nextPage
            
        })


     } catch (XRPCError) {
    
        console.log(XRPCError);
    }
});


app.get('/notifications', async (req: Request, res: Response) => {

    const {data} = await agent.listNotifications();
    
    const {notifications: postsArray2} = data;

    res.render('notifs', {
        notifs: postsArray2
    })
});


app.post('/follow', async (req: Request, res: Response) => {
    let did = req.body.did;
    const { uri } = await agent.follow(did)

    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
});


app.post('/unfollow', async (req: Request, res: Response) => {

    let did = req.body.did;
    const { uri } = await agent.follow(did)

    const data = await agent.deleteFollow(uri)
    console.log(did);
    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
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


app.post('/sendstatusWithImage', upload.single("embed"), express.urlencoded({extended: true}), async (req, res) => {
    console.log(req.body);
    console.log(req.files);
    const rt = new RichText({
      text: req.body.bodytext,
    });
    await rt.detectFacets(agent);

    const {data} = await agent.uploadBlob(req.file.buffer as any, {encoding:'image/png'});
    await agent.post({
      "$type": "app.bsky.feed.post",
      text: rt.text,
      embed: {
        $type:'app.bsky.embed.images',
        images:[{
            image: data.blob,
            alt: req.body.alt
        }]
      },
      facets: rt.facets,
      createdAt: new Date().toISOString()
    })
    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
})

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
    
    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
})

app.post('/like',  async (req: Request, res: Response) => {

    await agent.like(req.body.uri, req.body.cid);

    const user = req.params['user']
    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
});

app.post('/repost',  async (req: Request, res: Response) => {
    await agent.repost(req.body.uri2, req.body.cid2)
    const user = req.params['user']
    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
});


app.post('/reply',  async (req: Request, res: Response) => {

    console.log(req.body);
    console.log(req.files);
    const rt = new RichText({
      text: req.body.bodytext2,
    });
    await rt.detectFacets(agent);

    
    
    await agent.post({
      "$type": "app.bsky.feed.post",
      text: rt.text,
      reply: {
        root: {
            uri: req.body.uri3,
            cid: req.body.cid3,
        },
        parent: {
            uri: req.body.uri3,
            cid: req.body.cid3
        }
      },
      facets: rt.facets,
      createdAt: new Date().toISOString()
      
    })
    

    res.send(`<meta http-equiv="Refresh" content="0; URL=/"/>`);
});


app.listen(port, ip, () => {
    console.log("Listening on", port)
})
