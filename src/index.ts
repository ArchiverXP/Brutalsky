import { AtpAgent, AtpSessionEvent, AtpSessionData, RichText, AppBskyRichtextFacet, Agent } from '@atproto/api'
import { engine } from 'express-handlebars';
import express, { Express } from 'express';
import { Router, Request, Response } from "express";
import path from 'path';
import {fileURLToPath} from 'url';
import { dirname } from 'path';
import multer from 'multer'
import sharp from 'sharp'
const port = 3020;
const ip = "0.0.0.0";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const app: Express = express();
export const agent = new AtpAgent({
    service: process.env.BSKY_SERVICE || "https://bsky.social",
  });
  
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

app.get("/", (req: Request, res: Response) => {
    res.render('main');
    
});


app.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        await agent.login({
            identifier: username,
            password: password
        });
        res.redirect("/home");
    } catch (error) {
        console.log(error);
        res.status(400).send("Oops, Authorization failed! (400)");
    }
})




app.get("/home", express.urlencoded({ extended: true }), async (req, res) => {

    const {data} = await agent.getTimeline({limit: 15});
    const { feed: postsArray, cursor: nextPage } = data;
    try {
        res.render('home', {
            feed: postsArray,
            cursor: nextPage
        });
     } catch (error) {
        res.status(400).send("Oops, Authorization failed! (400)");
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
    const compressImage = sharp(req.file?.buffer).jpeg({quality: 50})
    const {data} = await agent.uploadBlob(compressImage as any, {encoding:'image/png'});
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
    res.redirect("/home")
})

app.listen(port, ip, () => {
    console.log("Listening on", port)
})
