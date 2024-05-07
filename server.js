const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const Joi = require('joi');
require('dotenv').config()
var session = require('express-session');


const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;

const expireTime = 24 * 60 * 60 * 1000; //expires after 1 day  (hours * minutes * seconds * millis)


var MongoDBStore = require('connect-mongodb-session')(session);

var store = new MongoDBStore({
    uri: `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.l8u9sij.mongodb.net/?retryWrites=true&w=majority`,
    collection: 'mySessions'
})

const mongoose = require('mongoose');

main().catch(err => console.log(err));

async function main() {
    // await mongoose.connect('mongodb://127.0.0.1:27017/test');
    await mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.l8u9sij.mongodb.net/?retryWrites=true&w=majority`);

    app.listen( process.env.PORT || 3001, () => {
        console.log("Server is running on port 3000");
    });
}


const usersSchema = new mongoose.Schema({
    username: String,
    password: String, 
    type: String
});

const userModel = mongoose.model('w1users', usersSchema)


app.use(session({
    secret: process.env.SECRET_FOR_SESSION_STORE,
    resave: false,
    saveUninitialized: true,
    // cookie: { secure: true }
    store: store,
}));


// Adds a dynamic route for each file name in the public folder
app.use(express.static(__dirname + '/public'));


app.get('/', (req, res) => {
    if(req.session.authenticated == true) {
        res.send(`
        Hello, ${req.session.username}
        <form action='/members' method = 'get'> <button>Go to Members Area</button></form>
        <form action='/logout' method = 'get'> <button>Log out</button></form>
        `)
    }
    else{
        res.send(`
        <form action='/login' method = 'get'> <button>Log In</button></form>
        <form action='/signUp' method = 'get'> <button>Sign up</button></form>
        `)
    }
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    return res.redirect('/');
});

app.get('/signUp', (req, res) => {
    res.send(`
    <form action="/submitUser" method="post">
        Username:
        <input type="text" name="username" />
        <br>
        Email:
        <input type="text" name="email" />
        <br>
        Password:
        <input type="password" name="password" />
        <br>
        <input type="submit" />
    </form>
    `);
});


app.use(express.urlencoded({ extended: true }));
app.post('/submitUser', async (req,res) => {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;

	const schema = Joi.object(
		{
			username: Joi.string().alphanum().max(20).required(),
			password: Joi.string().max(20).required()
		});
	
	const validationResult = schema.validate({username, password});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/signUp");
   }

    var hashedPassword = await bcrypt.hash(password, 10);
	
	result = await userModel.create({username: username, password: hashedPassword, email: email, type: 'non-administrator'});
	console.log("Inserted user");

    req.session.authenticated = true
    req.session.type = result.type
    req.session.username = result.username
    res.redirect('/members');
});



app.get('/login', (req, res) => {
    res.send(`
    <form action="/loggingIn" method="post">
        <input type="text" name="username" />
        <input type="password" name="password" />
        <input type="submit" />
    </form>
    `);
});


async function passwordHasher(plain_text_password, hashed_password){
    hashed_password = await bcrypt.hashSync(plain_text_password, 10)
    console.log(hashed_password);

    const isMatch = await bcrypt.compareSync('123456', hashed_password)
    console.log(isMatch);
}


app.use(express.urlencoded({ extended: true }));
app.post("/loggingIn", async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

	const schema = Joi.string().max(20).required();
	const validationResult = schema.validate(username);
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}

    const result = await userModel.find({username: username})

    console.log(result);
    console.log(req.body.username)
	if (!result) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
	if (passwordHasher(req.body.password, result.password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.username = username;
		req.session.cookie.maxAge = expireTime;

		res.redirect('/members');
		return;
	}
	else {
		console.log("incorrect password");
		res.redirect("/login");
		return;
	}
});



// Add public routed before this line and protected routes after
isUserAuthenticated = ((req, res, next) => {
    if(req.session.authenticated)
        next();
    else
        res.status(401).send('Please Login First');
        res.redirect("/login");
		return;
})

app.use(isUserAuthenticated)


app.get('/members', (req, res) => {
    app.use(express.static("public"))
    var cat = 1
    if (cat == 1) {
        res.send(`
        Hello, ${req.session.username}
        Cat 1: <img src='/cat1.gif' style='width:250px;'>
        <form action='/logout' method = 'get'> <button>Log out</button></form>
        `);
    }
    else if (cat == 2) {
        res.send(`
        Hello, ${req.session.username}
        Cat 2: <img src='/cat2.gif' style='width:250px;'>
        <form action='/logout' method = 'get'> <button>Log out</button></form>
        `);
    }
    else if (cat == 3) {
        res.send(`
        Hello, ${req.session.username}
        Cat 3: <img src='/cat3.gif' style='width:250px;'>
        <form action='/logout' method = 'get'> <button>Log out</button></form>
        `);
    }
    else {
        res.send("Invalid cat id: " + cat);
    }
   
}); 


//Add protected routes before this line and admin routes after
isAdmin = (req, res, next) => {
    if (req.session.type = 'administrator')
        next();
    else
return res.status(401).send('Access Denied')
}

app.use(isAdmin)

app.get('/anotherPotectedRouteForAdminsOnly', (req, res) => {
    return res.send(`Hello, ${req.session.username} Protected Route`);
});

app.get('*', (req, res) => {
    res.status(404).send('404 Page Not Found');
});
