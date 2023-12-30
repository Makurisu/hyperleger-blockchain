'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const express = require('express')
const hbs = require('express-handlebars')
const multer = require('multer');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const session = require('express-session');

const fsPromiss = require('fs').promises;

const cookieParser = require("cookie-parser");

const app = express()

const port = 3000;

app.engine(
    "hbs",
    hbs.engine({
        defaultLayout: "main",
        extname: '.hbs',
        helpers: {
            eq: function (a, b) {
                return a === b;
            }
        }       
    })
);

app.set("view engine", "hbs");

app.use(express.static(__dirname + "/public"));

const upload = multer({
    storage: multer.memoryStorage()
});

app.use(express.json());

// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;
//session middleware
app.use(session({
    secret: "hung",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
}));

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'AppUser3';

const create = require("ipfs-http-client")
const fs = require('fs');

async function ipfsClient() {
    const ipfs = await create({ host: 'localhost', port: '5001', protocol: 'http' });
    return ipfs
}

function prettyJSONString(inputString) {
    return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function imgHash(image) {
    let ipfs = await ipfsClient();
    let result = await ipfs.add(image);
    return result.path
}

var contract;


async function isLogin(req, res, next) {
    if (req.session.user) {
        const user = req.session.user;
        const folderPath = 'wallet';
        const fileName = user.email;
        const fullPath = `${folderPath}/${fileName}.id`;

        try {
            const data = fs.readFileSync(fullPath, 'utf8');
            const jsonData = JSON.parse(data);
            const cleanedPrivateKey = jsonData.credentials.privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
                .replace(/\r\n/g, '')
                .replace('-----END PRIVATE KEY-----', '');

            const pass = user.secrectKey;

            if (pass === cleanedPrivateKey.toString()) {
                return next();
            } else {
                return res.redirect('/login');
            }
        } catch (err) {
            console.error(err);
            return res.redirect('/login');
        }
    } else {
        return res.redirect('/login');
    }
}



app.use(async (req, res, next) => {
    try {

        const ccp = buildCCPOrg1();

        const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

        const wallet = await buildWallet(Wallets, walletPath);

        await enrollAdmin(caClient, wallet, mspOrg1);

        // await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'appuser@gmail.com', 'org1.department1');

        const gateway = new Gateway();
        const user = req.session?.user;
        try {
            await gateway.connect(ccp, {
                wallet,
                // identity: req.session.user.username,
                identity: 'admin',
                discovery: { enabled: true, asLocalhost: true },
            });

            const network = await gateway.getNetwork(channelName);

            contract = network.getContract(chaincodeName);

            // await contract.submitTransaction('InitLedger');

        }
        catch (error) {
            console.log(`*** Successfully caught the error: \n    ${error}`);
        }
    } catch (error) {
        console.error(`******** FAILED to run the application: ${error}`);
        process.exit(1);
    }
    next()
});



app.get('/', isLogin, async (req, res) => {
    const user = req.session?.user;
    return res.render('home', { user: user });
});

app.get('/get-all-assets', async (req, res) => {
    let result = await contract.evaluateTransaction('GetAllAssets');
    let json = {
        'draw': 1,
        'iTotalRecords': 4,
        'iTotalDisplayRecords': 4,
        'aaData': JSON.parse(result.toString())
    };
    return res.json(json);
});

app.post('/edit', upload.single('image'), async (req, res) => {
    const id = req.body.id;
    const carCompany = req.body.carCompany;
    const type = req.body.type;
    const Owner = req.body.owner;
    let fileHash = req.body.imageHash;
    if (req.file) {
        const file = req.file.buffer;
        fileHash = await imgHash(file);
    }
    const result1 = await contract.addDiscoveryInterest({ name: 'basic' })
    const result = await contract.createTransaction('UpdateAsset');
    await result.submit(id, carCompany, type, Owner, fileHash);
    return res.redirect('/');
});

app.get('/mycar', isLogin, async (req, res) => {
    const user = req.session?.user;
    let { id } = req.params;
    id = { id: id };
    const dirname = 'wallet/';
    const arrUsers = await readFilesAsync(dirname);
    return res.render('mycar', {
        locals: {
            fs: fs
        },
        user: user,
        arrUsers: arrUsers
    });
});

app.get('/detailmycar', isLogin, async (req, res) => {
    const user = req.session?.user;
    let result = await contract.evaluateTransaction('ReadAssetByOwner', user.email);
    let json = {
        'draw': 1,
        'iTotalRecords': 4,
        'iTotalDisplayRecords': 4,
        'aaData': JSON.parse(result.toString())
    };
    return res.json(json);
});

app.get('/history/:id', isLogin, async (req, res) => {
    const user = req.session.user;
    let { id } = req.params;
    return res.render('history', { id: id, user: user })
});

app.get('/detail/:id', isLogin, async (req, res) => {
    const id = req.params.id
    let result = await contract.evaluateTransaction('GetLogs');
    let logs = JSON.parse(result)
    let filtered = logs.filter(asset => {
        return asset.ID === id;
    });

    let json = {
        'draw': 1,
        'iTotalRecords': 1,
        'iTotalDisplayRecords': 1,
        'aaData': filtered
    };
    return res.json(json);
});

async function readFilesAsync(dir) {
    try {
        const files = await fsPromiss.readdir(dir);
        const users = files.filter(filename => filename != 'admin.id')
                            .map(filename => filename.split('.').slice(0, -1).join('.'));
        return users;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

app.get('/create', isLogin, async (req, res) => {
    const user = req.session.user;
    return res.render('create', { user: user });
});

app.post('/create', upload.single('image'), async (req, res) => {
    const id = req.body.id;
    const carCompany = req.body.carCompany;
    const type = req.body.type;
    const Owner = req.session.user.email;
    const file = req.file.buffer;
    const fileHash = await imgHash(file);
    const result = await contract.createTransaction('CreateAsset');
    await result.submit(id, carCompany, type, Owner, fileHash);
    return res.redirect('/mycar');
});

app.get('/register', async (req, res) => {
    res.render('register', { user: null });
});

app.post('/register', async (req, res) => {
    const email = req.body.email;

    const ccp = buildCCPOrg1();
    const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
    const wallet = await buildWallet(Wallets, walletPath);

    let privateKey = await registerAndEnrollUser(caClient, wallet, mspOrg1, email, 'org1.department1');
    privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
        .replace(/\r\n/g, '')
        .replace('-----END PRIVATE KEY-----', '')
    req.session.user = {
        email: email,
        secrectKey: privateKey
    };

    console.log(privateKey)
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: 'khanghuynh.tga@gmail.com',
            pass: 'ncvs ximj cawy stmv'
        }
    });
    
    let mailOptions = {
        from: 'Carchain@gmail.com',
        to: email,
        subject: 'YOUR SECRECT KEY',
        html: `Your secrect key: 
                <br><b>${privateKey}</b>`
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error.message);
        }
        console.log('success');
    });

    return res.redirect('/login');
});

app.get('/login', async (req, res) => {
    const user = req.session?.user;
    res.render('login', { user: user });
});

app.post('/login', async (req, res) => {
    const email = req.body.email;
    const pass = req.body.pass

    const folderPath = 'wallet';
    const fileName = email;
    const fullPath = `${folderPath}/${fileName}.id`;

    fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.redirect('/login');
        }
        const jsonData = JSON.parse(data)
        const cleanedPrivateKey = jsonData.credentials.privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
            .replace(/\r\n/g, '')
            .replace('-----END PRIVATE KEY-----', '')
        if (pass == cleanedPrivateKey.toString()) {
            req.session.user = {
                email: email,
                secrectKey: pass
            };
            return res.redirect('/');
        }
        else {
            return res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    return res.redirect('/login');
})

app.listen(port, () =>
    console.log(
        `Express started on http://localhost:${port};  ` +
        "press Ctrl-C to terminate. "
    )
);
